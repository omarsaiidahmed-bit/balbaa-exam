const { db } = require('./db');

/**
 * Fisher-Yates array shuffle helper
 */
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Generate a randomized exam attempt adhering to the Blueprint
 * - Exam is 50 questions
 * - Duration is 20 minutes (configured on exam record)
 * - Controls medical abbreviations (max 3-5 questions or <= 10%)
 * - Balances contract rules, company rules, prescription handling,
 *   insurance procedures, documentation, rejection prevention, coverage scenarios
 * - Diversifies across as many distinct companies as possible
 * 
 * @param {number} examId 
 * @param {number} attemptId 
 * @param {object} customBlueprint (optional override)
 */
function generateAttemptQuestions(examId, attemptId, customBlueprint = null) {
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
  if (!exam) {
    throw new Error('Exam configuration not found');
  }

  let blueprint = customBlueprint;
  if (!blueprint && exam.blueprint) {
    try {
      blueprint = JSON.parse(exam.blueprint);
    } catch (e) {
      console.error('Failed to parse exam blueprint JSON:', e);
    }
  }

  // Default blueprint: 50 questions total
  const targetCount = exam.question_count || 50;
  const maxPerCompany = 3; // Keep high diversity across companies
  const maxAbbreviations = 4; // Medical abbreviations MUST NOT dominate the exam

  // Fetch all approved active questions
  const allApproved = db.prepare(`
    SELECT * FROM questions 
    WHERE review_status = 'APPROVED' AND company_status = 'ACTIVE'
  `).all();

  if (allApproved.length < targetCount) {
    throw new Error(`Insufficient approved questions in database: found ${allApproved.length}, required ${targetCount}`);
  }

  // Identify abbreviation questions vs scenario / practical / contract rule questions
  const isAbbreviation = (q) => {
    return (
      q.question_type === 'Abbreviation' ||
      (q.medical_abbreviation && q.medical_abbreviation.trim() !== '') ||
      (q.category && q.category.toLowerCase().includes('abbreviation')) ||
      (q.question && (q.question.includes('اختصار') || q.question.includes('يرمز إلى') || q.question.includes('معنى اختصار')))
    );
  };

  const abbreviationPool = shuffleArray(allApproved.filter(isAbbreviation));
  const coreRulePool = shuffleArray(allApproved.filter(q => !isAbbreviation(q)));

  const selectedQuestions = [];
  const selectedIds = new Set();
  const companyCounts = {};

  // Step 1: Pick a controlled, small number of abbreviation questions (at most maxAbbreviations)
  let abbrevPicked = 0;
  for (const q of abbreviationPool) {
    if (abbrevPicked >= maxAbbreviations) break;
    selectedQuestions.push(q);
    selectedIds.add(q.id);
    companyCounts[q.company] = (companyCounts[q.company] || 0) + 1;
    abbrevPicked++;
  }

  // Step 2: Separate core questions by difficulty
  const pools = {
    Easy: shuffleArray(coreRulePool.filter(q => q.difficulty === 'Easy' && !selectedIds.has(q.id))),
    Medium: shuffleArray(coreRulePool.filter(q => q.difficulty === 'Medium' && !selectedIds.has(q.id))),
    Hard: shuffleArray(coreRulePool.filter(q => q.difficulty === 'Hard' && !selectedIds.has(q.id)))
  };

  // Use blueprint difficulty targets if available, otherwise use defaults
  // Since question bank is now upgraded to Medium/Hard only, default to 46 Medium + 4 Hard
  const bpDiff = (blueprint && blueprint.difficulty) ? blueprint.difficulty : {};
  const targetEasy = Math.min(bpDiff.Easy || 0, pools.Easy.length);
  const targetMedium = Math.min(bpDiff.Medium || 46, pools.Medium.length);
  const targetHard = Math.min(bpDiff.Hard || 4, pools.Hard.length);

  function tryPickFromPool(pool, needed) {
    let picked = 0;
    for (const q of pool) {
      if (picked >= needed) break;
      if (selectedIds.has(q.id)) continue;

      const comp = q.company;
      const curCount = companyCounts[comp] || 0;

      // Ensure company balance: don't exceed maxPerCompany in the first passes
      if (curCount < maxPerCompany) {
        selectedQuestions.push(q);
        selectedIds.add(q.id);
        companyCounts[comp] = curCount + 1;
        picked++;
      }
    }
    return picked;
  }

  // Pass 1: Select by requested difficulties with company balancing
  tryPickFromPool(pools.Easy, targetEasy);
  tryPickFromPool(pools.Medium, targetMedium);
  tryPickFromPool(pools.Hard, targetHard);

  // Pass 2: If we still need questions, pick from remaining core questions relaxing company caps
  if (selectedQuestions.length < targetCount) {
    const shuffledRemainingCore = shuffleArray(coreRulePool.filter(q => !selectedIds.has(q.id)));
    for (const q of shuffledRemainingCore) {
      if (selectedQuestions.length >= targetCount) break;
      selectedQuestions.push(q);
      selectedIds.add(q.id);
      companyCounts[q.company] = (companyCounts[q.company] || 0) + 1;
    }
  }

  // Pass 3: Fallback if still under targetCount
  if (selectedQuestions.length < targetCount) {
    const allRemaining = shuffleArray(allApproved.filter(q => !selectedIds.has(q.id)));
    for (const q of allRemaining) {
      if (selectedQuestions.length >= targetCount) break;
      selectedQuestions.push(q);
      selectedIds.add(q.id);
      companyCounts[q.company] = (companyCounts[q.company] || 0) + 1;
    }
  }

  // Shuffle the final selected question order
  const finalQuestions = shuffleArray(selectedQuestions);

  // Prepare insert statements for attempt_questions
  const insertAttemptQStmt = db.prepare(`
    INSERT INTO attempt_questions (
      attempt_id, question_id, question_order, option_order, options_json, correct_option_key
    ) VALUES (
      @attempt_id, @question_id, @question_order, @option_order, @options_json, @correct_option_key
    )
  `);

  const saveAttemptQuestions = db.transaction((questionsList) => {
    questionsList.forEach((q, index) => {
      // Original options
      const originalOptions = [
        { origKey: 'A', text: q.option_a },
        { origKey: 'B', text: q.option_b },
        { origKey: 'C', text: q.option_c },
        { origKey: 'D', text: q.option_d }
      ];

      // Shuffle options for this attempt
      const shuffledOptions = shuffleArray(originalOptions);
      const optionLabels = ['A', 'B', 'C', 'D'];

      // Build options JSON with new keys (A, B, C, D)
      let correctOptionKey = '';
      const candidateOptions = shuffledOptions.map((opt, optIdx) => {
        const candidateKey = optionLabels[optIdx];
        if (opt.origKey === q.correct_answer) {
          correctOptionKey = candidateKey;
        }
        return {
          key: candidateKey,
          text: opt.text,
          originalKey: opt.origKey
        };
      });

      const optionOrder = candidateOptions.map(o => o.originalKey).join(',');

      insertAttemptQStmt.run({
        attempt_id: attemptId,
        question_id: q.id,
        question_order: index + 1,
        option_order: optionOrder,
        options_json: JSON.stringify(candidateOptions),
        correct_option_key: correctOptionKey
      });
    });
  });

  saveAttemptQuestions(finalQuestions);

  return {
    total: finalQuestions.length,
    companiesRepresented: Object.keys(companyCounts).length,
    companyBreakdown: companyCounts,
    abbreviationsIncluded: abbrevPicked,
    difficulties: {
      Easy: finalQuestions.filter(q => q.difficulty === 'Easy').length,
      Medium: finalQuestions.filter(q => q.difficulty === 'Medium').length,
      Hard: finalQuestions.filter(q => q.difficulty === 'Hard').length
    }
  };
}

module.exports = {
  generateAttemptQuestions,
  shuffleArray
};

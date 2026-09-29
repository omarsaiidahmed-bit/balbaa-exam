const { db } = require('./server/db');

const allQuestions = db.prepare('SELECT * FROM questions ORDER BY id ASC').all();

function classifyQuestion(q) {
  const text = q.question;
  const qLen = text.length;

  // Indicators of TOO_EASY:
  // Short direct questions asking for a single number, color, or simple fact
  const isDirectWhat = /^(ما|كم|هل|أين|متى|ما هو|ما هي|ماذا|وفقًا لـ|في تعاقد)\s/i.test(text.trim());
  const isSingleFact = /(صلاحية|مدة|لون|أيام|يوم|نسبة التحمل|كارنيه|ختم|شكل|شفرة|اسم)/.test(text);
  const hasNoScenario = !text.includes('حضر') && !text.includes('مريض') && !text.includes('عميل') && !text.includes('روشتة تحتوي') && !text.includes('تاريخها') && !text.includes('رفض') && !text.includes('استثناء');

  if (q.difficulty === 'Hard') return 'HARD';

  if (qLen < 80 && isDirectWhat && hasNoScenario) {
    return 'TOO_EASY';
  }

  if (qLen < 110 && isSingleFact && hasNoScenario) {
    return 'TOO_EASY';
  }

  if (q.question_type === 'Scenario' || (text.includes('حضر') && text.includes('في حالة'))) {
    return q.difficulty === 'Medium' ? 'MEDIUM' : 'HARD';
  }

  if (q.difficulty === 'Easy') {
    return 'EASY';
  }

  return 'MEDIUM';
}

const audit = {
  TOO_EASY: [],
  EASY: [],
  MEDIUM: [],
  HARD: []
};

allQuestions.forEach(q => {
  const cat = classifyQuestion(q);
  audit[cat].push(q);
});

console.log('AUDIT CLASSIFICATION RESULTS:');
console.log('TOO_EASY:', audit.TOO_EASY.length);
console.log('EASY:', audit.EASY.length);
console.log('MEDIUM:', audit.MEDIUM.length);
console.log('HARD:', audit.HARD.length);

console.log('\nSample TOO_EASY questions:');
audit.TOO_EASY.slice(0, 15).forEach(q => {
  console.log(`[${q.question_id}] [${q.company}] [${q.rule_id}]: ${q.question} (Len: ${q.question.length})`);
});

// Distribution of TOO_EASY across companies
const companyTooEasy = {};
audit.TOO_EASY.forEach(q => {
  companyTooEasy[q.company] = (companyTooEasy[q.company] || 0) + 1;
});
console.log('\nTOO_EASY distribution across companies (' + Object.keys(companyTooEasy).length + ' companies):');
console.log(companyTooEasy);

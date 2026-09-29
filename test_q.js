const { db } = require('./server/db');

console.log('=== QUESTIONS AUDIT ===');
const total = db.prepare('SELECT COUNT(*) as c FROM questions').get().c;
console.log('Total Questions:', total);

const difficulties = db.prepare('SELECT difficulty, COUNT(*) as c FROM questions GROUP BY difficulty').all();
console.log('Difficulties:', difficulties);

const abbrevs = db.prepare("SELECT DISTINCT medical_abbreviation FROM questions WHERE medical_abbreviation IS NOT NULL AND TRIM(medical_abbreviation) != ''").all();
console.log('Medical Abbreviations count:', abbrevs.length);
console.log('Abbrevs sample:', abbrevs.map(a => a.medical_abbreviation).slice(0, 20));

const conditions = db.prepare("SELECT DISTINCT clinical_condition FROM questions WHERE clinical_condition IS NOT NULL AND TRIM(clinical_condition) != ''").all();
console.log('Clinical conditions count:', conditions.length);
console.log('Conditions sample:', conditions.map(c => c.clinical_condition).slice(0, 20));

const medSources = db.prepare("SELECT DISTINCT medical_source FROM questions WHERE medical_source IS NOT NULL AND TRIM(medical_source) != ''").all();
console.log('Medical sources count:', medSources.length);
console.log('Sources sample:', medSources.map(m => m.medical_source).slice(0, 20));

const questionTypes = db.prepare("SELECT question_type, COUNT(*) as c FROM questions GROUP BY question_type").all();
console.log('Question types:', questionTypes);

// Sample questions with their text and difficulty
const sampleEasy = db.prepare("SELECT id, question_id, company, rule_id, question, option_a, option_b, option_c, option_d, correct_answer FROM questions WHERE difficulty = 'Easy' LIMIT 10").all();
console.log('\n--- Sample Easy Questions ---');
sampleEasy.forEach(q => {
  console.log(`[${q.question_id}] ${q.company} (${q.rule_id}): ${q.question}`);
});

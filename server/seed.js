const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const bcrypt = require('bcryptjs');
const { db, initDatabase } = require('./db');

async function seed() {
  initDatabase();

  // 1. Seed Question Bank Version
  const existingVersion = db.prepare('SELECT id FROM question_bank_versions WHERE version = ?').get('1.0');
  if (!existingVersion) {
    db.prepare(`
      INSERT INTO question_bank_versions (version, total_questions, status, notes)
      VALUES (?, ?, ?, ?)
    `).run('1.0', 500, 'APPROVED', 'Initial approved 500 question dataset from Balbaa_Question_Bank_APPROVED.csv');
  }

  // 2. Check and seed questions
  const questionCount = db.prepare('SELECT COUNT(*) as count FROM questions').get().count;
  if (questionCount < 500) {
    console.log('Seeding approved 500 questions from CSV...');
    const csvPath = path.join(__dirname, '..', 'Balbaa_Question_Bank_APPROVED.csv');
    
    const rows = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(csvPath, { encoding: 'utf-8' })
        .pipe(csv({
          mapHeaders: ({ header }) => header.replace(/^[\ufeff"'\s]+|["'\s]+$/g, '').trim()
        }))
        .on('data', (data) => rows.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    console.log(`Parsed ${rows.length} rows from CSV with clean headers.`);

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO questions (
        question_id, company, company_status, rule_id, category, subcategory,
        question_type, medical_abbreviation, clinical_condition, medication,
        question, option_a, option_b, option_c, option_d, correct_answer,
        explanation, rule_source, medical_source, difficulty, review_status, notes, version
      ) VALUES (
        @question_id, @company, @company_status, @rule_id, @category, @subcategory,
        @question_type, @medical_abbreviation, @clinical_condition, @medication,
        @question, @option_a, @option_b, @option_c, @option_d, @correct_answer,
        @explanation, @rule_source, @medical_source, @difficulty, @review_status, @notes, '1.0'
      )
    `);

    const insertMany = db.transaction((items) => {
      for (const row of items) {
        const qid = (row['Question ID'] || '').trim();
        if (!qid) {
          console.warn('Skipping empty row or missing QID:', row);
          continue;
        }
        insertStmt.run({
          question_id: qid,
          company: (row['Company'] || '').trim(),
          company_status: (row['Company Status'] || 'ACTIVE').trim(),
          rule_id: (row['Rule ID'] || '').trim(),
          category: (row['Category'] || '').trim(),
          subcategory: (row['Subcategory'] || '').trim(),
          question_type: (row['Question Type'] || '').trim(),
          medical_abbreviation: (row['Medical Abbreviation'] || '').trim(),
          clinical_condition: (row['Clinical Condition'] || '').trim(),
          medication: (row['Medication'] || '').trim(),
          question: (row['Question'] || '').trim(),
          option_a: (row['Option A'] || '').trim(),
          option_b: (row['Option B'] || '').trim(),
          option_c: (row['Option C'] || '').trim(),
          option_d: (row['Option D'] || '').trim(),
          correct_answer: (row['Correct Answer'] || 'A').trim(),
          explanation: (row['Explanation'] || '').trim(),
          rule_source: (row['Rule Source'] || '').trim(),
          medical_source: (row['Medical Source'] || '').trim(),
          difficulty: (row['Difficulty'] || 'Easy').trim(),
          review_status: (row['Review Status'] || 'APPROVED').trim(),
          notes: (row['Notes'] || '').trim()
        });
      }
    });

    insertMany(rows);
    const finalCount = db.prepare('SELECT COUNT(*) as count FROM questions').get().count;
    console.log(`Successfully seeded ${finalCount} approved questions into the database.`);
  } else {
    console.log(`Questions table already populated with ${questionCount} questions.`);
  }

  // 3. Seed Default Exam Configuration with Balanced Blueprint
  const existingExam = db.prepare('SELECT id FROM exams WHERE id = 1').get();
  const defaultBlueprint = {
    total_questions: 50,
    difficulty: {
      Easy: 0,
      Medium: 46,
      Hard: 4
    },
    company_balance: 'balanced', // Max 2-3 per company
    max_per_company: 3,
    min_distinct_companies: 20,
    categories: {
      "Dispensing Requirements": 14,
      "Special Instructions": 13,
      "Dispensing Duration & Validity": 8,
      "Exclusions / Non-covered": 5,
      "Maximum Limit": 4,
      "General / Header Notes": 3,
      "Price Difference": 2,
      "Approvals": 1
    }
  };

  if (!existingExam) {
    db.prepare(`
      INSERT INTO exams (id, name, question_count, duration_minutes, difficulty, passing_percentage, blueprint, snapshot_interval_minutes)
      VALUES (1, ?, 50, 60, 'Easy', 70, ?, 5)
    `).run('اختبار تعاقدات التأمين الطبي - صيدليات بلبع', JSON.stringify(defaultBlueprint));
    console.log('Seeded default exam configuration.');
  }

  // 4. Seed Default Admin
  const existingAdmin = db.prepare('SELECT id FROM admins WHERE email = ?').get('admin@balbaa.com');
  if (!existingAdmin) {
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync('admin123', salt);
    db.prepare(`
      INSERT INTO admins (username, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `).run('admin', 'admin@balbaa.com', passwordHash, 'superadmin');
    console.log('Default admin seeded: admin@balbaa.com / admin123');
  }

  // 5. Seed Audit Log for initial setup
  db.prepare(`
    INSERT INTO audit_logs (user_type, user_id, action, target, details)
    VALUES ('SYSTEM', 'INIT', 'DATABASE_SEEDED', 'SYSTEM', 'Question bank and default exam seeded successfully.')
  `).run();

  console.log('Seed completed successfully!');
}

if (require.main === module) {
  seed().then(() => {
    process.exit(0);
  }).catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  });
}

module.exports = { seed };

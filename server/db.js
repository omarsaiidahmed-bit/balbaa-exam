const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'balbaa_exam.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency and performance
db.pragma('journal_mode = WAL');

function initDatabase() {
  db.exec(`
    -- Candidates table
    CREATE TABLE IF NOT EXISTS candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      employee_code TEXT NOT NULL UNIQUE,
      branch TEXT NOT NULL,
      initial_snapshot TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Questions table (authoritative bank)
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id TEXT NOT NULL UNIQUE,
      company TEXT NOT NULL,
      company_status TEXT DEFAULT 'ACTIVE',
      rule_id TEXT NOT NULL,
      category TEXT NOT NULL,
      subcategory TEXT,
      question_type TEXT,
      medical_abbreviation TEXT,
      clinical_condition TEXT,
      medication TEXT,
      question TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      explanation TEXT,
      rule_source TEXT,
      medical_source TEXT,
      difficulty TEXT NOT NULL DEFAULT 'Easy',
      review_status TEXT NOT NULL DEFAULT 'APPROVED',
      notes TEXT,
      version TEXT DEFAULT '1.0',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Exam configuration & blueprint
    CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      question_count INTEGER NOT NULL DEFAULT 50,
      duration_minutes INTEGER NOT NULL DEFAULT 20,
      difficulty TEXT DEFAULT 'Easy',
      passing_percentage INTEGER NOT NULL DEFAULT 70,
      blueprint TEXT,
      is_active INTEGER DEFAULT 1,
      snapshot_interval_minutes INTEGER DEFAULT 5,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Exam Attempts
    CREATE TABLE IF NOT EXISTS attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL,
      candidate_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'IN_PROGRESS', -- IN_PROGRESS, SUBMITTED, TIME_EXPIRED, CANCELLED
      is_simulation INTEGER DEFAULT 0,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      submitted_at DATETIME,
      submission_reason TEXT, -- MANUAL, TIME_EXPIRED, ADMIN, SYSTEM
      score REAL DEFAULT 0,
      percentage REAL DEFAULT 0,
      result TEXT, -- PASS, FAIL
      client_meta TEXT,
      FOREIGN KEY (exam_id) REFERENCES exams(id),
      FOREIGN KEY (candidate_id) REFERENCES candidates(id)
    );

    -- Randomized questions per attempt
    CREATE TABLE IF NOT EXISTS attempt_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      question_order INTEGER NOT NULL,
      option_order TEXT NOT NULL, -- e.g. "C,A,D,B"
      options_json TEXT NOT NULL, -- JSON array of [{key: 'A', text: '...', originalKey: 'C'}, ...]
      correct_option_key TEXT NOT NULL, -- What key (A/B/C/D in the candidate's randomized view) corresponds to the true answer
      FOREIGN KEY (attempt_id) REFERENCES attempts(id),
      FOREIGN KEY (question_id) REFERENCES questions(id)
    );

    -- Saved answers
    CREATE TABLE IF NOT EXISTS answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      selected_answer TEXT, -- Candidate's chosen option key (A, B, C, D) in randomized view
      original_selected_answer TEXT, -- Mapped back to original Option key
      is_correct INTEGER DEFAULT 0,
      answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (attempt_id) REFERENCES attempts(id),
      FOREIGN KEY (question_id) REFERENCES questions(id),
      UNIQUE(attempt_id, question_id)
    );

    -- Monitoring Events
    CREATE TABLE IF NOT EXISTS monitoring_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id INTEGER NOT NULL,
      event_type TEXT NOT NULL, -- EXAM_STARTED, CAMERA_STARTED, NO_FACE, MULTIPLE_FACES, TAB_SWITCH, etc.
      severity TEXT NOT NULL DEFAULT 'Minor', -- Minor, Medium, High
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      metadata TEXT,
      snapshot_id INTEGER,
      FOREIGN KEY (attempt_id) REFERENCES attempts(id)
    );

    -- Snapshots captured during exam
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id INTEGER NOT NULL,
      captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      storage_path TEXT,
      image_data TEXT, -- Base64 data URL
      trigger_event TEXT, -- INITIAL, INTERVAL, NO_FACE, MULTIPLE_FACES, TAB_SWITCH, etc.
      FOREIGN KEY (attempt_id) REFERENCES attempts(id)
    );

    -- Administrators
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Audit Logs
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_type TEXT NOT NULL, -- ADMIN, SYSTEM, CANDIDATE
      user_id TEXT,
      action TEXT NOT NULL,
      target TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Question Bank Versions
    CREATE TABLE IF NOT EXISTS question_bank_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version TEXT NOT NULL UNIQUE,
      total_questions INTEGER NOT NULL,
      status TEXT DEFAULT 'APPROVED',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('Database tables verified and ready.');
}

module.exports = {
  db,
  initDatabase
};

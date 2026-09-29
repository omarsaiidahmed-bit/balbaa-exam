const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const XLSX = require('xlsx');

const { db, initDatabase } = require('./db');
const { generateAttemptQuestions } = require('./blueprint');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'balbaa_exam_secret_key_2025';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure DB is initialized
initDatabase();

// Helper: Safely parse SQLite UTC timestamp
function parseSqliteDate(dateStr) {
  if (!dateStr) return Date.now();
  if (dateStr.includes('T') && dateStr.endsWith('Z')) {
    return new Date(dateStr).getTime();
  }
  // Convert 'YYYY-MM-DD HH:MM:SS' to 'YYYY-MM-DDTHH:MM:SSZ'
  const iso = dateStr.trim().replace(' ', 'T') + (dateStr.includes('Z') ? '' : 'Z');
  return new Date(iso).getTime();
}

// Helper: Admin authentication middleware
function authenticateAdmin(req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'غير مصرح: يرجى تسجيل الدخول كمسؤول' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'رمز الجلسة غير صالح أو منتهي الصلاحية' });
  }
}

// Helper: Log audit action
function logAudit(userType, userId, action, target, details) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (user_type, user_id, action, target, details)
      VALUES (?, ?, ?, ?, ?)
    `).run(userType, String(userId || 'ANON'), action, target, typeof details === 'string' ? details : JSON.stringify(details));
  } catch (e) {
    console.error('Audit log failed:', e);
  }
}

// ==========================================
// 1. CANDIDATE EXAMINATION ENDPOINTS
// ==========================================

// Check candidate status (One-attempt policy & Resume check)
app.post('/api/candidate/check-status', (req, res) => {
  const { employee_code } = req.body;
  if (!employee_code || !employee_code.trim()) {
    return res.status(400).json({ error: 'كود الموظف مطلوب' });
  }

  const cleanCode = employee_code.trim();
  const candidate = db.prepare('SELECT * FROM candidates WHERE employee_code = ?').get(cleanCode);

  if (!candidate) {
    return res.json({ status: 'NOT_REGISTERED' });
  }

  // Check existing attempts for this candidate
  const completedAttempt = db.prepare(`
    SELECT * FROM attempts 
    WHERE candidate_id = ? AND status IN ('SUBMITTED', 'TIME_EXPIRED')
    ORDER BY id DESC LIMIT 1
  `).get(candidate.id);

  if (completedAttempt) {
    return res.json({
      status: 'ALREADY_COMPLETED',
      message: 'هذا الكود استخدم بالفعل ولا يمكن بدء محاولة جديدة.',
      candidate: {
        id: candidate.id,
        full_name: candidate.full_name,
        employee_code: candidate.employee_code,
        branch: candidate.branch
      },
      attempt: {
        id: completedAttempt.id,
        score: completedAttempt.score,
        percentage: completedAttempt.percentage,
        result: completedAttempt.result,
        submitted_at: completedAttempt.submitted_at
      }
    });
  }

  const activeAttempt = db.prepare(`
    SELECT * FROM attempts 
    WHERE candidate_id = ? AND status = 'IN_PROGRESS'
    ORDER BY id DESC LIMIT 1
  `).get(candidate.id);

  if (activeAttempt) {
    const exam = db.prepare('SELECT duration_minutes, question_count FROM exams WHERE id = ?').get(activeAttempt.exam_id);
    const durationSeconds = (exam ? exam.duration_minutes : 20) * 60;
    const elapsedSeconds = Math.floor((Date.now() - parseSqliteDate(activeAttempt.started_at)) / 1000);
    const remainingSeconds = Math.max(0, durationSeconds - elapsedSeconds);

    if (remainingSeconds <= 0) {
      // Auto-expire
      db.prepare(`
        UPDATE attempts 
        SET status = 'TIME_EXPIRED', submitted_at = CURRENT_TIMESTAMP, submission_reason = 'TIME_EXPIRED'
        WHERE id = ?
      `).run(activeAttempt.id);

      return res.json({
        status: 'ALREADY_COMPLETED',
        message: 'انتهى الوقت المحدد للمحاولة السابقة.',
        candidate
      });
    }

    const answeredCount = db.prepare('SELECT COUNT(*) as count FROM answers WHERE attempt_id = ?').get(activeAttempt.id).count;
    const totalCount = db.prepare('SELECT COUNT(*) as count FROM attempt_questions WHERE attempt_id = ?').get(activeAttempt.id).count;

    return res.json({
      status: 'CAN_RESUME',
      message: 'تم العثور على محاولة اختبار غير مكتملة',
      candidate,
      attempt: {
        id: activeAttempt.id,
        answeredCount,
        totalCount: totalCount || 50,
        remainingSeconds,
        started_at: activeAttempt.started_at
      }
    });
  }

  return res.json({ status: 'READY_TO_START', candidate });
});

// Candidate Registration & Exam Start
app.post('/api/candidate/register', (req, res) => {
  try {
    const full_name = req.body.full_name || req.body.fullName;
    const employee_code = req.body.employee_code || req.body.employeeCode;
    const branch = req.body.branch;
    const initial_snapshot = req.body.initial_snapshot || req.body.snapshotData || req.body.initialSnapshot;
    const camera_consent = req.body.camera_consent !== undefined ? req.body.camera_consent : req.body.cameraConsent;

    // Strict validation
    if (!full_name || !String(full_name).trim()) {
      return res.status(400).json({ error: 'الاسم بالكامل مطلوب' });
    }
    if (!employee_code || !String(employee_code).trim()) {
      return res.status(400).json({ error: 'كود الموظف مطلوب' });
    }
    if (!branch || !String(branch).trim()) {
      return res.status(400).json({ error: 'الفرع مطلوب' });
    }
    if (!camera_consent) {
      return res.status(400).json({ error: 'يجب الموافقة على استخدام الكاميرا أثناء الامتحان' });
    }
    if (!initial_snapshot) {
      return res.status(400).json({ error: 'يجب التقاط الصورة الشخصية بالكاميرا قبل بدء الامتحان' });
    }

    const cleanCode = employee_code.trim();
    const cleanName = full_name.trim();
    const cleanBranch = branch.trim();

    // Check existing completed attempt
    let candidate = db.prepare('SELECT * FROM candidates WHERE employee_code = ?').get(cleanCode);
    if (candidate) {
      const completed = db.prepare(`
        SELECT * FROM attempts 
        WHERE candidate_id = ? AND status IN ('SUBMITTED', 'TIME_EXPIRED')
      `).get(candidate.id);

      if (completed) {
        return res.status(400).json({ error: 'هذا الكود استخدم بالفعل ولا يمكن بدء محاولة جديدة.' });
      }

      // Check if active attempt exists
      const active = db.prepare(`
        SELECT * FROM attempts 
        WHERE candidate_id = ? AND status = 'IN_PROGRESS'
      `).get(candidate.id);

      if (active) {
        return res.json({
          success: true,
          resumed: true,
          attemptId: active.id,
          message: 'تم العثور على محاولة اختبار غير مكتملة وجاري استكمالها.'
        });
      }
    } else {
      // Create new candidate
      const insertCandidate = db.prepare(`
        INSERT INTO candidates (full_name, employee_code, branch, initial_snapshot)
        VALUES (?, ?, ?, ?)
      `).run(cleanName, cleanCode, cleanBranch, initial_snapshot);

      candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(insertCandidate.lastInsertRowid);
    }

    // Get active exam configuration
    const exam = db.prepare('SELECT * FROM exams WHERE id = 1 AND is_active = 1').get() || { id: 1, duration_minutes: 20, question_count: 50 };

    // Create new attempt
    const insertAttempt = db.prepare(`
      INSERT INTO attempts (exam_id, candidate_id, status, started_at)
      VALUES (?, ?, 'IN_PROGRESS', CURRENT_TIMESTAMP)
    `).run(exam.id, candidate.id);

    const attemptId = insertAttempt.lastInsertRowid;

    // Save initial snapshot in snapshots table
    db.prepare(`
      INSERT INTO snapshots (attempt_id, image_data, trigger_event)
      VALUES (?, ?, 'INITIAL_REGISTRATION')
    `).run(attemptId, initial_snapshot);

    // Generate randomized questions & shuffled options via Blueprint Engine
    const blueprintResult = generateAttemptQuestions(exam.id, attemptId);

    // Log monitoring events
    db.prepare(`
      INSERT INTO monitoring_events (attempt_id, event_type, severity, metadata)
      VALUES (?, 'EXAM_STARTED', 'Minor', ?)
    `).run(attemptId, JSON.stringify({ blueprint: blueprintResult }));

    db.prepare(`
      INSERT INTO monitoring_events (attempt_id, event_type, severity, metadata)
      VALUES (?, 'CAMERA_STARTED', 'Minor', '{"camera_consent":true}')
    `).run(attemptId);

    logAudit('CANDIDATE', candidate.employee_code, 'EXAM_STARTED', `Attempt #${attemptId}`, {
      candidateName: cleanName,
      branch: cleanBranch
    });

    res.json({
      success: true,
      attemptId,
      message: 'تم تسجيل البيانات وبدء الاختبار بنجاح'
    });
  } catch (error) {
    console.error('Error starting exam:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء بدء الاختبار' });
  }
});

// Get active attempt exam data (Strictly secures correct answers)
app.get('/api/candidate/attempt/:attemptId', (req, res) => {
  try {
    const attemptId = parseInt(req.params.attemptId, 10);
    const attempt = db.prepare(`
      SELECT a.*, c.full_name, c.employee_code, c.branch, e.duration_minutes, e.snapshot_interval_minutes
      FROM attempts a
      JOIN candidates c ON a.candidate_id = c.id
      JOIN exams e ON a.exam_id = e.id
      WHERE a.id = ?
    `).get(attemptId);

    if (!attempt) {
      return res.status(404).json({ error: 'محاولة الاختبار غير موجودة' });
    }

    if (attempt.status !== 'IN_PROGRESS') {
      return res.status(400).json({
        error: 'هذا الاختبار مكتمل بالفعل',
        status: attempt.status,
        result: attempt.result,
        score: attempt.score,
        percentage: attempt.percentage
      });
    }

    // Check server authoritative timer (20 minutes)
    const durationSeconds = (attempt.duration_minutes || 20) * 60;
    const elapsedSeconds = Math.floor((Date.now() - parseSqliteDate(attempt.started_at)) / 1000);
    const remainingSeconds = Math.max(0, durationSeconds - elapsedSeconds);

    if (remainingSeconds <= 0) {
      // Auto-submit due to time expiry
      autoSubmitAttempt(attemptId, 'TIME_EXPIRED');
      return res.status(400).json({
        error: 'انتهى وقت الاختبار المخصص وتم تسليم المحاولة تلقائياً',
        status: 'TIME_EXPIRED'
      });
    }

    // Fetch randomized questions for this candidate attempt
    const attemptQuestions = db.prepare(`
      SELECT aq.question_order, aq.options_json,
             q.id as q_db_id, q.question_id, q.company, q.category, q.subcategory, q.question
      FROM attempt_questions aq
      JOIN questions q ON aq.question_id = q.id
      WHERE aq.attempt_id = ?
      ORDER BY aq.question_order ASC
    `).all(attemptId);

    // Fetch already saved answers
    const savedAnswers = db.prepare(`
      SELECT question_id, selected_answer 
      FROM answers 
      WHERE attempt_id = ?
    `).all(attemptId);

    const answersMap = {};
    for (const ans of savedAnswers) {
      answersMap[ans.question_id] = ans.selected_answer;
    }

    // Format safe question list (NEVER expose correct_answer or explanation)
    const safeQuestions = attemptQuestions.map(item => {
      const optionsParsed = JSON.parse(item.options_json);
      // Remove originalKey so candidate cannot reverse-engineer
      const safeOptions = optionsParsed.map(opt => ({
        key: opt.key,
        text: opt.text
      }));

      return {
        order: item.question_order,
        question_id: item.question_id,
        company: item.company,
        category: item.category,
        subcategory: item.subcategory,
        question: item.question,
        options: safeOptions,
        selectedAnswer: answersMap[item.q_db_id] || null
      };
    });

    res.json({
      attemptId: attempt.id,
      candidate: {
        name: attempt.full_name,
        employee_code: attempt.employee_code,
        branch: attempt.branch
      },
      durationMinutes: attempt.duration_minutes,
      remainingSeconds,
      snapshotIntervalMinutes: attempt.snapshot_interval_minutes || 5,
      totalQuestions: safeQuestions.length,
      questions: safeQuestions
    });
  } catch (error) {
    console.error('Error fetching attempt:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحميل بيانات الاختبار' });
  }
});

// Autosave Answer
app.post('/api/candidate/answer', (req, res) => {
  try {
    const { attemptId, questionOrder, selectedAnswer } = req.body;

    if (!attemptId || questionOrder === undefined || !selectedAnswer) {
      return res.status(400).json({ error: 'البيانات غير مكتملة' });
    }

    const attempt = db.prepare('SELECT status, started_at, exam_id FROM attempts WHERE id = ?').get(attemptId);
    if (!attempt || attempt.status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'لا يمكن حفظ الإجابة: الاختبار غير نشط' });
    }

    // Verify time (20 minutes)
    const exam = db.prepare('SELECT duration_minutes FROM exams WHERE id = ?').get(attempt.exam_id);
    const durationSeconds = (exam ? exam.duration_minutes : 20) * 60;
    const elapsedSeconds = Math.floor((Date.now() - parseSqliteDate(attempt.started_at)) / 1000);
    if (elapsedSeconds > durationSeconds + 15) { // 15 sec buffer
      autoSubmitAttempt(attemptId, 'TIME_EXPIRED');
      return res.status(400).json({ error: 'انتهى الوقت المحدد للاختبار' });
    }

    // Retrieve attempt question info
    const aq = db.prepare(`
      SELECT aq.question_id, aq.correct_option_key, aq.options_json 
      FROM attempt_questions aq 
      WHERE aq.attempt_id = ? AND aq.question_order = ?
    `).get(attemptId, questionOrder);

    if (!aq) {
      return res.status(404).json({ error: 'السؤال غير موجود في هذه المحاولة' });
    }

    const isCorrect = selectedAnswer === aq.correct_option_key ? 1 : 0;
    
    // Find original option key
    const parsedOptions = JSON.parse(aq.options_json);
    const matchedOpt = parsedOptions.find(o => o.key === selectedAnswer);
    const origSelectedKey = matchedOpt ? matchedOpt.originalKey : selectedAnswer;

    // Upsert answer
    db.prepare(`
      INSERT INTO answers (attempt_id, question_id, selected_answer, original_selected_answer, is_correct, answered_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(attempt_id, question_id) DO UPDATE SET
        selected_answer = excluded.selected_answer,
        original_selected_answer = excluded.original_selected_answer,
        is_correct = excluded.is_correct,
        answered_at = CURRENT_TIMESTAMP
    `).run(attemptId, aq.question_id, selectedAnswer, origSelectedKey, isCorrect);

    res.json({ success: true, savedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Error autosaving answer:', error);
    res.status(500).json({ error: 'فشل حفظ الإجابة' });
  }
});

// Record Monitoring Event
app.post('/api/candidate/monitoring-event', (req, res) => {
  try {
    const { attemptId, event_type, severity = 'Minor', metadata = {}, snapshot_data = null } = req.body;

    if (!attemptId || !event_type) {
      return res.status(400).json({ error: 'attemptId and event_type are required' });
    }

    let snapshotId = null;
    if (snapshot_data) {
      const snap = db.prepare(`
        INSERT INTO snapshots (attempt_id, image_data, trigger_event)
        VALUES (?, ?, ?)
      `).run(attemptId, snapshot_data, event_type);
      snapshotId = snap.lastInsertRowid;
    }

    db.prepare(`
      INSERT INTO monitoring_events (attempt_id, event_type, severity, metadata, snapshot_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(attemptId, event_type, severity, JSON.stringify(metadata), snapshotId);

    res.json({ success: true, event_type });
  } catch (error) {
    console.error('Error logging monitoring event:', error);
    res.status(500).json({ error: 'فشل تسجيل حدث المراقبة' });
  }
});

// Save Snapshot
app.post('/api/candidate/snapshot', (req, res) => {
  try {
    const { attemptId, image_data, trigger_event = 'INTERVAL' } = req.body;

    if (!attemptId || !image_data) {
      return res.status(400).json({ error: 'attemptId and image_data are required' });
    }

    const snap = db.prepare(`
      INSERT INTO snapshots (attempt_id, image_data, trigger_event)
      VALUES (?, ?, ?)
    `).run(attemptId, image_data, trigger_event);

    db.prepare(`
      INSERT INTO monitoring_events (attempt_id, event_type, severity, metadata, snapshot_id)
      VALUES (?, 'SNAPSHOT_CAPTURED', 'Minor', ?, ?)
    `).run(attemptId, JSON.stringify({ trigger_event }), snap.lastInsertRowid);

    res.json({ success: true, snapshotId: snap.lastInsertRowid });
  } catch (error) {
    console.error('Error saving snapshot:', error);
    res.status(500).json({ error: 'فشل حفظ لقطة الكاميرا' });
  }
});

// Submit Exam
app.post('/api/candidate/submit', (req, res) => {
  try {
    const { attemptId, submission_reason = 'MANUAL' } = req.body;

    if (!attemptId) {
      return res.status(400).json({ error: 'attemptId is required' });
    }

    const attempt = db.prepare('SELECT * FROM attempts WHERE id = ?').get(attemptId);
    if (!attempt) {
      return res.status(404).json({ error: 'المحاولة غير موجودة' });
    }

    if (attempt.status === 'SUBMITTED' || attempt.status === 'TIME_EXPIRED') {
      return res.json({
        success: true,
        alreadySubmitted: true,
        attemptId: attempt.id,
        score: attempt.score,
        percentage: attempt.percentage,
        result: attempt.result
      });
    }

    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(attempt.exam_id);
    const passingPercentage = exam ? exam.passing_percentage : 70;

    // Calculate score
    const totalQuestions = db.prepare('SELECT COUNT(*) as c FROM attempt_questions WHERE attempt_id = ?').get(attemptId).c || 50;
    const correctCount = db.prepare('SELECT COUNT(*) as c FROM answers WHERE attempt_id = ? AND is_correct = 1').get(attemptId).c;
    const percentage = Math.round((correctCount / totalQuestions) * 100);
    const result = percentage >= passingPercentage ? 'PASS' : 'FAIL';

    db.prepare(`
      UPDATE attempts 
      SET status = 'SUBMITTED',
          submitted_at = CURRENT_TIMESTAMP,
          submission_reason = ?,
          score = ?,
          percentage = ?,
          result = ?
      WHERE id = ?
    `).run(submission_reason, correctCount, percentage, result, attemptId);

    // Record submission event
    db.prepare(`
      INSERT INTO monitoring_events (attempt_id, event_type, severity, metadata)
      VALUES (?, 'EXAM_SUBMITTED', 'Minor', ?)
    `).run(attemptId, JSON.stringify({ submission_reason, score: correctCount, percentage, result }));

    logAudit('CANDIDATE', attemptId, 'EXAM_SUBMITTED', `Attempt #${attemptId}`, {
      score: correctCount,
      percentage,
      result,
      reason: submission_reason
    });

    res.json({
      success: true,
      attemptId,
      score: correctCount,
      totalQuestions,
      percentage,
      result,
      passingPercentage
    });
  } catch (error) {
    console.error('Error submitting exam:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تسليم الاختبار' });
  }
});

// Helper for automated time expiration
function autoSubmitAttempt(attemptId, reason = 'TIME_EXPIRED') {
  try {
    const attempt = db.prepare('SELECT * FROM attempts WHERE id = ?').get(attemptId);
    if (!attempt || attempt.status !== 'IN_PROGRESS') return;

    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(attempt.exam_id);
    const passingPercentage = exam ? exam.passing_percentage : 70;
    const totalQuestions = db.prepare('SELECT COUNT(*) as c FROM attempt_questions WHERE attempt_id = ?').get(attemptId).c || 50;
    const correctCount = db.prepare('SELECT COUNT(*) as c FROM answers WHERE attempt_id = ? AND is_correct = 1').get(attemptId).c;
    const percentage = Math.round((correctCount / totalQuestions) * 100);
    const result = percentage >= passingPercentage ? 'PASS' : 'FAIL';

    db.prepare(`
      UPDATE attempts 
      SET status = ?,
          submitted_at = CURRENT_TIMESTAMP,
          submission_reason = ?,
          score = ?,
          percentage = ?,
          result = ?
      WHERE id = ?
    `).run(reason, reason, correctCount, percentage, result, attemptId);

    db.prepare(`
      INSERT INTO monitoring_events (attempt_id, event_type, severity, metadata)
      VALUES (?, 'TIME_EXPIRED', 'Medium', ?)
    `).run(attemptId, JSON.stringify({ score: correctCount, percentage, result }));
  } catch (e) {
    console.error('Auto-submit failed:', e);
  }
}

// Candidate Result Card
app.get('/api/candidate/result/:attemptId', (req, res) => {
  try {
    const attemptId = parseInt(req.params.attemptId, 10);
    const data = db.prepare(`
      SELECT a.*, c.full_name, c.employee_code, c.branch, e.name as exam_name, e.passing_percentage
      FROM attempts a
      JOIN candidates c ON a.candidate_id = c.id
      JOIN exams e ON a.exam_id = e.id
      WHERE a.id = ?
    `).get(attemptId);

    if (!data) {
      return res.status(404).json({ error: 'بيانات النتيجة غير موجودة' });
    }

    const totalQuestions = db.prepare('SELECT COUNT(*) as c FROM attempt_questions WHERE attempt_id = ?').get(attemptId).c || 50;
    const answeredCount = db.prepare('SELECT COUNT(*) as c FROM answers WHERE attempt_id = ?').get(attemptId).c || 0;
    const correctCount = db.prepare('SELECT COUNT(*) as c FROM answers WHERE attempt_id = ? AND is_correct = 1').get(attemptId).c || 0;
    const wrongCount = db.prepare('SELECT COUNT(*) as c FROM answers WHERE attempt_id = ? AND is_correct = 0').get(attemptId).c || 0;
    const unansweredCount = Math.max(0, totalQuestions - answeredCount);

    let timeUsedMinutes = 1;
    if (data.started_at && data.submitted_at) {
      const start = new Date(data.started_at.replace(' ', 'T') + (data.started_at.includes('Z') ? '' : 'Z'));
      const end = new Date(data.submitted_at.replace(' ', 'T') + (data.submitted_at.includes('Z') ? '' : 'Z'));
      timeUsedMinutes = Math.max(1, Math.round((end - start) / 60000));
    }

    res.json({
      attemptId: data.id,
      candidateName: data.full_name,
      employeeCode: data.employee_code,
      branch: data.branch,
      examName: data.exam_name,
      score: data.score,
      totalQuestions,
      percentage: data.percentage,
      result: data.result,
      passingPercentage: data.passing_percentage,
      correctCount,
      wrongCount,
      unansweredCount,
      timeUsedMinutes,
      startedAt: data.started_at,
      submittedAt: data.submitted_at,
      submissionReason: data.submission_reason
    });
  } catch (error) {
    console.error('Error fetching result card:', error);
    res.status(500).json({ error: 'فشل تحميل بطاقة النتيجة' });
  }
});

// ==========================================
// 2. ADMIN ATTEMPTS RESET / CLEAR ENDPOINT
// ==========================================

// Clear Old Attempts (Safe clear of attempts and candidates to prepare for a new session)
app.post('/api/admin/clear-attempts', authenticateAdmin, (req, res) => {
  try {
    const clearTransaction = db.transaction(() => {
      db.prepare('DELETE FROM answers').run();
      db.prepare('DELETE FROM attempt_questions').run();
      db.prepare('DELETE FROM monitoring_events').run();
      db.prepare('DELETE FROM snapshots').run();
      db.prepare('DELETE FROM attempts').run();
      db.prepare('DELETE FROM candidates').run();
    });

    clearTransaction();

    logAudit('ADMIN', req.admin ? req.admin.username : 'admin', 'CLEAR_OLD_ATTEMPTS', 'ALL_ATTEMPTS', {
      clearedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'تم مسح جميع المحاولات السابقة وسجلات المتدربين بنجاح. النظام جاهز تماماً لجلسة الاختبار الجديدة.'
    });
  } catch (error) {
    console.error('Error clearing old attempts:', error);
    res.status(500).json({ error: 'فشل مسح المحاولات: ' + error.message });
  }
});

// ==========================================
// 3. ADMIN PORTAL ENDPOINTS
// ==========================================

// Admin Login
app.post('/api/admin/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان' });
    }

    const admin = db.prepare('SELECT * FROM admins WHERE email = ? OR username = ?').get(email.trim(), email.trim());
    if (!admin) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    const isMatch = bcrypt.compareSync(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username, email: admin.email, role: admin.role },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    logAudit('ADMIN', admin.username, 'LOGIN', 'ADMIN_PORTAL', 'Admin logged in');

    res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الدخول' });
  }
});

// Admin Dashboard Summary
app.get('/api/admin/dashboard', authenticateAdmin, (req, res) => {
  try {
    const totalCandidates = db.prepare('SELECT COUNT(*) as c FROM candidates').get().c;
    const completedAttempts = db.prepare(`SELECT COUNT(*) as c FROM attempts WHERE status IN ('SUBMITTED', 'TIME_EXPIRED')`).get().c;
    const inProgressAttempts = db.prepare(`SELECT COUNT(*) as c FROM attempts WHERE status = 'IN_PROGRESS'`).get().c;
    const passedAttempts = db.prepare(`SELECT COUNT(*) as c FROM attempts WHERE result = 'PASS'`).get().c;

    const avgScoreRow = db.prepare(`
      SELECT AVG(score) as avg_score, AVG(percentage) as avg_pct 
      FROM attempts WHERE status IN ('SUBMITTED', 'TIME_EXPIRED')
    `).get();

    const passRate = completedAttempts > 0 ? Math.round((passedAttempts / completedAttempts) * 100) : 0;
    const avgScore = avgScoreRow && avgScoreRow.avg_score ? parseFloat(avgScoreRow.avg_score.toFixed(1)) : 0;
    const avgPercentage = avgScoreRow && avgScoreRow.avg_pct ? parseFloat(avgScoreRow.avg_pct.toFixed(1)) : 0;

    const totalMonitoringEvents = db.prepare('SELECT COUNT(*) as c FROM monitoring_events').get().c;
    const totalQuestions = db.prepare('SELECT COUNT(*) as c FROM questions').get().c;
    const totalCompanies = db.prepare('SELECT COUNT(DISTINCT company) as c FROM questions').get().c;

    // Company breakdown in question bank
    const companyQuestions = db.prepare(`
      SELECT company, COUNT(*) as count 
      FROM questions 
      GROUP BY company 
      ORDER BY count DESC
    `).all();

    // Category breakdown
    const categoryQuestions = db.prepare(`
      SELECT category, COUNT(*) as count 
      FROM questions 
      GROUP BY category 
      ORDER BY count DESC
    `).all();

    // Recent attempts with monitoring count
    const recentAttempts = db.prepare(`
      SELECT a.id, a.score, a.percentage, a.result, a.status, a.started_at, a.submitted_at,
             c.full_name, c.employee_code, c.branch,
             (SELECT COUNT(*) FROM monitoring_events WHERE attempt_id = a.id) as monitoring_count
      FROM attempts a
      JOIN candidates c ON a.candidate_id = c.id
      ORDER BY a.id DESC LIMIT 15
    `).all();

    res.json({
      metrics: {
        totalCandidates,
        completedAttempts,
        inProgressAttempts,
        passRate,
        avgScore,
        avgPercentage,
        totalMonitoringEvents,
        totalQuestions,
        totalCompanies
      },
      companyQuestions,
      categoryQuestions,
      recentAttempts
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ error: 'فشل تحميل بيانات لوحة التحكم' });
  }
});

// Admin Candidates & Attempts List
app.get('/api/admin/candidates', authenticateAdmin, (req, res) => {
  try {
    const { search = '', status = 'ALL', branch = 'ALL', flagged = 'ALL' } = req.query;

    let query = `
      SELECT a.id as attempt_id, a.status, a.score, a.percentage, a.result, a.started_at, a.submitted_at, a.submission_reason, a.is_simulation,
             c.id as candidate_id, c.full_name, c.employee_code, c.branch, c.initial_snapshot,
             (SELECT COUNT(*) FROM monitoring_events WHERE attempt_id = a.id) as total_events,
             (SELECT COUNT(*) FROM monitoring_events WHERE attempt_id = a.id AND event_type = 'TAB_SWITCH') as tab_switches,
             (SELECT COUNT(*) FROM monitoring_events WHERE attempt_id = a.id AND event_type = 'FULLSCREEN_EXIT') as fullscreen_exits,
             (SELECT COUNT(*) FROM monitoring_events WHERE attempt_id = a.id AND event_type = 'NO_FACE') as no_face_events,
             (SELECT COUNT(*) FROM monitoring_events WHERE attempt_id = a.id AND event_type = 'MULTIPLE_FACES') as multiple_face_events,
             (SELECT COUNT(*) FROM monitoring_events WHERE attempt_id = a.id AND event_type = 'CAMERA_DISCONNECTED') as camera_disconnects
      FROM attempts a
      JOIN candidates c ON a.candidate_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (search.trim()) {
      query += ` AND (c.full_name LIKE ? OR c.employee_code LIKE ? OR c.branch LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    if (status !== 'ALL') {
      if (status === 'PASS' || status === 'FAIL') {
        query += ` AND a.result = ?`;
        params.push(status);
      } else {
        query += ` AND a.status = ?`;
        params.push(status);
      }
    }

    if (branch !== 'ALL') {
      query += ` AND c.branch = ?`;
      params.push(branch);
    }

    if (flagged === 'YES') {
      query += ` AND (SELECT COUNT(*) FROM monitoring_events WHERE attempt_id = a.id AND severity IN ('Medium', 'High')) > 0`;
    }

    query += ` ORDER BY a.id DESC`;

    const candidates = db.prepare(query).all(...params);
    res.json({ candidates });
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({ error: 'فشل تحميل قائمة المتدربين' });
  }
});

// Admin Detailed Attempt Review (Timeline, Snapshots, Answers with Source Traceability)
app.get('/api/admin/attempt/:id', authenticateAdmin, (req, res) => {
  try {
    const attemptId = parseInt(req.params.id, 10);
    const attempt = db.prepare(`
      SELECT a.*, c.full_name, c.employee_code, c.branch, c.initial_snapshot, e.name as exam_name,
             e.duration_minutes, e.question_count, e.passing_percentage
      FROM attempts a
      JOIN candidates c ON a.candidate_id = c.id
      JOIN exams e ON a.exam_id = e.id
      WHERE a.id = ?
    `).get(attemptId);

    if (!attempt) {
      return res.status(404).json({ error: 'المحاولة غير موجودة' });
    }

    // Monitoring Timeline
    const timeline = db.prepare(`
      SELECT id, event_type, severity, timestamp, metadata, snapshot_id
      FROM monitoring_events
      WHERE attempt_id = ?
      ORDER BY timestamp ASC, id ASC
    `).all(attemptId);

    // Monitoring Risk Indicators
    const riskIndicators = {
      tabSwitches: timeline.filter(e => e.event_type === 'TAB_SWITCH').length,
      fullscreenExits: timeline.filter(e => e.event_type === 'FULLSCREEN_EXIT').length,
      noFaceEvents: timeline.filter(e => e.event_type === 'NO_FACE').length,
      multipleFaceEvents: timeline.filter(e => e.event_type === 'MULTIPLE_FACES').length,
      cameraDisconnects: timeline.filter(e => e.event_type === 'CAMERA_DISCONNECTED').length,
      totalEvents: timeline.length
    };

    // Snapshots Gallery
    const snapshots = db.prepare(`
      SELECT id, captured_at, trigger_event, image_data
      FROM snapshots
      WHERE attempt_id = ?
      ORDER BY captured_at ASC
    `).all(attemptId);

    // Detailed Question-by-Question Answers with Traceability
    const detailedAnswers = db.prepare(`
      SELECT aq.question_order, aq.correct_option_key, aq.options_json,
             q.question_id, q.company, q.rule_id, q.category, q.subcategory,
             q.question, q.option_a, q.option_b, q.option_c, q.option_d,
             q.correct_answer as orig_correct_answer, q.explanation, q.rule_source, q.medical_source, q.difficulty,
             ans.selected_answer, ans.is_correct, ans.answered_at
      FROM attempt_questions aq
      JOIN questions q ON aq.question_id = q.id
      LEFT JOIN answers ans ON ans.attempt_id = aq.attempt_id AND ans.question_id = aq.question_id
      WHERE aq.attempt_id = ?
      ORDER BY aq.question_order ASC
    `).all(attemptId);

    res.json({
      attempt,
      riskIndicators,
      timeline,
      snapshots,
      detailedAnswers
    });
  } catch (error) {
    console.error('Error fetching detailed attempt:', error);
    res.status(500).json({ error: 'فشل تحميل بيانات المحاولة' });
  }
});

// Admin Question Bank Management (List, Filter, Search)
app.get('/api/admin/questions', authenticateAdmin, (req, res) => {
  try {
    const {
      search = '',
      company = 'ALL',
      category = 'ALL',
      difficulty = 'ALL',
      question_type = 'ALL',
      review_status = 'ALL',
      page = 1,
      limit = 50
    } = req.query;

    let countQuery = `SELECT COUNT(*) as count FROM questions WHERE 1=1`;
    let query = `SELECT * FROM questions WHERE 1=1`;
    const params = [];

    if (search.trim()) {
      const s = `%${search.trim()}%`;
      const searchClause = ` AND (question LIKE ? OR question_id LIKE ? OR rule_id LIKE ? OR explanation LIKE ? OR rule_source LIKE ?)`;
      countQuery += searchClause;
      query += searchClause;
      params.push(s, s, s, s, s);
    }

    if (company !== 'ALL') {
      countQuery += ` AND company = ?`;
      query += ` AND company = ?`;
      params.push(company);
    }

    if (category !== 'ALL') {
      countQuery += ` AND category = ?`;
      query += ` AND category = ?`;
      params.push(category);
    }

    if (difficulty !== 'ALL') {
      countQuery += ` AND difficulty = ?`;
      query += ` AND difficulty = ?`;
      params.push(difficulty);
    }

    if (question_type !== 'ALL') {
      countQuery += ` AND question_type = ?`;
      query += ` AND question_type = ?`;
      params.push(question_type);
    }

    if (review_status !== 'ALL') {
      countQuery += ` AND review_status = ?`;
      query += ` AND review_status = ?`;
      params.push(review_status);
    }

    const total = db.prepare(countQuery).get(...params).count;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const offset = (pageNum - 1) * limitNum;

    query += ` ORDER BY id ASC LIMIT ? OFFSET ?`;
    const pageParams = [...params, limitNum, offset];

    const questions = db.prepare(query).all(...pageParams);

    // Metadata for filters
    const companies = db.prepare('SELECT DISTINCT company FROM questions ORDER BY company ASC').all().map(c => c.company);
    const categories = db.prepare('SELECT DISTINCT category FROM questions ORDER BY category ASC').all().map(c => c.category);
    const difficulties = ['Easy', 'Medium', 'Hard'];
    const questionTypes = db.prepare("SELECT DISTINCT question_type FROM questions WHERE question_type IS NOT NULL AND question_type != '' ORDER BY question_type ASC").all().map(q => q.question_type);

    res.json({
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      questions,
      filterOptions: {
        companies,
        categories,
        difficulties,
        questionTypes
      }
    });
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ error: 'فشل تحميل بنك الأسئلة' });
  }
});

// Admin Add Question
app.post('/api/admin/questions', authenticateAdmin, (req, res) => {
  try {
    const q = req.body;
    if (!q.question || !q.option_a || !q.option_b || !q.company || !q.rule_id) {
      return res.status(400).json({ error: 'جميع الحقول الأساسية مطلوبة (السؤال، الخيارات، الشركة، كود القاعدة)' });
    }

    // Auto-generate Question ID if not provided
    let qid = q.question_id;
    if (!qid) {
      const maxIdRow = db.prepare('SELECT question_id FROM questions ORDER BY id DESC LIMIT 1').get();
      const nextNum = maxIdRow ? parseInt(maxIdRow.question_id.replace(/\D/g, ''), 10) + 1 : 1;
      qid = `Q${String(nextNum).padStart(4, '0')}`;
    }

    const stmt = db.prepare(`
      INSERT INTO questions (
        question_id, company, company_status, rule_id, category, subcategory,
        question_type, medical_abbreviation, clinical_condition, medication,
        question, option_a, option_b, option_c, option_d, correct_answer,
        explanation, rule_source, medical_source, difficulty, review_status, notes, version
      ) VALUES (
        @question_id, @company, @company_status, @rule_id, @category, @subcategory,
        @question_type, @medical_abbreviation, @clinical_condition, @medication,
        @question, @option_a, @option_b, @option_c, @option_d, @correct_answer,
        @explanation, @rule_source, @medical_source, @difficulty, @review_status, @notes, '1.1'
      )
    `);

    const result = stmt.run({
      question_id: qid,
      company: q.company,
      company_status: q.company_status || 'ACTIVE',
      rule_id: q.rule_id,
      category: q.category || 'General',
      subcategory: q.subcategory || '',
      question_type: q.question_type || 'Direct Contract Rule',
      medical_abbreviation: q.medical_abbreviation || '',
      clinical_condition: q.clinical_condition || '',
      medication: q.medication || '',
      question: q.question,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c || '',
      option_d: q.option_d || '',
      correct_answer: q.correct_answer || 'A',
      explanation: q.explanation || '',
      rule_source: q.rule_source || '',
      medical_source: q.medical_source || '',
      difficulty: q.difficulty || 'Easy',
      review_status: q.review_status || 'APPROVED',
      notes: q.notes || ''
    });

    logAudit('ADMIN', req.admin.username, 'CREATE_QUESTION', qid, { company: q.company, rule_id: q.rule_id });

    res.json({ success: true, id: result.lastInsertRowid, question_id: qid });
  } catch (error) {
    console.error('Error adding question:', error);
    res.status(500).json({ error: error.message || 'فشل إضافة السؤال' });
  }
});

// Admin Edit Question
app.put('/api/admin/questions/:id', authenticateAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const q = req.body;

    const existing = db.prepare('SELECT * FROM questions WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'السؤال غير موجود' });
    }

    db.prepare(`
      UPDATE questions SET
        company = ?,
        rule_id = ?,
        category = ?,
        subcategory = ?,
        question_type = ?,
        question = ?,
        option_a = ?,
        option_b = ?,
        option_c = ?,
        option_d = ?,
        correct_answer = ?,
        explanation = ?,
        rule_source = ?,
        difficulty = ?,
        review_status = ?
      WHERE id = ?
    `).run(
      q.company || existing.company,
      q.rule_id || existing.rule_id,
      q.category || existing.category,
      q.subcategory !== undefined ? q.subcategory : existing.subcategory,
      q.question_type || existing.question_type,
      q.question || existing.question,
      q.option_a || existing.option_a,
      q.option_b || existing.option_b,
      q.option_c || existing.option_c,
      q.option_d || existing.option_d,
      q.correct_answer || existing.correct_answer,
      q.explanation !== undefined ? q.explanation : existing.explanation,
      q.rule_source !== undefined ? q.rule_source : existing.rule_source,
      q.difficulty || existing.difficulty,
      q.review_status || existing.review_status,
      id
    );

    logAudit('ADMIN', req.admin.username, 'EDIT_QUESTION', existing.question_id, {
      previous: existing.question,
      updated: q.question
    });

    res.json({ success: true, message: 'تم تحديث السؤال بنجاح' });
  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({ error: 'فشل تحديث السؤال' });
  }
});

// Admin Delete Question
app.delete('/api/admin/questions/:id', authenticateAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = db.prepare('SELECT * FROM questions WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'السؤال غير موجود' });
    }

    db.prepare('DELETE FROM questions WHERE id = ?').run(id);

    logAudit('ADMIN', req.admin.username, 'DELETE_QUESTION', existing.question_id, {
      question: existing.question
    });

    res.json({ success: true, message: 'تم حذف السؤال بنجاح' });
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({ error: 'فشل حذف السؤال' });
  }
});

// Admin Analytics (Company, Category, Weak Areas, Question Error Rates)
app.get('/api/admin/analytics', authenticateAdmin, (req, res) => {
  try {
    // 1. Question Error Rate (Questions needing review)
    const questionPerformance = db.prepare(`
      SELECT q.id, q.question_id, q.company, q.category, q.difficulty, q.question,
             COUNT(ans.id) as total_attempts,
             SUM(CASE WHEN ans.is_correct = 1 THEN 1 ELSE 0 END) as correct_count,
             SUM(CASE WHEN ans.is_correct = 0 THEN 1 ELSE 0 END) as wrong_count
      FROM questions q
      JOIN answers ans ON ans.question_id = q.id
      GROUP BY q.id
      HAVING total_attempts > 0
      ORDER BY wrong_count DESC, total_attempts DESC
      LIMIT 20
    `).all();

    // 2. Company Performance (Average score by company)
    const companyPerformance = db.prepare(`
      SELECT q.company,
             COUNT(ans.id) as total_answers,
             SUM(CASE WHEN ans.is_correct = 1 THEN 1 ELSE 0 END) as correct_answers,
             ROUND(AVG(ans.is_correct) * 100, 1) as avg_accuracy
      FROM questions q
      JOIN answers ans ON ans.question_id = q.id
      GROUP BY q.company
      HAVING total_answers >= 3
      ORDER BY avg_accuracy ASC
    `).all();

    // 3. Category / Weak Areas
    const categoryPerformance = db.prepare(`
      SELECT q.category,
             COUNT(ans.id) as total_answers,
             SUM(CASE WHEN ans.is_correct = 1 THEN 1 ELSE 0 END) as correct_answers,
             ROUND(AVG(ans.is_correct) * 100, 1) as avg_accuracy
      FROM questions q
      JOIN answers ans ON ans.question_id = q.id
      GROUP BY q.category
      HAVING total_answers >= 3
      ORDER BY avg_accuracy ASC
    `).all();

    res.json({
      questionPerformance,
      companyPerformance,
      categoryPerformance
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'فشل تحميل بيانات التحليلات' });
  }
});

// Admin Configuration & Blueprint
app.get('/api/admin/config', authenticateAdmin, (req, res) => {
  try {
    const exam = db.prepare('SELECT * FROM exams WHERE id = 1').get();
    let blueprint = {};
    if (exam && exam.blueprint) {
      try {
        blueprint = JSON.parse(exam.blueprint);
      } catch (e) {}
    }

    res.json({
      exam: {
        id: exam.id,
        name: exam.name,
        question_count: exam.question_count,
        duration_minutes: exam.duration_minutes,
        difficulty: exam.difficulty,
        passing_percentage: exam.passing_percentage,
        snapshot_interval_minutes: exam.snapshot_interval_minutes,
        blueprint
      }
    });
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({ error: 'فشل تحميل الإعدادات' });
  }
});

app.put('/api/admin/config', authenticateAdmin, (req, res) => {
  try {
    const { name, question_count, duration_minutes, passing_percentage, snapshot_interval_minutes, blueprint } = req.body;

    db.prepare(`
      UPDATE exams SET
        name = ?,
        question_count = ?,
        duration_minutes = ?,
        passing_percentage = ?,
        snapshot_interval_minutes = ?,
        blueprint = ?
      WHERE id = 1
    `).run(
      name || 'اختبار تعاقدات التأمين الطبي - صيدليات بلبع',
      parseInt(question_count, 10) || 50,
      parseInt(duration_minutes, 10) || 20,
      parseInt(passing_percentage, 10) || 70,
      parseInt(snapshot_interval_minutes, 10) || 5,
      typeof blueprint === 'string' ? blueprint : JSON.stringify(blueprint)
    );

    logAudit('ADMIN', req.admin.username, 'UPDATE_CONFIG', 'EXAM_BLUEPRINT', {
      question_count, duration_minutes, passing_percentage
    });

    res.json({ success: true, message: 'تم تحديث إعدادات الامتحان بنجاح' });
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({ error: 'فشل حفظ الإعدادات' });
  }
});

// Admin Audit Logs List
app.get('/api/admin/audit-logs', authenticateAdmin, (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100
    `).all();
    res.json({ logs });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'فشل تحميل سجل المراجعة' });
  }
});

// Admin Generate Test Attempt (Simulation tool)
app.post('/api/admin/generate-test', authenticateAdmin, (req, res) => {
  try {
    const simCode = 'TEST-' + Math.floor(1000 + Math.random() * 9000);
    const branches = ['سموحة', 'لوران', 'جليم', 'رشدي', 'المعادي', 'التجمع'];
    const branch = branches[Math.floor(Math.random() * branches.length)];

    const cand = db.prepare(`
      INSERT INTO candidates (full_name, employee_code, branch, initial_snapshot)
      VALUES (?, ?, ?, 'SIMULATION_AVATAR')
    `).run(`متدرب تجريبي (${simCode})`, simCode, branch);

    const candId = cand.lastInsertRowid;
    const att = db.prepare(`
      INSERT INTO attempts (exam_id, candidate_id, status, is_simulation, started_at)
      VALUES (1, ?, 'IN_PROGRESS', 1, CURRENT_TIMESTAMP)
    `).run(candId);

    const attId = att.lastInsertRowid;
    generateAttemptQuestions(1, attId);

    // Simulate answering some questions
    const qList = db.prepare('SELECT * FROM attempt_questions WHERE attempt_id = ?').all(attId);
    let correctCount = 0;
    for (const q of qList) {
      // 80% chance of correct answer in simulation
      const willBeCorrect = Math.random() < 0.8;
      let chosenKey = q.correct_option_key;
      if (!willBeCorrect) {
        const wrongKeys = ['A', 'B', 'C', 'D'].filter(k => k !== q.correct_option_key);
        chosenKey = wrongKeys[Math.floor(Math.random() * wrongKeys.length)];
      } else {
        correctCount++;
      }

      db.prepare(`
        INSERT INTO answers (attempt_id, question_id, selected_answer, is_correct)
        VALUES (?, ?, ?, ?)
      `).run(attId, q.question_id, chosenKey, willBeCorrect ? 1 : 0);
    }

    const percentage = Math.round((correctCount / qList.length) * 100);
    const result = percentage >= 70 ? 'PASS' : 'FAIL';

    db.prepare(`
      UPDATE attempts 
      SET status = 'SUBMITTED',
          submitted_at = CURRENT_TIMESTAMP,
          submission_reason = 'MANUAL',
          score = ?,
          percentage = ?,
          result = ?
      WHERE id = ?
    `).run(correctCount, percentage, result, attId);

    // Add simulated monitoring events
    db.prepare(`INSERT INTO monitoring_events (attempt_id, event_type, severity, metadata) VALUES (?, 'EXAM_STARTED', 'Minor', '{"sim":true}')`).run(attId);
    db.prepare(`INSERT INTO monitoring_events (attempt_id, event_type, severity, metadata) VALUES (?, 'TAB_SWITCH', 'Minor', '{"duration_sec": 4}')`).run(attId);
    db.prepare(`INSERT INTO monitoring_events (attempt_id, event_type, severity, metadata) VALUES (?, 'RETURN_TO_EXAM', 'Minor', '{}')`).run(attId);
    db.prepare(`INSERT INTO monitoring_events (attempt_id, event_type, severity, metadata) VALUES (?, 'EXAM_SUBMITTED', 'Minor', '{"sim":true}')`).run(attId);

    logAudit('ADMIN', req.admin.username, 'GENERATE_SIMULATION', `Attempt #${attId}`, {
      simCode,
      score: correctCount,
      percentage
    });

    res.json({
      success: true,
      attemptId: attId,
      code: simCode,
      score: correctCount,
      percentage,
      result
    });
  } catch (error) {
    console.error('Error generating simulation:', error);
    res.status(500).json({ error: 'فشل توليد محاولة تجريبية' });
  }
});

// Admin Export — Comprehensive 5-Sheet Excel Report
app.get('/api/admin/export/results', authenticateAdmin, (req, res) => {
  try {
    const workbook = XLSX.utils.book_new();

    // ─── Sheet 1: RESULTS ───────────────────────────────────────────
    const resultsRows = db.prepare(`
      SELECT a.id as attempt_id, c.full_name, c.employee_code, c.branch,
             e.name as exam_name, '1.0' as exam_version, '1.0' as question_bank_version,
             a.score, e.question_count as total_questions,
             a.percentage, a.result, a.started_at, a.submitted_at,
             a.submission_reason,
             e.duration_minutes,
             (SELECT COUNT(*) FROM answers WHERE attempt_id = a.id) as answered_count,
             (SELECT COUNT(*) FROM answers WHERE attempt_id = a.id AND is_correct = 1) as correct_count,
             (SELECT COUNT(*) FROM answers WHERE attempt_id = a.id AND is_correct = 0) as wrong_count,
             (SELECT COUNT(*) FROM monitoring_events WHERE attempt_id = a.id) as monitoring_event_count,
             (SELECT COUNT(*) FROM monitoring_events WHERE attempt_id = a.id AND severity IN ('Medium', 'High')) as warning_count
      FROM attempts a
      JOIN candidates c ON a.candidate_id = c.id
      JOIN exams e ON a.exam_id = e.id
      ORDER BY a.id DESC
    `).all();

    const sheet1Data = resultsRows.map(r => {
      const totalQ = r.total_questions || 50;
      const unanswered = totalQ - r.answered_count;
      let timeUsedMin = '';
      if (r.started_at && r.submitted_at) {
        const start = new Date(r.started_at.replace(' ', 'T') + (r.started_at.includes('Z') ? '' : 'Z'));
        const end = new Date(r.submitted_at.replace(' ', 'T') + (r.submitted_at.includes('Z') ? '' : 'Z'));
        timeUsedMin = Math.round((end - start) / 60000);
      }
      return {
        'اسم المتقدم': r.full_name,
        'كود الموظف': r.employee_code,
        'الفرع': r.branch,
        'الامتحان': r.exam_name,
        'إصدار الامتحان': r.exam_version,
        'إصدار بنك الأسئلة': r.question_bank_version,
        'الدرجة': r.score,
        'عدد الأسئلة': totalQ,
        'النسبة %': r.percentage,
        'النتيجة': r.result === 'PASS' ? 'ناجح' : r.result === 'FAIL' ? 'راسب' : r.result || '-',
        'وقت البدء': r.started_at,
        'وقت الانتهاء': r.submitted_at,
        'المدة المستغرقة (دقيقة)': timeUsedMin,
        'المدة المسموحة (دقيقة)': r.duration_minutes,
        'أسئلة تم الإجابة عليها': r.answered_count,
        'أسئلة لم يُجب عليها': unanswered,
        'إجابات صحيحة': r.correct_count,
        'إجابات خاطئة': r.wrong_count,
        'أحداث المراقبة': r.monitoring_event_count,
        'التنبيهات': r.warning_count,
        'سبب التسليم': r.submission_reason || '-'
      };
    });
    const ws1 = XLSX.utils.json_to_sheet(sheet1Data);
    XLSX.utils.book_append_sheet(workbook, ws1, 'النتائج');

    // ─── Sheet 2: DETAILED ANSWERS ──────────────────────────────────
    const detailedRows = db.prepare(`
      SELECT c.full_name, c.employee_code, c.branch,
             aq.question_order,
             q.question_id, q.company, q.rule_id, q.category, q.subcategory,
             q.question, q.option_a, q.option_b, q.option_c, q.option_d,
             q.correct_answer, q.explanation, q.rule_source, q.medical_source, q.difficulty,
             ans.original_selected_answer, ans.is_correct
      FROM attempt_questions aq
      JOIN questions q ON aq.question_id = q.id
      JOIN attempts a ON aq.attempt_id = a.id
      JOIN candidates c ON a.candidate_id = c.id
      LEFT JOIN answers ans ON ans.attempt_id = aq.attempt_id AND ans.question_id = aq.question_id
      ORDER BY a.id DESC, aq.question_order ASC
    `).all();

    const sheet2Data = detailedRows.map(r => ({
      'اسم المتقدم': r.full_name,
      'كود الموظف': r.employee_code,
      'الفرع': r.branch,
      'رقم السؤال': r.question_order,
      'كود السؤال': r.question_id,
      'الشركة': r.company,
      'كود القاعدة': r.rule_id,
      'التصنيف': r.category,
      'التصنيف الفرعي': r.subcategory || '-',
      'السؤال': r.question,
      'الخيار أ': r.option_a,
      'الخيار ب': r.option_b,
      'الخيار ج': r.option_c,
      'الخيار د': r.option_d,
      'إجابة المتقدم': r.original_selected_answer || 'لم يُجب',
      'الإجابة الصحيحة': r.correct_answer,
      'النتيجة': r.original_selected_answer ? (r.is_correct ? 'صحيح ✓' : 'خطأ ✗') : 'لم يُجب',
      'الشرح': r.explanation || '-',
      'مصدر القاعدة': r.rule_source || '-',
      'المصدر الطبي': r.medical_source || '-',
      'الصعوبة': r.difficulty
    }));
    const ws2 = XLSX.utils.json_to_sheet(sheet2Data);
    XLSX.utils.book_append_sheet(workbook, ws2, 'إجابات تفصيلية');

    // ─── Sheet 3: MONITORING EVENTS ─────────────────────────────────
    const monitoringRows = db.prepare(`
      SELECT c.full_name, c.employee_code,
             me.attempt_id, me.event_type, me.severity, me.timestamp, me.metadata, me.snapshot_id
      FROM monitoring_events me
      JOIN attempts a ON me.attempt_id = a.id
      JOIN candidates c ON a.candidate_id = c.id
      ORDER BY me.attempt_id DESC, me.timestamp ASC
    `).all();

    const sheet3Data = monitoringRows.map(r => ({
      'المتقدم': r.full_name,
      'كود الموظف': r.employee_code,
      'رقم المحاولة': r.attempt_id,
      'نوع الحدث': r.event_type,
      'الشدة': r.severity,
      'الوقت': r.timestamp,
      'بيانات إضافية': r.metadata || '-',
      'رقم اللقطة': r.snapshot_id || '-',
      'الحالة': 'Monitoring Event'
    }));
    const ws3 = XLSX.utils.json_to_sheet(sheet3Data);
    XLSX.utils.book_append_sheet(workbook, ws3, 'أحداث المراقبة');

    // ─── Sheet 4: QUESTION SUMMARY ──────────────────────────────────
    const questionSummary = db.prepare(`
      SELECT q.question_id, q.company, q.rule_id, q.category,
             COUNT(ans.id) as times_used,
             SUM(CASE WHEN ans.is_correct = 1 THEN 1 ELSE 0 END) as correct_count,
             SUM(CASE WHEN ans.is_correct = 0 THEN 1 ELSE 0 END) as wrong_count
      FROM questions q
      LEFT JOIN answers ans ON ans.question_id = q.id
      GROUP BY q.id
      ORDER BY q.question_id ASC
    `).all();

    const totalAttemptQuestions = db.prepare('SELECT COUNT(DISTINCT attempt_id) as c FROM attempt_questions').get().c || 1;
    const sheet4Data = questionSummary.map(r => {
      const unanswered = Math.max(0, r.times_used > 0 ? 0 : totalAttemptQuestions - r.times_used);
      const correctPct = r.times_used > 0 ? Math.round((r.correct_count / r.times_used) * 100) : 0;
      const wrongPct = r.times_used > 0 ? Math.round((r.wrong_count / r.times_used) * 100) : 0;
      return {
        'كود السؤال': r.question_id,
        'الشركة': r.company,
        'كود القاعدة': r.rule_id,
        'التصنيف': r.category,
        'عدد مرات الاستخدام': r.times_used,
        'إجابات صحيحة': r.correct_count,
        'إجابات خاطئة': r.wrong_count,
        'لم يُجب': unanswered,
        'نسبة الصحيحة %': correctPct,
        'نسبة الخاطئة %': wrongPct
      };
    });
    const ws4 = XLSX.utils.json_to_sheet(sheet4Data);
    XLSX.utils.book_append_sheet(workbook, ws4, 'ملخص الأسئلة');

    // ─── Sheet 5: COMPANY PERFORMANCE ───────────────────────────────
    const companyPerf = db.prepare(`
      SELECT q.company,
             COUNT(DISTINCT q.id) as question_count,
             COUNT(ans.id) as total_attempts,
             SUM(CASE WHEN ans.is_correct = 1 THEN 1 ELSE 0 END) as correct_answers,
             SUM(CASE WHEN ans.is_correct = 0 THEN 1 ELSE 0 END) as wrong_answers
      FROM questions q
      LEFT JOIN answers ans ON ans.question_id = q.id
      GROUP BY q.company
      ORDER BY q.company ASC
    `).all();

    const sheet5Data = companyPerf.map(r => ({
      'الشركة': r.company,
      'عدد الأسئلة': r.question_count,
      'المحاولات': r.total_attempts,
      'إجابات صحيحة': r.correct_answers,
      'إجابات خاطئة': r.wrong_answers,
      'متوسط الإجابات الصحيحة %': r.total_attempts > 0 ? Math.round((r.correct_answers / r.total_attempts) * 100) : 0,
      'مساهمة النقاط المتوسطة': r.total_attempts > 0 ? parseFloat((r.correct_answers / Math.max(1, r.total_attempts)).toFixed(2)) : 0
    }));
    const ws5 = XLSX.utils.json_to_sheet(sheet5Data);
    XLSX.utils.book_append_sheet(workbook, ws5, 'أداء الشركات');

    // ─── Generate and Send ──────────────────────────────────────────
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="Balbaa_Exam_Report.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting results:', error);
    res.status(500).json({ error: 'فشل تصدير ملف النتائج' });
  }
});

// Admin Export Question Bank to CSV
app.get('/api/admin/export/questions-csv', authenticateAdmin, (req, res) => {
  try {
    const questions = db.prepare('SELECT * FROM questions ORDER BY id ASC').all();
    const worksheet = XLSX.utils.json_to_sheet(questions);
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);

    res.setHeader('Content-Disposition', 'attachment; filename="Balbaa_Question_Bank_Export.csv"');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send('\ufeff' + csvContent);
  } catch (error) {
    console.error('Error exporting questions:', error);
    res.status(500).json({ error: 'فشل تصدير بنك الأسئلة' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    platform: 'Balbaa Pharmacies - Contracts Training Examination Platform'
  });
});

// Serve frontend in production or if build directory exists
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
}

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`Balbaa Pharmacies Examination Server running on http://localhost:${PORT}`);
  console.log(`====================================================`);
});

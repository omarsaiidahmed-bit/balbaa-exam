import React, { useState, useEffect, useRef } from 'react';
import {
  Clock, AlertTriangle, ShieldAlert, CheckCircle,
  ChevronRight, ChevronLeft, Send, Maximize, Eye,
  Camera, WifiOff, Check
} from 'lucide-react';
import { FaceDetector } from '../utils/faceDetector';
import balbaaLogo from '../R.jpg';

export default function ExamScreen({ attemptId, onExamSubmitted }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [examData, setExamData] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [savingState, setSavingState] = useState('SAVED');

  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const [isFullscreen, setIsFullscreen] = useState(true);
  const [fullscreenWarning, setFullscreenWarning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [faceStatus, setFaceStatus] = useState('NORMAL');
  const [activeWarningBanner, setActiveWarningBanner] = useState('');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const faceDetectorRef = useRef(null);
  const snapshotIntervalRef = useRef(null);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    loadAttemptData();
  }, [attemptId]);

  const loadAttemptData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/candidate/attempt/${attemptId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تحميل بيانات الاختبار');

      setExamData(data);
      setRemainingSeconds(data.remainingSeconds);

      const initialAnswers = {};
      data.questions.forEach(q => {
        if (q.selectedAnswer) initialAnswers[q.order] = q.selectedAnswer;
      });

      const localBackupKey = `balbaa_answers_attempt_${attemptId}`;
      try {
        const cached = localStorage.getItem(localBackupKey);
        if (cached) Object.assign(initialAnswers, JSON.parse(cached));
      } catch (e) {}

      setAnswers(initialAnswers);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loading || remainingSeconds <= 0) return;
    const timer = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit('TIME_EXPIRED');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [loading, remainingSeconds]);

  useEffect(() => {
    if (loading || error) return;

    const setupCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' },
          audio: false
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setCameraActive(true);

          faceDetectorRef.current = new FaceDetector(videoRef.current, (eventType, severity, meta) => {
            handleMonitoringEvent(eventType, severity, meta);
            if (eventType === 'NO_FACE') {
              setFaceStatus('NO_FACE');
              setActiveWarningBanner('⚠ تنبيه: لم يتم اكتشاف وجهك. يرجى الجلوس أمام الشاشة.');
            } else if (eventType === 'MULTIPLE_FACES') {
              setFaceStatus('MULTIPLE_FACES');
              setActiveWarningBanner('⚠ تنبيه: تم رصد أكثر من شخص في الكاميرا.');
            }
          });
          faceDetectorRef.current.start(3000);

          const intervalMins = examData?.snapshotIntervalMinutes || 5;
          snapshotIntervalRef.current = setInterval(() => {
            captureAndUploadSnapshot('INTERVAL');
          }, intervalMins * 60 * 1000);
        }
      } catch (err) {
        console.error('Camera init error:', err);
        setCameraActive(false);
        handleMonitoringEvent('CAMERA_DISCONNECTED', 'Medium', { message: 'Camera access lost' });
      }
    };

    setupCamera();

    return () => {
      if (faceDetectorRef.current) faceDetectorRef.current.stop();
      if (snapshotIntervalRef.current) clearInterval(snapshotIntervalRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [loading, error]);

  useEffect(() => {
    requestFullscreen();

    const handleFullscreenChange = () => {
      const isNowFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
      setIsFullscreen(isNowFS);
      if (!isNowFS && !isSubmittingRef.current) {
        setFullscreenWarning(true);
        handleMonitoringEvent('FULLSCREEN_EXIT', 'Medium', { timestamp: new Date().toISOString() });
      } else if (isNowFS) {
        setFullscreenWarning(false);
        handleMonitoringEvent('FULLSCREEN_ENTER', 'Minor', { timestamp: new Date().toISOString() });
      }
    };

    const handleVisibilityChange = () => {
      if (isSubmittingRef.current) return;
      if (document.hidden) {
        handleMonitoringEvent('TAB_SWITCH', 'Minor', { time: new Date().toISOString() });
        setActiveWarningBanner('⚠ تنبيه: تم رصد مغادرة نافذة الامتحان.');
      } else {
        handleMonitoringEvent('RETURN_TO_EXAM', 'Minor', { time: new Date().toISOString() });
      }
    };

    const handleBlur = () => {
      if (!isSubmittingRef.current) handleMonitoringEvent('TAB_SWITCH', 'Minor', { reason: 'window_blur' });
    };

    const handleContextMenu = (e) => e.preventDefault();
    const handleCopy = (e) => e.preventDefault();
    const handleCut = (e) => e.preventDefault();
    const handlePaste = (e) => e.preventDefault();
    const handleKeyDown = (e) => {
      if ((e.ctrlKey && (e.key === 'p' || e.key === 'P' || e.key === 's' || e.key === 'S')) || e.key === 'F12') {
        e.preventDefault();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('paste', handlePaste);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('paste', handlePaste);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const requestFullscreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) elem.requestFullscreen().catch(() => {});
    else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen().catch(() => {});
  };

  const handleMonitoringEvent = async (eventType, severity = 'Minor', metadata = {}) => {
    try {
      let snap = null;
      if (faceDetectorRef.current && (severity === 'Medium' || severity === 'High')) {
        snap = faceDetectorRef.current.captureSnapshot();
      }
      await fetch('/api/candidate/monitoring-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId, event_type: eventType, severity, metadata, snapshot_data: snap })
      });
    } catch (e) {
      console.warn('Failed to post monitoring event:', e);
    }
  };

  const captureAndUploadSnapshot = async (triggerEvent = 'INTERVAL') => {
    if (!faceDetectorRef.current) return;
    const snap = faceDetectorRef.current.captureSnapshot();
    if (!snap) return;
    try {
      await fetch('/api/candidate/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId, image_data: snap, trigger_event: triggerEvent })
      });
    } catch (e) {
      console.warn('Snapshot upload failed:', e);
    }
  };

  const handleSelectAnswer = async (questionOrder, optionKey) => {
    const updatedAnswers = { ...answers, [questionOrder]: optionKey };
    setAnswers(updatedAnswers);
    setSavingState('SAVING');

    const localBackupKey = `balbaa_answers_attempt_${attemptId}`;
    try { localStorage.setItem(localBackupKey, JSON.stringify(updatedAnswers)); } catch (e) {}

    try {
      const res = await fetch('/api/candidate/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId, questionOrder, selectedAnswer: optionKey })
      });
      if (!res.ok) throw new Error('Server autosave failed');
      setSavingState('SAVED');
    } catch (err) {
      console.warn('Autosave network issue:', err);
      setSavingState('OFFLINE');
    }
  };

  const handleSubmitExam = async (reason = 'MANUAL') => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setSubmitting(true);

    try {
      const res = await fetch('/api/candidate/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId, submission_reason: reason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تسليم الاختبار');

      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }

      try { localStorage.removeItem(`balbaa_answers_attempt_${attemptId}`); } catch (e) {}
      onExamSubmitted(attemptId);
    } catch (err) {
      alert(`حدث خطأ أثناء تسليم الاختبار: ${err.message}`);
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleAutoSubmit = (reason) => handleSubmitExam(reason);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // ─── Loading State ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="exam-loading">
        <div className="exam-loading-spinner"></div>
        <p>جاري تحميل أسئلة الاختبار ومزامنة الخادم...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="exam-error-box">
        <AlertTriangle size={24} />
        <div>
          <strong>خطأ في تحميل الامتحان</strong>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const questions = examData?.questions || [];
  const currentQuestion = questions[currentIndex] || {};
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).length;
  const isLowTime = remainingSeconds > 0 && remainingSeconds < 120;    // Critical: < 2 min
  const isWarningTime = remainingSeconds >= 120 && remainingSeconds < 300;  // Warning: 2–5 min

  // ─── Main Exam UI (Light Theme) ──────────────────────────────────
  return (
    <div className="exam-root" style={{ userSelect: 'none' }}>

      {/* Watermark */}
      <div className="balbaa-watermark" aria-hidden="true">
        <img src={balbaaLogo} alt="" />
      </div>

      {/* Top Warning Banner */}
      {activeWarningBanner && (
        <div className="exam-warning-banner">
          <AlertTriangle size={18} />
          <span>{activeWarningBanner}</span>
          <button onClick={() => setActiveWarningBanner('')} className="exam-warning-close">×</button>
        </div>
      )}

      {/* Exam Top Bar */}
      <div className="exam-topbar">
        <div className="exam-topbar-brand">
          <div className="exam-topbar-logo">
            <img src={balbaaLogo} alt="شعار بلبع" className="bento-nav-logo-img" />
          </div>
          <div>
            <div className="exam-topbar-title">صيدليات بلبع</div>
            <div className="exam-topbar-sub">اختبار تعاقدات التأمين الطبي الرسمي</div>
          </div>
        </div>

        <div className="exam-topbar-center">
          <div className="exam-candidate-chip">
            {examData?.candidate?.name} &nbsp;·&nbsp; {examData?.candidate?.branch}
          </div>
        </div>

        <div className="exam-topbar-right">
          {/* Timer */}
          <div className={`exam-timer ${isLowTime ? 'exam-timer-critical' : isWarningTime ? 'exam-timer-warning' : ''}`}>
            <Clock size={16} />
            <span className="exam-timer-digits">{formatTimer(remainingSeconds)}</span>
            <span className="exam-timer-label">الوقت المتبقي</span>
          </div>

          {/* Save status */}
          <div className="exam-save-status">
            {savingState === 'SAVING' && <span className="exam-save-saving">جاري الحفظ...</span>}
            {savingState === 'SAVED' && <span className="exam-save-ok"><Check size={13} /> تم حفظ الإجابة</span>}
            {savingState === 'OFFLINE' && <span className="exam-save-offline"><WifiOff size={13} /> دون اتصال</span>}
          </div>

          {/* Camera PiP */}
          <div className="exam-camera-pip">
            <video ref={videoRef} autoPlay playsInline muted className="exam-camera-video" />
            <div className={`exam-camera-dot ${cameraActive ? 'active' : 'inactive'}`}></div>
            <div className={`exam-face-indicator ${faceStatus !== 'NORMAL' ? 'bad' : ''}`}>
              {faceStatus === 'NORMAL' ? '✓' : '⚠'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Exam Content */}
      <div className="exam-body">
        {/* Question Panel */}
        <div className="exam-question-panel">

          {/* Question Meta */}
          <div className="exam-q-meta">
            <div className="exam-q-counter">
              السؤال <strong>{currentIndex + 1}</strong> من <strong>{totalQuestions}</strong>
            </div>
            <div className="exam-q-tags">
              <span className="exam-tag exam-tag-company">{currentQuestion.company}</span>
              <span className="exam-tag exam-tag-category">{currentQuestion.category}</span>
              {currentQuestion.subcategory && (
                <span className="exam-tag exam-tag-sub">{currentQuestion.subcategory}</span>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="exam-q-divider"></div>

          {/* Question Text */}
          <div className="exam-q-text">
            {currentQuestion.question}
          </div>

          {/* Options */}
          <div className="exam-options">
            {(currentQuestion.options || []).map((opt) => {
              const isSelected = answers[currentQuestion.order] === opt.key;
              return (
                <div
                  key={opt.key}
                  className={`exam-option ${isSelected ? 'exam-option-selected' : ''}`}
                  onClick={() => handleSelectAnswer(currentQuestion.order, opt.key)}
                >
                  <div className={`exam-option-key ${isSelected ? 'exam-option-key-selected' : ''}`}>
                    {opt.key}
                  </div>
                  <div className="exam-option-text">{opt.text}</div>
                  {isSelected && (
                    <div className="exam-option-check">
                      <Check size={16} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Navigation */}
          <div className="exam-nav">
            <button
              type="button"
              className="exam-nav-btn exam-nav-prev"
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
            >
              <ChevronRight size={18} />
              السابق
            </button>

            <div className="exam-nav-progress">
              <div className="exam-progress-bar">
                <div
                  className="exam-progress-fill"
                  style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
                ></div>
              </div>
              <span className="exam-progress-label">{answeredCount} / {totalQuestions} مُجاب</span>
            </div>

            {currentIndex < totalQuestions - 1 ? (
              <button
                type="button"
                className="exam-nav-btn exam-nav-next"
                onClick={() => setCurrentIndex(prev => Math.min(totalQuestions - 1, prev + 1))}
              >
                التالي
                <ChevronLeft size={18} />
              </button>
            ) : (
              <button
                type="button"
                className="exam-nav-btn exam-nav-submit"
                onClick={() => setShowSubmitModal(true)}
              >
                <Send size={16} />
                مراجعة وتسليم
              </button>
            )}
          </div>
        </div>

        {/* Sidebar: Navigator + Submit */}
        <div className="exam-sidebar-panel">

          {/* Question grid navigator */}
          <div className="exam-navigator">
            <div className="exam-navigator-header">
              <span>خريطة الأسئلة</span>
              <span className="exam-navigator-count">{answeredCount}/{totalQuestions}</span>
            </div>

            <div className="exam-q-grid">
              {questions.map((q, idx) => {
                const isAnswered = !!answers[q.order];
                const isCurrent = idx === currentIndex;
                return (
                  <button
                    key={q.order}
                    type="button"
                    className={`exam-q-btn ${isAnswered ? 'exam-q-btn-answered' : ''} ${isCurrent ? 'exam-q-btn-current' : ''}`}
                    onClick={() => setCurrentIndex(idx)}
                    title={`سؤال ${idx + 1}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="exam-legend">
              <span className="exam-legend-item">
                <span className="exam-legend-dot answered"></span> مُجاب
              </span>
              <span className="exam-legend-item">
                <span className="exam-legend-dot current"></span> الحالي
              </span>
              <span className="exam-legend-item">
                <span className="exam-legend-dot unanswered"></span> لم يُجب
              </span>
            </div>

            <button
              type="button"
              className="exam-submit-btn"
              onClick={() => setShowSubmitModal(true)}
            >
              <Send size={16} />
              تسليم الاختبار
            </button>
          </div>
        </div>
      </div>

      {/* ─── Fullscreen Warning Modal ─── */}
      {fullscreenWarning && (
        <div className="exam-modal-overlay">
          <div className="exam-modal exam-modal-danger">
            <ShieldAlert size={44} color="#dc2626" style={{ margin: '0 auto 1rem', display: 'block' }} />
            <h3 className="exam-modal-title" style={{ color: '#dc2626' }}>تنبيه: تم الخروج من وضع ملء الشاشة</h3>
            <p className="exam-modal-body">
              يجب البقاء في وضع ملء الشاشة طوال مدة الاختبار.<br />
              <small>يتم تسجيل هذا الحدث في سجل المراقبة الخاص بمحاولتك.</small>
            </p>
            <button className="exam-modal-btn-danger" onClick={requestFullscreen}>
              <Maximize size={17} />
              العودة إلى ملء الشاشة
            </button>
          </div>
        </div>
      )}

      {/* ─── Submit Confirmation Modal ─── */}
      {showSubmitModal && (
        <div className="exam-modal-overlay">
          <div className="exam-modal">
            <CheckCircle size={44} color="#16a34a" style={{ margin: '0 auto 1rem', display: 'block' }} />
            <h3 className="exam-modal-title">تأكيد تسليم الاختبار</h3>
            <p className="exam-modal-body">هل أنت متأكد من رغبتك في إنهاء وتسليم المحاولة الرسمية؟</p>

            <div className="exam-modal-summary">
              <div className="exam-modal-row">
                <span>إجمالي الأسئلة</span>
                <strong>{totalQuestions}</strong>
              </div>
              <div className="exam-modal-row">
                <span>تم الإجابة</span>
                <strong style={{ color: '#16a34a' }}>{answeredCount}</strong>
              </div>
              <div className="exam-modal-row">
                <span>لم يُجب عليها</span>
                <strong style={{ color: totalQuestions - answeredCount > 0 ? '#d97706' : '#6b7280' }}>
                  {totalQuestions - answeredCount}
                </strong>
              </div>
            </div>

            <div className="exam-modal-actions">
              <button
                className="exam-modal-btn-secondary"
                onClick={() => setShowSubmitModal(false)}
                disabled={submitting}
              >
                العودة للمراجعة
              </button>
              <button
                className="exam-modal-btn-primary"
                onClick={() => handleSubmitExam('MANUAL')}
                disabled={submitting}
              >
                {submitting ? 'جاري التسليم...' : 'نعم، تسليم الاختبار'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

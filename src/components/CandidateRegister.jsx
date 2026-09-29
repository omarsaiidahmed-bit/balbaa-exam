import React, { useState, useRef, useEffect } from 'react';
import {
  Camera, AlertTriangle, CheckCircle, RefreshCw, Play, Lock,
  User, Building2, Hash, Shield, ArrowRight, Check, ChevronLeft,
  Video, Eye, HelpCircle
} from 'lucide-react';

export default function CandidateRegister({ onStartExam, onResumeExam, onBackToLanding }) {
  const [fullName, setFullName] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [branch, setBranch] = useState('');
  const [cameraConsent, setCameraConsent] = useState(false);
  const [snapshotData, setSnapshotData] = useState(null);

  // Camera verification states
  const [cameraPermissionStatus, setCameraPermissionStatus] = useState('IDLE'); // 'IDLE' | 'REQUESTING' | 'GRANTED' | 'DENIED'
  const [cameraActive, setCameraActive] = useState(false);
  const [videoVerified, setVideoVerified] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);

  const [checkingCode, setCheckingCode] = useState(false);
  const [codeStatus, setCodeStatus] = useState(null);
  const [codeStatusData, setCodeStatusData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Stop camera on unmount
  useEffect(() => {
    return () => stopCamera();
  }, []);

  // Request & verify camera stream
  const requestCameraAccess = async () => {
    setCameraPermissionStatus('REQUESTING');
    setCameraError('');
    setShowPermissionGuide(false);

    // Verify browser supports mediaDevices
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraPermissionStatus('DENIED');
      setCameraError('المتصفح الحالي لا يدعم تشغيل الكاميرا. يرجى استخدام متصفح Google Chrome أو Safari الحديث.');
      return;
    }

    try {
      // Mobile-friendly camera constraints (prefer user-facing camera)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });

      // Verification Step 1: Active MediaStream exists
      if (!stream || !stream.active) {
        throw new Error('فشل التحقق من تدفق الكاميرا (MediaStream غير نشط).');
      }

      // Verification Step 2: Active VideoTrack exists
      const videoTracks = stream.getVideoTracks();
      if (!videoTracks || videoTracks.length === 0 || videoTracks[0].readyState !== 'live') {
        throw new Error('لم يتم العثور على مسار فيديو نشط من الكاميرا.');
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().then(() => {
            setCameraActive(true);
            setVideoVerified(true);
            setCameraPermissionStatus('GRANTED');
            setCameraError('');
          }).catch(playErr => {
            console.error('Video play error:', playErr);
            setVideoVerified(false);
            setCameraError('تعذر بدء تشغيل معاينة الفيديو للكاميرا.');
          });
        };
      }
    } catch (err) {
      console.error('Camera permission/access error:', err);
      stopCamera();
      setCameraPermissionStatus('DENIED');
      setVideoVerified(false);
      setCameraActive(false);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('لا يمكن بدء الامتحان بدون السماح باستخدام الكاميرا. لقد تم رفض إذن الكاميرا من المتصفح.');
        setShowPermissionGuide(true);
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('لم يتم العثور على كاميرا متصلة بجهازك. يُشترط وجود كاميرا لأداء الاختبار.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraError('الكاميرا قيد الاستخدام بواسطة تطبيق آخر. يرجى إغلاق التطبيقات الأخرى وإعادة المحاولة.');
      } else {
        setCameraError(err.message || 'تعذر تشغيل الكاميرا. يرجى التأكد من توصيل الكاميرا وإعطاء الإذن.');
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try { track.stop(); } catch (e) {}
      });
      streamRef.current = null;
    }
    setCameraActive(false);
    setVideoVerified(false);
  };

  // Capture candidate initial photo
  const takeSnapshot = () => {
    if (!videoRef.current || !cameraActive || !videoVerified) {
      setFormError('الكاميرا غير نشطة. يرجى تفعيل الكاميرا أولاً.');
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      const vWidth = videoRef.current.videoWidth || 480;
      const vHeight = videoRef.current.videoHeight || 360;
      canvas.width = 480;
      canvas.height = Math.round((vHeight / vWidth) * 480);

      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

      // Verify snapshot is valid base64 image data
      if (!dataUrl || dataUrl.length < 500 || !dataUrl.startsWith('data:image/jpeg')) {
        throw new Error('فشل حفظ الصورة الملتقطة. يرجى التقاط الصورة مرة أخرى.');
      }

      setSnapshotData(dataUrl);
      setFormError('');
    } catch (e) {
      console.error('Snapshot capture error:', e);
      setFormError(e.message || 'حدث خطأ أثناء التقاط الصورة.');
    }
  };

  // Check candidate code status
  const checkEmployeeCode = async (codeToTest) => {
    const clean = codeToTest ? codeToTest.trim() : employeeCode.trim();
    if (!clean) {
      setCodeStatus(null);
      setCodeStatusData(null);
      return;
    }

    setCheckingCode(true);
    setFormError('');
    try {
      const res = await fetch('/api/candidate/check-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_code: clean })
      });
      const data = await res.json();
      setCodeStatus(data.status);
      setCodeStatusData(data);
      if (data.candidate) {
        if (data.candidate.full_name) setFullName(data.candidate.full_name);
        if (data.candidate.branch) setBranch(data.candidate.branch);
      }
    } catch (err) {
      console.error('Code check error:', err);
    } finally {
      setCheckingCode(false);
    }
  };

  // Handle Exam Submission & Start
  const handleStartExam = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!fullName.trim()) {
      setFormError('الاسم بالكامل مطلوب.');
      return;
    }
    if (!employeeCode.trim()) {
      setFormError('كود الموظف مطلوب.');
      return;
    }
    if (!branch.trim()) {
      setFormError('اسم الفرع مطلوب.');
      return;
    }
    if (!cameraConsent) {
      setFormError('يجب الموافقة الصريحة على استخدام الكاميرا والمراقبة قبل بدء الامتحان.');
      return;
    }
    if (!cameraActive || !videoVerified) {
      setFormError('لا يمكن بدء الامتحان بدون السماح باستخدام الكاميرا والتحقق من عملها.');
      return;
    }
    if (!snapshotData) {
      setFormError('يرجى التقاط الصورة الشخصية بالكاميرا قبل بدء الامتحان.');
      return;
    }
    if (codeStatus === 'ALREADY_COMPLETED') {
      setFormError('هذا الكود استُخدم بالفعل ولا يمكن بدء محاولة جديدة.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/candidate/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          employee_code: employeeCode.trim(),
          branch: branch.trim(),
          camera_consent: true,
          initial_snapshot: snapshotData
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل تسجيل المتدرب');
      }

      stopCamera();

      if (data.resumed) {
        onResumeExam(data.attemptId);
      } else {
        onStartExam(data.attemptId);
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatRemainingMinutes = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Verification readiness check
  const isReadyToStart = (
    fullName.trim().length > 0 &&
    employeeCode.trim().length > 0 &&
    branch.trim().length > 0 &&
    cameraConsent === true &&
    cameraActive === true &&
    videoVerified === true &&
    snapshotData !== null &&
    codeStatus !== 'ALREADY_COMPLETED' &&
    !submitting
  );

  return (
    <div className="bento-reg-wrapper animate-fade-in">
      {/* Return to landing */}
      {onBackToLanding && (
        <button
          type="button"
          className="bento-back-link touch-target"
          onClick={onBackToLanding}
        >
          <ArrowRight size={18} />
          <span>العودة للرئيسية</span>
        </button>
      )}

      {/* Main Registration Card */}
      <div className="bento-reg-card">
        {/* Header */}
        <div className="bento-reg-header">
          <div className="bento-reg-header-top">
            <div className="bento-badge">
              <span className="bento-badge-dot"></span>
              <span>المرحلة الأولى · التحقق والتسجيل</span>
            </div>
            <div className="bento-reg-metric-pill font-en">
              50 سؤالاً · 20 دقيقة
            </div>
          </div>

          <h2 className="bento-reg-title">تسجيل بيانات المتقدم للاختبار</h2>
          <p className="bento-reg-subtitle">
            يرجى إدخال البيانات الوظيفية بدقة، وتفعيل الكاميرا لالتقاط صورة التحقق الرسمية.
          </p>
        </div>

        {/* Existing Completed Attempt Alert */}
        {codeStatus === 'ALREADY_COMPLETED' && (
          <div className="bento-alert bento-alert-danger animate-fade-in">
            <Lock size={22} className="bento-alert-icon" />
            <div>
              <div className="bento-alert-title">هذا الكود استُخدم بالفعل</div>
              <div className="bento-alert-body">
                المتدرب: <strong>{codeStatusData?.candidate?.full_name}</strong> — النتيجة: {codeStatusData?.attempt?.score} / 50 ({codeStatusData?.attempt?.percentage}%) — {codeStatusData?.attempt?.result === 'PASS' ? 'ناجح ✓' : 'راسب'}
              </div>
            </div>
          </div>
        )}

        {/* Can Resume Alert */}
        {codeStatus === 'CAN_RESUME' && (
          <div className="bento-alert bento-alert-warning animate-fade-in">
            <RefreshCw size={22} className="bento-alert-icon" />
            <div style={{ flex: 1 }}>
              <div className="bento-alert-title">يوجد لديك محاولة غير مكتملة</div>
              <div className="bento-alert-body">
                المتدرب: <strong>{codeStatusData?.candidate?.full_name}</strong> — تم إجابة {codeStatusData?.attempt?.answeredCount} من {codeStatusData?.attempt?.totalCount} — الوقت المتبقي: <strong className="font-en">{formatRemainingMinutes(codeStatusData?.attempt?.remainingSeconds)}</strong>
              </div>
            </div>
            <button
              type="button"
              className="bento-btn-resume touch-target"
              onClick={() => {
                stopCamera();
                onResumeExam(codeStatusData.attempt.id);
              }}
            >
              <Play size={16} />
              استكمال المحاولة
            </button>
          </div>
        )}

        {/* Form Error Message */}
        {formError && (
          <div className="bento-alert bento-alert-danger animate-fade-in">
            <AlertTriangle size={20} className="bento-alert-icon" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleStartExam} className="bento-reg-form">
          {/* Fields Grid */}
          <div className="bento-reg-fields-grid">
            {/* Full Name */}
            <div className="bento-form-group">
              <label className="bento-form-label">
                <User size={16} />
                الاسم رباعي (كما في السجلات) <span className="bento-req">*</span>
              </label>
              <input
                type="text"
                className="bento-form-input touch-input"
                placeholder="مثال: أحمد محمد عبد الرحمن علي"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={codeStatus === 'ALREADY_COMPLETED'}
                required
                autoComplete="name"
              />
            </div>

            {/* Employee Code */}
            <div className="bento-form-group">
              <label className="bento-form-label">
                <Hash size={16} />
                كود الموظف <span className="bento-req">*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="bento-form-input touch-input font-en"
                  placeholder="مثال: 1025"
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  onBlur={() => checkEmployeeCode()}
                  required
                  autoComplete="off"
                />
                {checkingCode && (
                  <span className="bento-input-status-hint">جاري التحقق...</span>
                )}
              </div>
            </div>

            {/* Branch (Free Text Input) */}
            <div className="bento-form-group">
              <label className="bento-form-label">
                <Building2 size={16} />
                الفرع <span className="bento-req">*</span>
              </label>
              <input
                type="text"
                className="bento-form-input touch-input"
                placeholder="اكتب اسم الفرع"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                disabled={codeStatus === 'ALREADY_COMPLETED'}
                required
              />
            </div>
          </div>

          {/* Camera Consent Checkbox (Required before activation) */}
          <div className="bento-consent-card">
            <label className="bento-consent-label touch-target">
              <input
                type="checkbox"
                className="bento-consent-checkbox"
                checked={cameraConsent}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setCameraConsent(checked);
                  if (checked && !cameraActive) {
                    requestCameraAccess();
                  }
                }}
                disabled={codeStatus === 'ALREADY_COMPLETED'}
                required
              />
              <span className="bento-consent-text">
                أوافق على تشغيل الكاميرا ومراقبة الجلسة أثناء الاختبار الرسمي وفق لوائح النزاهة الرقمية لصيدليات بلبع. <span className="bento-req">*</span>
              </span>
            </label>
          </div>

          {/* Camera Verification Section (Mandatory) */}
          <div className="bento-camera-box">
            <div className="bento-camera-header">
              <div className="bento-camera-title">
                <Camera size={20} className="bento-camera-icon" />
                <span>التحقق من الكاميرا والتقاط الصورة الشخصية <span className="bento-req">*</span></span>
              </div>
              {snapshotData && (
                <span className="bento-badge-success">
                  <Check size={14} /> تم التقاط الصورة وتأكيدها
                </span>
              )}
            </div>

            {/* Camera Permission Denied Error Banner */}
            {cameraPermissionStatus === 'DENIED' && (
              <div className="bento-alert bento-alert-danger animate-fade-in" style={{ marginBottom: '1.25rem' }}>
                <AlertTriangle size={22} className="bento-alert-icon" />
                <div style={{ flex: 1 }}>
                  <div className="bento-alert-title">لا يمكن بدء الامتحان بدون السماح باستخدام الكاميرا.</div>
                  <div className="bento-alert-body">{cameraError}</div>
                  {showPermissionGuide && (
                    <div className="bento-permission-guide">
                      <strong>طريقة تفعيل إذن الكاميرا:</strong>
                      <ul>
                        <li><strong>على هواتف Android (Chrome):</strong> اضغط على أيقونة القفل/الإعدادات في شريط عنوان المتصفح &larr; "أذونات" (Permissions) &larr; "الكاميرا" &larr; اختر "السماح" (Allow).</li>
                        <li><strong>على هواتف iPhone (Safari):</strong> اضغط على أيقونة "عأ" أو "AA" في شريط العنوان &larr; "إعدادات موقع الويب" (Website Settings) &larr; "الكاميرا" &larr; اختر "السماح" (Allow).</li>
                      </ul>
                    </div>
                  )}
                  <button
                    type="button"
                    className="bento-btn-primary touch-target"
                    style={{ marginTop: '0.75rem', padding: '0.6rem 1.25rem', fontSize: '0.9rem' }}
                    onClick={requestCameraAccess}
                  >
                    <Video size={16} />
                    <span>السماح بالكاميرا وإعادة المحاولة</span>
                  </button>
                </div>
              </div>
            )}

            <div className="bento-camera-grid">
              {/* Live Video Feed */}
              <div className="bento-camera-feed-card">
                <div className="bento-camera-feed-viewport">
                  <video ref={videoRef} autoPlay playsInline muted />
                  {!cameraActive && (
                    <div className="bento-camera-offline">
                      <Camera size={36} color="#94a3b8" />
                      <p style={{ marginTop: '0.5rem', fontWeight: 600 }}>الكاميرا غير مفعلة حالياً</p>
                      <button
                        type="button"
                        className="bento-btn-primary touch-target"
                        style={{ marginTop: '0.75rem', padding: '0.6rem 1.1rem', fontSize: '0.88rem' }}
                        onClick={requestCameraAccess}
                      >
                        <Video size={16} />
                        <span>تشغيل الكاميرا</span>
                      </button>
                    </div>
                  )}
                  {cameraActive && videoVerified && (
                    <div className="bento-camera-live-indicator">
                      <span className="bento-dot-green"></span>
                      <span>الكاميرا متصلة ونشطة</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="bento-btn-secondary touch-target"
                  style={{ width: '100%', marginTop: '0.75rem' }}
                  onClick={takeSnapshot}
                  disabled={!cameraActive || !videoVerified}
                >
                  <Camera size={18} />
                  <span>التقاط الصورة الشخصية المعتمدة</span>
                </button>
              </div>

              {/* Snapshot Preview */}
              <div className="bento-camera-feed-card">
                <div className="bento-camera-feed-viewport preview-bg">
                  {snapshotData ? (
                    <img src={snapshotData} alt="معاينة الصورة المعتمدة" />
                  ) : (
                    <div className="bento-camera-empty">
                      <Camera size={36} color="#cbd5e1" />
                      <p>معاينة الصورة الشخصية بعد الالتقاط</p>
                    </div>
                  )}
                </div>
                <div className="bento-camera-note">
                  تُحفظ الصورة وتُستخدم لمطابقة هوية المتدرب طوال مدة الامتحان بالرصد الآلي.
                </div>
              </div>
            </div>

            {/* Clean Camera Verification Checklist Card (Requirement 11) */}
            <div style={{
              background: 'var(--bg-canvas-subtle)',
              border: '1px solid var(--border-glass)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem 1.25rem',
              marginTop: '1rem'
            }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '0.6rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={16} color="var(--blue-accent)" />
                <span>التحقق من الكاميرا</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: cameraActive && videoVerified ? 'var(--balbaa-emerald)' : 'var(--text-muted)' }}>
                  {cameraActive && videoVerified ? <Check size={16} /> : <span style={{ width: '16px', textAlign: 'center' }}>○</span>}
                  <span style={{ fontWeight: cameraActive && videoVerified ? 700 : 500 }}>الكاميرا متصلة</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: videoVerified ? 'var(--balbaa-emerald)' : 'var(--text-muted)' }}>
                  {videoVerified ? <Check size={16} /> : <span style={{ width: '16px', textAlign: 'center' }}>○</span>}
                  <span style={{ fontWeight: videoVerified ? 700 : 500 }}>الصورة واضحة</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: snapshotData ? 'var(--balbaa-emerald)' : 'var(--text-muted)' }}>
                  {snapshotData ? <Check size={16} /> : <span style={{ width: '16px', textAlign: 'center' }}>○</span>}
                  <span style={{ fontWeight: snapshotData ? 700 : 500 }}>تم التقاط الصورة الأولية</span>
                </div>
              </div>
              {!cameraActive && (
                <div style={{ fontSize: '0.78rem', color: 'var(--balbaa-danger)', marginTop: '0.6rem', background: 'rgba(239, 68, 68, 0.06)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)' }}>
                  الكاميرا غير متاحة · يرجى السماح باستخدام الكاميرا والتأكد من أنها تعمل بشكل صحيح.
                </div>
              )}
            </div>
          </div>

          {/* Submit Action — Strictly disabled unless all camera steps succeed */}
          <div className="bento-reg-submit-wrap">
            <button
              type="submit"
              className="bento-btn-primary full-width touch-target"
              disabled={!isReadyToStart}
              id="btn-register-submit"
            >
              <Play size={20} />
              <span>{submitting ? 'جاري تجهيز بيئة الاختبار...' : 'بدء الاختبار الرسمي الآن'}</span>
            </button>
            {!isReadyToStart && (
              <div className="bento-submit-hint">
                {!cameraConsent
                  ? '• يرجى الموافقة على تشغيل الكاميرا أعلاه.'
                  : !cameraActive || !videoVerified
                  ? '• لا يمكن بدء الامتحان بدون تشغيل الكاميرا والسماح بالوصول إليها.'
                  : !snapshotData
                  ? '• يرجى الضغط على "التقاط الصورة الشخصية المعتمدة" للمتابعة.'
                  : '• يرجى استكمال جميع الحقول المطلوبة.'}
              </div>
            )}
          </div>
        </form>

        <div className="bento-reg-footer">
          <span>اختبار سري معتمد</span>
          <span>·</span>
          <span>حفظ الإجابات تلقائياً</span>
          <span>·</span>
          <span>رصد فوري لبيئة الاختبار</span>
        </div>
      </div>
    </div>
  );
}

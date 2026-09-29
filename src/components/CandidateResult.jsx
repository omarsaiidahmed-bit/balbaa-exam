import React, { useEffect, useState } from 'react';
import {
  Award, CheckCircle2, XCircle, Printer, ArrowRight,
  ShieldCheck, Building2, User, Hash, Clock
} from 'lucide-react';
import balbaaLogo from '../R.jpg';

export default function CandidateResult({ attemptId, onBackToRegister }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchResult();
  }, [attemptId]);

  const fetchResult = async () => {
    try {
      const res = await fetch(`/api/candidate/result/${attemptId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تحميل النتيجة');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="bento-loading-wrap">
        <div className="bento-spinner"></div>
        <h3 className="bento-loading-title">جاري استخراج بطاقة النتيجة الرسمية المعتمدة...</h3>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="bento-alert bento-alert-danger" style={{ maxWidth: '640px', margin: '3rem auto' }}>
        <p>{error || 'لم يتم العثور على النتيجة'}</p>
      </div>
    );
  }

  const isPass = result.result === 'PASS';

  return (
    <div className="bento-result-wrapper animate-fade-in">
      {/* Official Certificate Card */}
      <div className="bento-result-card" id="printable-result-card">
        {/* Submission Success Banner */}
        <div style={{
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '0.85rem 1.25rem',
          marginBottom: '1.5rem',
          textAlign: 'center',
          color: 'var(--balbaa-emerald)',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem'
        }}>
          <CheckCircle2 size={20} />
          <span>تم إرسال الامتحان بنجاح واعتماد النتيجة رسميًا</span>
        </div>

        {/* Brand header */}
        <div className="bento-result-header">
          <div className="bento-result-logo-badge">
            <img src={balbaaLogo} alt="شعار بلبع" className="bento-nav-logo-img" />
          </div>
          <div>
            <h2 className="bento-result-brand-title">صيدليات بلبع | Balbaa Pharmacies</h2>
            <div className="bento-result-brand-sub">إدارة التدريب والتأهيل الفني · قطاع التعاقدات الطبية</div>
          </div>
        </div>

        {/* Status Icon */}
        <div className="bento-result-icon-wrap">
          {isPass ? (
            <div className="bento-result-icon pass">
              <CheckCircle2 size={54} />
            </div>
          ) : (
            <div className="bento-result-icon fail">
              <XCircle size={54} />
            </div>
          )}
        </div>

        <h3 className="bento-result-heading">
          بطاقة نتيجة الاختبار الرسمي
        </h3>
        <p className="bento-result-exam-name">
          {result.examName}
        </p>

        {/* Candidate Details Grid */}
        <div className="bento-result-details-grid">
          <div className="bento-result-detail-box">
            <div className="bento-result-detail-label">اسم الممتحن</div>
            <div className="bento-result-detail-val">{result.candidateName}</div>
          </div>
          <div className="bento-result-detail-box">
            <div className="bento-result-detail-label">كود الموظف</div>
            <div className="bento-result-detail-val font-en accent-blue">{result.employeeCode}</div>
          </div>
          <div className="bento-result-detail-box">
            <div className="bento-result-detail-label">الفرع</div>
            <div className="bento-result-detail-val">{result.branch}</div>
          </div>
        </div>

        {/* Score & Evaluation Big Banner */}
        <div className={`bento-result-score-box ${isPass ? 'pass' : 'fail'}`}>
          <div className="bento-result-score-label">الدرجة المحققة</div>
          <div className="bento-result-score-num font-en">
            {result.score} <span className="bento-result-score-total">/ {result.totalQuestions}</span>
          </div>

          <div className="bento-result-eval-row">
            <span className="bento-result-eval-pct font-en">
              {result.percentage}%
            </span>
            <span className={`bento-result-badge ${isPass ? 'pass' : 'fail'}`}>
              {isPass ? 'اجتياز معتمد (PASS)' : 'لم يوفق (FAIL)'}
            </span>
          </div>
          <div className="bento-result-score-note">
            الحد الأدنى للاجتياز المعتمد: {result.passingPercentage}% (35 درجة)
          </div>
        </div>

        {/* Performance Metrics Breakdown Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '0.75rem',
          margin: '1.25rem 0'
        }}>
          <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.06)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16, 185, 129, 0.15)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--balbaa-emerald)', fontWeight: 700 }}>عدد الإجابات الصحيحة</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'var(--font-en)', color: 'var(--balbaa-emerald)' }}>
              {result.correctCount !== undefined ? result.correctCount : result.score}
            </div>
          </div>

          <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.06)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.15)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--balbaa-danger)', fontWeight: 700 }}>عدد الإجابات الخاطئة</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'var(--font-en)', color: 'var(--balbaa-danger)' }}>
              {result.wrongCount !== undefined ? result.wrongCount : (result.totalQuestions - result.score)}
            </div>
          </div>

          <div style={{ padding: '0.75rem', background: 'rgba(100, 116, 139, 0.06)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(100, 116, 139, 0.15)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>الأسئلة غير المجابة</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'var(--font-en)', color: 'var(--text-primary)' }}>
              {result.unansweredCount !== undefined ? result.unansweredCount : 0}
            </div>
          </div>

          <div style={{ padding: '0.75rem', background: 'rgba(37, 99, 235, 0.06)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(37, 99, 235, 0.15)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--blue-accent)', fontWeight: 700 }}>الوقت المستخدم</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'var(--font-en)', color: 'var(--blue-accent)' }}>
              {result.timeUsedMinutes || 1} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>دقيقة</span>
            </div>
          </div>
        </div>

        {/* Verification Meta */}
        <div className="bento-result-meta-row">
          <span>رقم المحاولة: <strong className="font-en">#{result.attemptId}</strong></span>
          <span>توقيت التسليم: {new Date(result.submittedAt).toLocaleString('ar-EG')}</span>
          <span>حالة المحاولة: <strong>مغلقة وموثقة (IMMUTABLE)</strong></span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bento-result-actions">
        <button
          type="button"
          className="bento-btn-secondary"
          onClick={onBackToRegister}
        >
          <ArrowRight size={18} />
          العودة للصفحة الرئيسية
        </button>

        <button
          type="button"
          className="bento-btn-primary"
          onClick={handlePrint}
        >
          <Printer size={18} />
          طباعة بطاقة النتيجة (Print / PDF)
        </button>
      </div>
    </div>
  );
}

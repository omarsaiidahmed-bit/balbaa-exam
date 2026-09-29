import React from 'react';
import {
  Shield, Clock, Building2, HelpCircle, CheckCircle2,
  Camera, Maximize2, Save, ArrowLeft, ArrowRight,
  Layers, Check, Sparkles, FileText, ChevronLeft
} from 'lucide-react';
import balbaaLogo from '../R.jpg';

export default function LandingPage({ onStartExam, onOpenInstructions }) {
  return (
    <div className="landing-container animate-fade-in">
      {/* ========================================================
          ASYMMETRIC BENTO GRID
          Archsurvey-inspired glassmorphic bento layout
          ======================================================== */}
      <div className="bento-grid">

        {/* --------------------------------------------------------
            PANEL 1: Large Primary Hero Panel
            -------------------------------------------------------- */}
        <section className="bento-card bento-hero">
          <div className="bento-hero-glow"></div>

          {/* Logo watermark inside hero card */}
          <div className="bento-hero-watermark" aria-hidden="true">
            <img src={balbaaLogo} alt="" />
          </div>

          <div className="bento-hero-content">
            <div className="bento-badge">
              <span className="bento-badge-dot"></span>
              <span>المنصة الرسمية المعتمدة · صيدليات بلبع</span>
            </div>

            <h1 className="bento-hero-title">
              اختبار التعاقدات الطبية
            </h1>

            <p className="bento-hero-desc">
              منظومة تقييم واعتماد مؤسسية محكمة مصممة لقياس الكفاءة التشغيلية والمعرفية لفرق الصيدليات في لوائح وضوابط صرف تعاقدات شركات وهيئات التأمين الطبي والرعاية الصحية.
            </p>

            <div className="bento-hero-actions">
              <button
                type="button"
                className="bento-btn-primary"
                onClick={onStartExam}
                id="btn-hero-start-exam"
              >
                <span>ابدأ الامتحان</span>
                <ChevronLeft size={18} />
              </button>

              <button
                type="button"
                className="bento-btn-secondary"
                onClick={onOpenInstructions}
                id="btn-hero-instructions"
              >
                <HelpCircle size={17} />
                <span>تعليمات الامتحان</span>
              </button>
            </div>

            <div className="bento-hero-micro-meta">
              <span className="micro-meta-item">
                <Check size={14} className="micro-check" />
                50 سؤالاً معتمداً
              </span>
              <span className="micro-meta-divider"></span>
              <span className="micro-meta-item">
                <Check size={14} className="micro-check" />
                20 دقيقة
              </span>
              <span className="micro-meta-divider"></span>
              <span className="micro-meta-item">
                <Check size={14} className="micro-check" />
                رصد ونزاهة رقمية
              </span>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------
            PANEL 2: Exam Preview Panel (Realistic visual preview)
            -------------------------------------------------------- */}
        <section className="bento-card bento-preview">
          <div className="bento-card-header">
            <div className="bento-card-title-group">
              <span className="bento-tag-muted">معاينة واجهة الاختبار</span>
              <span className="bento-preview-live-badge">Live Preview</span>
            </div>
            {/* Visual Timer Badge */}
            <div className="bento-preview-timer">
              <Clock size={14} />
              <span className="font-en">42:18</span>
            </div>
          </div>

          <div className="bento-preview-body">
            <div className="bento-preview-q-meta">
              <span className="bento-preview-q-count">السؤال 17 من 50</span>
              <span className="bento-preview-badge-company">أكسا للتأمين (AXA)</span>
            </div>

            {/* Progress indicator */}
            <div className="bento-preview-progress-track">
              <div className="bento-preview-progress-bar" style={{ width: '34%' }}></div>
            </div>

            {/* Question Text */}
            <p className="bento-preview-q-text">
              ما هو الإجراء المعتمد عند طلب صنف يستلزم موافقة مسبقة وتجاوز العميل الحد الائتماني المتاح؟
            </p>

            {/* Answer Options */}
            <div className="bento-preview-options">
              <div className="bento-preview-option">
                <span className="bento-preview-opt-key">A</span>
                <span className="bento-preview-opt-label">صرف الروشتة وتحميل الفارق على حساب الصيدلية</span>
              </div>

              <div className="bento-preview-option selected">
                <span className="bento-preview-opt-key">B</span>
                <span className="bento-preview-opt-label">التواصل مع خط الموافقات الساخن والحصول على استثناء رسمي موثق</span>
                <CheckCircle2 size={16} className="bento-preview-opt-check" />
              </div>

              <div className="bento-preview-option">
                <span className="bento-preview-opt-key">C</span>
                <span className="bento-preview-opt-label">إلغاء المطالبة بالكامل وتوجيه العميل للفرع الإقليمي</span>
              </div>
            </div>
          </div>

          <div className="bento-preview-footer">
            <span className="bento-preview-nav-btn">السابق</span>
            <span className="bento-preview-autosave">
              <span className="bento-dot-green"></span>
              تم الحفظ تلقائياً
            </span>
            <span className="bento-preview-nav-btn active">التالي</span>
          </div>
        </section>

        {/* --------------------------------------------------------
            PANEL 3: Statistics Panel (Clean visual metrics)
            -------------------------------------------------------- */}
        <section className="bento-card bento-stats">
          <div className="bento-card-header">
            <div className="bento-card-title-group">
              <h3 className="bento-card-title">المؤشرات القياسية للاختبار</h3>
              <p className="bento-card-subtitle">مواصفات الجلسة الامتحانية المعتمدة</p>
            </div>
          </div>

          <div className="bento-stats-grid">
            <div className="bento-stat-item">
              <div className="bento-stat-number font-en">50</div>
              <div className="bento-stat-label">سؤالاً اختيارياً</div>
              <div className="bento-stat-sub">Questions</div>
            </div>

            <div className="bento-stat-item">
              <div className="bento-stat-number font-en">20</div>
              <div className="bento-stat-label">دقيقة للاختبار</div>
              <div className="bento-stat-sub">Minutes</div>
            </div>

            <div className="bento-stat-item">
              <div className="bento-stat-number font-en">57</div>
              <div className="bento-stat-label">شركة وهيئة معتمدة</div>
              <div className="bento-stat-sub">Companies</div>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------
            PANEL 4: Security / Monitoring Panel
            -------------------------------------------------------- */}
        <section className="bento-card bento-security">
          <div className="bento-card-header">
            <div className="bento-card-title-group">
              <h3 className="bento-card-title">نظام الرصد والمراقبة الرقمية</h3>
              <p className="bento-card-subtitle">معايير أمان ونزاهة الاختبار الرسمي</p>
            </div>
            <div className="bento-security-shield">
              <Shield size={18} />
            </div>
          </div>

          <div className="bento-status-indicators">
            <div className="bento-status-row">
              <div className="bento-status-info">
                <span className="bento-status-icon-wrap">
                  <Camera size={16} />
                </span>
                <div>
                  <div className="bento-status-name">الكاميرا والتحقق الحي</div>
                  <div className="bento-status-desc">Camera Active · Face Detection</div>
                </div>
              </div>
              <span className="bento-status-pill green">Active</span>
            </div>

            <div className="bento-status-row">
              <div className="bento-status-info">
                <span className="bento-status-icon-wrap">
                  <Maximize2 size={16} />
                </span>
                <div>
                  <div className="bento-status-name">وضع ملء الشاشة الإلزامي</div>
                  <div className="bento-status-desc">Fullscreen Enabled · Anti-Switch</div>
                </div>
              </div>
              <span className="bento-status-pill green">Enabled</span>
            </div>

            <div className="bento-status-row">
              <div className="bento-status-info">
                <span className="bento-status-icon-wrap">
                  <Save size={16} />
                </span>
                <div>
                  <div className="bento-status-name">الحفظ التلقائي الفوري</div>
                  <div className="bento-status-desc">Auto Save Active · Real-time Sync</div>
                </div>
              </div>
              <span className="bento-status-pill blue">Active</span>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------
            PANEL 5: Question Bank Panel (Approved question bank)
            -------------------------------------------------------- */}
        <section className="bento-card bento-qbank">
          <div className="bento-card-header">
            <div className="bento-card-title-group">
              <h3 className="bento-card-title">بنك الأسئلة المعتمد</h3>
              <p className="bento-card-subtitle">Approved Question Bank · Version 2026</p>
            </div>
            <span className="bento-pill-blue">محكم رسمياً</span>
          </div>

          <div className="bento-qbank-metrics">
            <div className="bento-qbank-row">
              <div className="bento-qbank-metric-head">
                <span className="bento-qbank-label">Companies</span>
                <span className="bento-qbank-value font-en">57 شركة وهيئة</span>
              </div>
              <div className="bento-qbank-bar">
                <div className="bento-qbank-bar-fill" style={{ width: '92%' }}></div>
              </div>
            </div>

            <div className="bento-qbank-row">
              <div className="bento-qbank-metric-head">
                <span className="bento-qbank-label">Categories</span>
                <span className="bento-qbank-value font-en">ضوابط الصرف، الموافقات، النسب</span>
              </div>
              <div className="bento-qbank-bar">
                <div className="bento-qbank-bar-fill" style={{ width: '85%' }}></div>
              </div>
            </div>

            <div className="bento-qbank-row">
              <div className="bento-qbank-metric-head">
                <span className="bento-qbank-label">Rules</span>
                <span className="bento-qbank-value font-en">500+ قاعدة ولائحة تعاقدية</span>
              </div>
              <div className="bento-qbank-bar">
                <div className="bento-qbank-bar-fill" style={{ width: '96%' }}></div>
              </div>
            </div>

            <div className="bento-qbank-row">
              <div className="bento-qbank-metric-head">
                <span className="bento-qbank-label">Questions</span>
                <span className="bento-qbank-value font-en">500 سؤال محكّم ومفهرس</span>
              </div>
              <div className="bento-qbank-bar">
                <div className="bento-qbank-bar-fill" style={{ width: '100%' }}></div>
              </div>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------
            PANEL 6: Exam Flow Panel (Wide horizontal progression)
            -------------------------------------------------------- */}
        <section className="bento-card bento-flow">
          <div className="bento-card-header">
            <div className="bento-card-title-group">
              <h3 className="bento-card-title">مسار وتجربة الاختبار المعتمد</h3>
              <p className="bento-card-subtitle">خمس مراحل محكمة من تسجيل الحضور وحتى اعتماد النتيجة</p>
            </div>
          </div>

          <div className="bento-flow-steps">
            <div className="bento-flow-step">
              <div className="bento-flow-num font-en">01</div>
              <div className="bento-flow-content">
                <div className="bento-flow-title font-en">Registration</div>
                <div className="bento-flow-ar">تسجيل البيانات الوظيفية</div>
                <div className="bento-flow-desc">الاسم، كود الموظف، الفرع</div>
              </div>
            </div>

            <div className="bento-flow-line"></div>

            <div className="bento-flow-step">
              <div className="bento-flow-num font-en">02</div>
              <div className="bento-flow-content">
                <div className="bento-flow-title font-en">Verification</div>
                <div className="bento-flow-ar">التحقق والتقاط الصورة</div>
                <div className="bento-flow-desc">فحص الكاميرا ومطابقة الهوية</div>
              </div>
            </div>

            <div className="bento-flow-line"></div>

            <div className="bento-flow-step">
              <div className="bento-flow-num font-en">03</div>
              <div className="bento-flow-content">
                <div className="bento-flow-title font-en">Exam</div>
                <div className="bento-flow-ar">جلسة الاختبار الرسمية (20 دقيقة)</div>
                <div className="bento-flow-desc">50 سؤالاً مع الحفظ التلقائي</div>
              </div>
            </div>

            <div className="bento-flow-line"></div>

            <div className="bento-flow-step">
              <div className="bento-flow-num font-en">04</div>
              <div className="bento-flow-content">
                <div className="bento-flow-title font-en">Submission</div>
                <div className="bento-flow-ar">المراجعة والتسليم الرسمي</div>
                <div className="bento-flow-desc">تأكيد الإجابات وغلق المحاولة</div>
              </div>
            </div>

            <div className="bento-flow-line"></div>

            <div className="bento-flow-step highlight">
              <div className="bento-flow-num font-en">05</div>
              <div className="bento-flow-content">
                <div className="bento-flow-title font-en">Result</div>
                <div className="bento-flow-ar">النتيجة والاعتماد الفوري</div>
                <div className="bento-flow-desc">بطاقة الدرجات وطباعة الشهادة</div>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

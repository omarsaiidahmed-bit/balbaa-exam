import React from 'react';
import { Shield, Clock, AlertTriangle, CheckCircle2, X, ChevronLeft, Award } from 'lucide-react';

export default function InstructionsModal({ isOpen, onClose, onStartExam }) {
  if (!isOpen) return null;

  return (
    <div className="bento-modal-overlay" onClick={onClose}>
      <div className="bento-modal-card animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="bento-modal-header">
          <div className="bento-modal-title-group">
            <div className="bento-badge">
              <span className="bento-badge-dot"></span>
              <span>اللوائح الإلزامية</span>
            </div>
            <h2 className="bento-modal-title">تعليمات وضوابط اختبار التعاقدات الطبية</h2>
            <p className="bento-modal-subtitle">صيدليات بلبع · قطاع التدريب والتأهيل الفني</p>
          </div>
          <button type="button" className="bento-modal-close" onClick={onClose} aria-label="إغلاق">
            <X size={20} />
          </button>
        </div>

        <div className="bento-modal-content">
          <div className="bento-instruct-grid">
            <div className="bento-instruct-card">
              <div className="bento-instruct-icon-wrap blue">
                <Clock size={20} />
              </div>
              <div className="bento-instruct-text">
                <h4>زمن الجلسة والأسئلة</h4>
                <p>مدة الاختبار <strong>20 دقيقة</strong> متواصلة لـ <strong>50 سؤالاً</strong> بنظام الاختيار من متعدد. يبدأ المؤقت بمجرد فتح واجهة الامتحان ويغلق تلقائياً فور انتهاء الوقت.</p>
              </div>
            </div>

            <div className="bento-instruct-card">
              <div className="bento-instruct-icon-wrap green">
                <Award size={20} />
              </div>
              <div className="bento-instruct-text">
                <h4>معيار النجاح والاعتماد</h4>
                <p>الحد الأدنى لاجتياز الاختبار هو <strong>70%</strong> (أي الحصول على 35 درجة من 50). تصدر بطاقة النتيجة والاعتماد فور تسليم المحاولة.</p>
              </div>
            </div>

            <div className="bento-instruct-card">
              <div className="bento-instruct-icon-wrap amber">
                <Shield size={20} />
              </div>
              <div className="bento-instruct-text">
                <h4>المراقبة بالكاميرا والتحقق</h4>
                <p>يجب السماح بالوصول للكاميرا والتقاط صورة شخصية معتمدة قبل البدء. تعمل خوارزميات رصد الوجه للتأكد من تواجد المتدرب نفسه طوال فترة الامتحان.</p>
              </div>
            </div>

            <div className="bento-instruct-card">
              <div className="bento-instruct-icon-wrap purple">
                <AlertTriangle size={20} />
              </div>
              <div className="bento-instruct-text">
                <h4>بروتوكول شاشة الامتحان</h4>
                <p>يتم قفل الامتحان في وضع <strong>ملء الشاشة</strong>. يُسجّل أي خروج أو تنقل بين النوافذ أو فتح تطبيقات أخرى كحدث مراقبة رسمي في تقرير الإدارة.</p>
              </div>
            </div>
          </div>

          <div className="bento-instruct-note">
            <strong>تنبيه فني:</strong> يتم حفظ جميع إجاباتك تلقائياً وبشكل فوري على الخادم. في حال حدوث انقطاع طارئ في الإنترنت، تظل إجاباتك محفوظة ويمكن استكمال المحاولة طالما لم ينتهِ الوقت الرسمي.
          </div>
        </div>

        <div className="bento-modal-footer">
          <button type="button" className="bento-btn-secondary" onClick={onClose}>
            إغلاق
          </button>
          <button
            type="button"
            className="bento-btn-primary"
            onClick={() => {
              onClose();
              if (onStartExam) onStartExam();
            }}
          >
            <span>أوافق وابدأ التسجيل</span>
            <ChevronLeft size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

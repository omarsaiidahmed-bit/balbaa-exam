import React from 'react';
import { ChevronLeft, Lock } from 'lucide-react';
import balbaaLogo from '../R.jpg';

export default function Navbar({ currentView, setView, onOpenInstructions }) {
  return (
    <header className="bento-navbar">
      <div className="bento-nav-inner">
        {/* Brand / Logo */}
        <div
          className="bento-nav-brand"
          onClick={() => {
            if (currentView !== 'EXAM') setView('LANDING');
          }}
          role="button"
          tabIndex={0}
        >
          <div className="bento-nav-logo-badge">
            <img src={balbaaLogo} alt="شعار بلبع" className="bento-nav-logo-img" />
          </div>
          <div className="bento-nav-brand-text">
            <span className="bento-nav-title">صيدليات بلبع</span>
            <span className="bento-nav-subtitle font-en">Balbaa Pharmacies</span>
          </div>
        </div>

        {/* Minimal Navigation Links */}
        <nav className="bento-nav-links">
          <button
            type="button"
            className={`bento-nav-link ${currentView === 'LANDING' ? 'active' : ''}`}
            onClick={() => setView('LANDING')}
            disabled={currentView === 'EXAM'}
          >
            الرئيسية
          </button>

          <button
            type="button"
            className="bento-nav-link"
            onClick={onOpenInstructions}
            disabled={currentView === 'EXAM'}
          >
            تعليمات الامتحان
          </button>

          <button
            type="button"
            className={`bento-nav-link ${currentView === 'REGISTER' ? 'active' : ''}`}
            onClick={() => setView('REGISTER')}
            disabled={currentView === 'EXAM'}
          >
            الدخول للامتحان
          </button>
        </nav>

        {/* Action Group */}
        <div className="bento-nav-actions">
          {/* Subtle Admin Link */}
          <button
            type="button"
            className={`bento-nav-admin-btn ${currentView === 'ADMIN' ? 'active' : ''}`}
            onClick={() => setView('ADMIN')}
            title="بوابة إدارة الاختبارات"
            disabled={currentView === 'EXAM'}
          >
            <Lock size={14} />
            <span className="admin-btn-label">الإدارة</span>
          </button>

          {/* Primary CTA Button */}
          <button
            type="button"
            className="bento-nav-primary-btn"
            onClick={() => setView('REGISTER')}
            disabled={currentView === 'EXAM'}
            id="btn-nav-start-exam"
          >
            <span>ابدأ الامتحان</span>
            <ChevronLeft size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}

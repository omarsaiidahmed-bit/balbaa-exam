import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import LandingPage from './components/LandingPage';
import InstructionsModal from './components/InstructionsModal';
import CandidateRegister from './components/CandidateRegister';
import ExamScreen from './components/ExamScreen';
import CandidateResult from './components/CandidateResult';
import AdminPortal from './components/AdminPortal';

export default function App() {
  const [currentView, setCurrentView] = useState('LANDING'); // 'LANDING' | 'REGISTER' | 'EXAM' | 'RESULT' | 'ADMIN'
  const [activeAttemptId, setActiveAttemptId] = useState(null);
  const [completedAttemptId, setCompletedAttemptId] = useState(null);
  const [showInstructions, setShowInstructions] = useState(false);

  // Check URL hash for direct admin routing
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#admin') {
        setCurrentView('ADMIN');
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Check if an attempt is currently saved in session/local storage
  useEffect(() => {
    const savedAttemptId = localStorage.getItem('balbaa_active_attempt_id');
    if (savedAttemptId) {
      fetch(`/api/candidate/attempt/${savedAttemptId}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.attemptId && !data.error) {
            setActiveAttemptId(data.attemptId);
            setCurrentView('EXAM');
          } else {
            localStorage.removeItem('balbaa_active_attempt_id');
          }
        })
        .catch(() => {
          localStorage.removeItem('balbaa_active_attempt_id');
        });
    }
  }, []);

  const handleStartExam = (attemptId) => {
    setActiveAttemptId(attemptId);
    localStorage.setItem('balbaa_active_attempt_id', attemptId.toString());
    setCurrentView('EXAM');
  };

  const handleResumeExam = (attemptId) => {
    setActiveAttemptId(attemptId);
    localStorage.setItem('balbaa_active_attempt_id', attemptId.toString());
    setCurrentView('EXAM');
  };

  const handleExamSubmitted = (attemptId) => {
    localStorage.removeItem('balbaa_active_attempt_id');
    setActiveAttemptId(null);
    setCompletedAttemptId(attemptId);
    setCurrentView('RESULT');
  };

  const handleBackToLanding = () => {
    setCompletedAttemptId(null);
    setCurrentView('LANDING');
  };

  return (
    <div className="app-container">
      {/* Navbar hidden during active exam */}
      {currentView !== 'EXAM' && (
        <Navbar
          currentView={currentView}
          setView={(v) => {
            if (v === 'ADMIN') window.location.hash = '#admin';
            else window.location.hash = '';
            setCurrentView(v);
          }}
          onOpenInstructions={() => setShowInstructions(true)}
        />
      )}

      {/* Global Instructions Modal */}
      <InstructionsModal
        isOpen={showInstructions}
        onClose={() => setShowInstructions(false)}
        onStartExam={() => {
          setShowInstructions(false);
          setCurrentView('REGISTER');
        }}
      />

      <main className="main-content" style={currentView === 'EXAM' ? { padding: '0', maxWidth: '100%' } : {}}>
        {currentView === 'LANDING' && (
          <LandingPage
            onStartExam={() => setCurrentView('REGISTER')}
            onOpenInstructions={() => setShowInstructions(true)}
          />
        )}

        {currentView === 'REGISTER' && (
          <CandidateRegister
            onStartExam={handleStartExam}
            onResumeExam={handleResumeExam}
            onBackToLanding={handleBackToLanding}
          />
        )}

        {currentView === 'EXAM' && activeAttemptId && (
          <ExamScreen
            attemptId={activeAttemptId}
            onExamSubmitted={handleExamSubmitted}
          />
        )}

        {currentView === 'RESULT' && completedAttemptId && (
          <CandidateResult
            attemptId={completedAttemptId}
            onBackToRegister={handleBackToLanding}
          />
        )}

        {currentView === 'ADMIN' && (
          <AdminPortal
            onLogout={() => {
              window.location.hash = '';
              setCurrentView('LANDING');
            }}
          />
        )}
      </main>
    </div>
  );
}

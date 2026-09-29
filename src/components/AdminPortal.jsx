import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, HelpCircle, Settings, BarChart2,
  FileSpreadsheet, ShieldAlert, LogOut, Search, Filter,
  Download, Plus, Edit3, Trash2, Eye, Play, CheckCircle,
  XCircle, Clock, Camera, RefreshCw, AlertTriangle, Printer
} from 'lucide-react';

export default function AdminPortal({ onLogout }) {
  const [token, setToken] = useState(localStorage.getItem('balbaa_admin_token') || '');
  const [adminUser, setAdminUser] = useState(null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Admin Navigation Tabs: 'DASHBOARD' | 'CANDIDATES' | 'QUESTIONS' | 'CONFIG' | 'ANALYTICS' | 'AUDIT'
  const [activeTab, setActiveTab] = useState('DASHBOARD');

  // Dashboard state
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  // Candidates list state
  const [candidates, setCandidates] = useState([]);
  const [candSearch, setCandSearch] = useState('');
  const [candStatus, setCandStatus] = useState('ALL');
  const [candBranch, setCandBranch] = useState('ALL');
  const [candFlagged, setCandFlagged] = useState('ALL');
  const [candLoading, setCandLoading] = useState(false);

  // Detailed Attempt modal state
  const [selectedAttemptId, setSelectedAttemptId] = useState(null);
  const [attemptDetails, setAttemptDetails] = useState(null);
  const [attemptDetailsLoading, setAttemptDetailsLoading] = useState(false);
  const [answersFilter, setAnswersFilter] = useState('ALL'); // 'ALL' | 'WRONG' | 'UNANSWERED'

  // Questions management state
  const [questionsData, setQuestionsData] = useState({ questions: [], total: 0, totalPages: 1 });
  const [qSearch, setQSearch] = useState('');
  const [qCompany, setQCompany] = useState('ALL');
  const [qCategory, setQCategory] = useState('ALL');
  const [qDifficulty, setQDifficulty] = useState('ALL');
  const [qPage, setQPage] = useState(1);
  const [qFilterOptions, setQFilterOptions] = useState({ companies: [], categories: [] });
  const [qLoading, setQLoading] = useState(false);

  // Question Edit / Add modal
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [questionFormData, setQuestionFormData] = useState({
    company: '', rule_id: '', category: 'Dispensing Requirements', question: '',
    option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'A',
    explanation: '', rule_source: '', difficulty: 'Easy'
  });

  // Config state
  const [configData, setConfigData] = useState(null);
  const [configSaving, setConfigSaving] = useState(false);

  // Analytics state
  const [analyticsData, setAnalyticsData] = useState(null);

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState([]);

  // Simulation state
  const [simulating, setSimulating] = useState(false);

  // Auto-load on token change
  useEffect(() => {
    if (token) {
      loadDashboard();
    }
  }, [token]);

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // Login Handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تسجيل الدخول');

      setToken(data.token);
      setAdminUser(data.admin);
      localStorage.setItem('balbaa_admin_token', data.token);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setToken('');
    setAdminUser(null);
    localStorage.removeItem('balbaa_admin_token');
    if (onLogout) onLogout();
  };

  // Load Dashboard Data
  const loadDashboard = async () => {
    setDashboardLoading(true);
    try {
      const res = await fetch('/api/admin/dashboard', { headers: authHeaders });
      if (res.status === 401 || res.status === 403) {
        handleLogout();
        return;
      }
      const data = await res.json();
      setDashboardData(data);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setDashboardLoading(false);
    }
  };

  // Load Candidates
  const loadCandidates = async () => {
    setCandLoading(true);
    try {
      const query = new URLSearchParams({
        search: candSearch,
        status: candStatus,
        branch: candBranch,
        flagged: candFlagged
      });
      const res = await fetch(`/api/admin/candidates?${query.toString()}`, { headers: authHeaders });
      const data = await res.json();
      setCandidates(data.candidates || []);
    } catch (err) {
      console.error('Failed to load candidates:', err);
    } finally {
      setCandLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'CANDIDATES' && token) {
      loadCandidates();
    }
  }, [activeTab, candSearch, candStatus, candBranch, candFlagged]);

  // Load Attempt Details
  const viewAttemptDetails = async (attemptId) => {
    setSelectedAttemptId(attemptId);
    setAttemptDetailsLoading(true);
    try {
      const res = await fetch(`/api/admin/attempt/${attemptId}`, { headers: authHeaders });
      const data = await res.json();
      setAttemptDetails(data);
    } catch (err) {
      console.error('Failed to load attempt details:', err);
    } finally {
      setAttemptDetailsLoading(false);
    }
  };

  // Load Questions
  const loadQuestions = async () => {
    setQLoading(true);
    try {
      const query = new URLSearchParams({
        search: qSearch,
        company: qCompany,
        category: qCategory,
        difficulty: qDifficulty,
        page: qPage.toString(),
        limit: '25'
      });
      const res = await fetch(`/api/admin/questions?${query.toString()}`, { headers: authHeaders });
      const data = await res.json();
      setQuestionsData(data);
      if (data.filterOptions) {
        setQFilterOptions(data.filterOptions);
      }
    } catch (err) {
      console.error('Failed to load questions:', err);
    } finally {
      setQLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'QUESTIONS' && token) {
      loadQuestions();
    }
  }, [activeTab, qSearch, qCompany, qCategory, qDifficulty, qPage]);

  // Load Config
  const loadConfig = async () => {
    try {
      const res = await fetch('/api/admin/config', { headers: authHeaders });
      const data = await res.json();
      setConfigData(data.exam);
    } catch (err) {
      console.error('Failed to load config:', err);
    }
  };

  // Load Analytics
  const loadAnalytics = async () => {
    try {
      const res = await fetch('/api/admin/analytics', { headers: authHeaders });
      const data = await res.json();
      setAnalyticsData(data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
  };

  // Load Audit Logs
  const loadAuditLogs = async () => {
    try {
      const res = await fetch('/api/admin/audit-logs', { headers: authHeaders });
      const data = await res.json();
      setAuditLogs(data.logs || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  };

  useEffect(() => {
    if (!token) return;
    if (activeTab === 'CONFIG') loadConfig();
    if (activeTab === 'ANALYTICS') loadAnalytics();
    if (activeTab === 'AUDIT') loadAuditLogs();
  }, [activeTab, token]);

  // Simulation trigger
  const handleGenerateSimulation = async () => {
    setSimulating(true);
    try {
      const res = await fetch('/api/admin/generate-test', {
        method: 'POST',
        headers: authHeaders
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل توليد محاولة تجريبية');
      alert(`تم بنجاح توليد محاولة تجريبية بكود (${data.code}) وبدرجة: ${data.score}/50 (${data.percentage}%) - ${data.result === 'PASS' ? 'ناجح' : 'راسب'}`);
      loadDashboard();
      if (activeTab === 'CANDIDATES') loadCandidates();
    } catch (err) {
      alert(`خطأ: ${err.message}`);
    } finally {
      setSimulating(false);
    }
  };

  // Export Results.xlsx download
  const handleExportResults = async () => {
    try {
      const res = await fetch('/api/admin/export/results', { headers: authHeaders });
      if (!res.ok) throw new Error('فشل تصدير ملف النتائج');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Balbaa_Contracts_Exam_Results_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      // Fallback
      window.open(`/api/admin/export/results?token=${encodeURIComponent(token)}`, '_blank');
    }
  };

  // Export Questions CSV
  const handleExportQuestionsCsv = async () => {
    try {
      const res = await fetch('/api/admin/export/questions-csv', { headers: authHeaders });
      if (!res.ok) throw new Error('فشل تصدير بنك الأسئلة');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Balbaa_Question_Bank_Export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      // Fallback
      window.open(`/api/admin/export/questions-csv?token=${encodeURIComponent(token)}`, '_blank');
    }
  };

  // Clear Old Attempts (Reset for new exam session)
  const handleClearAttempts = async () => {
    const confirmed = window.confirm(
      'هل أنت متأكد من مسح جميع المحاولات المسجلة؟\n\nتنبيه: سيتم مسح بيانات المحاولات والمتدربين فقط، ولن يتم مسح بنك الأسئلة أو إعدادات الامتحان.'
    );
    if (!confirmed) return;

    try {
      const res = await fetch('/api/admin/clear-attempts', {
        method: 'POST',
        headers: authHeaders
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل مسح المحاولات');
      alert(data.message);
      loadDashboard();
      if (activeTab === 'CANDIDATES') loadCandidates();
    } catch (err) {
      alert('خطأ: ' + err.message);
    }
  };

  // ----------------------------------------------------
  // RENDER: LOGIN FORM (If not authenticated)
  // ----------------------------------------------------
  if (!token) {
    return (
      <div className="animate-fade-in" style={{ maxWidth: '440px', margin: '4rem auto' }}>
        <div className="glass-card" style={{ padding: '2.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div className="brand-logo-badge" style={{ margin: '0 auto 1rem', width: '52px', height: '52px' }}>ب</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>بوابة إدارة الاختبارات</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>صيدليات بلبع - منصة التحكم والمراقبة</p>
          </div>

          {loginError && (
            <div className="alert-box alert-danger">
              <AlertTriangle size={18} />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">البريد الإلكتروني / اسم المستخدم</label>
              <input
                type="text"
                className="form-input"
                placeholder="admin@balbaa.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">كلمة المرور</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', marginTop: '1rem', padding: '0.85rem' }}
              disabled={loginLoading}
            >
              {loginLoading ? 'جاري التحقق...' : 'تسجيل الدخول'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: AUTHENTICATED ADMIN PORTAL
  // ----------------------------------------------------
  return (
    <div className="animate-fade-in">
      {/* Admin Top Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>لوحة تحكم إدارة الامتحانات</h2>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            بنك الأسئلة المعتمد: 500 سؤال | النسخة 1.0 (APPROVED)
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            onClick={handleGenerateSimulation}
            disabled={simulating}
            title="توليد محاولة تجريبية كاملة لاختبار المحرك والمراقبة والنتائج"
          >
            <Play size={15} />
            {simulating ? 'جاري المحاكاة...' : 'توليد محاولة تجريبية (Simulation)'}
          </button>

          <button
            type="button"
            className="btn-primary"
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            onClick={handleExportResults}
          >
            <Download size={15} />
            تصدير كشف النتائج (Results.xlsx)
          </button>

          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '0.5rem 0.8rem', color: 'var(--balbaa-danger)' }}
            onClick={handleLogout}
            title="تسجيل الخروج"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Admin Subnav Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
        <button
          className={`nav-btn ${activeTab === 'DASHBOARD' ? 'active' : ''}`}
          onClick={() => setActiveTab('DASHBOARD')}
        >
          <LayoutDashboard size={17} />
          المؤشرات العامة (Dashboard)
        </button>

        <button
          className={`nav-btn ${activeTab === 'CANDIDATES' ? 'active' : ''}`}
          onClick={() => setActiveTab('CANDIDATES')}
        >
          <Users size={17} />
          المتدربون والمحاولات (Candidates)
        </button>

        <button
          className={`nav-btn ${activeTab === 'QUESTIONS' ? 'active' : ''}`}
          onClick={() => setActiveTab('QUESTIONS')}
        >
          <HelpCircle size={17} />
          بنك الأسئلة (500 سؤال)
        </button>

        <button
          className={`nav-btn ${activeTab === 'CONFIG' ? 'active' : ''}`}
          onClick={() => setActiveTab('CONFIG')}
        >
          <Settings size={17} />
          مخطط الامتحان (Blueprint)
        </button>

        <button
          className={`nav-btn ${activeTab === 'ANALYTICS' ? 'active' : ''}`}
          onClick={() => setActiveTab('ANALYTICS')}
        >
          <BarChart2 size={17} />
          التحليلات ونقاط الضعف
        </button>

        <button
          className={`nav-btn ${activeTab === 'AUDIT' ? 'active' : ''}`}
          onClick={() => setActiveTab('AUDIT')}
        >
          <ShieldAlert size={17} />
          سجل الرقابة (Audit Logs)
        </button>
      </div>

      {/* TAB 1: DASHBOARD */}
      {activeTab === 'DASHBOARD' && (
        <div className="animate-fade-in">
          {dashboardData && (
            <>
              {/* Metric Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>إجمالي المتدربين المسجلين</div>
                  <div style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '0.3rem', fontFamily: 'var(--font-en)' }}>
                    {dashboardData.metrics.totalCandidates}
                  </div>
                </div>

                <div className="glass-card" style={{ padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>المحاولات المكتملة</div>
                  <div style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--balbaa-emerald)', marginTop: '0.3rem', fontFamily: 'var(--font-en)' }}>
                    {dashboardData.metrics.completedAttempts}
                  </div>
                </div>

                <div className="glass-card" style={{ padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>نسبة الاجتياز (Pass Rate)</div>
                  <div style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--balbaa-teal)', marginTop: '0.3rem', fontFamily: 'var(--font-en)' }}>
                    {dashboardData.metrics.passRate}%
                  </div>
                </div>

                <div className="glass-card" style={{ padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>متوسط الدرجات الرسمي</div>
                  <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#fbbf24', marginTop: '0.3rem', fontFamily: 'var(--font-en)' }}>
                    {dashboardData.metrics.avgScore} <small style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/ 50</small>
                  </div>
                </div>

                <div className="glass-card" style={{ padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>أحداث المراقبة المسجلة</div>
                  <div style={{ fontSize: '2.2rem', fontWeight: 900, color: dashboardData.metrics.totalMonitoringEvents > 0 ? '#f87171' : 'var(--text-primary)', marginTop: '0.3rem', fontFamily: 'var(--font-en)' }}>
                    {dashboardData.metrics.totalMonitoringEvents}
                  </div>
                </div>
              </div>

              {/* Two Column Section: Company Question Coverage & Recent Attempts */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '2rem' }}>
                {/* Company Breakdown Card */}
                <div className="glass-card" style={{ padding: '1.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>تغطية الشركات في بنك الأسئلة ({dashboardData.totalCompanies} شركة)</h3>
                    <span className="badge badge-emerald">{dashboardData.totalQuestions} سؤال معتمد</span>
                  </div>

                  <div style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                    {dashboardData.companyQuestions.map((cq, i) => (
                      <div key={cq.company} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          <strong style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontFamily: 'var(--font-en)' }}>{i + 1}.</strong> {cq.company}
                        </span>
                        <span style={{ fontWeight: 800, fontFamily: 'var(--font-en)', color: 'var(--balbaa-teal)' }}>
                          {cq.count} سؤال
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Attempts Table (Requirement 28) */}
                <div className="glass-card" style={{ padding: '1.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>أحدث المحاولات</h3>
                    <span className="badge badge-blue font-en">{dashboardData.recentAttempts.length} محاولة</span>
                  </div>
                  <div className="data-table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>المتدرب</th>
                          <th>الفرع</th>
                          <th>الدرجة</th>
                          <th>النتيجة</th>
                          <th>وقت البدء</th>
                          <th>وقت الانتهاء</th>
                          <th>الحالة</th>
                          <th>أحداث المراقبة</th>
                          <th>الإجراء</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboardData.recentAttempts.length === 0 ? (
                          <tr>
                            <td colSpan="9" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                              لا توجد محاولات مسجلة حتى الآن.
                            </td>
                          </tr>
                        ) : (
                          dashboardData.recentAttempts.map(att => (
                            <tr key={att.id}>
                              <td>
                                <strong>{att.full_name}</strong>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>كود: {att.employee_code}</div>
                              </td>
                              <td>{att.branch}</td>
                              <td style={{ fontFamily: 'var(--font-en)', fontWeight: 700 }}>
                                {att.score} / 50 ({att.percentage}%)
                              </td>
                              <td>
                                <span className={`badge ${att.result === 'PASS' ? 'badge-emerald' : att.result === 'FAIL' ? 'badge-danger' : 'badge-gold'}`}>
                                  {att.result === 'PASS' ? 'ناجح' : att.result === 'FAIL' ? 'راسب' : 'نشط'}
                                </span>
                              </td>
                              <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-en)' }}>
                                {att.started_at ? new Date(att.started_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '-'}
                              </td>
                              <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-en)' }}>
                                {att.submitted_at ? new Date(att.submitted_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '-'}
                              </td>
                              <td>
                                <span className="badge" style={{ fontSize: '0.75rem', background: 'var(--bg-canvas-subtle)', color: 'var(--text-secondary)' }}>
                                  {att.status === 'SUBMITTED' ? 'مكتمل' : att.status === 'TIME_EXPIRED' ? 'انتهاء الوقت' : 'قيد الاختبار'}
                                </span>
                              </td>
                              <td>
                                <span className={`badge ${att.monitoring_count > 0 ? 'badge-gold' : 'badge-emerald'}`} style={{ fontFamily: 'var(--font-en)' }}>
                                  {att.monitoring_count || 0} حدث
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '0.35rem' }}>
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                                    onClick={() => viewAttemptDetails(att.id)}
                                    title="فحص التفاصيل والرقابة"
                                  >
                                    <Eye size={13} /> فحص
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', color: 'var(--blue-accent)' }}
                                    onClick={() => {
                                      viewAttemptDetails(att.id);
                                      setTimeout(() => window.print(), 600);
                                    }}
                                    title="طباعة التقرير الفردي A4"
                                  >
                                    <Printer size={13} /> طباعة
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: CANDIDATES & ATTEMPTS */}
      {activeTab === 'CANDIDATES' && (
        <div className="animate-fade-in">
          {/* Filters Bar */}
          <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>بحث بالاسم أو الكود</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="ابحث..."
                    value={candSearch}
                    onChange={(e) => setCandSearch(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>حالة النتيجة</label>
                <select
                  className="form-select"
                  value={candStatus}
                  onChange={(e) => setCandStatus(e.target.value)}
                >
                  <option value="ALL">جميع الحالات</option>
                  <option value="PASS">ناجح (PASS)</option>
                  <option value="FAIL">راسب (FAIL)</option>
                  <option value="IN_PROGRESS">قيد الاختبار (In Progress)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>أحداث المراقبة / الاشتباه</label>
                <select
                  className="form-select"
                  value={candFlagged}
                  onChange={(e) => setCandFlagged(e.target.value)}
                >
                  <option value="ALL">الكل</option>
                  <option value="YES">تتضمن تنبيهات مراقبة (Flagged Events)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Candidates Table */}
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>الصورة</th>
                  <th>المتدرب</th>
                  <th>كود الموظف</th>
                  <th>الفرع</th>
                  <th>الدرجة</th>
                  <th>النتيجة</th>
                  <th>مؤشرات الرقابة</th>
                  <th>وقت البدء</th>
                  <th>الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {candLoading ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '3rem' }}>جاري التحميل...</td>
                  </tr>
                ) : candidates.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>لا توجد محاولات مسجلة تطابق البحث</td>
                  </tr>
                ) : (
                  candidates.map(c => (
                    <tr key={c.attempt_id}>
                      <td>
                        {c.initial_snapshot && c.initial_snapshot.startsWith('data:') ? (
                          <img src={c.initial_snapshot} alt="Candidate" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-subtle)' }} />
                        ) : (
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            👤
                          </div>
                        )}
                      </td>
                      <td>
                        <strong>{c.full_name}</strong>
                        {c.is_simulation === 1 && (
                          <span className="badge" style={{ fontSize: '0.65rem', background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', marginRight: '0.4rem' }}>
                            محاكاة
                          </span>
                        )}
                      </td>
                      <td style={{ fontFamily: 'var(--font-en)', fontWeight: 600 }}>{c.employee_code}</td>
                      <td>{c.branch}</td>
                      <td style={{ fontFamily: 'var(--font-en)', fontWeight: 700 }}>
                        {c.status === 'IN_PROGRESS' ? 'قيد الاختبار...' : `${c.score} / 50 (${c.percentage}%)`}
                      </td>
                      <td>
                        <span className={`badge ${c.result === 'PASS' ? 'badge-emerald' : c.result === 'FAIL' ? 'badge-danger' : 'badge-gold'}`}>
                          {c.result === 'PASS' ? 'ناجح' : c.result === 'FAIL' ? 'راسب' : 'نشط'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.8rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {c.tab_switches > 0 && <span className="badge badge-gold" title="مغادرة التبويب">{c.tab_switches} تبويب</span>}
                          {c.fullscreen_exits > 0 && <span className="badge badge-danger" title="خروج من ملء الشاشة">{c.fullscreen_exits} خروج</span>}
                          {c.no_face_events > 0 && <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' }} title="عدم رصد الوجه">{c.no_face_events} غياب وجه</span>}
                          {c.total_events === 0 && <span style={{ color: 'var(--balbaa-emerald)' }}>✓ هادئ</span>}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(c.started_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                          onClick={() => viewAttemptDetails(c.attempt_id)}
                        >
                          <Eye size={14} /> فحص المحاولة
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: QUESTION BANK MANAGEMENT */}
      {activeTab === 'QUESTIONS' && (
        <div className="animate-fade-in">
          {/* Question Filter & Search Header */}
          <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>بنك الأسئلة المعتمد (500 سؤال)</h3>
                <span className="badge badge-emerald">Version 1.0</span>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                  onClick={handleExportQuestionsCsv}
                >
                  <Download size={14} /> تصدير CSV
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                  onClick={() => {
                    setIsAddingQuestion(true);
                    setQuestionFormData({
                      company: qFilterOptions.companies[0] || 'نكست كير (Nextcare)',
                      rule_id: 'R-NEW',
                      category: 'Dispensing Requirements',
                      question: '',
                      option_a: '',
                      option_b: '',
                      option_c: '',
                      option_d: '',
                      correct_answer: 'A',
                      explanation: '',
                      rule_source: '',
                      difficulty: 'Easy'
                    });
                  }}
                >
                  <Plus size={16} /> إضافة سؤال جديد
                </button>
              </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>بحث بالنص أو الكود</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="ابحث في نص السؤال، الشرح، كود القاعدة..."
                  value={qSearch}
                  onChange={(e) => { setQSearch(e.target.value); setQPage(1); }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>الشركة</label>
                <select
                  className="form-select"
                  value={qCompany}
                  onChange={(e) => { setQCompany(e.target.value); setQPage(1); }}
                >
                  <option value="ALL">جميع الشركات</option>
                  {qFilterOptions.companies.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>التصنيف</label>
                <select
                  className="form-select"
                  value={qCategory}
                  onChange={(e) => { setQCategory(e.target.value); setQPage(1); }}
                >
                  <option value="ALL">جميع التصنيفات</option>
                  {qFilterOptions.categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>الصعوبة</label>
                <select
                  className="form-select"
                  value={qDifficulty}
                  onChange={(e) => { setQDifficulty(e.target.value); setQPage(1); }}
                >
                  <option value="ALL">جميع المستويات</option>
                  <option value="Easy">Easy (سهل)</option>
                  <option value="Medium">Medium (متوسط)</option>
                  <option value="Hard">Hard (صعب)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Questions Table */}
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>المعرف</th>
                  <th>الشركة</th>
                  <th>القاعدة</th>
                  <th>التصنيف</th>
                  <th>نص السؤال</th>
                  <th>الصعوبة</th>
                  <th>الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {qLoading ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '3rem' }}>جاري التحميل...</td></tr>
                ) : questionsData.questions.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>لا توجد أسئلة تطابق الفلاتر</td></tr>
                ) : (
                  questionsData.questions.map(q => (
                    <tr key={q.id}>
                      <td style={{ fontFamily: 'var(--font-en)', fontWeight: 700, color: 'var(--balbaa-teal)' }}>{q.question_id}</td>
                      <td><strong>{q.company}</strong></td>
                      <td style={{ fontFamily: 'var(--font-en)', fontSize: '0.8rem' }}>{q.rule_id}</td>
                      <td><span className="badge badge-blue">{q.category}</span></td>
                      <td style={{ maxWidth: '350px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {q.question}
                      </td>
                      <td>
                        <span className={`badge ${q.difficulty === 'Easy' ? 'badge-emerald' : q.difficulty === 'Medium' ? 'badge-gold' : 'badge-danger'}`}>
                          {q.difficulty}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                            onClick={() => {
                              setEditingQuestion(q);
                              setQuestionFormData({ ...q });
                            }}
                          >
                            <Edit3 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            <div>إجمالي النتائج: {questionsData.total} سؤال</div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '0.4rem 0.8rem' }}
                disabled={qPage <= 1}
                onClick={() => setQPage(prev => Math.max(1, prev - 1))}
              >
                الصفحة السابقة
              </button>
              <span style={{ padding: '0.4rem 0.8rem', fontFamily: 'var(--font-en)' }}>
                {qPage} / {questionsData.totalPages || 1}
              </span>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '0.4rem 0.8rem' }}
                disabled={qPage >= questionsData.totalPages}
                onClick={() => setQPage(prev => prev + 1)}
              >
                الصفحة التالية
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: EXAM BLUEPRINT CONFIGURATION */}
      {activeTab === 'CONFIG' && (
        <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
          {configData && (
            <div className="glass-card">
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                تكوين مخطط الامتحان الرسمي (Exam Blueprint)
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">عدد الأسئلة في الامتحان</label>
                  <input
                    type="number"
                    className="form-input"
                    value={configData.question_count}
                    onChange={(e) => setConfigData({ ...configData, question_count: parseInt(e.target.value, 10) })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">مدة الاختبار (بالدقائق)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={configData.duration_minutes}
                    onChange={(e) => setConfigData({ ...configData, duration_minutes: parseInt(e.target.value, 10) })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">نسبة النجاح المقررة (%)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={configData.passing_percentage}
                    onChange={(e) => setConfigData({ ...configData, passing_percentage: parseInt(e.target.value, 10) })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">دورية لقطات الكاميرا (بالدقائق)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={configData.snapshot_interval_minutes}
                    onChange={(e) => setConfigData({ ...configData, snapshot_interval_minutes: parseInt(e.target.value, 10) })}
                  />
                </div>
              </div>

              {/* Blueprint Difficulty Distribution */}
              <div style={{ background: 'var(--bg-canvas-subtle)', padding: '1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '1px solid var(--border-glass)' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--blue-accent)' }}>
                  توزيع مستويات الصعوبة المعتمد في كل محاولة (Blueprint Distribution)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', textAlign: 'center' }}>
                  <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--balbaa-emerald)', fontWeight: 700 }}>Easy (سهل)</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-en)', color: 'var(--text-primary)' }}>35</div>
                    <small style={{ color: 'var(--text-muted)' }}>من 304 متوفر</small>
                  </div>

                  <div style={{ padding: '1rem', background: 'rgba(245, 158, 11, 0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--balbaa-gold)', fontWeight: 700 }}>Medium (متوسط)</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-en)', color: 'var(--text-primary)' }}>14</div>
                    <small style={{ color: 'var(--text-muted)' }}>من 191 متوفر</small>
                  </div>

                  <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--balbaa-danger)', fontWeight: 700 }}>Hard (صعب)</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-en)', color: 'var(--text-primary)' }}>1</div>
                    <small style={{ color: 'var(--text-muted)' }}>من 5 متوفر فقط</small>
                  </div>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                  * تطبق خوارزمية التوزيع المتوازن للشركات بحيث لا تتجاوز أي شركة 3 أسئلة في المحاولة الواحدة.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                {/* Danger Zone: Clear Attempts */}
                <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem', flex: 1, minWidth: '260px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--balbaa-danger)', marginBottom: '0.3rem' }}>⚠ منطقة الإعادة والمسح (Danger Zone)</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>يُستخدم قبل جلسة اختبار جديدة لمسح كل المحاولات والمتدربين السابقين. لا يمس بنك الأسئلة أو الإعدادات.</div>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', color: 'var(--balbaa-danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                    onClick={handleClearAttempts}
                  >
                    <Trash2 size={15} />
                    مسح جميع المحاولات السابقة (إعادة التهيئة)
                  </button>
                </div>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={async () => {
                    setConfigSaving(true);
                    try {
                      const res = await fetch('/api/admin/config', {
                        method: 'PUT',
                        headers: authHeaders,
                        body: JSON.stringify(configData)
                      });
                      if (!res.ok) throw new Error('فشل حفظ الإعدادات');
                      alert('تم تحديث إعدادات الامتحان بنجاح!');
                    } catch (e) {
                      alert(e.message);
                    } finally {
                      setConfigSaving(false);
                    }
                  }}
                  disabled={configSaving}
                >
                  {configSaving ? 'جاري الحفظ...' : 'حفظ التعديلات في المخطط'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: ANALYTICS & WEAK AREAS */}
      {activeTab === 'ANALYTICS' && (
        <div className="animate-fade-in">
          {analyticsData && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '2rem' }}>
              {/* Question Performance (Questions needing review) */}
              <div className="glass-card" style={{ padding: '1.75rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '1rem' }}>
                  الأسئلة الأكثر خطأً (تحتاج مراجعة تدريبية)
                </h3>
                <div className="data-table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>الكود</th>
                        <th>الشركة</th>
                        <th>محاولات</th>
                        <th>خطأ</th>
                        <th>دقة الإجابة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsData.questionPerformance.map(q => {
                        const accuracy = Math.round((q.correct_count / q.total_attempts) * 100);
                        return (
                          <tr key={q.id}>
                            <td style={{ fontFamily: 'var(--font-en)', fontWeight: 700 }}>{q.question_id}</td>
                            <td>{q.company}</td>
                            <td style={{ fontFamily: 'var(--font-en)' }}>{q.total_attempts}</td>
                            <td style={{ fontFamily: 'var(--font-en)', color: 'var(--balbaa-danger)' }}>{q.wrong_count}</td>
                            <td>
                              <span className={`badge ${accuracy > 60 ? 'badge-emerald' : 'badge-danger'}`}>
                                {accuracy}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Category & Topic Weak Area Analytics */}
              <div className="glass-card" style={{ padding: '1.75rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '1rem' }}>
                  تحليل نقاط الضعف حسب التصنيف (Topic / Weak Areas)
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {analyticsData.categoryPerformance.map(cat => (
                    <div key={cat.category} style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                        <strong>{cat.category}</strong>
                        <span style={{ fontFamily: 'var(--font-en)', fontWeight: 700, color: cat.avg_accuracy > 70 ? 'var(--balbaa-emerald)' : 'var(--balbaa-gold)' }}>
                          {cat.avg_accuracy}%
                        </span>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${cat.avg_accuracy}%`, height: '100%', background: cat.avg_accuracy > 70 ? 'var(--balbaa-emerald)' : 'var(--balbaa-gold)' }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: AUDIT LOGS */}
      {activeTab === 'AUDIT' && (
        <div className="animate-fade-in">
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>المعرف</th>
                  <th>النوع</th>
                  <th>المستخدم</th>
                  <th>الإجراء</th>
                  <th>الهدف</th>
                  <th>التفاصيل</th>
                  <th>التوقيت</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontFamily: 'var(--font-en)' }}>#{log.id}</td>
                    <td><span className="badge badge-blue">{log.user_type}</span></td>
                    <td style={{ fontFamily: 'var(--font-en)' }}>{log.user_id}</td>
                    <td><strong>{log.action}</strong></td>
                    <td style={{ fontFamily: 'var(--font-en)' }}>{log.target}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.details}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {new Date(log.created_at).toLocaleString('ar-EG')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DETAILED ATTEMPT REVIEW MODAL & A4 PRINTABLE REPORT (Requirement 30 & 31) */}
      {selectedAttemptId && attemptDetails && (() => {
        const totalQ = attemptDetails.attempt.question_count || 50;
        const correctCount = attemptDetails.detailedAnswers.filter(a => a.is_correct === 1).length;
        const answeredCount = attemptDetails.detailedAnswers.filter(a => a.selected_answer).length;
        const wrongCount = attemptDetails.detailedAnswers.filter(a => a.selected_answer && a.is_correct === 0).length;
        const unansweredCount = Math.max(0, totalQ - answeredCount);

        let timeUsedMin = 1;
        if (attemptDetails.attempt.started_at && attemptDetails.attempt.submitted_at) {
          const start = new Date(attemptDetails.attempt.started_at.replace(' ', 'T') + (attemptDetails.attempt.started_at.includes('Z') ? '' : 'Z'));
          const end = new Date(attemptDetails.attempt.submitted_at.replace(' ', 'T') + (attemptDetails.attempt.submitted_at.includes('Z') ? '' : 'Z'));
          timeUsedMin = Math.max(1, Math.round((end - start) / 60000));
        }

        return (
          <div className="modal-overlay">
            <div className="modal-card animate-fade-in printable-report-card" id="printable-candidate-report" style={{ maxWidth: '1050px', maxHeight: '92vh', overflowY: 'auto', textAlign: 'right' }}>
              {/* Modal Header / Report Top Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {attemptDetails.attempt.initial_snapshot && (
                    <img
                      src={attemptDetails.attempt.initial_snapshot}
                      alt="Candidate Verification"
                      style={{ width: '64px', height: '64px', borderRadius: 'var(--radius-sm)', objectFit: 'cover', border: '2px solid var(--blue-accent)' }}
                    />
                  )}
                  <div>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      تقرير فحص المحاولة: {attemptDetails.attempt.full_name}
                    </h3>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      كود: <strong className="font-en">{attemptDetails.attempt.employee_code}</strong> | الفرع: <strong>{attemptDetails.attempt.branch}</strong> | محاولة <strong className="font-en">#{attemptDetails.attempt.id}</strong>
                    </div>
                  </div>
                </div>

                <div className="no-print" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ padding: '0.45rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
                    onClick={() => window.print()}
                  >
                    <Printer size={15} />
                    طباعة التقرير (A4 / PDF)
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
                    onClick={() => { setSelectedAttemptId(null); setAttemptDetails(null); }}
                  >
                    ✕ إغلاق
                  </button>
                </div>
              </div>

              {/* Comprehensive Exam Information Panel */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem', background: 'var(--bg-canvas-subtle)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>اسم الاختبار</div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{attemptDetails.attempt.exam_name || 'اختبار تعاقدات التأمين الطبي'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>الإصدار والبنك</div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem' }} className="font-en">Exam v1.0 · Bank v1.0</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>توقيت البدء والتسليم</div>
                  <div style={{ fontSize: '0.82rem', fontFamily: 'var(--font-en)' }}>
                    {attemptDetails.attempt.started_at ? new Date(attemptDetails.attempt.started_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '-'} &larr; {attemptDetails.attempt.submitted_at ? new Date(attemptDetails.attempt.submitted_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '-'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>الوقت المستغرق / المسموح</div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem' }} className="font-en">
                    {timeUsedMin} دقيقة / 20 دقيقة
                  </div>
                </div>
              </div>

              {/* Results Breakdown Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ padding: '0.85rem', background: 'rgba(255, 255, 255, 0.7)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>الدرجة النهائية</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-en)', color: attemptDetails.attempt.result === 'PASS' ? 'var(--balbaa-emerald)' : 'var(--balbaa-danger)' }}>
                    {attemptDetails.attempt.score} / {totalQ} ({attemptDetails.attempt.percentage}%)
                  </div>
                </div>

                <div style={{ padding: '0.85rem', background: 'rgba(255, 255, 255, 0.7)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>النتيجة المعتمدة</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '0.2rem', color: attemptDetails.attempt.result === 'PASS' ? 'var(--balbaa-emerald)' : 'var(--balbaa-danger)' }}>
                    {attemptDetails.attempt.result === 'PASS' ? 'اجتياز (PASS)' : 'رسوب (FAIL)'}
                  </div>
                </div>

                <div style={{ padding: '0.85rem', background: 'rgba(16, 185, 129, 0.06)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.2)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--balbaa-emerald)', fontWeight: 700 }}>إجابات صحيحة</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-en)', color: 'var(--balbaa-emerald)' }}>
                    {correctCount}
                  </div>
                </div>

                <div style={{ padding: '0.85rem', background: 'rgba(239, 68, 68, 0.06)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239, 68, 68, 0.2)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--balbaa-danger)', fontWeight: 700 }}>إجابات خاطئة</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-en)', color: 'var(--balbaa-danger)' }}>
                    {wrongCount}
                  </div>
                </div>

                <div style={{ padding: '0.85rem', background: 'rgba(100, 116, 139, 0.06)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(100, 116, 139, 0.2)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>لم يُجب عليها</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-en)', color: 'var(--text-primary)' }}>
                    {unansweredCount}
                  </div>
                </div>

                <div style={{ padding: '0.85rem', background: 'rgba(37, 99, 235, 0.06)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(37, 99, 235, 0.2)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--blue-accent)', fontWeight: 700 }}>أحداث الرقابة</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-en)', color: 'var(--blue-accent)' }}>
                    {attemptDetails.riskIndicators.totalEvents}
                  </div>
                </div>
              </div>

            {/* Anti-cheat Chronological Timeline */}
            <div style={{ marginBottom: '2rem' }}>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--balbaa-teal)' }}>
                الخط الزمني الرقابي (Anti-Cheat Timeline)
              </h4>
              <div style={{ maxHeight: '200px', overflowY: 'auto', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                {attemptDetails.timeline.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.85rem' }}>
                    <span style={{ fontFamily: 'var(--font-en)', color: 'var(--text-muted)', minWidth: '70px' }}>
                      {new Date(item.timestamp).toLocaleTimeString('ar-EG')}
                    </span>
                    <span className={`badge ${item.severity === 'High' ? 'badge-danger' : item.severity === 'Medium' ? 'badge-gold' : 'badge-blue'}`}>
                      {item.event_type}
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>{item.metadata}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Snapshots Gallery */}
            {attemptDetails.snapshots && attemptDetails.snapshots.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--balbaa-emerald)' }}>
                  معرض لقطات الكاميرا أثناء الامتحان ({attemptDetails.snapshots.length} لقطة)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem', maxHeight: '180px', overflowY: 'auto' }}>
                  {attemptDetails.snapshots.map(s => (
                    <div key={s.id} style={{ borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                      <img src={s.image_data} alt="Snapshot" style={{ width: '100%', height: '90px', objectFit: 'cover' }} />
                      <div style={{ fontSize: '0.65rem', padding: '0.2rem', textAlign: 'center', background: '#000', color: 'var(--text-muted)', fontFamily: 'var(--font-en)' }}>
                        {new Date(s.captured_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Question-by-Question Detailed Answers with Source Traceability */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  تفاصيل الإجابات وتتبع القواعد (Source Traceability)
                </h4>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className={`btn-secondary ${answersFilter === 'ALL' ? 'active' : ''}`}
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                    onClick={() => setAnswersFilter('ALL')}
                  >
                    عرض الكل (50)
                  </button>
                  <button
                    type="button"
                    className={`btn-secondary ${answersFilter === 'WRONG' ? 'active' : ''}`}
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: 'var(--balbaa-danger)' }}
                    onClick={() => setAnswersFilter('WRONG')}
                  >
                    الإجابات الخاطئة فقط
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {attemptDetails.detailedAnswers
                  .filter(a => {
                    if (answersFilter === 'WRONG') return a.is_correct === 0;
                    return true;
                  })
                  .map(a => {
                    return (
                      <div key={a.question_order} style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div>
                            <span style={{ fontWeight: 800, color: 'var(--balbaa-teal)' }}>سؤال {a.question_order} ({a.question_id})</span>
                            <span className="badge badge-emerald" style={{ marginRight: '0.5rem' }}>{a.company}</span>
                            <span className="badge badge-blue">{a.category}</span>
                          </div>
                          <span className={`badge ${a.is_correct === 1 ? 'badge-emerald' : 'badge-danger'}`}>
                            {a.is_correct === 1 ? 'إجابة صحيحة' : 'إجابة خاطئة'}
                          </span>
                        </div>

                        <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                          {a.question}
                        </div>

                        <div style={{ fontSize: '0.85rem', display: 'flex', gap: '1.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                          <div>إجابة المتدرب: <strong style={{ color: a.is_correct === 1 ? 'var(--balbaa-emerald)' : 'var(--balbaa-danger)' }}>{a.selected_answer || 'لم يجب'}</strong></div>
                          <div>الإجابة الصحيحة: <strong style={{ color: 'var(--balbaa-emerald)' }}>{a.correct_option_key}</strong></div>
                        </div>

                        {/* Traceability */}
                        <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', borderRight: '3px solid var(--balbaa-teal)' }}>
                          <div><strong>تفسير القاعدة المعتمدة:</strong> {a.explanation}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                            كود القاعدة: <strong>{a.rule_id}</strong> | مصدر القاعدة: <strong>{a.rule_source || 'العقد المعتمد'}</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      );
    })()}

      {/* ADD / EDIT QUESTION MODAL */}
      {(editingQuestion || isAddingQuestion) && (
        <div className="modal-overlay">
          <div className="modal-card animate-fade-in" style={{ maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto', textAlign: 'right' }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '1.25rem' }}>
              {isAddingQuestion ? 'إضافة سؤال جديد إلى بنك الأسئلة' : `تعديل السؤال (${editingQuestion.question_id})`}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group">
                <label className="form-label">الشركة</label>
                <input
                  type="text"
                  className="form-input"
                  value={questionFormData.company}
                  onChange={(e) => setQuestionFormData({ ...questionFormData, company: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">كود القاعدة (Rule ID)</label>
                <input
                  type="text"
                  className="form-input"
                  value={questionFormData.rule_id}
                  onChange={(e) => setQuestionFormData({ ...questionFormData, rule_id: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">التصنيف</label>
                <input
                  type="text"
                  className="form-input"
                  value={questionFormData.category}
                  onChange={(e) => setQuestionFormData({ ...questionFormData, category: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">مستوى الصعوبة</label>
                <select
                  className="form-select"
                  value={questionFormData.difficulty}
                  onChange={(e) => setQuestionFormData({ ...questionFormData, difficulty: e.target.value })}
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">نص السؤال</label>
              <textarea
                className="form-input"
                rows="3"
                value={questionFormData.question}
                onChange={(e) => setQuestionFormData({ ...questionFormData, question: e.target.value })}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group">
                <label className="form-label">الخيار A</label>
                <input
                  type="text"
                  className="form-input"
                  value={questionFormData.option_a}
                  onChange={(e) => setQuestionFormData({ ...questionFormData, option_a: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">الخيار B</label>
                <input
                  type="text"
                  className="form-input"
                  value={questionFormData.option_b}
                  onChange={(e) => setQuestionFormData({ ...questionFormData, option_b: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">الخيار C</label>
                <input
                  type="text"
                  className="form-input"
                  value={questionFormData.option_c}
                  onChange={(e) => setQuestionFormData({ ...questionFormData, option_c: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">الخيار D</label>
                <input
                  type="text"
                  className="form-input"
                  value={questionFormData.option_d}
                  onChange={(e) => setQuestionFormData({ ...questionFormData, option_d: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">الإجابة الصحيحة الأصلية</label>
              <select
                className="form-select"
                value={questionFormData.correct_answer}
                onChange={(e) => setQuestionFormData({ ...questionFormData, correct_answer: e.target.value })}
              >
                <option value="A">الخيار A</option>
                <option value="B">الخيار B</option>
                <option value="C">الخيار C</option>
                <option value="D">الخيار D</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">الشرح والسند التعاقدي (Explanation)</label>
              <textarea
                className="form-input"
                rows="2"
                value={questionFormData.explanation}
                onChange={(e) => setQuestionFormData({ ...questionFormData, explanation: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { setEditingQuestion(null); setIsAddingQuestion(false); }}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={async () => {
                  try {
                    const url = isAddingQuestion ? '/api/admin/questions' : `/api/admin/questions/${editingQuestion.id}`;
                    const method = isAddingQuestion ? 'POST' : 'PUT';

                    const res = await fetch(url, {
                      method,
                      headers: authHeaders,
                      body: JSON.stringify(questionFormData)
                    });
                    if (!res.ok) throw new Error('فشل حفظ بيانات السؤال');
                    alert('تم حفظ السؤال بنجاح');
                    setEditingQuestion(null);
                    setIsAddingQuestion(false);
                    loadQuestions();
                  } catch (e) {
                    alert(e.message);
                  }
                }}
              >
                حفظ السؤال
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

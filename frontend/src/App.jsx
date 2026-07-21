import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';
import AuthScreen from './AuthScreen.jsx';
import {
  ScanIcon, HistoryIcon, UploadIcon, FileIcon, EditIcon,
  CheckIcon, CrossIcon, WarningIcon, ToolIcon, TrendIcon,
  TargetIcon, BulbIcon, RefreshIcon, MailIcon, PhoneIcon,
  LinkIcon, DownloadIcon, ClockIcon, CopyIcon, LogoutIcon, UserIcon,
} from './Icons.jsx';

// Falls back to localhost for local dev; set VITE_API_URL in .env for staging/prod.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const LOADING_STEPS = [
  'Reading your resume…',
  'Scanning keywords & skills…',
  'Checking formatting & structure…',
  'Scoring impact & clarity…',
  'Finalizing your report…',
];

const MAX_FILE_SIZE_MB = 8;
const TOKEN_STORAGE_KEY = 'resumecheck_token';
const USER_STORAGE_KEY = 'resumecheck_user';

// The signature motif: a wax-seal / certification stamp. Used once in the
// hero (promise of a verdict) and again on the score card (the verdict itself).
function Seal({ size = 128, label = 'ATS VERIFIED', className = '' }) {
  const pathId = `seal-curve-${label.replace(/\s+/g, '')}`;
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={`seal-svg ${className}`}>
      <defs>
        <path id={pathId} d="M 60,60 m -45,0 a 45,45 0 1,1 90,0 a 45,45 0 1,1 -90,0" />
      </defs>
      <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="1.5 4.5" opacity="0.6" />
      <circle cx="60" cy="60" r="44" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <text fontSize="7.4" letterSpacing="2.6" fill="currentColor" fontFamily="var(--font-mono)" fontWeight="600">
        <textPath href={`#${pathId}`} startOffset="2%">{label} • {label} •</textPath>
      </text>
      <path d="M42 61 L53 72 L79 45" stroke="currentColor" strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function App() {
  // ---- Auth state ----
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) || '');
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem(USER_STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  });

  const [file, setFile] = useState(null);
  const [jobDescription, setJobDescription] = useState('');
  const [showJobBox, setShowJobBox] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [viewingHistory, setViewingHistory] = useState(false);
  const [editingJD, setEditingJD] = useState(false);
  const [animatedScore, setAnimatedScore] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const reportRef = useRef(null);

  const authHeaders = () => ({ Authorization: `Bearer ${token}` });

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    setToken('');
    setUser(null);
    setFile(null);
    setResult(null);
    setMeta(null);
    setHistory([]);
    setShowHistory(false);
    setViewingHistory(false);
  };

  const handleAuthSuccess = (newToken, newUser) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  // Confirm the saved token is still valid as soon as we have one — catches
  // an expired/old token before the user hits it mid-upload.
  useEffect(() => {
    if (!token) return;
    axios.get(`${API_URL}/api/auth/me`, { headers: authHeaders() }).catch((err) => {
      if (err.response?.status === 401) {
        handleLogout();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Count the match score up from 0 whenever a new result arrives
  useEffect(() => {
    if (!result) {
      setAnimatedScore(0);
      return;
    }
    const target = result.matchScore;
    const duration = 900;
    const startTime = performance.now();
    let frame;
    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [result]);

  // Cycle through staged loading messages so the wait feels informative, not stuck.
  useEffect(() => {
    if (!loading) {
      setLoadingStep(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingStep((prev) => Math.min(prev + 1, LOADING_STEPS.length - 1));
    }, 1400);
    return () => clearInterval(interval);
  }, [loading]);

  // Auto-dismiss the error toast after a few seconds.
  useEffect(() => {
    if (!error) return;
    const timeout = setTimeout(() => setError(''), 6000);
    return () => clearTimeout(timeout);
  }, [error]);

  const validateAndSetFile = (selected) => {
    if (!selected) return;
    const isPdf = selected.type === 'application/pdf';
    const isDocx = selected.name.toLowerCase().endsWith('.docx');
    if (!isPdf && !isDocx) {
      setError('Only PDF or DOCX files are allowed.');
      return;
    }
    if (selected.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`File must be smaller than ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }
    setFile(selected);
    setResult(null);
    setError('');
  };

  const handleFileChange = (e) => validateAndSetFile(e.target.files[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    validateAndSetFile(e.dataTransfer.files?.[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a resume first.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);

    const formData = new FormData();
    formData.append('resume', file);
    if (jobDescription.trim()) {
      formData.append('jobDescription', jobDescription.trim());
    }

    try {
      const response = await axios.post(
        `${API_URL}/api/resume/upload`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data', ...authHeaders() } }
      );
      setResult(response.data.analysis);
      setMeta({
        originalName: response.data.originalName,
        pageCount: response.data.pageCount,
        hadJobDescription: response.data.hadJobDescription,
      });
    } catch (err) {
      const status = err.response?.status;
      if (status === 401) {
        handleLogout();
        setError('Your session has expired. Please log in again.');
      } else if (!err.response) {
        setError('Could not connect to the backend. Please check the server.');
      } else if (status === 413) {
        setError('The file is too large.');
      } else if (status >= 500) {
        setError('A server error occurred. Please try again shortly.');
      } else {
        setError('Something went wrong. Please check the backend.');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/resume/history`, { headers: authHeaders() });
      setHistory(response.data);
      setShowHistory(true);
    } catch (err) {
      if (err.response?.status === 401) {
        handleLogout();
        setError('Your session has expired. Please log in again.');
      } else {
        setError('Could not load history.');
      }
    }
  };

  const resetAll = () => {
    setFile(null);
    setResult(null);
    setMeta(null);
    setError('');
    setJobDescription('');
    setShowJobBox(false);
    setEditingJD(false);
    setViewingHistory(false);
  };

  const openHistoryItem = (item) => {
    try {
      const parsed = JSON.parse(item.full_analysis);
      // The DB stores the disk filename (timestamp-prefixed); strip that
      // prefix back off for a cleaner display since the original name wasn't saved separately.
      const displayName = item.filename ? item.filename.replace(/^\d+-/, '') : 'Resume';
      setResult(parsed);
      setMeta({ originalName: displayName, pageCount: null, hadJobDescription: false });
      setJobDescription('');
      setEditingJD(false);
      setViewingHistory(true);
      setShowHistory(false);
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (err) {
      console.error('Failed to parse saved analysis:', err);
      setError('Could not load this saved analysis — the data looks corrupted.');
    }
  };

  const handleDownloadReport = () => {
    window.print();
  };

  const handleCopyLine = (text, index) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex((current) => (current === index ? null : current)), 1800);
    }).catch(() => setError('Could not copy — the browser denied permission.'));
  };

  const scoreColor = (score) => {
    if (score >= 70) return 'var(--score-good)';
    if (score >= 40) return 'var(--score-mid)';
    return 'var(--score-bad)';
  };

  const statusMeta = (status) => {
    if (status === 'strong') return { label: 'Strong', color: 'var(--score-good)', Icon: CheckIcon };
    if (status === 'missing') return { label: 'Missing', color: 'var(--score-bad)', Icon: CrossIcon };
    return { label: 'No metric', color: 'var(--score-mid)', Icon: WarningIcon };
  };

  const contactRow = (label, present, Icon) => (
    <div className={`contact-chip ${present ? 'ok' : 'missing'}`}>
      <Icon width={14} height={14} />
      <span>{label}</span>
      {present ? <CheckIcon width={12} height={12} /> : <CrossIcon width={12} height={12} />}
    </div>
  );

  if (!token) {
    return <AuthScreen apiUrl={API_URL} onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="page">
      <div className="navbar">
        <div className="brand">
          <span className="brand-icon"><ScanIcon width={20} height={20} /></span>
          ATSmate
        </div>
        <div className="nav-actions">
          <button className="secondary-btn" onClick={fetchHistory} aria-label="View analysis history">
            <HistoryIcon width={15} height={15} /> History
          </button>
          <span className="nav-user">
            <UserIcon width={14} height={14} /> {user?.name}
          </span>
          <button className="secondary-btn" onClick={handleLogout} aria-label="Log out">
            <LogoutIcon width={15} height={15} /> Logout
          </button>
        </div>
      </div>

      {error && (
        <div className="toast toast-error" role="alert">
          <WarningIcon width={15} height={15} />
          <span>{error}</span>
          <button className="toast-close" onClick={() => setError('')} aria-label="Dismiss error">
            <CrossIcon width={12} height={12} />
          </button>
        </div>
      )}

      {!result && (
        <div className="hero-wrapper">
          <div className="hero-glow" aria-hidden="true"></div>
          <div className="scan-grid" aria-hidden="true"></div>

          <div className="hero-visual" aria-hidden="true">
            <div className="scan-frame">
              <svg className="scan-doc" viewBox="0 0 260 320" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" width="258" height="318" rx="14" className="doc-page" />
                <circle cx="40" cy="46" r="16" className="doc-avatar" />
                <rect x="66" y="36" width="90" height="8" rx="4" className="doc-line strong" />
                <rect x="66" y="52" width="60" height="6" rx="3" className="doc-line" />
                <rect x="24" y="86" width="212" height="5" rx="2.5" className="doc-line" />
                <rect x="24" y="100" width="180" height="5" rx="2.5" className="doc-line" />
                <rect x="24" y="114" width="200" height="5" rx="2.5" className="doc-line" />
                <rect x="24" y="140" width="70" height="6" rx="3" className="doc-line strong" />
                <rect x="24" y="156" width="212" height="5" rx="2.5" className="doc-line" />
                <rect x="24" y="170" width="150" height="5" rx="2.5" className="doc-line" />
                <rect x="24" y="184" width="190" height="5" rx="2.5" className="doc-line" />
                <rect x="24" y="210" width="70" height="6" rx="3" className="doc-line strong" />
                <rect x="24" y="226" width="212" height="5" rx="2.5" className="doc-line" />
                <rect x="24" y="240" width="165" height="5" rx="2.5" className="doc-line" />
                <rect x="24" y="254" width="195" height="5" rx="2.5" className="doc-line" />
                <rect x="24" y="280" width="90" height="5" rx="2.5" className="doc-line" />
                <rect x="122" y="280" width="90" height="5" rx="2.5" className="doc-line" />
              </svg>
              <div className="scan-beam"></div>

              <div className="seal-wrap" aria-hidden="true">
                <Seal size={118} />
              </div>

              <div className="float-badge b3">
                <TrendIcon width={13} height={13} /> Avg. impact lift +32%
              </div>
            </div>
          </div>

          <div className="hero-form-col">
            <span className="eyebrow">Dossier · ATS Diagnostic</span>
            <h1>See your resume the way <em>recruiters</em> actually do.</h1>
            <p className="subtitle">
              Upload your resume and, optionally, a job description to get a detailed
              match report — keywords, formatting, impact, and line-by-line feedback.
            </p>

            <div className="upload-box">
              <label
                className={`file-drop ${isDragging ? 'dragging' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <input type="file" accept=".pdf,.docx" onChange={handleFileChange} />
                <span className="file-drop-text">
                  {file ? (
                    <><FileIcon width={17} height={17} /> {file.name}</>
                  ) : (
                    <><UploadIcon width={17} height={17} /> {isDragging ? 'Drop it here' : 'Click or drag your resume here (PDF or DOCX)'}</>
                  )}
                </span>
              </label>

              <button className="link-btn" onClick={() => setShowJobBox(!showJobBox)}>
                {showJobBox ? '− Remove job description' : '+ Add job description (optional, for match score)'}
              </button>

              {showJobBox && (
                <textarea
                  className="job-textarea"
                  placeholder="Paste the job description here..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  rows={7}
                />
              )}

              <button className="primary-btn" onClick={handleUpload} disabled={loading}>
                {loading ? LOADING_STEPS[loadingStep] : 'Upload & analyze'}
              </button>
              {loading && (
                <div className="loading-bar" aria-hidden="true">
                  <div className="loading-bar-fill" style={{ width: `${((loadingStep + 1) / LOADING_STEPS.length) * 100}%` }} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="report-wrapper">
          <div className="report-shell" ref={reportRef}>

            {/* Sidebar: verdict at a glance, section nav, and actions — stays in view while you read */}
            <aside className="report-sidebar">
              <div className="sidebar-seal" aria-hidden="true">
                <Seal size={92} label="VERIFIED" />
              </div>
              <div className="sidebar-score">
                <span className="big-score" style={{ color: scoreColor(result.matchScore) }}>
                  {animatedScore}
                </span>
                <span className="score-caption">match score</span>
              </div>
              <div className="pill-row sidebar-pills">
                {result.isATSFriendly && (
                  <span className="pill pill-green"><CheckIcon width={12} height={12} /> ATS-friendly</span>
                )}
                <span className="pill pill-yellow">
                  <WarningIcon width={12} height={12} /> {result.gapsFound} gap{result.gapsFound === 1 ? '' : 's'}
                </span>
              </div>

              <nav className="sidebar-nav no-print">
                {[
                  { label: 'Overview', id: 'section-overview' },
                  { label: 'Header check', id: 'section-header' },
                  { label: 'Feedback', id: 'section-feedback' },
                  { label: 'Keywords', id: 'section-keywords' },
                  { label: 'Skills', id: 'section-skills' },
                  { label: 'Verdict', id: 'section-verdict' },
                ].map((s) => (
                  <button
                    key={s.id}
                    className="sidebar-nav-link"
                    onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  >
                    {s.label}
                  </button>
                ))}
              </nav>

              <div className="sidebar-actions no-print">
                <button className="download-btn" onClick={handleDownloadReport} aria-label="Download report as PDF">
                  <DownloadIcon width={15} height={15} /> Export
                </button>
                <button className="new-upload-btn" onClick={resetAll}>
                  <RefreshIcon width={15} height={15} /> Analyze another
                </button>
              </div>
            </aside>

            {/* Main content */}
            <div className="report-main">

              {viewingHistory && (
                <div className="history-banner no-print">
                  <ClockIcon width={13} height={13} /> Viewing a saved analysis from your history
                </div>
              )}

              {/* Top Row: File Card + Job Description Card */}
              <div className="top-row">
                <div className="info-card">
                  <div className="file-icon"><FileIcon width={22} height={22} /></div>
                  <div>
                    <p className="card-title">{meta?.originalName || 'Resume.pdf'}</p>
                    <p className="card-subtext">
                      Uploaded{viewingHistory ? ' · from history' : ''}
                      {meta?.pageCount ? ` · ${meta.pageCount} page${meta.pageCount === 1 ? '' : 's'}` : ''}
                    </p>
                  </div>
                </div>

                <div className="info-card jd-card">
                  <div className="jd-card-header">
                    <p className="card-label">Job description</p>
                    {!viewingHistory && (
                      <button className="edit-btn" onClick={() => setEditingJD(!editingJD)} aria-label="Edit job description">
                        <EditIcon width={13} height={13} /> {meta?.hadJobDescription ? 'Edit' : 'Add'}
                      </button>
                    )}
                  </div>
                  {viewingHistory && (
                    <p className="card-subtext jd-preview">
                      Re-upload the resume to add or change a job description for this analysis.
                    </p>
                  )}
                  {!viewingHistory && !editingJD && (
                    <p className="card-subtext jd-preview">
                      {jobDescription
                        ? jobDescription.slice(0, 90) + (jobDescription.length > 90 ? '...' : '')
                        : 'No job description added yet'}
                    </p>
                  )}
                  {!viewingHistory && editingJD && (
                    <div className="jd-edit-area">
                      <textarea
                        className="job-textarea small"
                        rows={4}
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        placeholder="Paste job description..."
                      />
                      <button className="mini-btn" onClick={handleUpload} disabled={loading}>
                        {loading ? 'Re-analyzing…' : 'Re-analyze'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Verdict summary — one sentence, given its own quiet moment */}
              <div id="section-overview" className="verdict-banner">
                <p className="verdict-quote">"{result.summary}"</p>
              </div>

              {/* Metric Cards */}
              <div className="metrics-row">
                {['keywords', 'formatting', 'impact', 'clarity', 'actionVerbs'].filter((k) => result.metrics[k] !== undefined).map((key) => (
                  <div key={key} className="metric-card" style={{ borderLeftColor: scoreColor(result.metrics[key]) }}>
                    <p className="metric-label">{key === 'actionVerbs' ? 'Action verbs' : key.charAt(0).toUpperCase() + key.slice(1)}</p>
                    <p className="metric-value" style={{ color: scoreColor(result.metrics[key]) }}>
                      {result.metrics[key]}%
                    </p>
                  </div>
                ))}
              </div>

              {/* Header check + Employment gaps side by side instead of stacked */}
              <div className="dual-row">
                {(result.contactInfo || result.pageLengthFeedback) && (
                  <div id="section-header" className="section-block">
                    <h3><FileIcon width={16} height={16} /> Header & length check</h3>
                    {result.contactInfo && (
                      <>
                        <div className="contact-chips">
                          {contactRow('Email', result.contactInfo.hasEmail, MailIcon)}
                          {contactRow('Phone', result.contactInfo.hasPhone, PhoneIcon)}
                          {contactRow('LinkedIn', result.contactInfo.hasLinkedIn, LinkIcon)}
                          {contactRow('Portfolio/GitHub', result.contactInfo.hasPortfolioOrGithub, LinkIcon)}
                        </div>
                        {result.contactInfo.note && <p className="feedback-note contact-note">{result.contactInfo.note}</p>}
                      </>
                    )}
                    {result.pageLengthFeedback && (
                      <p className="feedback-note contact-note">{result.pageLengthFeedback}</p>
                    )}
                  </div>
                )}

                {result.employmentGaps?.length > 0 && (
                  <div className="section-block">
                    <h3><ClockIcon width={16} height={16} /> Employment gaps</h3>
                    <div className="card-list">
                      {result.employmentGaps.map((g, i) => (
                        <div key={i} className="card-item card-yellow">
                          <strong>{g.period}</strong> — {g.note}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Line-by-line Feedback */}
              <div id="section-feedback" className="section-block">
                <h3><ScanIcon width={16} height={16} /> Line-by-line feedback</h3>
                <div className="feedback-list">
                  {result.lineFeedback.map((item, i) => {
                    const st = statusMeta(item.status);
                    const StIcon = st.Icon;
                    const hasRewrite = item.suggestedRewrite && item.suggestedRewrite.trim().length > 0;
                    return (
                      <div key={i} className="feedback-item">
                        <div className="feedback-text">
                          <p className="feedback-quote">"{item.quote}"</p>
                          <p className="feedback-note">{item.note}</p>
                          {hasRewrite && (
                            <div className="rewrite-box">
                              <p className="rewrite-label">Suggested rewrite</p>
                              <p className="rewrite-text">{item.suggestedRewrite}</p>
                              <button className="copy-line-btn" onClick={() => handleCopyLine(item.suggestedRewrite, i)}>
                                <CopyIcon width={12} height={12} /> {copiedIndex === i ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                          )}
                        </div>
                        <span className="feedback-status" style={{ color: st.color, borderColor: st.color }}>
                          <StIcon width={12} height={12} /> {st.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Keywords */}
              {(result.matchedKeywords?.length > 0 || result.missingKeywords?.length > 0) && (
                <div id="section-keywords" className="section-block two-col">
                  <div>
                    <h3><CheckIcon width={16} height={16} /> Matched keywords</h3>
                    <div className="tags">
                      {result.matchedKeywords?.map((k, i) => <span key={i} className="tag tag-green">{k}</span>)}
                    </div>
                  </div>
                  <div>
                    <h3><WarningIcon width={16} height={16} /> Missing keywords</h3>
                    <div className="tags">
                      {result.missingKeywords?.map((k, i) => <span key={i} className="tag tag-red">{k}</span>)}
                    </div>
                  </div>
                </div>
              )}

              {/* Skills */}
              <div id="section-skills" className="section-block">
                <h3><ToolIcon width={16} height={16} /> Skills detected</h3>
                <div className="tags">
                  {result.skills.map((s, i) => <span key={i} className="tag">{s}</span>)}
                </div>
              </div>

              {/* Strengths / Weaknesses / Suggestions — a 3-up verdict grid, not 3 stacked blocks */}
              <div id="section-verdict" className="verdict-grid">
                <div className="section-block">
                  <h3><TrendIcon width={16} height={16} /> Strengths</h3>
                  <div className="card-list">
                    {result.strengths.map((s, i) => <div key={i} className="card-item card-green">{s}</div>)}
                  </div>
                </div>

                <div className="section-block">
                  <h3><TargetIcon width={16} height={16} /> Areas to improve</h3>
                  <div className="card-list">
                    {result.weaknesses.map((w, i) => <div key={i} className="card-item card-yellow">{w}</div>)}
                  </div>
                </div>

                <div className="section-block">
                  <h3><BulbIcon width={16} height={16} /> Suggestions</h3>
                  <div className="card-list">
                    {result.suggestions.map((s, i) => <div key={i} className="card-item card-blue">{s}</div>)}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {showHistory && (
        <div className="history-overlay" onClick={() => setShowHistory(false)}>
          <div className="history-panel" onClick={(e) => e.stopPropagation()}>
            <div className="history-header">
              <h2>Analysis history</h2>
              <button className="close-btn" onClick={() => setShowHistory(false)} aria-label="Close history panel">
                <CrossIcon width={14} height={14} />
              </button>
            </div>
            {history.length === 0 && <p className="history-empty">No history found</p>}
            {history.map((item) => (
              <button
                key={item.id}
                className="history-item"
                onClick={() => openHistoryItem(item)}
              >
                <p><strong>{item.candidate_name}</strong> — Score: {item.ats_score}</p>
                <p className="history-meta">
                  {item.experience_level} · {new Date(item.created_at).toLocaleString()}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
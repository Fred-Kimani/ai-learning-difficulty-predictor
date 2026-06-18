import React, { useState, useEffect, useMemo, useCallback } from 'react';

// Predefined set of student IDs for quick class-wide analysis
const DEFAULT_CLASS_IDS = [1, 10, 100, 500, 1000, 1500, 1700, 1800, 2000, 2200];

// ── Counselor-style language helpers ──
// Translates raw attention timestep into teacher-friendly language
function describeAttentionTimestep(step, totalSteps = 10) {
  if (step <= 2) {
    return "The root of their current struggle seems to trace back to concepts from a few lessons ago.";
  } else if (step <= 4) {
    return "They started losing their footing a few topics back — there may be a gap in earlier material.";
  } else if (step <= 6) {
    return "They were keeping up for a while, but seem to have gotten tripped up somewhere in the middle of recent work.";
  } else if (step <= 8) {
    return "They were managing well until fairly recently, when something started to feel harder.";
  } else {
    return "They were doing fine until they hit the most recent material.";
  }
}

// Translates confidence scores into conversational certainty language
function describeConfidence(prediction) {
  if (!prediction) return '';
  const { confidence_scores } = prediction;
  const { low_risk, medium_risk, high_risk } = confidence_scores;
  const maxConf = Math.max(low_risk, medium_risk, high_risk);

  // Check if scores are roughly evenly split
  const spread = maxConf - Math.min(low_risk, medium_risk, high_risk);
  if (spread < 0.15) {
    return "Their recent signals are a bit mixed, but";
  } else if (maxConf >= 0.7) {
    return "The picture is pretty clear —";
  } else if (maxConf >= 0.5) {
    return "There are enough signs pointing in one direction that";
  } else {
    return "It's a bit of a toss-up right now, but";
  }
}

// Generates a single, cohesive counselor-style paragraph
function generateCounselorSummary(prediction) {
  if (!prediction) return '';
  const { predicted_risk_class, attention_focus_timestep, diagnostic_reasons } = prediction;
  const confidenceIntro = describeConfidence(prediction);
  const timestepInsight = describeAttentionTimestep(attention_focus_timestep);

  let riskStatement;
  if (predicted_risk_class === 'High Risk') {
    riskStatement = `${confidenceIntro} there are enough warning signs that we should definitely check in with this student soon.`;
  } else if (predicted_risk_class === 'Medium Risk') {
    riskStatement = `${confidenceIntro} this student is showing some early signs of struggling and could use a little extra support.`;
  } else {
    riskStatement = `${confidenceIntro} this student seems to be doing well overall. No immediate concerns.`;
  }

  const reasonText = diagnostic_reasons && diagnostic_reasons.length > 0
    ? ' ' + diagnostic_reasons[0]
    : '';

  return `${riskStatement} ${timestepInsight}${reasonText}`;
}

// Translates step detail for the selected timeline step
function describeStepDetail(stepNumber, isFocusStep, step) {
  if (isFocusStep) {
    if (step.correct === 1) {
      return "This is where they needed the most effort. They eventually got it right, but it clearly took some extra thinking.";
    } else {
      return "This is where things got really tough for them. It looks like this is the concept they're struggling with most.";
    }
  }
  if (step.correct === 1) {
    return "They handled this one well — no concerns here.";
  }
  return "They missed this one, but it doesn't seem to be the main sticking point.";
}

function App() {
  // Navigation & Theme State
  const [activeTab, setActiveTab] = useState('single');
  const [theme, setTheme] = useState('light');
  const [apiStatus, setApiStatus] = useState('checking');

  // Single Student Analytics State
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [studentId, setStudentId] = useState('');
  const [selectedStep, setSelectedStep] = useState(null);

  // Class-wide Overview State
  const [classIdsInput, setClassIdsInput] = useState(DEFAULT_CLASS_IDS.join(', '));
  const [classData, setClassData] = useState(null);
  const [classLoading, setClassLoading] = useState(false);
  const [classError, setClassError] = useState(null);
  const [classSearch, setClassSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [classSortField, setClassSortField] = useState('id');
  const [classSortOrder, setClassSortOrder] = useState('asc');

  // Initialize Theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('dashboard-theme') || 'light';
    setTheme(savedTheme);
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    checkApiHealth();
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('dashboard-theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const checkApiHealth = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/');
      if (response.ok) {
        setApiStatus('online');
      } else {
        setApiStatus('offline');
      }
    } catch {
      setApiStatus('offline');
    }
  };

  const fetchRandomStudent = async () => {
    setLoading(true);
    setError(null);
    setSelectedStep(null);
    try {
      const response = await fetch('http://127.0.0.1:8000/demo/random');
      if (!response.ok) {
        throw new Error(`Failed to load a random student sequence (Status: ${response.status})`);
      }
      const result = await response.json();
      setData(result);
      setStudentId(result.user_id.toString());
      setApiStatus('online');
      if (result.prediction && result.prediction.attention_focus_timestep) {
        setSelectedStep(result.prediction.attention_focus_timestep - 1);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSpecificStudent = async (e, idToFetch = null) => {
    if (e) e.preventDefault();
    const finalId = idToFetch || studentId;
    if (!finalId || !finalId.toString().trim()) return;

    setLoading(true);
    setError(null);
    setSelectedStep(null);
    try {
      const response = await fetch(`http://127.0.0.1:8000/student/${finalId}`);
      if (response.status === 404) {
        throw new Error(`Student #${finalId} does not have enough history (10 interactions required).`);
      }
      if (!response.ok) {
        throw new Error(`Failed to load student data (Status: ${response.status})`);
      }
      const result = await response.json();
      setData(result);
      setStudentId(finalId.toString());
      setApiStatus('online');
      if (result.prediction && result.prediction.attention_focus_timestep) {
        setSelectedStep(result.prediction.attention_focus_timestep - 1);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchClassSummary = async (e) => {
    if (e) e.preventDefault();
    const ids = classIdsInput
      .split(',')
      .map(id => parseInt(id.trim()))
      .filter(id => !isNaN(id));

    if (ids.length === 0) return;

    setClassLoading(true);
    setClassError(null);
    try {
      const response = await fetch('http://127.0.0.1:8000/class/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: ids })
      });
      if (!response.ok) {
        throw new Error(`Failed to load class batch data (Status: ${response.status})`);
      }
      const result = await response.json();
      setClassData(result.batch_results);
      setApiStatus('online');
    } catch (err) {
      setClassError(err.message);
    } finally {
      setClassLoading(false);
    }
  };

  const handleDrillDown = (uid) => {
    setStudentId(uid.toString());
    setActiveTab('single');
    fetchSpecificStudent(null, uid);
  };

  // Risk styling — muted, sophisticated palette
  const getRiskColor = (riskClass) => {
    switch (riskClass) {
      case 'High Risk': return { text: 'text-risk-high', bg: 'bg-risk-high-soft dark:bg-risk-high-wash', dot: 'bg-risk-high' };
      case 'Medium Risk': return { text: 'text-risk-mid', bg: 'bg-risk-mid-soft dark:bg-risk-mid-wash', dot: 'bg-risk-mid' };
      case 'Low Risk': return { text: 'text-risk-low', bg: 'bg-risk-low-soft dark:bg-risk-low-wash', dot: 'bg-risk-low' };
      default: return { text: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-900', dot: 'bg-slate-400' };
    }
  };

  const getConfidence = (prediction) => {
    if (!prediction) return 0;
    const { predicted_risk_class, confidence_scores } = prediction;
    if (predicted_risk_class === 'High Risk') return confidence_scores.high_risk;
    if (predicted_risk_class === 'Medium Risk') return confidence_scores.medium_risk;
    return confidence_scores.low_risk;
  };

  // Class stats
  const classStats = useMemo(() => {
    if (!classData) return null;
    const list = Object.entries(classData);
    const total = list.length;
    const valid = list.filter(([_, value]) => !value.error).length;
    const high = list.filter(([_, value]) => value.predicted_risk_class === 'High Risk').length;
    const medium = list.filter(([_, value]) => value.predicted_risk_class === 'Medium Risk').length;
    const low = list.filter(([_, value]) => value.predicted_risk_class === 'Low Risk').length;
    const errors = total - valid;
    return { total, valid, high, medium, low, errors };
  }, [classData]);

  const processedClassList = useMemo(() => {
    if (!classData) return [];
    let list = Object.entries(classData).map(([uid, details]) => ({
      id: parseInt(uid),
      ...details
    }));
    if (classSearch.trim() !== '') {
      list = list.filter(item => item.id.toString().includes(classSearch.trim()));
    }
    if (classFilter !== 'all') {
      list = list.filter(item => item.predicted_risk_class === classFilter);
    }
    list.sort((a, b) => {
      let valA = a[classSortField];
      let valB = b[classSortField];
      if (classSortField === 'risk') {
        const riskOrder = { 'High Risk': 3, 'Medium Risk': 2, 'Low Risk': 1, undefined: 0 };
        valA = riskOrder[a.predicted_risk_class] || 0;
        valB = riskOrder[b.predicted_risk_class] || 0;
      } else if (classSortField === 'attention') {
        valA = a.attention_focus_timestep || 0;
        valB = b.attention_focus_timestep || 0;
      }
      if (valA < valB) return classSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return classSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [classData, classSearch, classFilter, classSortField, classSortOrder]);

  const toggleSort = (field) => {
    if (classSortField === field) {
      setClassSortOrder(classSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setClassSortField(field);
      setClassSortOrder('asc');
    }
  };

  // Attention curve
  const attentionCurve = useMemo(() => {
    if (!data || !data.prediction) return [];
    const focus = data.prediction.attention_focus_timestep;
    return Array.from({ length: 10 }, (_, i) => {
      const step = i + 1;
      if (step === focus) return 100;
      const dist = Math.abs(step - focus);
      return Math.max(15, Math.round(95 - (dist * 18) - (step * 2)));
    });
  }, [data]);

  return (
    <div className="min-h-screen bg-surface text-slate-700 dark:bg-surface-dark dark:text-slate-300 transition-colors duration-300 antialiased">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-40 bg-surface/90 dark:bg-surface-dark/90 backdrop-blur-lg">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand flex items-center justify-center text-white font-display font-bold text-lg shadow-glow-brand hover:rotate-3 transition-transform duration-300 ease-out cursor-default">
              Ω
            </div>
            <div>
              <h1 className="text-base font-display font-bold tracking-tight text-slate-900 dark:text-white leading-none">
                StruggleLens
              </h1>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 tracking-wide mt-0.5">
                Early warning system for student support
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* API Status */}
            <button
              onClick={checkApiHealth}
              title="Check API status"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ease-out cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                apiStatus === 'online'
                  ? 'text-risk-low bg-risk-low-soft dark:bg-risk-low-wash'
                  : apiStatus === 'offline'
                    ? 'text-risk-high bg-risk-high-soft dark:bg-risk-high-wash animate-pulse-soft'
                    : 'text-slate-400 bg-surface-sunken dark:bg-surface-dark-raised'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${
                apiStatus === 'online' ? 'bg-risk-low' : apiStatus === 'offline' ? 'bg-risk-high' : 'bg-slate-400'
              }`} />
              {apiStatus === 'online' ? 'Online' : apiStatus === 'offline' ? 'Offline' : 'Checking'}
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-surface-sunken dark:hover:bg-surface-dark-raised transition-all duration-200 ease-out cursor-pointer"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-6xl mx-auto px-6 py-10">

        {/* Tab navigation */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-12">
          <nav className="flex gap-1 bg-surface-sunken dark:bg-surface-dark-sunken p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('single')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ease-out cursor-pointer ${
                activeTab === 'single'
                  ? 'bg-surface dark:bg-surface-dark-raised text-slate-900 dark:text-white shadow-card dark:shadow-card-dark'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Single Student
            </button>
            <button
              onClick={() => {
                setActiveTab('class');
                if (!classData) fetchClassSummary();
              }}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ease-out cursor-pointer ${
                activeTab === 'class'
                  ? 'bg-surface dark:bg-surface-dark-raised text-slate-900 dark:text-white shadow-card dark:shadow-card-dark'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Class Overview
            </button>
          </nav>

          {/* Active student ribbon */}
          {activeTab === 'single' && data && (
            <div className="flex items-center gap-2 text-sm text-brand font-medium">
              <span className="w-2 h-2 bg-brand rounded-full animate-pulse-soft" />
              Analyzing Student <span className="font-mono font-bold ml-1">#{data.user_id}</span>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* SINGLE STUDENT TAB                                               */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'single' && (
          <div className="space-y-10 animate-fade-in">

            {/* Controls */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
              <div className="max-w-lg">
                <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
                  Student Check-In
                </h2>
                <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                  Look up a student to see how they've been doing recently and whether they might need some extra help.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <form onSubmit={fetchSpecificStudent} className="flex items-center bg-surface-sunken dark:bg-surface-dark-sunken rounded-xl p-1 focus-within:ring-2 focus-within:ring-brand/20 transition-all duration-200">
                  <span className="pl-3 text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </span>
                  <input
                    type="number"
                    placeholder="Student ID..."
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="bg-transparent text-slate-900 dark:text-white placeholder-slate-400 font-mono text-sm px-3 py-2 focus:outline-none w-36 font-semibold"
                  />
                  <button
                    type="submit"
                    disabled={loading || !studentId.trim()}
                    className="btn-primary text-xs py-2 px-4 rounded-lg"
                  >
                    Analyze
                  </button>
                </form>

                <button
                  onClick={fetchRandomStudent}
                  disabled={loading}
                  className="btn-ghost text-sm py-2.5 px-4 flex items-center justify-center gap-2 bg-surface dark:bg-surface-dark-raised shadow-card dark:shadow-card-dark rounded-xl"
                >
                  <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 12H19" />
                  </svg>
                  {loading ? 'Analyzing...' : 'Random Student'}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="card p-6 border-l-4 border-l-risk-high animate-fade-in">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-risk-high-soft dark:bg-risk-high-wash rounded-lg text-risk-high shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">Connection Issue</h3>
                    <p className="text-slate-500 text-sm mt-1">{error}</p>
                    <div className="flex items-center gap-4 mt-4">
                      <button onClick={checkApiHealth} className="btn-ghost text-xs text-risk-high py-1.5 px-3">
                        Retry
                      </button>
                      <span className="label-mono">http://127.0.0.1:8000/</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Loading skeleton */}
            {loading && (
              <div className="space-y-8 animate-pulse">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="card p-6 h-48 space-y-4">
                      <div className="h-3 bg-surface-sunken dark:bg-surface-dark-sunken rounded-full w-1/3"></div>
                      <div className="h-8 bg-surface-sunken dark:bg-surface-dark-sunken rounded-xl w-2/3"></div>
                      <div className="h-12 bg-surface-sunken dark:bg-surface-dark-sunken rounded-xl w-full"></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!data && !loading && !error && (
              <div className="text-center py-24 animate-fade-in">
                <div className="w-16 h-16 bg-brand-wash dark:bg-brand-wash-dark rounded-2xl flex items-center justify-center mx-auto mb-6 text-brand">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
                  Ready to analyze
                </h2>
                <p className="text-slate-400 max-w-md mx-auto text-sm leading-relaxed mb-10">
                  Search for a student by ID or pick a random one to see where they might be struggling and what kind of support could help.
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => { setStudentId('1700'); fetchSpecificStudent(null, '1700'); }}
                    className="btn-ghost text-sm font-mono bg-surface dark:bg-surface-dark-raised shadow-card dark:shadow-card-dark rounded-xl"
                  >
                    Student #1700
                  </button>
                  <button
                    onClick={fetchRandomStudent}
                    className="btn-primary text-sm"
                  >
                    Random Sequence
                  </button>
                </div>
              </div>
            )}

            {/* ── Dashboard content ── */}
            {data && !loading && (
              <div className="space-y-10 animate-fade-in">

                {/* Prediction + Diagnostics — asymmetric bento */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start stagger-children">

                  {/* Prediction card — takes 2 cols, slightly taller */}
                  <div className={`lg:col-span-2 card p-8 relative overflow-hidden ${getRiskColor(data.prediction.predicted_risk_class).bg}`}>
                    <div className="relative z-10">
                      <p className="label mb-6">How this student is doing</p>

                      <div className="flex items-center gap-5">
                        {/* Gauge */}
                        <div className="relative w-20 h-20 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="40" cy="40" r="32" stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeWidth="3" fill="transparent" />
                            <circle
                              cx="40" cy="40" r="32"
                              stroke="currentColor"
                              className={getRiskColor(data.prediction.predicted_risk_class).text}
                              strokeWidth="4"
                              fill="transparent"
                              strokeDasharray={201}
                              strokeDashoffset={201 - (201 * getConfidence(data.prediction))}
                              strokeLinecap="round"
                            />
                          </svg>
                          <span className="absolute text-lg font-display font-bold text-slate-900 dark:text-white">
                            {Math.round(getConfidence(data.prediction) * 100)}%
                          </span>
                        </div>

                        <div>
                          <p className="text-3xl font-display font-bold tracking-tight text-slate-900 dark:text-white">
                            {data.prediction.predicted_risk_class === 'High Risk' ? 'Needs Support'
                              : data.prediction.predicted_risk_class === 'Medium Risk' ? 'Worth Watching'
                              : 'Doing Well'}
                          </p>
                          <p className="text-sm text-slate-400 mt-1 font-mono">
                            Student #{data.user_id}
                          </p>
                        </div>
                      </div>

                      {/* Where the struggle started */}
                      <div className="mt-8 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                        <span className="flex items-center gap-2 text-brand font-medium mb-1">
                          <span className="w-2 h-2 bg-brand rounded-full animate-pulse-soft" />
                          Where the struggle started
                        </span>
                        {describeAttentionTimestep(data.prediction.attention_focus_timestep)}
                      </div>
                    </div>
                  </div>

                  {/* Diagnostics + Confidence — takes 3 cols */}
                  <div className="lg:col-span-3 card p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                      {/* What we're noticing */}
                      <div>
                        <p className="label mb-4">What we're noticing</p>
                        <div className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                          <p>{generateCounselorSummary(data.prediction)}</p>
                        </div>
                      </div>

                      {/* Confidence bars */}
                      <div>
                        <p className="label mb-4">How clear is the picture</p>
                        <div className="space-y-4">
                          {[
                            { label: 'Doing Well', value: data.prediction.confidence_scores.low_risk, color: 'bg-risk-low', textColor: 'text-risk-low' },
                            { label: 'Worth Watching', value: data.prediction.confidence_scores.medium_risk, color: 'bg-risk-mid', textColor: 'text-risk-mid' },
                            { label: 'Needs Support', value: data.prediction.confidence_scores.high_risk, color: 'bg-risk-high', textColor: 'text-risk-high' },
                          ].map(({ label, value, color, textColor }) => (
                            <div key={label}>
                              <div className="flex justify-between text-xs mb-1.5">
                                <span className={`font-semibold ${textColor}`}>{label}</span>
                                <span className="font-mono text-slate-400">{(value * 100).toFixed(1)}%</span>
                              </div>
                              <div className="w-full bg-surface-sunken dark:bg-surface-dark-sunken rounded-full h-1.5 overflow-hidden">
                                <div className={`${color} h-full rounded-full transition-all duration-700 ease-out`} style={{ width: `${value * 100}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Interaction Timeline ── */}
                {data.history && (
                  <div className="card p-8 space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <h3 className="text-lg font-display font-bold tracking-tight text-slate-900 dark:text-white">
                          Recent Activity
                        </h3>
                        <p className="text-sm text-slate-400 mt-1">
                          Click any step to see details. The glowing dot shows where they struggled most.
                        </p>
                      </div>
                      <div className="flex gap-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 bg-risk-low rounded-full" />
                          Correct
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 bg-risk-high rounded-full" />
                          Incorrect
                        </span>
                      </div>
                    </div>

                    {/* Timeline grid — staggered heights */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-10 gap-3 stagger-children">
                      {data.history.map((step, index) => {
                        const stepNum = index + 1;
                        const isAttentionFocus = stepNum === data.prediction.attention_focus_timestep;
                        const isSelected = selectedStep === index;

                        return (
                          <button
                            key={index}
                            onClick={() => setSelectedStep(index)}
                            className={`group p-3.5 rounded-xl transition-all duration-300 ease-out text-left flex flex-col justify-between relative cursor-pointer outline-none hover:-translate-y-1.5 hover:rotate-[0.5deg] active:scale-[0.96] ${
                              index % 2 === 0 ? 'h-[124px]' : 'h-[112px]'
                            } ${
                              isSelected
                                ? 'bg-brand-wash dark:bg-brand-wash-dark shadow-card-hover dark:shadow-card-dark-hover ring-2 ring-brand/20'
                                : isAttentionFocus
                                  ? 'bg-brand-wash/50 dark:bg-brand-wash-dark/50 shadow-card dark:shadow-card-dark'
                                  : 'bg-surface-sunken dark:bg-surface-dark-sunken hover:bg-surface dark:hover:bg-surface-dark-raised hover:shadow-card dark:hover:shadow-card-dark'
                            }`}
                          >
                            <div className="flex justify-between items-center w-full">
                              <span className="label-mono text-[10px]">S{stepNum}</span>
                              {isAttentionFocus && (
                                <span className="w-2 h-2 rounded-full bg-brand shadow-glow-brand animate-pulse-soft" />
                              )}
                            </div>

                            <div className="my-1.5">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-semibold ${
                                step.correct === 1
                                  ? 'bg-risk-low-soft dark:bg-risk-low-wash text-risk-low'
                                  : 'bg-risk-high-soft dark:bg-risk-high-wash text-risk-high'
                              }`}>
                                {step.correct === 1 ? '✓' : '✗'}
                              </div>
                            </div>

                            <span className="label-mono text-[10px] group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                              {(step.ms_first_response / 1000).toFixed(1)}s
                            </span>

                            {isAttentionFocus && (
                              <div className="absolute left-1/2 -bottom-2 transform -translate-x-1/2 bg-brand text-white text-[8px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap">
                                PEAK
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Step detail panel */}
                    {selectedStep !== null && data.history[selectedStep] && (
                      <div className="surface-inset p-6 border-l-2 border-l-brand animate-fade-in">
                        <div className="flex flex-wrap items-start gap-x-10 gap-y-6">

                          <div>
                            <p className="label mb-1">Looking at</p>
                            <h4 className="text-xl font-display font-bold text-slate-900 dark:text-white">
                              Step {selectedStep + 1}
                            </h4>
                            <span className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-lg text-xs font-medium ${
                              data.history[selectedStep].correct === 1
                                ? 'bg-risk-low-soft dark:bg-risk-low-wash text-risk-low'
                                : 'bg-risk-high-soft dark:bg-risk-high-wash text-risk-high'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                data.history[selectedStep].correct === 1 ? 'bg-risk-low' : 'bg-risk-high'
                              }`} />
                              {data.history[selectedStep].correct === 1 ? 'Correct' : 'Incorrect'}
                            </span>
                          </div>

                          <div>
                            <p className="label mb-1">Time to answer</p>
                            <p className="text-2xl font-display font-bold text-slate-900 dark:text-white">
                              {(data.history[selectedStep].ms_first_response / 1000).toFixed(2)}s
                            </p>
                          </div>

                          <div>
                            <p className="label mb-1">Attempts</p>
                            <p className="text-2xl font-display font-bold text-slate-900 dark:text-white">
                              {data.history[selectedStep].attempt_count}
                            </p>
                          </div>

                          <div className="max-w-xs">
                            <p className="label mb-1">What happened here</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                              {selectedStep + 1 === data.prediction.attention_focus_timestep ? (
                                <span className="text-brand font-medium">
                                  {describeStepDetail(selectedStep + 1, true, data.history[selectedStep])}
                                </span>
                              ) : (
                                describeStepDetail(selectedStep + 1, false, data.history[selectedStep])
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Attention Heatmap ── */}
                {data.prediction && (
                  <div className="card p-8 space-y-6">
                    <h3 className="text-lg font-display font-bold tracking-tight text-slate-900 dark:text-white">
                      Where They Needed the Most Help
                    </h3>
                    <div className="flex items-end h-36 gap-2 px-1">
                      {attentionCurve.map((weight, index) => {
                        const isFocus = index + 1 === data.prediction.attention_focus_timestep;
                        return (
                          <div key={index} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                            <span className="absolute -top-6 text-[10px] font-mono font-semibold text-brand opacity-0 group-hover:opacity-100 transition-all duration-200 bg-surface dark:bg-surface-dark-raised px-2 py-0.5 rounded-md shadow-card dark:shadow-card-dark z-20">
                              {weight}%
                            </span>

                            <div
                              className={`w-full rounded-lg transition-all duration-500 ease-out cursor-pointer ${
                                isFocus
                                  ? 'bg-brand shadow-glow-brand'
                                  : 'bg-slate-200/80 dark:bg-slate-700/50 group-hover:bg-brand/30 dark:group-hover:bg-brand/20'
                              }`}
                              style={{ height: `${weight}%` }}
                            />

                            <span className={`text-[10px] font-mono mt-2 ${isFocus ? 'text-brand font-bold' : 'text-slate-400'}`}>
                              {index + 1}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="label text-center">
                      Effort level across their recent work (taller bars = more struggle)
                    </p>
                  </div>
                )}

                {/* ── Recommendations ── */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
                  {/* Interventions — wider */}
                  <div className="lg:col-span-3 card p-8 space-y-5">
                    <div className="flex items-center gap-3">
                      <span className="p-2 bg-brand-wash dark:bg-brand-wash-dark text-brand rounded-lg">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </span>
                      <h3 className="text-lg font-display font-bold tracking-tight text-slate-900 dark:text-white">
                        Suggested Next Steps
                      </h3>
                    </div>

                    <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                      {data.prediction.predicted_risk_class === 'High Risk' ? (
                        <>
                          <li className="flex items-start gap-2.5">
                            <span className="text-risk-high mt-0.5">▸</span>
                            <span><strong>Have a 1-on-1 chat soon.</strong> It would help to sit with this student and walk through the material they're stuck on — particularly around step {data.prediction.attention_focus_timestep} where things seemed to get hard.</span>
                          </li>
                          <li className="flex items-start gap-2.5">
                            <span className="text-risk-high mt-0.5">▸</span>
                            <span><strong>Check the basics.</strong> Their struggle might be connected to earlier concepts they didn't fully get. A quick review of the foundational material could clear things up.</span>
                          </li>
                        </>
                      ) : data.prediction.predicted_risk_class === 'Medium Risk' ? (
                        <>
                          <li className="flex items-start gap-2.5">
                            <span className="text-risk-mid mt-0.5">▸</span>
                            <span><strong>Offer a few extra hints.</strong> This student could benefit from some gentle guidance on upcoming problems — nothing drastic, just a nudge in the right direction.</span>
                          </li>
                          <li className="flex items-start gap-2.5">
                            <span className="text-risk-mid mt-0.5">▸</span>
                            <span><strong>Keep an eye on them.</strong> Check back in after a few more assignments to see if things improve or if they need more help.</span>
                          </li>
                        </>
                      ) : (
                        <li className="flex items-start gap-2.5">
                          <span className="text-risk-low mt-0.5">▸</span>
                          <span><strong>They're doing great!</strong> This student is keeping up well and showing solid understanding. No extra support needed right now.</span>
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* Stats — narrower, offset vertically */}
                  <div className="lg:col-span-2 card p-8 lg:mt-6">
                    <p className="label mb-5">Quick stats</p>
                    <div className="space-y-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Success rate</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{data.history.filter(h => h.correct === 1).length}/10</span>
                      </div>
                      <div className="h-px bg-surface-sunken dark:bg-surface-dark-sunken" />
                      <div className="flex justify-between">
                        <span className="text-slate-500">Avg. attempts</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{(data.history.reduce((acc, h) => acc + h.attempt_count, 0) / 10).toFixed(1)}</span>
                      </div>
                      <div className="h-px bg-surface-sunken dark:bg-surface-dark-sunken" />
                      <div className="flex justify-between">
                        <span className="text-slate-500">Avg. response time</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{(data.history.reduce((acc, h) => acc + h.ms_first_response, 0) / 10000).toFixed(2)}s</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* CLASS OVERVIEW TAB                                                */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'class' && (
          <div className="space-y-10 animate-fade-in">

            {/* Controls */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
              <div className="max-w-lg">
                <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
                  Class Overview
                </h2>
                <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                  See how your whole class is doing at a glance and quickly spot which students might need extra help.
                </p>
              </div>
              <form onSubmit={fetchClassSummary} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 max-w-xl">
                <div className="flex-1 flex items-center bg-surface-sunken dark:bg-surface-dark-sunken rounded-xl p-1 focus-within:ring-2 focus-within:ring-brand/20 transition-all duration-200">
                  <span className="pl-3 text-xs text-slate-400 font-medium whitespace-nowrap">IDs:</span>
                  <input
                    type="text"
                    placeholder="1, 10, 100, 500..."
                    value={classIdsInput}
                    onChange={(e) => setClassIdsInput(e.target.value)}
                    className="bg-transparent text-slate-900 dark:text-white placeholder-slate-400 font-mono text-sm px-3 py-2 focus:outline-none w-full font-semibold"
                  />
                </div>
                <button
                  type="submit"
                  disabled={classLoading || !classIdsInput.trim()}
                  className="btn-primary text-sm whitespace-nowrap"
                >
                  {classLoading ? 'Processing...' : 'Scan Cohort'}
                </button>
              </form>
            </div>

            {/* Class error */}
            {classError && (
              <div className="card p-6 border-l-4 border-l-risk-high animate-fade-in">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-risk-high-soft dark:bg-risk-high-wash rounded-lg text-risk-high">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">Cohort Scan Failed</h3>
                    <p className="text-slate-500 text-sm mt-1">{classError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Loading */}
            {classLoading && (
              <div className="space-y-6 animate-pulse">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="card p-6 h-28 space-y-3">
                      <div className="h-3 bg-surface-sunken dark:bg-surface-dark-sunken rounded-full w-1/3"></div>
                      <div className="h-6 bg-surface-sunken dark:bg-surface-dark-sunken rounded-xl w-1/2"></div>
                    </div>
                  ))}
                </div>
                <div className="card h-64" />
              </div>
            )}

            {/* Class content */}
            {!classLoading && classData && classStats && (
              <div className="space-y-8 animate-fade-in">

                {/* Stats — asymmetric bento */}
                <div className="grid grid-cols-2 lg:grid-cols-12 gap-4 stagger-children">
                  {/* Large total card */}
                  <div className="col-span-2 lg:col-span-5 card p-6">
                    <p className="label">Cohort size</p>
                    <h3 className="text-4xl font-display font-bold text-slate-900 dark:text-white mt-2">
                      {classStats.total} <span className="text-base font-normal text-slate-400">students</span>
                    </h3>
                  </div>

                  {/* High risk */}
                  <div className="lg:col-span-3 card p-6 bg-risk-high-soft dark:bg-risk-high-wash">
                    <p className="label text-risk-high">High risk</p>
                    <div className="flex items-center justify-between mt-2">
                      <h3 className="text-3xl font-display font-bold text-risk-high">{classStats.high}</h3>
                      {classStats.high > 0 && <span className="w-2 h-2 bg-risk-high rounded-full shadow-glow-risk animate-pulse-soft" />}
                    </div>
                  </div>

                  {/* Medium risk */}
                  <div className="lg:col-span-2 card p-6 bg-risk-mid-soft dark:bg-risk-mid-wash">
                    <p className="label text-risk-mid">Medium</p>
                    <h3 className="text-2xl font-display font-bold text-risk-mid mt-2">{classStats.medium}</h3>
                  </div>

                  {/* Low risk */}
                  <div className="lg:col-span-2 card p-6 bg-risk-low-soft dark:bg-risk-low-wash">
                    <p className="label text-risk-low">Low risk</p>
                    <h3 className="text-2xl font-display font-bold text-risk-low mt-2">{classStats.low}</h3>
                  </div>
                </div>

                {/* Distribution bar */}
                {classStats.valid > 0 && (
                  <div className="card p-6 space-y-4">
                    <p className="label">How the class breaks down</p>
                    <div className="w-full h-2.5 rounded-full flex overflow-hidden bg-surface-sunken dark:bg-surface-dark-sunken">
                      {classStats.high > 0 && (
                        <div className="bg-risk-high h-full transition-all duration-500" style={{ width: `${(classStats.high / classStats.valid) * 100}%` }} />
                      )}
                      {classStats.medium > 0 && (
                        <div className="bg-risk-mid h-full transition-all duration-500" style={{ width: `${(classStats.medium / classStats.valid) * 100}%` }} />
                      )}
                      {classStats.low > 0 && (
                        <div className="bg-risk-low h-full transition-all duration-500" style={{ width: `${(classStats.low / classStats.valid) * 100}%` }} />
                      )}
                    </div>
                    <div className="flex gap-6 text-xs text-slate-400 justify-center">
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-risk-high rounded-sm" /> {Math.round((classStats.high / classStats.valid) * 100)}% high</span>
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-risk-mid rounded-sm" /> {Math.round((classStats.medium / classStats.valid) * 100)}% medium</span>
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-risk-low rounded-sm" /> {Math.round((classStats.low / classStats.valid) * 100)}% low</span>
                    </div>
                  </div>
                )}

                {/* Student table */}
                <div className="card overflow-hidden">
                  {/* Table controls */}
                  <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-sunken/50 dark:bg-surface-dark-sunken/50">
                    <div className="relative max-w-xs">
                      <input
                        type="text"
                        placeholder="Search ID..."
                        value={classSearch}
                        onChange={(e) => setClassSearch(e.target.value)}
                        className="w-full bg-surface dark:bg-surface-dark-raised text-sm pl-8 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all font-mono font-semibold"
                      />
                      <span className="absolute left-2.5 top-2.5 text-slate-400">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <select
                        value={classFilter}
                        onChange={(e) => setClassFilter(e.target.value)}
                        className="bg-surface dark:bg-surface-dark-raised rounded-lg px-3 py-2 text-xs font-medium focus:outline-none cursor-pointer"
                      >
                        <option value="all">All risk levels</option>
                        <option value="High Risk">High risk</option>
                        <option value="Medium Risk">Medium risk</option>
                        <option value="Low Risk">Low risk</option>
                      </select>
                      <span className="label-mono text-[11px]">
                        {processedClassList.length} of {classStats.total}
                      </span>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="text-xs text-slate-400 font-medium">
                          <th className="px-5 py-3 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" onClick={() => toggleSort('id')}>
                            ID {classSortField === 'id' && (classSortOrder === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-5 py-3 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" onClick={() => toggleSort('risk')}>
                            Status {classSortField === 'risk' && (classSortOrder === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-5 py-3 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" onClick={() => toggleSort('attention')}>
                            Struggle area {classSortField === 'attention' && (classSortOrder === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-5 py-3">What we're seeing</th>
                          <th className="px-5 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {processedClassList.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="px-5 py-12 text-center text-slate-400 text-sm">
                              No matching students found.
                            </td>
                          </tr>
                        ) : (
                          processedClassList.map((student, rowIdx) => {
                            if (student.error) {
                              return (
                                <tr key={student.id} className={`${rowIdx % 2 === 0 ? '' : 'bg-surface-sunken/30 dark:bg-surface-dark-sunken/30'}`}>
                                  <td className="px-5 py-3.5 font-mono font-semibold text-slate-400">#{student.id}</td>
                                  <td colSpan="3" className="px-5 py-3.5 text-xs text-risk-high">Insufficient history (min 10 interactions)</td>
                                  <td className="px-5 py-3.5 text-right">
                                    <button disabled className="text-xs px-3 py-1.5 rounded-lg text-slate-300 dark:text-slate-600 cursor-not-allowed">View</button>
                                  </td>
                                </tr>
                              );
                            }

                            const rc = getRiskColor(student.predicted_risk_class);
                            return (
                              <tr key={student.id} className={`group hover:bg-brand-wash/30 dark:hover:bg-brand-wash-dark/30 transition-colors ${rowIdx % 2 === 0 ? '' : 'bg-surface-sunken/30 dark:bg-surface-dark-sunken/30'}`}>
                                <td className="px-5 py-3.5 font-mono font-bold text-slate-900 dark:text-white">#{student.id}</td>
                                <td className="px-5 py-3.5">
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${rc.bg} ${rc.text}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${rc.dot}`} />
                                    {student.predicted_risk_class}
                                  </span>
                                </td>
                                <td className="px-5 py-3.5 text-slate-500 text-sm">{student.attention_focus_timestep <= 2 ? 'Early material' : student.attention_focus_timestep <= 5 ? 'Middle topics' : student.attention_focus_timestep <= 8 ? 'Recent work' : 'Latest lesson'}</td>
                                <td className="px-5 py-3.5 max-w-xs truncate text-slate-500 text-sm">
                                  {student.diagnostic_reasons ? student.diagnostic_reasons.join(', ') : '—'}
                                </td>
                                <td className="px-5 py-3.5 text-right">
                                  <button
                                    onClick={() => handleDrillDown(student.id)}
                                    className="text-xs font-medium text-brand hover:text-brand-deep px-3 py-1.5 rounded-lg hover:bg-brand-wash dark:hover:bg-brand-wash-dark transition-all duration-200 cursor-pointer"
                                  >
                                    View details →
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Empty class state */}
            {!classLoading && !classData && (
              <div className="text-center py-24 animate-fade-in">
                <div className="w-16 h-16 bg-brand-wash dark:bg-brand-wash-dark rounded-2xl flex items-center justify-center mx-auto mb-6 text-brand">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
                  Check on your class
                </h2>
                <p className="text-slate-400 max-w-md mx-auto text-sm leading-relaxed mb-10">
                  Enter student IDs separated by commas to see who might be struggling and who's doing well.
                </p>
                <button
                  onClick={() => { setClassIdsInput(DEFAULT_CLASS_IDS.join(', ')); fetchClassSummary(); }}
                  className="btn-primary text-sm"
                >
                  Check Default Class (10 Students)
                </button>
              </div>
            )}
          </div>
        )}

      </main>

      {/* ── Footer ── */}
      <footer className="mt-20 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            © 2026 StruggleLens v3.0
          </p>
          <p className="text-xs text-slate-300 dark:text-slate-600">
            Student support tool · Built with care
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
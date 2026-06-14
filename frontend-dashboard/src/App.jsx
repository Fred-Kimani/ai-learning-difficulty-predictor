import React, { useState, useEffect, useMemo } from 'react';

// Predefined set of student IDs for quick class-wide analysis
const DEFAULT_CLASS_IDS = [1, 10, 100, 500, 1000, 1500, 1700, 1800, 2000, 2200];

function App() {
  // Navigation & Theme State
  const [activeTab, setActiveTab] = useState('single'); // 'single' | 'class'
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
  const [classFilter, setClassFilter] = useState('all'); // 'all' | 'High Risk' | 'Medium Risk' | 'Low Risk'
  const [classSortField, setClassSortField] = useState('id'); // 'id' | 'risk' | 'attention'
  const [classSortOrder, setClassSortOrder] = useState('asc'); // 'asc' | 'desc'

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

  // Fetch a random student sequence
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
      
      // Auto-select the attention focus step as default
      if (result.prediction && result.prediction.attention_focus_timestep) {
        setSelectedStep(result.prediction.attention_focus_timestep - 1);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch a specific student sequence by ID
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
      
      // Auto-select the attention focus step as default
      if (result.prediction && result.prediction.attention_focus_timestep) {
        setSelectedStep(result.prediction.attention_focus_timestep - 1);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Run Batch Analysis for Class
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

  // Navigate from Class view to Single student deep-dive
  const handleDrillDown = (uid) => {
    setStudentId(uid.toString());
    setActiveTab('single');
    fetchSpecificStudent(null, uid);
  };

  // Stylings & Colors Helper Functions
  const getRiskColors = (riskClass) => {
    switch (riskClass) {
      case 'High Risk':
        return {
          bg: 'bg-rose-50 dark:bg-rose-950/20',
          border: 'border-rose-200 dark:border-rose-800/50',
          text: 'text-rose-800 dark:text-rose-300',
          accent: 'bg-rose-500',
          ring: 'ring-rose-500/20'
        };
      case 'Medium Risk':
        return {
          bg: 'bg-amber-50 dark:bg-amber-950/20',
          border: 'border-amber-200 dark:border-amber-800/50',
          text: 'text-amber-800 dark:text-amber-300',
          accent: 'bg-amber-500',
          ring: 'ring-amber-500/20'
        };
      case 'Low Risk':
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-950/20',
          border: 'border-emerald-200 dark:border-emerald-800/50',
          text: 'text-emerald-800 dark:text-emerald-300',
          accent: 'bg-emerald-500',
          ring: 'ring-emerald-500/20'
        };
      default:
        return {
          bg: 'bg-slate-50 dark:bg-slate-800/30',
          border: 'border-slate-200 dark:border-slate-700/50',
          text: 'text-slate-700 dark:text-slate-300',
          accent: 'bg-slate-500',
          ring: 'ring-slate-500/20'
        };
    }
  };

  // Compute stats for class analysis
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

  // Filter & Sort student list for Class Overview
  const processedClassList = useMemo(() => {
    if (!classData) return [];
    
    let list = Object.entries(classData).map(([uid, details]) => ({
      id: parseInt(uid),
      ...details
    }));

    // Filter search
    if (classSearch.trim() !== '') {
      list = list.filter(item => item.id.toString().includes(classSearch.trim()));
    }

    // Filter Risk
    if (classFilter !== 'all') {
      list = list.filter(item => item.predicted_risk_class === classFilter);
    }

    // Sort
    list.sort((a, b) => {
      let valA = a[classSortField];
      let valB = b[classSortField];

      // Handle custom fields
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

  // Attention curve visual generator based on model focus timestep
  const attentionCurve = useMemo(() => {
    if (!data || !data.prediction) return [];
    const focus = data.prediction.attention_focus_timestep;
    return Array.from({ length: 10 }, (_, i) => {
      const step = i + 1;
      // Synthesize a beautiful gradient scale peaked at the focus step
      if (step === focus) return 100;
      const dist = Math.abs(step - focus);
      return Math.max(15, Math.round(95 - (dist * 18) - (step * 2)));
    });
  }, [data]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-200 transition-colors duration-200 antialiased font-sans">
      
      {/* Top Banner / Navbar */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-all duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 font-mono font-bold text-lg">
              Ω
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <span>StruggleLens</span>
                <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  LSTM-Attention v3
                </span>
              </h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                AI STUDENT DIFFICULTY COGNITIVE PREDICTOR
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* API Status indicator */}
            <button 
              onClick={checkApiHealth}
              title="Click to check API status"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold font-mono border transition-all ${
                apiStatus === 'online' 
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/30' 
                  : apiStatus === 'offline' 
                    ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-200/60 dark:border-rose-800/30 animate-pulse' 
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${
                apiStatus === 'online' ? 'bg-emerald-500 animate-pulse' : apiStatus === 'offline' ? 'bg-rose-500' : 'bg-slate-400'
              }`} />
              <span className="hidden sm:inline">API:</span> {apiStatus.toUpperCase()}
            </button>

            {/* Dark Mode toggle */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-150 shadow-sm cursor-pointer"
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

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Navigation Tabs and Layout Selection */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mb-8 pb-4 border-b border-slate-200 dark:border-slate-800">
          <nav className="flex space-x-1 bg-slate-200/60 dark:bg-slate-900/60 p-1.5 rounded-xl border border-slate-200/40 dark:border-slate-800/40 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('single')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
                activeTab === 'single'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/30 dark:border-slate-700/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/30 dark:hover:bg-slate-800/30'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Single Student analytics
            </button>
            <button
              onClick={() => {
                setActiveTab('class');
                if (!classData) fetchClassSummary();
              }}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
                activeTab === 'class'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/30 dark:border-slate-700/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/30 dark:hover:bg-slate-800/30'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Class Overview Analysis
            </button>
          </nav>

          {/* Quick Stats Summary Ribbon */}
          {activeTab === 'single' && data && (
            <div className="flex items-center gap-2 text-xs font-mono bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100/60 dark:border-blue-900/30 px-4 py-2 rounded-xl text-blue-700 dark:text-blue-400">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />
              <span>Analyzing: Student ID <strong>#{data.user_id}</strong></span>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* SINGLE STUDENT TAB                                                        */}
        {/* ========================================================================= */}
        {activeTab === 'single' && (
          <div className="space-y-6 animate-fade-in">
            {/* Filter Control Header */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Student Selector & Inference Controls</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Query the predictive model for single student historical tracking logs.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <form onSubmit={fetchSpecificStudent} className="flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-1 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all duration-200">
                  <span className="pl-3 text-slate-400 dark:text-slate-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </span>
                  <input
                    type="number"
                    placeholder="Enter Student ID..."
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="bg-transparent text-slate-900 dark:text-white placeholder-slate-400 font-mono text-sm px-3 py-2 focus:outline-none w-44"
                  />
                  <button
                    type="submit"
                    disabled={loading || !studentId.trim()}
                    className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 shadow-sm cursor-pointer"
                  >
                    Analyze
                  </button>
                </form>

                <button
                  onClick={fetchRandomStudent}
                  disabled={loading}
                  className="bg-slate-100 hover:bg-slate-200 active:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold py-2.5 px-4 rounded-xl shadow-sm transition-all duration-150 disabled:opacity-50 text-sm flex items-center justify-center gap-2 cursor-pointer border border-slate-200 dark:border-slate-700"
                >
                  <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 12H19" />
                  </svg>
                  {loading ? 'Analyzing...' : 'Fetch Random Student'}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 border-l-4 border-l-rose-500 dark:border-l-rose-500 p-5 rounded-2xl shadow-sm flex items-start gap-4 animate-fade-in">
                <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-xl text-rose-700 dark:text-rose-400 mt-0.5 shadow-sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-rose-800 dark:text-rose-300 font-bold text-base font-mono">Inference Engine Error</h3>
                  <p className="text-slate-600 dark:text-slate-300 text-sm mt-1">{error}</p>
                  <div className="flex flex-wrap items-center gap-4 mt-4 text-xs">
                    <button
                      onClick={checkApiHealth}
                      className="bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-rose-700 dark:text-rose-400 font-bold px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/40 transition-colors shadow-sm cursor-pointer"
                    >
                      Retry Connection
                    </button>
                    <span className="text-slate-500 dark:text-slate-400 font-mono">
                      FastAPI URL: <code className="bg-slate-100 dark:bg-slate-950 px-1 py-0.5 rounded">http://127.0.0.1:8000/</code>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Skeleton Loading State */}
            {loading && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl h-56 shadow-sm space-y-4 animate-pulse">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
                      <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded w-2/3"></div>
                      <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
                    </div>
                  ))}
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl h-80 shadow-sm animate-pulse space-y-6">
                  <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4"></div>
                  <div className="grid grid-cols-10 gap-3 h-48 items-end">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} className="h-full bg-slate-100 dark:bg-slate-800/50 rounded-xl" style={{ height: `${Math.random() * 80 + 20}%` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Landing Empty state */}
            {!data && !loading && !error && (
              <div className="text-center py-16 px-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm animate-fade-in relative overflow-hidden">
                {/* Backdrop design decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-100/30 dark:bg-blue-900/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-100/20 dark:bg-amber-900/5 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

                <div className="w-20 h-20 bg-blue-50 dark:bg-blue-950/40 rounded-2xl flex items-center justify-center mx-auto mb-6 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30 shadow-md">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Predictive Engine Standby</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto text-sm leading-relaxed mb-8">
                  Query student sequences to diagnose concept retention, identify structural struggle patterns, and focus 1-on-1 tutoring blocks.
                </p>
                <div className="flex justify-center gap-3 flex-wrap">
                  <button 
                    onClick={() => { setStudentId('1700'); fetchSpecificStudent(null, '1700'); }} 
                    className="text-xs bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl font-mono border border-slate-200 dark:border-slate-700 transition-all shadow-sm cursor-pointer"
                  >
                    Quick Load: Student #1700
                  </button>
                  <button 
                    onClick={() => { setStudentId('1'); fetchSpecificStudent(null, '1'); }} 
                    className="text-xs bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl font-mono border border-slate-200 dark:border-slate-700 transition-all shadow-sm cursor-pointer"
                  >
                    Quick Load: Student #1
                  </button>
                  <button 
                    onClick={fetchRandomStudent} 
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-md shadow-blue-500/10 cursor-pointer"
                  >
                    Scan Random Sequence
                  </button>
                </div>
              </div>
            )}

            {/* Dashboard Visualizer Content */}
            {data && !loading && (
              <div className="space-y-6 animate-fade-in">

                {/* Top Grid: Status Gauges & Diagnostic Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                  {/* Prediction Gauge Card */}
                  <div className={`border p-6 rounded-3xl flex flex-col justify-between shadow-sm relative overflow-hidden transition-all duration-300 ${getRiskColors(data.prediction.predicted_risk_class).bg} ${getRiskColors(data.prediction.predicted_risk_class).border}`}>
                    
                    {/* Ring highlight background element */}
                    <div className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full opacity-10 bg-slate-900 dark:bg-white pointer-events-none" />

                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider opacity-60 font-mono">
                          Cognitive Profile
                        </span>
                        <p className="text-4xl font-mono font-bold tracking-tight text-slate-900 dark:text-white mt-1">
                          #{data.user_id}
                        </p>
                      </div>
                      <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border uppercase tracking-wider font-mono shadow-sm bg-white dark:bg-slate-900 ${
                        data.prediction.predicted_risk_class === 'High Risk' 
                          ? 'border-rose-200 text-rose-600 dark:text-rose-400 dark:border-rose-900/30' 
                          : data.prediction.predicted_risk_class === 'Medium Risk' 
                            ? 'border-amber-200 text-amber-600 dark:text-amber-400 dark:border-amber-900/30' 
                            : 'border-emerald-200 text-emerald-600 dark:text-emerald-400 dark:border-emerald-900/30'
                      }`}>
                        Inference Active
                      </span>
                    </div>

                    <div className="mt-8 flex items-center gap-5">
                      {/* Visual gauge representation */}
                      <div className="relative w-16 h-16 flex items-center justify-center rounded-full bg-white dark:bg-slate-900 shadow-sm border border-slate-200/50 dark:border-slate-800">
                        {/* Circle SVG */}
                        <svg className="w-14 h-14 transform -rotate-90">
                          <circle cx="28" cy="28" r="23" stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeWidth="3" fill="transparent" />
                          <circle 
                            cx="28" 
                            cy="28" 
                            r="23" 
                            stroke="currentColor" 
                            className={`${
                              data.prediction.predicted_risk_class === 'High Risk' ? 'text-rose-500' : data.prediction.predicted_risk_class === 'Medium Risk' ? 'text-amber-500' : 'text-emerald-500'
                            }`}
                            strokeWidth="3.5" 
                            fill="transparent" 
                            strokeDasharray={144.5} 
                            strokeDashoffset={
                              data.prediction.predicted_risk_class === 'High Risk' 
                                ? 144.5 - (144.5 * data.prediction.confidence_scores.high_risk) 
                                : data.prediction.predicted_risk_class === 'Medium Risk' 
                                  ? 144.5 - (144.5 * data.prediction.confidence_scores.medium_risk) 
                                  : 144.5 - (144.5 * data.prediction.confidence_scores.low_risk)
                            } 
                          />
                        </svg>
                        <span className="absolute text-xs font-bold font-mono">
                          {data.prediction.predicted_risk_class === 'High Risk' 
                            ? Math.round(data.prediction.confidence_scores.high_risk * 100) 
                            : data.prediction.predicted_risk_class === 'Medium Risk' 
                              ? Math.round(data.prediction.confidence_scores.medium_risk * 100) 
                              : Math.round(data.prediction.confidence_scores.low_risk * 100)}%
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider opacity-60 font-mono block">
                          Struggle Classification
                        </span>
                        <span className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white block">
                          {data.prediction.predicted_risk_class}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Diagnostic Factors Card */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl flex flex-col justify-between shadow-sm relative">
                    <div>
                      <h3 className="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold font-mono mb-4 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <span>MODEL DIAGNOSES</span>
                        <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </h3>
                      <ul className="space-y-3">
                        {data.prediction.diagnostic_reasons.map((reason, index) => (
                          <li key={index} className="text-slate-700 dark:text-slate-300 text-sm flex items-start gap-2.5">
                            <span className="text-blue-500 dark:text-blue-400 font-bold mt-0.5">•</span>
                            <span className="font-medium">{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100/60 dark:border-blue-900/20 text-blue-700 dark:text-blue-400 text-xs px-3.5 py-2.5 rounded-2xl flex items-center gap-2 mt-4 font-mono shadow-sm">
                      <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
                      <span>
                        Attention peak: Step <strong>#{data.prediction.attention_focus_timestep}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Confidence distribution Bars Card */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl flex flex-col justify-between shadow-sm">
                    <h3 className="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold font-mono mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                      CONFIDENCE DISTRIBUTION
                    </h3>
                    <div className="space-y-4">
                      {/* Low Risk */}
                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">Low Risk</span>
                          <span className="font-mono text-slate-500 dark:text-slate-400">{(data.prediction.confidence_scores.low_risk * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-200/20 dark:border-slate-800/20">
                          <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${data.prediction.confidence_scores.low_risk * 100}%` }} />
                        </div>
                      </div>

                      {/* Medium Risk */}
                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="font-semibold text-amber-600 dark:text-amber-400 font-mono">Medium Risk</span>
                          <span className="font-mono text-slate-500 dark:text-slate-400">{(data.prediction.confidence_scores.medium_risk * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-200/20 dark:border-slate-800/20">
                          <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${data.prediction.confidence_scores.medium_risk * 100}%` }} />
                        </div>
                      </div>

                      {/* High Risk */}
                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="font-semibold text-rose-600 dark:text-rose-400 font-mono">High Risk</span>
                          <span className="font-mono text-slate-500 dark:text-slate-400">{(data.prediction.confidence_scores.high_risk * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-200/20 dark:border-slate-800/20">
                          <div className="bg-rose-500 h-full rounded-full transition-all duration-500" style={{ width: `${data.prediction.confidence_scores.high_risk * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Interaction Timeline Section */}
                {data.history && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <h3 className="text-sm uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold font-mono">
                          10-Step Interaction Timeline Explorer
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Click on steps to inspect detailed metrics. Model attention peaks at step with glowing border.
                        </p>
                      </div>
                      <div className="flex gap-4 text-xs font-mono justify-end">
                        <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                          <span className="w-3 h-3 bg-emerald-500 rounded-full border border-emerald-400/30" />
                          Correct
                        </span>
                        <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                          <span className="w-3 h-3 bg-rose-500 rounded-full border border-rose-400/30" />
                          Incorrect
                        </span>
                      </div>
                    </div>

                    {/* Timeline Items Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-10 gap-4 py-2">
                      {data.history.map((step, index) => {
                        const stepNum = index + 1;
                        const isAttentionFocus = stepNum === data.prediction.attention_focus_timestep;
                        const isSelected = selectedStep === index;

                        return (
                          <button
                            key={index}
                            onClick={() => setSelectedStep(index)}
                            className={`p-3.5 rounded-2xl border transition-all duration-200 text-left flex flex-col justify-between h-32 relative cursor-pointer outline-none ${
                              isAttentionFocus
                                ? isSelected
                                  ? 'border-blue-500 ring-4 ring-blue-500/20 bg-blue-50/20 dark:bg-blue-950/10'
                                  : 'border-blue-400/70 bg-blue-50/10 dark:bg-blue-950/5 hover:border-blue-500'
                                : isSelected
                                  ? 'border-slate-800 dark:border-slate-100 ring-2 ring-slate-400/10 bg-slate-50/50 dark:bg-slate-800/40'
                                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/20 dark:bg-slate-900/30'
                            }`}
                          >
                            {/* Step number and glow badge */}
                            <div className="flex justify-between items-center w-full">
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">Step #{stepNum}</span>
                              {isAttentionFocus && (
                                <span className="w-2 h-2 rounded-full bg-blue-500 absolute top-2 right-2 animate-ping" />
                              )}
                            </div>

                            {/* Status Mark */}
                            <div className="my-2.5 flex justify-start">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shadow-sm ${
                                step.correct === 1
                                  ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/20'
                                  : 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/20'
                              }`}>
                                {step.correct === 1 ? '✓' : '✗'}
                              </div>
                            </div>

                            {/* Brief stat label */}
                            <div className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">
                              {(step.ms_first_response / 1000).toFixed(1)}s speed
                            </div>

                            {/* Focus banner */}
                            {isAttentionFocus && (
                              <div className="absolute left-1/2 bottom-[-9px] transform -translate-x-1/2 bg-blue-600 text-white text-[7px] font-bold tracking-wider uppercase px-2 py-0.5 rounded shadow-sm whitespace-nowrap z-10 font-mono">
                                ATTENTION PEAK
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Step Specific Details Panel (Populates when clicking step) */}
                    {selectedStep !== null && data.history[selectedStep] && (
                      <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/60 p-5 rounded-2xl animate-fade-in grid grid-cols-1 md:grid-cols-4 gap-6">
                        
                        <div className="flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 pb-4 md:pb-0 md:pr-4">
                          <div>
                            <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
                              Active Timeline Segment
                            </span>
                            <h4 className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">
                              Step {selectedStep + 1} Assessment
                            </h4>
                          </div>
                          
                          <div className="mt-4">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold font-mono border ${
                              data.history[selectedStep].correct === 1
                                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200/40 dark:border-emerald-800/30'
                                : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200/40 dark:border-rose-800/30'
                            }`}>
                              <span className={`w-2.5 h-2.5 rounded-full ${
                                data.history[selectedStep].correct === 1 ? 'bg-emerald-500' : 'bg-rose-500'
                              }`} />
                              {data.history[selectedStep].correct === 1 ? 'Correct Concept Submission' : 'Incorrect Concept Submission'}
                            </span>
                          </div>
                        </div>

                        {/* Speed details */}
                        <div className="flex items-center gap-4 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 pb-4 md:pb-0 md:pr-4">
                          <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-blue-600 dark:text-blue-400 shadow-sm border border-blue-100/50 dark:border-blue-900/30">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div>
                            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase">Response speed</span>
                            <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                              {(data.history[selectedStep].ms_first_response / 1000).toFixed(2)}s
                            </p>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">Time elapsed before initial answer</span>
                          </div>
                        </div>

                        {/* Attempt details */}
                        <div className="flex items-center gap-4 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 pb-4 md:pb-0 md:pr-4">
                          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-amber-600 dark:text-amber-400 shadow-sm border border-amber-100/50 dark:border-amber-900/30">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </div>
                          <div>
                            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase">Solver Attempts</span>
                            <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                              {data.history[selectedStep].attempt_count}
                            </p>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              {data.history[selectedStep].attempt_count === 1 ? 'Single clean attempt' : 'Multiple retries submitted'}
                            </span>
                          </div>
                        </div>

                        {/* Model Reasoning for this step */}
                        <div className="flex flex-col justify-center">
                          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase font-semibold">Model Focus Analysis</span>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                            {selectedStep + 1 === data.prediction.attention_focus_timestep ? (
                              <span className="text-blue-600 dark:text-blue-400 font-medium">
                                🌟 Neural network attention layer pinpointed this timestep as the definitive anchor indicating struggle dynamics.
                              </span>
                            ) : (
                              <span>
                                This step records standard learning progress. Response latency matches average class profiles.
                              </span>
                            )}
                          </p>
                        </div>

                      </div>
                    )}
                  </div>
                )}

                {/* Attention Weight Distribution Heatmap */}
                {data.prediction && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm">
                    <h3 className="text-sm uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold font-mono mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                      RNN Attention Weight Density Mapping
                    </h3>
                    <div className="space-y-4">
                      {/* Bar Heatmap chart */}
                      <div className="flex items-end h-28 gap-2 px-2">
                        {attentionCurve.map((weight, index) => {
                          const isFocus = index + 1 === data.prediction.attention_focus_timestep;
                          return (
                            <div key={index} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                              {/* Percentage Popover tooltip */}
                              <span className="absolute -top-6 text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-blue-50 dark:bg-slate-950 border border-blue-100 dark:border-blue-900 px-1.5 py-0.5 rounded shadow-sm">
                                {weight}%
                              </span>

                              {/* Vertical Bar */}
                              <div 
                                className={`w-full rounded-t-lg transition-all duration-500 ${
                                  isFocus 
                                    ? 'bg-blue-600 dark:bg-blue-500 shadow-md shadow-blue-500/20' 
                                    : 'bg-slate-200/80 dark:bg-slate-800 hover:bg-blue-200 dark:hover:bg-blue-900/40'
                                }`} 
                                style={{ height: `${weight}%` }}
                              />

                              {/* Step Indicator Label */}
                              <span className={`text-[9px] font-mono mt-2 ${isFocus ? 'font-bold text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
                                S#{index + 1}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono text-center">
                        WEIGHT PROBABILISTIC DENSITY CURVE PLOTTED ACROSS RECURRENT STEPS
                      </p>
                    </div>
                  </div>
                )}

                {/* Recommendations and Intervention Actions Section */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm">
                  <div className="flex items-center gap-3 mb-6 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100/30 dark:border-blue-900/20 rounded-xl shadow-sm">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </span>
                    <h3 className="text-sm uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold font-mono">
                      Teacher Action Protocols & Cognitive Interventions
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="p-5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200/50 dark:border-slate-800/60 rounded-2xl shadow-sm">
                      <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono mb-3">
                        RECOMMENDED ACTIONS
                      </h4>
                      <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                        {data.prediction.predicted_risk_class === 'High Risk' ? (
                          <>
                            <li className="flex items-start gap-2.5">
                              <span className="text-rose-500 font-bold">▶</span>
                              <span><strong>Immediate 1-on-1 Block:</strong> Intercept sequence before progression. Focus on concept step #{data.prediction.attention_focus_timestep} where latency spiked.</span>
                            </li>
                            <li className="flex items-start gap-2.5">
                              <span className="text-rose-500 font-bold">▶</span>
                              <span><strong>Prerequisite Check:</strong> Review the student's foundation relative to concept attempts. Check for gaps in skills prior to Step #{data.prediction.attention_focus_timestep}.</span>
                            </li>
                          </>
                        ) : data.prediction.predicted_risk_class === 'Medium Risk' ? (
                          <>
                            <li className="flex items-start gap-2.5">
                              <span className="text-amber-500 font-bold">▶</span>
                              <span><strong>Adaptive Hint Injection:</strong> Push tailored hint sets on next sequence steps.</span>
                            </li>
                            <li className="flex items-start gap-2.5">
                              <span className="text-amber-500 font-bold">▶</span>
                              <span><strong>Progress Monitoring:</strong> Flag for auto-review in 5 submissions to monitor if confidence shifts to Low Risk.</span>
                            </li>
                          </>
                        ) : (
                          <li className="flex items-start gap-2.5">
                            <span className="text-emerald-500 font-bold">▶</span>
                            <span><strong>Standard Progression:</strong> Maintain current pace. The student demonstrates solid memory retention and concept mastery. No active interventions required.</span>
                          </li>
                        )}
                      </ul>
                    </div>

                    <div className="p-5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200/50 dark:border-slate-800/60 rounded-2xl shadow-sm flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono mb-3">
                          COGNITIVE PROGRESS METRICS
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-mono">
                          Success Ratio: <strong className="text-slate-900 dark:text-white">{data.history.filter(h => h.correct === 1).length} / 10</strong> correct answers.
                          <br />
                          Average Attempt Rate: <strong className="text-slate-900 dark:text-white">{(data.history.reduce((acc, h) => acc + h.attempt_count, 0) / 10).toFixed(1)}</strong> attempts per node.
                          <br />
                          Average Latency: <strong className="text-slate-900 dark:text-white">{(data.history.reduce((acc, h) => acc + h.ms_first_response, 0) / 10000).toFixed(2)}s</strong> per submission.
                        </p>
                      </div>

                      <div className="border-t border-slate-200 dark:border-slate-800 pt-3.5 mt-4 text-[10px] text-slate-400 font-mono">
                        Attention anchors flag the cognitive load bottleneck during recurrent state mapping.
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

        {/* ========================================================================= */}
        {/* CLASS OVERVIEW TAB                                                        */}
        {/* ========================================================================= */}
        {activeTab === 'class' && (
          <div className="space-y-6 animate-fade-in">
            {/* Filter Control Header */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Cohort Batch Analytics Controls</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Analyze risk scores and attention timesteps for an entire cohort simultaneously.
                </p>
              </div>

              <div className="flex-1 max-w-xl">
                <form onSubmit={fetchClassSummary} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="flex-1 flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-1 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all duration-200">
                    <span className="pl-3 text-slate-400 dark:text-slate-500 font-mono text-xs uppercase font-bold">IDs:</span>
                    <input
                      type="text"
                      placeholder="e.g. 1, 10, 100, 500"
                      value={classIdsInput}
                      onChange={(e) => setClassIdsInput(e.target.value)}
                      className="bg-transparent text-slate-900 dark:text-white placeholder-slate-400 font-mono text-sm px-3 py-2 focus:outline-none w-full"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={classLoading || !classIdsInput.trim()}
                    className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold py-3 px-5 rounded-xl transition-all duration-200 disabled:opacity-50 shadow-md shadow-blue-500/10 cursor-pointer whitespace-nowrap"
                  >
                    {classLoading ? 'Batch Processing...' : 'Scan Cohort'}
                  </button>
                </form>
              </div>
            </div>

            {/* Class Error Message */}
            {classError && (
              <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 border-l-4 border-l-rose-500 p-5 rounded-2xl shadow-sm flex items-start gap-4 animate-fade-in">
                <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-xl text-rose-700 dark:text-rose-400 mt-0.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-rose-800 dark:text-rose-300 font-bold text-base font-mono">Cohort Scan Failed</h3>
                  <p className="text-slate-600 dark:text-slate-300 text-sm mt-1">{classError}</p>
                </div>
              </div>
            )}

            {/* Skeleton Loading State for Class Overview */}
            {classLoading && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl h-32 shadow-sm space-y-4 animate-pulse">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
                      <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-2/3"></div>
                    </div>
                  ))}
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl h-80 shadow-sm animate-pulse" />
              </div>
            )}

            {/* Class Overview Content */}
            {!classLoading && classData && classStats && (
              <div className="space-y-6 animate-fade-in">
                
                {/* Cohort Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                  
                  {/* Total Card */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm">
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                      Cohort Scan Size
                    </span>
                    <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono mt-1">
                      {classStats.total} <span className="text-xs font-normal text-slate-400">students</span>
                    </h3>
                  </div>

                  {/* High Risk Card */}
                  <div className="bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30 p-5 rounded-3xl shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono text-rose-500 uppercase tracking-wider block">
                        High Struggle Risk
                      </span>
                      <h3 className="text-3xl font-extrabold text-rose-700 dark:text-rose-400 font-mono mt-1">
                        {classStats.high}
                      </h3>
                    </div>
                    {classStats.high > 0 && (
                      <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
                    )}
                  </div>

                  {/* Medium Risk Card */}
                  <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30 p-5 rounded-3xl shadow-sm">
                    <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                      Medium Struggle Risk
                    </span>
                    <h3 className="text-3xl font-extrabold text-amber-700 dark:text-amber-400 font-mono mt-1">
                      {classStats.medium}
                    </h3>
                  </div>

                  {/* Low Risk Card */}
                  <div className="bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 p-5 rounded-3xl shadow-sm">
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                      Low Struggle Risk
                    </span>
                    <h3 className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-400 font-mono mt-1">
                      {classStats.low}
                    </h3>
                  </div>
                </div>

                {/* Class Risk Breakdown stacked bar */}
                {classStats.valid > 0 && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4">
                    <h4 className="text-xs uppercase font-bold tracking-wider text-slate-400 font-mono">
                      Struggle Distribution Ratio
                    </h4>
                    
                    <div className="w-full h-4 rounded-full flex overflow-hidden border border-slate-100 dark:border-slate-950">
                      {classStats.high > 0 && (
                        <div 
                          className="bg-rose-500 h-full transition-all" 
                          style={{ width: `${(classStats.high / classStats.valid) * 100}%` }}
                          title={`High Risk: ${classStats.high} students`}
                        />
                      )}
                      {classStats.medium > 0 && (
                        <div 
                          className="bg-amber-500 h-full transition-all" 
                          style={{ width: `${(classStats.medium / classStats.valid) * 100}%` }}
                          title={`Medium Risk: ${classStats.medium} students`}
                        />
                      )}
                      {classStats.low > 0 && (
                        <div 
                          className="bg-emerald-500 h-full transition-all" 
                          style={{ width: `${(classStats.low / classStats.valid) * 100}%` }}
                          title={`Low Risk: ${classStats.low} students`}
                        />
                      )}
                    </div>

                    <div className="flex gap-6 text-[10px] font-mono text-slate-500 dark:text-slate-400 justify-center">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-rose-500 rounded" />
                        High: {Math.round((classStats.high / classStats.valid) * 100)}%
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-amber-500 rounded" />
                        Medium: {Math.round((classStats.medium / classStats.valid) * 100)}%
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-emerald-500 rounded" />
                        Low: {Math.round((classStats.low / classStats.valid) * 100)}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Cohort Table Card */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
                  
                  {/* Table Header Filter tools */}
                  <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    
                    <div className="relative flex-1 max-w-sm">
                      <input
                        type="text"
                        placeholder="Search student ID..."
                        value={classSearch}
                        onChange={(e) => setClassSearch(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 text-sm pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
                      />
                      <span className="absolute left-3 top-2.5 text-slate-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <select 
                        value={classFilter} 
                        onChange={(e) => setClassFilter(e.target.value)}
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                      >
                        <option value="all">Filter: All Risk Levels</option>
                        <option value="High Risk">High Risk Only</option>
                        <option value="Medium Risk">Medium Risk Only</option>
                        <option value="Low Risk">Low Risk Only</option>
                      </select>

                      <div className="text-xs font-mono text-slate-400">
                        Showing <strong>{processedClassList.length}</strong> of <strong>{classStats.total}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Student list table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/20 font-mono text-slate-400 text-xs font-semibold uppercase">
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors" onClick={() => toggleSort('id')}>
                            <span className="flex items-center gap-1">
                              Student ID
                              {classSortField === 'id' && (classSortOrder === 'asc' ? ' ▲' : ' ▼')}
                            </span>
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors" onClick={() => toggleSort('risk')}>
                            <span className="flex items-center gap-1">
                              Struggle Classification
                              {classSortField === 'risk' && (classSortOrder === 'asc' ? ' ▲' : ' ▼')}
                            </span>
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors" onClick={() => toggleSort('attention')}>
                            <span className="flex items-center gap-1">
                              Attention Anchor Step
                              {classSortField === 'attention' && (classSortOrder === 'asc' ? ' ▲' : ' ▼')}
                            </span>
                          </th>
                          <th className="px-6 py-4">Key Diagnostic Insight</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                        {processedClassList.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="px-6 py-12 text-center text-slate-500 dark:text-slate-400 font-mono">
                              No matching student sequences found.
                            </td>
                          </tr>
                        ) : (
                          processedClassList.map((student) => {
                            if (student.error) {
                              return (
                                <tr key={student.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-850/10">
                                  <td className="px-6 py-4 font-mono font-bold text-slate-400">
                                    #{student.id}
                                  </td>
                                  <td colSpan="3" className="px-6 py-4 text-xs font-mono text-rose-500">
                                    Insufficient sequence logs available (Needs min. 10 interactions)
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <button disabled className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed">
                                      Drill-Down
                                    </button>
                                  </td>
                                </tr>
                              );
                            }

                            return (
                              <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/20 transition-all">
                                <td className="px-6 py-4 font-mono font-bold text-slate-900 dark:text-white">
                                  #{student.id}
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                                    student.predicted_risk_class === 'High Risk'
                                      ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-200/40 dark:border-rose-800/30'
                                      : student.predicted_risk_class === 'Medium Risk'
                                        ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200/40 dark:border-amber-800/30'
                                        : 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200/40 dark:border-emerald-800/30'
                                  }`}>
                                    {student.predicted_risk_class}
                                  </span>
                                </td>
                                <td className="px-6 py-4 font-mono text-slate-600 dark:text-slate-400">
                                  Step #{student.attention_focus_timestep}
                                </td>
                                <td className="px-6 py-4 max-w-xs truncate font-medium text-slate-700 dark:text-slate-300">
                                  {student.diagnostic_reasons ? student.diagnostic_reasons.join(', ') : 'None'}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <button 
                                    onClick={() => handleDrillDown(student.id)}
                                    className="text-xs font-semibold px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm transition-all cursor-pointer hover:border-blue-500"
                                  >
                                    Drill-Down
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

            {/* Preloaded view if no class summary triggered */}
            {!classLoading && !classData && (
              <div className="text-center py-16 px-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm animate-fade-in relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-100/30 dark:bg-blue-900/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                <div className="w-20 h-20 bg-blue-50 dark:bg-blue-950/40 rounded-2xl flex items-center justify-center mx-auto mb-6 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30 shadow-md">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Batch Cognitive Diagnostics</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto text-sm leading-relaxed mb-8">
                  Import a comma-separated list of student IDs above to map risk distributions and cognitive struggle nodes across an entire class.
                </p>
                <div className="flex justify-center gap-3 flex-wrap">
                  <button 
                    onClick={() => { setClassIdsInput(DEFAULT_CLASS_IDS.join(', ')); fetchClassSummary(); }}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-md shadow-blue-500/10 cursor-pointer"
                  >
                    Scan Default Class (10 Students)
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

      </main>
      
      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 mt-16 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">
            © 2026 StruggleLens. All rights reserved. Registered MLOps Engine v3.0.0.
          </p>
          <div className="flex gap-4 text-xs font-mono text-slate-400 dark:text-slate-500">
            <span className="hover:text-blue-500 transition-colors">Cognitive Modeling</span>
            <span>•</span>
            <span className="hover:text-blue-500 transition-colors">FastAPI Backplane</span>
            <span>•</span>
            <span className="hover:text-blue-500 transition-colors">Attention Layer Explanations</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
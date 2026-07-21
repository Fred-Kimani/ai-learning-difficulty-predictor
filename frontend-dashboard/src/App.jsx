import React, { useState, useEffect, useMemo, useCallback } from 'react';

// ── API Configuration ──
const API_BASE = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const API_KEY = import.meta.env.VITE_API_KEY || '';
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Wrapper around fetch with:
 * - Configurable base URL (VITE_API_URL)
 * - Optional X-API-Key header (VITE_API_KEY)
 * - 15-second AbortController timeout
 * - Human-friendly error messages
 */
async function apiFetch(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const headers = { ...options.headers };
  if (API_KEY) headers['X-API-Key'] = API_KEY;

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (response.status === 401 || response.status === 403) {
      throw new Error('Authentication failed — check your API key.');
    }
    return response;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out — the server took too long to respond.');
    }
    if (err instanceof TypeError) {
      // Network-level failure (server unreachable, DNS, etc.)
      throw new Error('API server is unreachable. Is the backend running?');
    }
    throw err;
  }
}

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
  const { predicted_risk_class, attention_focus_timestep, diagnostic_reasons, is_uncertain, attention_note, guardrails_applied } = prediction;
  const confidenceIntro = describeConfidence(prediction);
  // Use backend attention_note if available (guardrail-aware), otherwise generate
  const timestepInsight = attention_note || describeAttentionTimestep(attention_focus_timestep);

  let riskStatement;
  if (is_uncertain || predicted_risk_class === 'Uncertain') {
    riskStatement = `${confidenceIntro} the signals are mixed enough that we can't say for certain — it's worth keeping an eye on this student without jumping to conclusions.`;
  } else if (predicted_risk_class === 'High Risk') {
    // Check if guardrails softened the prediction — use gentler language
    const wasOverridden = guardrails_applied && guardrails_applied.length > 0;
    if (wasOverridden) {
      riskStatement = `${confidenceIntro} there are some patterns worth watching, though the overall picture has positive signals too.`;
    } else {
      riskStatement = `${confidenceIntro} there are enough warning signs that we should definitely check in with this student soon.`;
    }
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

// ── Default playground steps ──
const createDefaultPlaygroundSteps = () =>
  Array.from({ length: 10 }, () => ({
    correct: 1,
    attempt_count: 1,
    ms_first_response: 5000,
  }));

// ── Preset playground scenarios ──
const PLAYGROUND_PRESETS = {
  struggling: {
    label: 'Struggling Student',
    description: 'Multiple wrong answers, high attempts, slow responses',
    steps: [
      { correct: 1, attempt_count: 1, ms_first_response: 4000 },
      { correct: 1, attempt_count: 1, ms_first_response: 5000 },
      { correct: 0, attempt_count: 2, ms_first_response: 8000 },
      { correct: 0, attempt_count: 3, ms_first_response: 12000 },
      { correct: 0, attempt_count: 3, ms_first_response: 15000 },
      { correct: 0, attempt_count: 4, ms_first_response: 18000 },
      { correct: 0, attempt_count: 3, ms_first_response: 20000 },
      { correct: 1, attempt_count: 4, ms_first_response: 22000 },
      { correct: 0, attempt_count: 5, ms_first_response: 25000 },
      { correct: 0, attempt_count: 4, ms_first_response: 30000 },
    ],
  },
  steady: {
    label: 'Steady Learner',
    description: 'Mostly correct, consistent pace',
    steps: [
      { correct: 1, attempt_count: 1, ms_first_response: 3000 },
      { correct: 1, attempt_count: 1, ms_first_response: 3500 },
      { correct: 1, attempt_count: 1, ms_first_response: 2800 },
      { correct: 1, attempt_count: 1, ms_first_response: 3200 },
      { correct: 0, attempt_count: 2, ms_first_response: 5000 },
      { correct: 1, attempt_count: 1, ms_first_response: 3100 },
      { correct: 1, attempt_count: 1, ms_first_response: 2900 },
      { correct: 1, attempt_count: 1, ms_first_response: 3000 },
      { correct: 1, attempt_count: 1, ms_first_response: 2700 },
      { correct: 1, attempt_count: 1, ms_first_response: 3300 },
    ],
  },
  lateDrop: {
    label: 'Late Drop-off',
    description: 'Starts strong, falters at the end',
    steps: [
      { correct: 1, attempt_count: 1, ms_first_response: 2000 },
      { correct: 1, attempt_count: 1, ms_first_response: 2500 },
      { correct: 1, attempt_count: 1, ms_first_response: 2200 },
      { correct: 1, attempt_count: 1, ms_first_response: 2800 },
      { correct: 1, attempt_count: 1, ms_first_response: 3000 },
      { correct: 1, attempt_count: 2, ms_first_response: 4500 },
      { correct: 0, attempt_count: 2, ms_first_response: 7000 },
      { correct: 0, attempt_count: 3, ms_first_response: 10000 },
      { correct: 0, attempt_count: 3, ms_first_response: 12000 },
      { correct: 0, attempt_count: 4, ms_first_response: 15000 },
    ],
  },
};


const MAX_RANDOM_TRIALS = 15;
const MAX_PLAYGROUND_TRIALS = 10;

function App() {
  // Navigation & Theme State
  const [showHero, setShowHero] = useState(true);
  const [activeTab, setActiveTab] = useState('single');
  const [theme, setTheme] = useState('light');
  const [apiStatus, setApiStatus] = useState('checking');
  const [trialsRemaining, setTrialsRemaining] = useState(MAX_RANDOM_TRIALS);
  const [playgroundTrialsRemaining, setPlaygroundTrialsRemaining] = useState(MAX_PLAYGROUND_TRIALS);

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

  // Playground State
  const [playgroundSteps, setPlaygroundSteps] = useState(createDefaultPlaygroundSteps());
  const [playgroundResult, setPlaygroundResult] = useState(null);
  const [playgroundLoading, setPlaygroundLoading] = useState(false);
  const [playgroundError, setPlaygroundError] = useState(null);

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
      const response = await apiFetch('/health');
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
    if (trialsRemaining <= 0) {
      setError('You\'ve used all your demo trials. Refresh the page to reset.');
      return;
    }
    setLoading(true);
    setError(null);
    setSelectedStep(null);
    try {
      const response = await apiFetch('/demo/random');
      if (!response.ok) {
        throw new Error(`Failed to load a random student sequence (Status: ${response.status})`);
      }
      const result = await response.json();
      setData(result);
      setStudentId(result.user_id.toString());
      setApiStatus('online');
      setTrialsRemaining(prev => prev - 1);
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
      const response = await apiFetch(`/student/${finalId}`);
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
      const response = await apiFetch('/class/summary', {
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

  // Playground handlers
  const updatePlaygroundStep = (index, field, value) => {
    setPlaygroundSteps(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const loadPreset = (presetKey) => {
    setPlaygroundSteps(PLAYGROUND_PRESETS[presetKey].steps.map(s => ({ ...s })));
    setPlaygroundResult(null);
    setPlaygroundError(null);
  };

  const runPlaygroundPrediction = async () => {
    if (playgroundTrialsRemaining <= 0) {
      setPlaygroundError('You\'ve used all your playground trials. Refresh the page to reset.');
      return;
    }
    setPlaygroundLoading(true);
    setPlaygroundError(null);
    try {
      const response = await apiFetch('/predict/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps: playgroundSteps })
      });
      if (!response.ok) {
        throw new Error(`Prediction failed (Status: ${response.status})`);
      }
      const result = await response.json();
      setPlaygroundResult(result);
      setApiStatus('online');
      setPlaygroundTrialsRemaining(prev => prev - 1);
    } catch (err) {
      setPlaygroundError(err.message);
    } finally {
      setPlaygroundLoading(false);
    }
  };

  // Risk styling — standard semantic colors
  const getRiskColor = (riskClass) => {
    switch (riskClass) {
      case 'High Risk': return { text: 'text-risk-high', bg: 'bg-risk-high-soft dark:bg-risk-high-wash', dot: 'bg-risk-high' };
      case 'Medium Risk': return { text: 'text-risk-mid', bg: 'bg-risk-mid-soft dark:bg-risk-mid-wash', dot: 'bg-risk-mid' };
      case 'Low Risk': return { text: 'text-risk-low', bg: 'bg-risk-low-soft dark:bg-risk-low-wash', dot: 'bg-risk-low' };
      case 'Uncertain': return { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30', dot: 'bg-amber-500' };
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

  // ══════════════════════════════════════════════════════════════════
  // HERO LANDING SCREEN
  // ══════════════════════════════════════════════════════════════════
  if (showHero) {
    return (
      <div className="min-h-screen bg-surface dark:bg-surface-dark flex flex-col items-center justify-center px-6 text-center relative overflow-hidden antialiased">
        {/* Background decorative elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 -left-20 w-72 h-72 bg-brand/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
          <div className="absolute top-10 right-10 w-40 h-40 bg-risk-low/5 rounded-full blur-2xl" />
        </div>

        {/* Floating grid decoration */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage: `radial-gradient(circle, currentColor 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
          }}
        />

        <div className="relative z-10 max-w-2xl animate-fade-in">
          {/* Logo */}
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-brand to-brand-deep flex items-center justify-center text-white text-2xl font-bold shadow-lg mb-8"
            style={{ animation: 'fadeIn 0.4s ease-out forwards' }}>
            Ω
          </div>

          {/* Model badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand/10 dark:bg-brand/20 text-brand text-xs font-semibold tracking-wide mb-6"
            style={{ animation: 'fadeIn 0.5s ease-out 0.1s both' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
            LSTM + ATTENTION · SEQUENCE MODEL
          </div>

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight mb-4"
            style={{ animation: 'fadeIn 0.5s ease-out 0.2s both' }}>
            Struggle<span className="text-brand">Lens</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-slate-500 dark:text-slate-400 mb-3 leading-relaxed"
            style={{ animation: 'fadeIn 0.5s ease-out 0.3s both' }}>
            AI-Powered Student Risk Prediction
          </p>

          <p className="text-sm text-slate-400 dark:text-slate-500 max-w-lg mx-auto mb-10 leading-relaxed"
            style={{ animation: 'fadeIn 0.5s ease-out 0.35s both' }}>
            Identify students at risk of falling behind using attention-based sequence analysis.
            Analyze 10-step interaction windows, detect cognitive struggle points, and generate
            actionable teacher insights — in real time.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-3 mb-10"
            style={{ animation: 'fadeIn 0.5s ease-out 0.4s both' }}>
            {[
              { icon: '🎯', text: 'Attention Heatmaps' },
              { icon: '📊', text: '3-Class Risk Scoring' },
              { icon: '🧠', text: 'LSTM Sequence Model' },
              { icon: '👥', text: 'Batch Class Analysis' },
            ].map(({ icon, text }) => (
              <span key={text} className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-surface-dark-raised border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 shadow-card">
                <span>{icon}</span> {text}
              </span>
            ))}
          </div>

          {/* CTA */}
          <div style={{ animation: 'fadeIn 0.5s ease-out 0.5s both' }}>
            <button
              onClick={() => setShowHero(false)}
              className="btn-primary text-base px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5"
            >
              Launch Dashboard →
            </button>
          </div>

          {/* Tech stack */}
          <div className="mt-12 flex items-center justify-center gap-6 text-xs text-slate-400 dark:text-slate-500"
            style={{ animation: 'fadeIn 0.5s ease-out 0.6s both' }}>
            <span>PyTorch</span>
            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
            <span>FastAPI</span>
            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
            <span>React + Vite</span>
            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
            <span>ASSISTments Dataset</span>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // MAIN DASHBOARD
  // ══════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-surface text-slate-700 dark:bg-surface-dark dark:text-slate-300 antialiased">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-40 bg-white dark:bg-surface-dark border-b border-gray-200 dark:border-gray-700 border-t-[3px] border-t-brand">
        <div className="max-w-[1120px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-brand-deep flex items-center justify-center text-white font-bold text-sm cursor-default shadow-sm">
              Ω
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-900 dark:text-white leading-none">
                StruggleLens
              </h1>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 hidden sm:block">
                Student risk analysis
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* API Status */}
            <button
              onClick={checkApiHealth}
              title="Check API status"
              className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded text-xs font-medium cursor-pointer border ${
                apiStatus === 'online'
                  ? 'text-risk-low bg-risk-low-soft dark:bg-risk-low-wash border-risk-low/20'
                  : apiStatus === 'offline'
                    ? 'text-risk-high bg-risk-high-soft dark:bg-risk-high-wash border-risk-high/20'
                    : 'text-slate-400 bg-surface-sunken dark:bg-surface-dark-raised border-gray-200 dark:border-gray-700'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${
                apiStatus === 'online' ? 'bg-risk-low' : apiStatus === 'offline' ? 'bg-risk-high' : 'bg-slate-400'
              }`} />
              <span className="hidden sm:inline">API: {apiStatus === 'online' ? 'Connected' : apiStatus === 'offline' ? 'Offline' : 'Checking'}</span>
              <span className="sm:hidden">{apiStatus === 'online' ? 'On' : apiStatus === 'offline' ? 'Off' : '...'}</span>
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-surface-sunken dark:hover:bg-surface-dark-raised cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
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
      <main className="max-w-[1120px] mx-auto px-4 sm:px-6 py-4 sm:py-6">

        {/* Tab navigation */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
          <nav className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
            {[
              { key: 'single', label: 'Student', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
              { key: 'class', label: 'Class', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
              { key: 'playground', label: 'Playground', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
              { key: 'howItWorks', label: 'How It Works', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
            ].map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => {
                  setActiveTab(key);
                  if (key === 'class' && !classData) fetchClassSummary();
                }}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium cursor-pointer border-b-2 -mb-px whitespace-nowrap ${
                  activeTab === key
                    ? 'border-brand text-brand'
                    : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={icon} />
                </svg>
                {label}
              </button>
            ))}
          </nav>

          {/* Active student indicator */}
          {activeTab === 'single' && data && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono bg-surface-sunken dark:bg-surface-dark-sunken px-2.5 py-1 rounded border border-gray-200 dark:border-gray-700">
              Active: Student <span className="font-bold ml-0.5">#{data.user_id}</span>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* SINGLE STUDENT TAB                                               */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'single' && (
          <div className="space-y-5">

            {/* Controls */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Student Check-In
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Look up a student to see how they've been doing recently.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <form onSubmit={fetchSpecificStudent} className="flex items-center border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-surface-dark-raised">
                  <span className="pl-2.5 text-slate-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </span>
                  <input
                    type="number"
                    placeholder="Student ID"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="bg-transparent text-slate-900 dark:text-white placeholder-slate-400 font-mono text-sm px-2.5 py-1.5 focus:outline-none w-full sm:w-28 min-w-0"
                  />
                  <button
                    type="submit"
                    disabled={loading || !studentId.trim()}
                    className="btn-primary text-xs py-1.5 px-3 rounded-none rounded-r border-l border-brand-deep whitespace-nowrap"
                  >
                    Analyze
                  </button>
                </form>

                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchRandomStudent}
                    disabled={loading || trialsRemaining <= 0}
                    className="btn-ghost text-sm py-1.5 px-3 flex items-center justify-center gap-1.5"
                  >
                    <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 12H19" />
                    </svg>
                    {loading ? 'Loading...' : 'Random'}
                  </button>
                  <span className={`text-[11px] font-mono font-medium tabular-nums px-1.5 py-0.5 rounded-md ${
                    trialsRemaining <= 3
                      ? 'text-risk-high bg-risk-high-soft dark:bg-risk-high-wash'
                      : trialsRemaining <= 7
                        ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30'
                        : 'text-slate-400 bg-surface-sunken dark:bg-surface-dark-sunken'
                  }`}>
                    {trialsRemaining}/{MAX_RANDOM_TRIALS}
                  </span>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="card p-4 border-l-3 border-l-risk-high">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-risk-high-soft dark:bg-risk-high-wash rounded text-risk-high shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Connection Error</h3>
                    <p className="text-slate-500 text-sm mt-0.5">{error}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <button onClick={checkApiHealth} className="text-xs text-risk-high font-medium hover:underline cursor-pointer">
                        Retry
                      </button>
                      <span className="label-mono text-xs">{API_BASE}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Loading skeleton */}
            {loading && (
              <div className="space-y-4 animate-pulse">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="card p-5 h-36 space-y-3">
                      <div className="h-3 bg-surface-sunken dark:bg-surface-dark-sunken rounded w-1/3"></div>
                      <div className="h-6 bg-surface-sunken dark:bg-surface-dark-sunken rounded w-2/3"></div>
                      <div className="h-10 bg-surface-sunken dark:bg-surface-dark-sunken rounded w-full"></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!data && !loading && !error && (
              <div className="card p-10 text-center">
                <div className="w-10 h-10 bg-surface-sunken dark:bg-surface-dark-sunken rounded flex items-center justify-center mx-auto mb-4 text-slate-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
                  No student selected
                </h2>
                <p className="text-sm text-slate-500 max-w-sm mx-auto mb-5">
                  Enter a student ID or load a random sequence to begin analysis.
                </p>
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => { setStudentId('1700'); fetchSpecificStudent(null, '1700'); }}
                    className="btn-ghost text-xs font-mono"
                  >
                    Load #1700
                  </button>
                  <button
                    onClick={fetchRandomStudent}
                    disabled={trialsRemaining <= 0}
                    className="btn-primary text-xs"
                  >
                    Random Student
                  </button>
                  <span className="text-[11px] font-mono text-slate-400">
                    {trialsRemaining} trials left
                  </span>
                </div>
              </div>
            )}

            {/* ── Dashboard content ── */}
            {data && !loading && (
              <div className="space-y-5">

                {/* Prediction + Diagnostics grid */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">

                  {/* Prediction card */}
                  <div className={`lg:col-span-2 card p-5 ${getRiskColor(data.prediction.predicted_risk_class).bg}`}>
                    <p className="label mb-4">Risk Assessment</p>

                    <div className="flex items-center gap-4">
                      {/* Gauge */}
                      <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="32" cy="32" r="26" stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth="3" fill="transparent" />
                          <circle
                            cx="32" cy="32" r="26"
                            stroke="currentColor"
                            className={getRiskColor(data.prediction.predicted_risk_class).text}
                            strokeWidth="3.5"
                            fill="transparent"
                            strokeDasharray={163}
                            strokeDashoffset={163 - (163 * getConfidence(data.prediction))}
                            strokeLinecap="butt"
                          />
                        </svg>
                        <span className="absolute text-sm font-bold font-mono text-slate-900 dark:text-white">
                          {Math.round(getConfidence(data.prediction) * 100)}%
                        </span>
                      </div>

                      <div>
                        <p className="text-lg font-semibold text-slate-900 dark:text-white leading-tight">
                          {data.prediction.predicted_risk_class === 'Uncertain' ? 'Needs Review'
                            : data.prediction.predicted_risk_class === 'High Risk' ? 'Needs Support'
                            : data.prediction.predicted_risk_class === 'Medium Risk' ? 'Worth Watching'
                            : 'Doing Well'}
                        </p>
                        {data.prediction.predicted_risk_class === 'Uncertain' && (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01" />
                            </svg>
                            Needs More Data
                          </span>
                        )}
                        <p className="text-xs text-slate-500 mt-0.5 font-mono">
                          Student #{data.user_id} · {data.prediction.predicted_risk_class}
                        </p>
                      </div>
                    </div>

                    {/* Where the struggle started — or softened attention note */}
                    <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                        {data.prediction.suppress_attention_peak
                          ? `Model focus: Step ${data.prediction.attention_focus_timestep}`
                          : `Attention focus: Step ${data.prediction.attention_focus_timestep}`}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        {data.prediction.attention_note || describeAttentionTimestep(data.prediction.attention_focus_timestep)}
                      </p>
                    </div>
                  </div>

                  {/* Diagnostics + Confidence */}
                  <div className="lg:col-span-3 card p-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                      {/* Summary */}
                      <div>
                        <p className="label mb-3">Diagnostic Summary</p>
                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                          {generateCounselorSummary(data.prediction)}
                        </p>
                      </div>

                      {/* Confidence bars */}
                      <div>
                        <p className="label mb-3">Confidence Scores</p>
                        <div className="space-y-3">
                          {[
                            { label: 'Low Risk', value: data.prediction.confidence_scores.low_risk, color: 'bg-risk-low', textColor: 'text-risk-low' },
                            { label: 'Medium Risk', value: data.prediction.confidence_scores.medium_risk, color: 'bg-risk-mid', textColor: 'text-risk-mid' },
                            { label: 'High Risk', value: data.prediction.confidence_scores.high_risk, color: 'bg-risk-high', textColor: 'text-risk-high' },
                          ].map(({ label, value, color, textColor }) => (
                            <div key={label}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className={`font-medium ${textColor}`}>{label}</span>
                                <span className="font-mono text-slate-500">{(value * 100).toFixed(1)}%</span>
                              </div>
                              <div className="w-full bg-surface-sunken dark:bg-surface-dark-sunken h-1.5 overflow-hidden rounded-sm">
                                <div className={`${color} h-full rounded-sm`} style={{ width: `${value * 100}%` }} />
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
                  <div className="card p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                          Recent Activity
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Click a step to inspect. {data.prediction.suppress_attention_peak
                            ? 'Highlighted step = model focus point.'
                            : 'Highlighted step = peak struggle point.'}
                        </p>
                      </div>
                      <div className="flex gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-risk-low rounded-sm" />
                          Correct
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-risk-high rounded-sm" />
                          Incorrect
                        </span>
                      </div>
                    </div>

                    {/* Timeline grid — uniform height */}
                    <div className="grid grid-cols-5 sm:grid-cols-5 md:grid-cols-10 gap-1.5">
                      {data.history.map((step, index) => {
                        const stepNum = index + 1;
                        const isAttentionFocus = stepNum === data.prediction.attention_focus_timestep;
                        const isSelected = selectedStep === index;

                        return (
                          <button
                            key={index}
                            onClick={() => setSelectedStep(index)}
                            className={`group p-1.5 sm:p-2.5 rounded text-left flex flex-col justify-between relative cursor-pointer outline-none h-[76px] sm:h-[96px] border ${
                              isSelected
                                ? 'bg-brand-wash dark:bg-brand-wash-dark border-brand'
                                : isAttentionFocus
                                  ? 'bg-brand-wash/50 dark:bg-brand-wash-dark/50 border-brand/30'
                                  : 'bg-surface-sunken dark:bg-surface-dark-sunken border-gray-200 dark:border-gray-700 hover:border-slate-400 dark:hover:border-slate-500'
                            }`}
                          >
                            <div className="flex justify-between items-center w-full">
                              <span className="text-[10px] font-mono font-medium text-slate-500">S{stepNum}</span>
                              {isAttentionFocus && (
                                <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                              )}
                            </div>

                            <div className="my-1">
                              <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-medium ${
                                step.correct === 1
                                  ? 'bg-risk-low-soft dark:bg-risk-low-wash text-risk-low'
                                  : 'bg-risk-high-soft dark:bg-risk-high-wash text-risk-high'
                              }`}>
                                {step.correct === 1 ? '✓' : '✗'}
                              </div>
                            </div>

                            <span className="text-[10px] font-mono text-slate-500">
                              {(step.ms_first_response / 1000).toFixed(1)}s
                            </span>

                            {isAttentionFocus && (
                              <div className="absolute left-1/2 -bottom-1.5 transform -translate-x-1/2 bg-brand text-white text-[8px] font-bold px-1.5 py-0.5 rounded-sm whitespace-nowrap">
                                PEAK
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Step detail panel */}
                    {selectedStep !== null && data.history[selectedStep] && (
                      <div className="surface-inset p-4 border-l-2 border-l-brand">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-x-8">

                          <div>
                            <p className="label mb-0.5">Step</p>
                            <h4 className="text-base font-semibold text-slate-900 dark:text-white">
                              #{selectedStep + 1}
                            </h4>
                            <span className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded text-xs font-medium ${
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
                            <p className="label mb-0.5">Response Time</p>
                            <p className="text-base font-semibold font-mono text-slate-900 dark:text-white">
                              {(data.history[selectedStep].ms_first_response / 1000).toFixed(2)}s
                            </p>
                          </div>

                          <div>
                            <p className="label mb-0.5">Attempts</p>
                            <p className="text-base font-semibold font-mono text-slate-900 dark:text-white">
                              {data.history[selectedStep].attempt_count}
                            </p>
                          </div>

                          <div className="col-span-2 sm:col-span-1 max-w-none sm:max-w-xs">
                            <p className="label mb-0.5">Assessment</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
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

                {/* ── Attention Heatmap (Bar Chart) ── */}
                {data.prediction && (
                  <div className="card p-5 space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Attention Distribution
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">Effort level across recent interactions — taller bars indicate more struggle.</p>
                    </div>
                    <div className="relative">
                      <div className="flex items-end h-32 gap-1 px-0.5">
                        {attentionCurve.map((weight, index) => {
                          const isFocus = index + 1 === data.prediction.attention_focus_timestep;
                          return (
                            <div key={index} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                              <span className="absolute -top-5 text-[10px] font-mono text-slate-600 dark:text-slate-300 opacity-0 group-hover:opacity-100 bg-white dark:bg-surface-dark-raised px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 z-20">
                                {weight}%
                              </span>

                              <div
                                className={`w-full rounded-sm ${
                                  isFocus
                                    ? 'bg-brand'
                                    : 'bg-slate-300 dark:bg-slate-600 group-hover:bg-slate-400 dark:group-hover:bg-slate-500'
                                }`}
                                style={{ height: `${weight}%` }}
                              />
                            </div>
                          );
                        })}
                      </div>
                      {/* X-axis line */}
                      <div className="h-px bg-slate-300 dark:bg-slate-600 mt-0" />
                      <div className="flex gap-1 px-0.5 mt-1">
                        {attentionCurve.map((_, index) => {
                          const isFocus = index + 1 === data.prediction.attention_focus_timestep;
                          return (
                            <div key={index} className="flex-1 text-center">
                              <span className={`text-[10px] font-mono ${isFocus ? 'text-brand font-bold' : 'text-slate-400'}`}>
                                {index + 1}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Recommendations ── */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
                  {/* Interventions */}
                  <div className="lg:col-span-3 card p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Suggested Next Steps
                    </h3>

                    <ul className="space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
                      {data.prediction.predicted_risk_class === 'High Risk' ? (
                        <>
                          <li className="flex items-start gap-2">
                            <span className="text-risk-high mt-0.5 text-xs">●</span>
                            <span><strong>Schedule a 1-on-1 check-in.</strong> Walk through the material they're stuck on, particularly around step {data.prediction.attention_focus_timestep} where things seemed to get hard.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-risk-high mt-0.5 text-xs">●</span>
                            <span><strong>Review prerequisite concepts.</strong> Their struggle might be connected to earlier concepts they didn't fully grasp. A quick review of foundational material could help.</span>
                          </li>
                        </>
                      ) : data.prediction.predicted_risk_class === 'Medium Risk' ? (
                        <>
                          <li className="flex items-start gap-2">
                            <span className="text-risk-mid mt-0.5 text-xs">●</span>
                            <span><strong>Provide targeted hints.</strong> This student could benefit from some guidance on upcoming problems — a nudge in the right direction.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-risk-mid mt-0.5 text-xs">●</span>
                            <span><strong>Monitor progress.</strong> Check back in after a few more assignments to see if things improve or if they need more help.</span>
                          </li>
                        </>
                      ) : (
                        <li className="flex items-start gap-2">
                          <span className="text-risk-low mt-0.5 text-xs">●</span>
                          <span><strong>No action required.</strong> This student is keeping up well and showing solid understanding. No extra support needed right now.</span>
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* Quick stats */}
                  <div className="lg:col-span-2 card p-5">
                    <p className="label mb-4">Quick Stats</p>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Success rate</span>
                        <span className="font-mono font-medium text-slate-900 dark:text-white">{data.history.filter(h => h.correct === 1).length}/10</span>
                      </div>
                      <div className="h-px bg-gray-200 dark:bg-gray-700" />
                      <div className="flex justify-between">
                        <span className="text-slate-500">Avg. attempts</span>
                        <span className="font-mono font-medium text-slate-900 dark:text-white">{(data.history.reduce((acc, h) => acc + h.attempt_count, 0) / 10).toFixed(1)}</span>
                      </div>
                      <div className="h-px bg-gray-200 dark:bg-gray-700" />
                      <div className="flex justify-between">
                        <span className="text-slate-500">Avg. response time</span>
                        <span className="font-mono font-medium text-slate-900 dark:text-white">{(data.history.reduce((acc, h) => acc + h.ms_first_response, 0) / 10000).toFixed(2)}s</span>
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
          <div className="space-y-5">

            {/* Controls */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Class Overview
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Batch analysis across multiple students.
                </p>
              </div>
              <form onSubmit={fetchClassSummary} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:flex-1 lg:max-w-xl">
                <div className="flex-1 flex items-center border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-surface-dark-raised">
                  <span className="pl-2.5 text-xs text-slate-400 font-medium whitespace-nowrap">IDs:</span>
                  <input
                    type="text"
                    placeholder="1, 10, 100, 500..."
                    value={classIdsInput}
                    onChange={(e) => setClassIdsInput(e.target.value)}
                    className="bg-transparent text-slate-900 dark:text-white placeholder-slate-400 font-mono text-sm px-2.5 py-1.5 focus:outline-none w-full min-w-0"
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
              <div className="card p-4 border-l-3 border-l-risk-high">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-risk-high-soft dark:bg-risk-high-wash rounded text-risk-high">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Cohort Scan Failed</h3>
                    <p className="text-slate-500 text-sm mt-0.5">{classError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Loading */}
            {classLoading && (
              <div className="space-y-4 animate-pulse">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="card p-4 h-24 space-y-2">
                      <div className="h-3 bg-surface-sunken dark:bg-surface-dark-sunken rounded w-1/3"></div>
                      <div className="h-5 bg-surface-sunken dark:bg-surface-dark-sunken rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
                <div className="card h-48" />
              </div>
            )}

            {/* Class content */}
            {!classLoading && classData && classStats && (
              <div className="space-y-4">

                {/* Stats row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="card p-4">
                    <p className="label">Total Students</p>
                    <h3 className="text-2xl font-semibold font-mono text-slate-900 dark:text-white mt-1">
                      {classStats.total}
                    </h3>
                  </div>

                  <div className="card p-4 bg-risk-high-soft dark:bg-risk-high-wash">
                    <p className="label text-risk-high">High Risk</p>
                    <div className="flex items-center gap-2 mt-1">
                      <h3 className="text-2xl font-semibold font-mono text-risk-high">{classStats.high}</h3>
                      <span className="text-xs text-risk-high font-mono">({classStats.valid > 0 ? Math.round((classStats.high / classStats.valid) * 100) : 0}%)</span>
                    </div>
                  </div>

                  <div className="card p-4 bg-risk-mid-soft dark:bg-risk-mid-wash">
                    <p className="label text-risk-mid">Medium Risk</p>
                    <h3 className="text-2xl font-semibold font-mono text-risk-mid mt-1">{classStats.medium}</h3>
                  </div>

                  <div className="card p-4 bg-risk-low-soft dark:bg-risk-low-wash">
                    <p className="label text-risk-low">Low Risk</p>
                    <h3 className="text-2xl font-semibold font-mono text-risk-low mt-1">{classStats.low}</h3>
                  </div>
                </div>

                {/* Distribution bar */}
                {classStats.valid > 0 && (
                  <div className="card p-4 space-y-3">
                    <p className="label">Risk Distribution</p>
                    <div className="w-full h-2 flex overflow-hidden bg-surface-sunken dark:bg-surface-dark-sunken rounded-sm">
                      {classStats.high > 0 && (
                        <div className="bg-risk-high h-full" style={{ width: `${(classStats.high / classStats.valid) * 100}%` }} />
                      )}
                      {classStats.medium > 0 && (
                        <div className="bg-risk-mid h-full" style={{ width: `${(classStats.medium / classStats.valid) * 100}%` }} />
                      )}
                      {classStats.low > 0 && (
                        <div className="bg-risk-low h-full" style={{ width: `${(classStats.low / classStats.valid) * 100}%` }} />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 bg-risk-high rounded-sm" /> {Math.round((classStats.high / classStats.valid) * 100)}% high</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 bg-risk-mid rounded-sm" /> {Math.round((classStats.medium / classStats.valid) * 100)}% medium</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 bg-risk-low rounded-sm" /> {Math.round((classStats.low / classStats.valid) * 100)}% low</span>
                    </div>
                  </div>
                )}

                {/* Student table */}
                <div className="card overflow-hidden">
                  {/* Table controls */}
                  <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-700 bg-surface-sunken/50 dark:bg-surface-dark-sunken/50">
                    <div className="relative max-w-xs">
                      <input
                        type="text"
                        placeholder="Filter by ID..."
                        value={classSearch}
                        onChange={(e) => setClassSearch(e.target.value)}
                        className="w-full bg-white dark:bg-surface-dark-raised text-sm pl-7 pr-3 py-1.5 rounded border border-gray-200 dark:border-gray-700 focus:outline-none focus:border-brand font-mono"
                      />
                      <span className="absolute left-2 top-2 text-slate-400">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <select
                        value={classFilter}
                        onChange={(e) => setClassFilter(e.target.value)}
                        className="bg-white dark:bg-surface-dark-raised rounded border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs font-medium focus:outline-none cursor-pointer"
                      >
                        <option value="all">All risk levels</option>
                        <option value="High Risk">High risk</option>
                        <option value="Medium Risk">Medium risk</option>
                        <option value="Low Risk">Low risk</option>
                      </select>
                      <span className="text-xs font-mono text-slate-500">
                        {processedClassList.length}/{classStats.total}
                      </span>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[600px]">
                      <thead>
                        <tr className="text-xs text-slate-500 font-medium border-b border-gray-200 dark:border-gray-700 bg-surface-sunken/30 dark:bg-surface-dark-sunken/30">
                          <th className="px-4 py-2.5 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" onClick={() => toggleSort('id')}>
                            ID {classSortField === 'id' && (classSortOrder === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-4 py-2.5 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" onClick={() => toggleSort('risk')}>
                            Status {classSortField === 'risk' && (classSortOrder === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-4 py-2.5 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" onClick={() => toggleSort('attention')}>
                            Focus Area {classSortField === 'attention' && (classSortOrder === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-4 py-2.5">Diagnostic</th>
                          <th className="px-4 py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {processedClassList.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="px-4 py-8 text-center text-slate-400 text-sm">
                              No matching students found.
                            </td>
                          </tr>
                        ) : (
                          processedClassList.map((student, rowIdx) => {
                            if (student.error) {
                              return (
                                <tr key={student.id} className={`border-b border-gray-200 dark:border-gray-700 ${rowIdx % 2 === 0 ? '' : 'bg-surface-sunken/30 dark:bg-surface-dark-sunken/30'}`}>
                                  <td className="px-4 py-2.5 font-mono font-medium text-slate-400">#{student.id}</td>
                                  <td colSpan="3" className="px-4 py-2.5 text-xs text-risk-high">Insufficient history (min 10 interactions)</td>
                                  <td className="px-4 py-2.5 text-right">
                                    <button disabled className="text-xs px-2.5 py-1 rounded text-slate-300 dark:text-slate-600 cursor-not-allowed border border-gray-200 dark:border-gray-700">View</button>
                                  </td>
                                </tr>
                              );
                            }

                            const rc = getRiskColor(student.predicted_risk_class);
                            return (
                              <tr key={student.id} className={`group hover:bg-surface-sunken dark:hover:bg-surface-dark-sunken border-b border-gray-200 dark:border-gray-700 ${rowIdx % 2 === 0 ? '' : 'bg-surface-sunken/30 dark:bg-surface-dark-sunken/30'}`}>
                                <td className="px-4 py-2.5 font-mono font-medium text-slate-900 dark:text-white">#{student.id}</td>
                                <td className="px-4 py-2.5">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${rc.bg} ${rc.text}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${rc.dot}`} />
                                    {student.predicted_risk_class}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-slate-500 text-sm">{student.attention_focus_timestep <= 2 ? 'Early material' : student.attention_focus_timestep <= 5 ? 'Middle topics' : student.attention_focus_timestep <= 8 ? 'Recent work' : 'Latest lesson'}</td>
                                <td className="px-4 py-2.5 max-w-xs truncate text-slate-500 text-sm">
                                  {student.diagnostic_reasons ? student.diagnostic_reasons.join(', ') : '—'}
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  <button
                                    onClick={() => handleDrillDown(student.id)}
                                    className="text-xs font-medium text-brand hover:text-brand-deep hover:underline cursor-pointer"
                                  >
                                    View →
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
              <div className="card p-10 text-center">
                <div className="w-10 h-10 bg-surface-sunken dark:bg-surface-dark-sunken rounded flex items-center justify-center mx-auto mb-4 text-slate-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
                  No cohort loaded
                </h2>
                <p className="text-sm text-slate-500 max-w-sm mx-auto mb-5">
                  Enter student IDs separated by commas to run a batch analysis.
                </p>
                <button
                  onClick={() => { setClassIdsInput(DEFAULT_CLASS_IDS.join(', ')); fetchClassSummary(); }}
                  className="btn-primary text-xs"
                >
                  Load Default Cohort (10)
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* PLAYGROUND TAB                                                    */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'playground' && (
          <div className="space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Prediction Playground
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Craft a custom 10-step interaction sequence and see how the model responds in real time.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400 font-medium mr-1">Presets:</span>
                {Object.entries(PLAYGROUND_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => loadPreset(key)}
                    className="btn-ghost text-xs py-1 px-2.5"
                    title={preset.description}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Step editor grid */}
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="label">Interaction Sequence</p>
                <button
                  onClick={() => { setPlaygroundSteps(createDefaultPlaygroundSteps()); setPlaygroundResult(null); }}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                >
                  Reset all
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {playgroundSteps.map((step, index) => (
                  <div key={index} className={`rounded-lg border p-3 space-y-2.5 transition-colors ${
                    step.correct === 1
                      ? 'bg-risk-low-soft/50 dark:bg-risk-low-wash/50 border-risk-low/20'
                      : 'bg-risk-high-soft/50 dark:bg-risk-high-wash/50 border-risk-high/20'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-slate-500">STEP {index + 1}</span>
                      <button
                        onClick={() => updatePlaygroundStep(index, 'correct', step.correct === 1 ? 0 : 1)}
                        className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold cursor-pointer transition-colors ${
                          step.correct === 1
                            ? 'bg-risk-low text-white'
                            : 'bg-risk-high text-white'
                        }`}
                        title={step.correct === 1 ? 'Correct — click to toggle' : 'Incorrect — click to toggle'}
                      >
                        {step.correct === 1 ? '✓' : '✗'}
                      </button>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 font-medium block mb-0.5">Time (ms)</label>
                      <input
                        type="number"
                        value={step.ms_first_response}
                        onChange={(e) => updatePlaygroundStep(index, 'ms_first_response', parseFloat(e.target.value) || 0)}
                        className="w-full bg-white dark:bg-surface-dark-raised text-xs font-mono px-2 py-1 rounded border border-gray-200 dark:border-gray-700 focus:outline-none focus:border-brand"
                        min="0"
                        step="500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 font-medium block mb-0.5">Attempts</label>
                      <input
                        type="number"
                        value={step.attempt_count}
                        onChange={(e) => updatePlaygroundStep(index, 'attempt_count', parseInt(e.target.value) || 1)}
                        className="w-full bg-white dark:bg-surface-dark-raised text-xs font-mono px-2 py-1 rounded border border-gray-200 dark:border-gray-700 focus:outline-none focus:border-brand"
                        min="1"
                        max="10"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={runPlaygroundPrediction}
                  disabled={playgroundLoading || playgroundTrialsRemaining <= 0}
                  className="btn-primary flex items-center gap-2"
                >
                  {playgroundLoading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 12H19" />
                      </svg>
                      Running Model...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Run Prediction
                    </>
                  )}
                </button>
                <span className={`text-[11px] font-mono font-medium tabular-nums px-1.5 py-0.5 rounded-md ${
                  playgroundTrialsRemaining <= 2
                    ? 'text-risk-high bg-risk-high-soft dark:bg-risk-high-wash'
                    : playgroundTrialsRemaining <= 5
                      ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30'
                      : 'text-slate-400 bg-surface-sunken dark:bg-surface-dark-sunken'
                }`}>
                  {playgroundTrialsRemaining}/{MAX_PLAYGROUND_TRIALS}
                </span>
                <span className="text-xs text-slate-400">
                  {playgroundSteps.filter(s => s.correct === 1).length}/10 correct · Avg {(playgroundSteps.reduce((a, s) => a + s.ms_first_response, 0) / 10000).toFixed(1)}s
                </span>
              </div>
            </div>

            {/* Playground error */}
            {playgroundError && (
              <div className="card p-4 border-l-3 border-l-risk-high">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-risk-high-soft dark:bg-risk-high-wash rounded text-risk-high shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Prediction Failed</h3>
                    <p className="text-slate-500 text-sm mt-0.5">{playgroundError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Playground result */}
            {playgroundResult && playgroundResult.prediction && (
              <div className="space-y-4 animate-fade-in">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">

                  {/* Result card */}
                  <div className={`lg:col-span-2 card p-5 ${getRiskColor(playgroundResult.prediction.predicted_risk_class).bg}`}>
                    <p className="label mb-4">Prediction Result</p>
                    <div className="flex items-center gap-4">
                      <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="32" cy="32" r="26" stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth="3" fill="transparent" />
                          <circle
                            cx="32" cy="32" r="26"
                            stroke="currentColor"
                            className={getRiskColor(playgroundResult.prediction.predicted_risk_class).text}
                            strokeWidth="3.5"
                            fill="transparent"
                            strokeDasharray={163}
                            strokeDashoffset={163 - (163 * getConfidence(playgroundResult.prediction))}
                            strokeLinecap="butt"
                          />
                        </svg>
                        <span className="absolute text-sm font-bold font-mono text-slate-900 dark:text-white">
                          {Math.round(getConfidence(playgroundResult.prediction) * 100)}%
                        </span>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-slate-900 dark:text-white leading-tight">
                          {playgroundResult.prediction.predicted_risk_class === 'Uncertain' ? 'Needs Review'
                            : playgroundResult.prediction.predicted_risk_class === 'High Risk' ? 'Needs Support'
                            : playgroundResult.prediction.predicted_risk_class === 'Medium Risk' ? 'Worth Watching'
                            : 'Doing Well'}
                        </p>
                        {playgroundResult.prediction.predicted_risk_class === 'Uncertain' && (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01" />
                            </svg>
                            Needs More Data
                          </span>
                        )}
                        <p className="text-xs text-slate-500 mt-0.5 font-mono">
                          Custom sequence · {playgroundResult.prediction.predicted_risk_class}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                        {playgroundResult.prediction.suppress_attention_peak
                          ? `Model focus: Step ${playgroundResult.prediction.attention_focus_timestep}`
                          : `Attention focus: Step ${playgroundResult.prediction.attention_focus_timestep}`}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        {describeAttentionTimestep(playgroundResult.prediction.attention_focus_timestep)}
                      </p>
                    </div>
                  </div>

                  {/* Confidence + Diagnostics */}
                  <div className="lg:col-span-3 card p-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <p className="label mb-3">Model Reasoning</p>
                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                          {generateCounselorSummary(playgroundResult.prediction)}
                        </p>
                      </div>
                      <div>
                        <p className="label mb-3">Confidence Scores</p>
                        <div className="space-y-3">
                          {[
                            { label: 'Low Risk', value: playgroundResult.prediction.confidence_scores.low_risk, color: 'bg-risk-low', textColor: 'text-risk-low' },
                            { label: 'Medium Risk', value: playgroundResult.prediction.confidence_scores.medium_risk, color: 'bg-risk-mid', textColor: 'text-risk-mid' },
                            { label: 'High Risk', value: playgroundResult.prediction.confidence_scores.high_risk, color: 'bg-risk-high', textColor: 'text-risk-high' },
                          ].map(({ label, value, color, textColor }) => (
                            <div key={label}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className={`font-medium ${textColor}`}>{label}</span>
                                <span className="font-mono text-slate-500">{(value * 100).toFixed(1)}%</span>
                              </div>
                              <div className="w-full bg-surface-sunken dark:bg-surface-dark-sunken h-1.5 overflow-hidden rounded-sm">
                                <div className={`${color} h-full rounded-sm`} style={{ width: `${value * 100}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Playground empty result state */}
            {!playgroundResult && !playgroundLoading && !playgroundError && (
              <div className="card p-8 text-center border-dashed">
                <div className="w-10 h-10 bg-surface-sunken dark:bg-surface-dark-sunken rounded flex items-center justify-center mx-auto mb-3 text-slate-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-500">
                  Configure the steps above and click <strong className="text-slate-700 dark:text-slate-200">Run Prediction</strong> to see results.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Try a preset to see how different patterns affect the model's output.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* HOW IT WORKS TAB                                                  */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'howItWorks' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                How It Works
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Understanding the AI pipeline behind StruggleLens.
              </p>
            </div>

            {/* Pipeline overview */}
            <div className="card p-6 space-y-6">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Pipeline Overview</h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {[
                  { step: '01', title: 'Data Collection', desc: 'Student interactions from the ASSISTments platform — correctness, response time, and attempt count per question.', icon: '📥', color: 'text-brand' },
                  { step: '02', title: 'Feature Engineering', desc: '12 features including rolling averages, temporal decay, and relative timing are computed over a 10-step window.', icon: '⚙️', color: 'text-accent-deep' },
                  { step: '03', title: 'LSTM + Attention', desc: 'A recurrent neural network processes the sequence while attention weights reveal which steps matter most.', icon: '🧠', color: 'text-brand' },
                  { step: '04', title: 'Risk Classification', desc: 'The model outputs Low, Medium, or High risk with confidence scores and diagnostic reasons.', icon: '🎯', color: 'text-risk-high' },
                ].map(({ step, title, desc, icon, color }) => (
                  <div key={step} className="relative">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{icon}</span>
                      <span className={`text-[10px] font-mono font-bold ${color}`}>{step}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{title}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Architecture details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Model architecture */}
              <div className="card p-5 space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Model Architecture</h3>
                <div className="surface-inset p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-brand/10 flex items-center justify-center text-brand text-xs font-bold shrink-0">IN</div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">Input Layer</p>
                      <p className="text-[11px] text-slate-500">12 features × 10 timesteps</p>
                    </div>
                  </div>
                  <div className="ml-4 border-l-2 border-brand/20 pl-3 py-1">
                    <p className="text-[10px] text-slate-400 font-mono">↓ sequential processing</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-brand/10 flex items-center justify-center text-brand text-xs font-bold shrink-0">L</div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">LSTM Layer</p>
                      <p className="text-[11px] text-slate-500">Hidden size: 64, 1 layer, batch-first</p>
                    </div>
                  </div>
                  <div className="ml-4 border-l-2 border-brand/20 pl-3 py-1">
                    <p className="text-[10px] text-slate-400 font-mono">↓ attention weighting</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-accent-wash flex items-center justify-center text-accent-deep text-xs font-bold shrink-0">A</div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">Attention Mechanism</p>
                      <p className="text-[11px] text-slate-500">Linear(64→1) + Softmax over timesteps</p>
                    </div>
                  </div>
                  <div className="ml-4 border-l-2 border-brand/20 pl-3 py-1">
                    <p className="text-[10px] text-slate-400 font-mono">↓ weighted context vector</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-risk-high-soft flex items-center justify-center text-risk-high text-xs font-bold shrink-0">FC</div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">Classification Head</p>
                      <p className="text-[11px] text-slate-500">Linear(64→3) → Softmax → 3-class output</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feature set */}
              <div className="card p-5 space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">12 Input Features</h3>
                <div className="space-y-0.5">
                  {[
                    { name: 'response_time', desc: 'Time to first answer (ms)', cat: 'Raw' },
                    { name: 'attempts', desc: 'Number of tries per question', cat: 'Raw' },
                    { name: 'correctness', desc: 'Binary correct/incorrect flag', cat: 'Raw' },
                    { name: 'correct_diff', desc: 'Change in correctness between steps', cat: 'Derived' },
                    { name: 'attempt_diff', desc: 'Change in attempt count', cat: 'Derived' },
                    { name: 'rolling_correctness', desc: '3-step rolling average accuracy', cat: 'Rolling' },
                    { name: 'rolling_attempts', desc: '3-step rolling average attempts', cat: 'Rolling' },
                    { name: 'relative_time', desc: 'Response time / mean time', cat: 'Normalized' },
                    { name: 'correct_std', desc: 'Correctness std deviation', cat: 'Aggregate' },
                    { name: 'time_std', desc: 'Response time std deviation', cat: 'Aggregate' },
                    { name: 'attempt_std', desc: 'Attempts std deviation', cat: 'Aggregate' },
                    { name: 'temporal_decay', desc: 'Exponential recency weighting', cat: 'Temporal' },
                  ].map(({ name, desc, cat }, i) => (
                    <div key={name} className={`flex items-center gap-3 px-3 py-1.5 rounded text-xs ${i % 2 === 0 ? 'bg-surface-sunken/50 dark:bg-surface-dark-sunken/50' : ''}`}>
                      <code className="font-mono text-brand font-medium w-40 shrink-0 truncate">{name}</code>
                      <span className="text-slate-500 flex-1 truncate">{desc}</span>
                      <span className="text-[10px] font-medium text-slate-400 bg-surface-sunken dark:bg-surface-dark-sunken px-1.5 py-0.5 rounded shrink-0">{cat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Model performance */}
            <div className="card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Model Performance Comparison</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[500px]">
                  <thead>
                    <tr className="text-xs text-slate-500 font-medium border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 pr-4">Model</th>
                      <th className="text-right py-2 px-3">Accuracy</th>
                      <th className="text-right py-2 px-3">Macro F1</th>
                      <th className="text-right py-2 px-3">High Risk Recall</th>
                      <th className="text-right py-2 pl-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    <tr className="border-b border-gray-200/60 dark:border-gray-700/60">
                      <td className="py-2.5 pr-4 font-medium text-slate-900 dark:text-white">Random Forest</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">49.0%</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">0.49</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">—</td>
                      <td className="py-2.5 pl-3 text-right"><span className="text-xs text-slate-400 bg-surface-sunken dark:bg-surface-dark-sunken px-2 py-0.5 rounded">Baseline</span></td>
                    </tr>
                    <tr className="border-b border-gray-200/60 dark:border-gray-700/60">
                      <td className="py-2.5 pr-4 font-medium text-slate-900 dark:text-white">Plain LSTM</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">34.8%</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">0.23</td>
                      <td className="py-2.5 px-3 text-right font-mono text-risk-high">0.0%</td>
                      <td className="py-2.5 pl-3 text-right"><span className="text-xs text-risk-high bg-risk-high-soft dark:bg-risk-high-wash px-2 py-0.5 rounded">Failed</span></td>
                    </tr>
                    <tr className="border-b border-gray-200/60 dark:border-gray-700/60">
                      <td className="py-2.5 pr-4 font-medium text-slate-900 dark:text-white">Attention LSTM (Mild Wt.)</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">37.7%</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">0.27</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">1.2%</td>
                      <td className="py-2.5 pl-3 text-right"><span className="text-xs text-risk-mid bg-risk-mid-soft dark:bg-risk-mid-wash px-2 py-0.5 rounded">Balanced</span></td>
                    </tr>
                    <tr className="bg-brand-wash/50 dark:bg-brand-wash-dark/50">
                      <td className="py-2.5 pr-4 font-semibold text-brand">Attention LSTM (Strong Wt.) ✦</td>
                      <td className="py-2.5 px-3 text-right font-mono text-brand font-medium">33.6%</td>
                      <td className="py-2.5 px-3 text-right font-mono text-brand font-medium">0.24</td>
                      <td className="py-2.5 px-3 text-right font-mono text-brand font-bold">79.8%</td>
                      <td className="py-2.5 pl-3 text-right"><span className="text-xs text-white bg-brand px-2 py-0.5 rounded font-medium">Active</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="surface-inset p-3 flex items-start gap-2">
                <span className="text-brand text-sm mt-0.5">✦</span>
                <p className="text-xs text-slate-500 leading-relaxed">
                  <strong className="text-slate-700 dark:text-slate-300">Why we chose strong class weights:</strong> In an early-warning system,
                  missing a struggling student (false negative) is far worse than a false alarm.
                  The active model achieves <strong className="text-brand">79.8% High Risk recall</strong>, catching 4 out of 5 at-risk students.
                </p>
              </div>
            </div>

            {/* Attention explainer */}
            <div className="card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Understanding Attention Weights</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                    The attention mechanism learns to assign importance weights to each of the 10 timesteps
                    in a student's interaction sequence. Higher attention on a specific step indicates
                    the model found that interaction particularly informative for predicting risk.
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                    For teachers, this translates to: <strong className="text-brand">"This is where the student started struggling most."</strong>
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    The attention weights are visualized as the bar chart in the single student view,
                    with the tallest bar representing the peak struggle point.
                  </p>
                </div>
                <div className="surface-inset p-4">
                  <p className="label mb-3">Simulated Attention Distribution</p>
                  <div className="flex items-end h-24 gap-1.5">
                    {[15, 20, 25, 30, 55, 80, 100, 70, 40, 25].map((w, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                        <div
                          className={`w-full rounded-sm ${i === 6 ? 'bg-brand' : 'bg-slate-300 dark:bg-slate-600'}`}
                          style={{ height: `${w}%` }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1.5 mt-1">
                    {[1,2,3,4,5,6,7,8,9,10].map(n => (
                      <div key={n} className="flex-1 text-center">
                        <span className={`text-[10px] font-mono ${n === 7 ? 'text-brand font-bold' : 'text-slate-400'}`}>{n}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2 text-center">
                    ← Earlier lessons · Recent lessons →
                  </p>
                </div>
              </div>
            </div>

            {/* Dataset info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="card p-5 text-center">
                <p className="label mb-2">Dataset</p>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">ASSISTments</h3>
                <p className="text-xs text-slate-500 mt-1">2012–2013 academic year</p>
              </div>
              <div className="card p-5 text-center">
                <p className="label mb-2">Sequences</p>
                <h3 className="text-xl font-bold font-mono text-slate-900 dark:text-white">200K</h3>
                <p className="text-xs text-slate-500 mt-1">10-step interaction windows</p>
              </div>
              <div className="card p-5 text-center">
                <p className="label mb-2">Tech Stack</p>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">PyTorch</h3>
                <p className="text-xs text-slate-500 mt-1">FastAPI · React · Vite</p>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ── Footer ── */}
      <footer className="mt-10 py-4 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-[1120px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            StruggleLens v3.0 © 2026
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Student risk analysis tool
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
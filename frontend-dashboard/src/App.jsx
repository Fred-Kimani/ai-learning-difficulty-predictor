import React, { useState, useEffect } from 'react';

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [studentId, setStudentId] = useState('');
  const [apiStatus, setApiStatus] = useState('checking');

  //API status 
  useEffect(() => {
    checkApiHealth();
  }, []);

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
    try {
      const response = await fetch('http://127.0.0.1:8000/demo/random');
      if (!response.ok) {
        throw new Error(`Failed to load a random student sequence (Status: ${response.status})`);
      }
      const result = await response.json();
      setData(result);
      setStudentId(result.user_id.toString());
      setApiStatus('online');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSpecificStudent = async (e) => {
    if (e) e.preventDefault();
    if (!studentId.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://127.0.0.1:8000/student/${studentId}`);
      if (response.status === 404) {
        throw new Error(`Student #${studentId} does not have enough history (10 interactions required).`);
      }
      if (!response.ok) {
        throw new Error(`Failed to load student data (Status: ${response.status})`);
      }
      const result = await response.json();
      setData(result);
      setApiStatus('online');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  const getRiskGradient = (riskClass) => {
    switch (riskClass) {
      case 'High Risk': return 'bg-rose-50 border-rose-200 text-rose-800 shadow-sm';
      case 'Medium Risk': return 'bg-amber-50 border-amber-200 text-amber-800 shadow-sm';
      case 'Low Risk': return 'bg-emerald-50 border-emerald-200 text-emerald-800 shadow-sm';
      default: return 'bg-slate-50 border-slate-200 text-slate-700 shadow-sm';
    }
  };

  const getRiskBadgeColor = (riskClass) => {
    switch (riskClass) {
      case 'High Risk': return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'Medium Risk': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Low Risk': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="min-h-screen p-4 sm:p-8 font-sans bg-[#f8fafc] text-slate-600 selection:bg-blue-100 selection:text-blue-900 relative overflow-hidden">

      <div className="max-w-5xl mx-auto relative z-10">

        {/* Header Section */}
        <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-6 gap-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                AI Student Risk <span className="text-blue-600">Dashboard</span>
              </h1>
              <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${apiStatus === 'online' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  apiStatus === 'offline' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                    'bg-slate-50 text-slate-500 border-slate-200'
                }`}>
                <span className={`w-2 h-2 rounded-full ${apiStatus === 'online' ? 'bg-emerald-500 animate-pulse' :
                    apiStatus === 'offline' ? 'bg-rose-500' :
                      'bg-slate-400'
                  }`} />
                {apiStatus === 'online' ? 'API connected' : apiStatus === 'offline' ? 'API disconnected' : 'checking API'}
              </span>
            </div>
            <p className="text-slate-500 mt-1.5 text-sm sm:text-base font-medium">
              Real-time Student Sequence Risk Analysis using Attention-LSTM Neural Nets
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search/Query Student ID Form */}
            <form onSubmit={fetchSpecificStudent} className="flex items-center bg-white border border-slate-200 rounded-lg p-1 shadow-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
              <input
                type="number"
                placeholder="Student ID (e.g. 1700)"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="bg-transparent text-slate-900 placeholder-slate-400 font-mono text-sm px-3 py-1.5 focus:outline-none w-44"
              />
              <button
                type="submit"
                disabled={loading || !studentId.trim()}
                className="bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-semibold py-1.5 px-3 rounded transition-colors disabled:opacity-50 border border-slate-200/50"
              >
                Analyze
              </button>
            </form>

            <button
              onClick={fetchRandomStudent}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-5 rounded-lg shadow-sm hover:shadow active:scale-[0.98] transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Running Inference...
                </>
              ) : (
                'Fetch Random Student'
              )}
            </button>
          </div>
        </header>

        {/* Error State */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 border-l-4 border-l-rose-500 p-5 mb-8 rounded-xl shadow-sm animate-fade-in flex items-start gap-4">
            <div className="p-1.5 bg-rose-100 rounded-lg text-rose-700 mt-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-rose-800 font-bold text-base">Inference Engine Connection Failure</h3>
              <p className="text-slate-600 text-sm mt-1">{error}</p>
              <div className="flex gap-4 mt-3">
                <button
                  onClick={checkApiHealth}
                  className="text-xs bg-rose-100 hover:bg-rose-200 text-rose-700 font-semibold px-3 py-1 rounded border border-rose-200 transition-colors"
                >
                  Retry Connection
                </button>
                <span className="text-xs text-slate-500 self-center">
                  Verify FastAPI is running locally: <code>python3 -m uvicorn main:app</code>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Prompt state when no data loaded */}
        {!data && !loading && (
          <div className="text-center py-16 px-6 bg-white border border-slate-200 rounded-2xl shadow-sm animate-fade-in">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-500 border border-blue-100">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">No Student Loaded</h2>
            <p className="text-slate-500 max-w-md mx-auto text-sm leading-relaxed mb-6">
              Click the button above to load a random student sequence, or search for a specific student ID to analyze concept retention.
            </p>
            <div className="flex justify-center gap-3 flex-wrap">
              <button onClick={() => { setStudentId('1700'); fetchSpecificStudent(); }} className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-600 px-4 py-2 rounded-lg font-mono border border-slate-200 transition-all shadow-sm">
                Try Student #1700
              </button>
              <button onClick={() => { setStudentId('1'); fetchSpecificStudent(); }} className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-600 px-4 py-2 rounded-lg font-mono border border-slate-200 transition-all shadow-sm">
                Try Student #1
              </button>
            </div>
          </div>
        )}

        {/* Dashboard Content */}
        {data && !loading && (
          <div className="space-y-6 animate-fade-in">

            {/* Top Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* Status Indicator Card */}
              <div className={`border p-6 rounded-2xl flex flex-col justify-between h-56 transition-all ${getRiskGradient(data.prediction.predicted_risk_class)}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xs uppercase tracking-wider opacity-80 font-semibold mb-1">Student Identifier</h2>
                    <p className="text-3xl font-mono font-bold">#{data.user_id}</p>
                  </div>
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-md border ${getRiskBadgeColor(data.prediction.predicted_risk_class)}`}>
                    LSTM Model v3
                  </span>
                </div>

                <div className="mt-4">
                  <h2 className="text-xs uppercase tracking-wider opacity-85 font-semibold mb-1.5">Assessment</h2>
                  <div className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    {data.prediction.predicted_risk_class}
                  </div>
                </div>
              </div>

              {/* Diagnostics Card */}
              <div className="bg-white border border-slate-200/80 p-6 rounded-2xl flex flex-col justify-between h-56 shadow-sm">
                <div>
                  <h3 className="text-sm uppercase tracking-wider text-slate-500 font-semibold mb-3 pb-2 border-b border-slate-100">
                    Diagnostic Analysis
                  </h3>
                  <ul className="space-y-2">
                    {data.prediction.diagnostic_reasons.map((reason, index) => (
                      <li key={index} className="text-slate-600 text-sm flex items-start gap-2">
                        <span className="text-blue-500 font-bold mt-0.5">•</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-blue-50/50 border border-blue-100 text-blue-700 text-xs px-3.5 py-2 rounded-xl flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />
                  <span>
                    Model focus at interaction <strong>#{data.prediction.attention_focus_timestep}</strong>
                  </span>
                </div>
              </div>

              {/* Confidence bars Card */}
              <div className="bg-white border border-slate-200/80 p-6 rounded-2xl flex flex-col justify-between h-56 shadow-sm">
                <h3 className="text-sm uppercase tracking-wider text-slate-500 font-semibold mb-3 pb-2 border-b border-slate-100">
                  Confidence Distribution
                </h3>
                <div className="space-y-3.5">
                  {/* Low Risk */}
                  <div>
                    <div className="flex justify-between text-xs mb-1 font-medium">
                      <span className="text-emerald-700">Low Risk Probability</span>
                      <span className="font-mono text-slate-600">{(data.prediction.confidence_scores.low_risk * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${data.prediction.confidence_scores.low_risk * 100}%` }} />
                    </div>
                  </div>

                  {/* Medium Risk */}
                  <div>
                    <div className="flex justify-between text-xs mb-1 font-medium">
                      <span className="text-amber-800">Medium Risk Probability</span>
                      <span className="font-mono text-slate-600">{(data.prediction.confidence_scores.medium_risk * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-amber-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${data.prediction.confidence_scores.medium_risk * 100}%` }} />
                    </div>
                  </div>

                  {/* High Risk */}
                  <div>
                    <div className="flex justify-between text-xs mb-1 font-medium">
                      <span className="text-rose-700">High Risk Probability</span>
                      <span className="font-mono text-slate-600">{(data.prediction.confidence_scores.high_risk * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-rose-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${data.prediction.confidence_scores.high_risk * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Interaction Timeline Section */}
            {data.history && (
              <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm">
                <div className="flex justify-between items-center mb-6 pb-2 border-b border-slate-100">
                  <h3 className="text-sm uppercase tracking-wider text-slate-500 font-semibold">
                    10-Step Student Interaction History
                  </h3>
                  <div className="flex gap-4 text-xs">
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                      Correct Answer
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <span className="w-2.5 h-2.5 bg-rose-500 rounded-full" />
                      Incorrect Answer
                    </span>
                  </div>
                </div>

                {/* Horizontal Timeline Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-10 gap-3 py-2">
                  {data.history.map((step, index) => {
                    const stepNum = index + 1;
                    const isAttentionFocus = stepNum === data.prediction.attention_focus_timestep;
                    return (
                      <div
                        key={index}
                        className={`p-3 bg-slate-50/50 rounded-xl border relative transition-all duration-300 ${isAttentionFocus
                            ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50/10'
                            : 'border-slate-100 hover:border-slate-200'
                          }`}
                      >
                        {/* Timestep Badge */}
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] text-slate-400 font-mono">Step #{stepNum}</span>
                          {isAttentionFocus && (
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping absolute top-2 right-2" />
                          )}
                        </div>

                        {/* Result Circle */}
                        <div className="flex justify-center mb-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${step.correct === 1
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                              : 'bg-rose-50 text-rose-600 border border-rose-200'
                            }`}>
                            {step.correct === 1 ? '✓' : '✗'}
                          </div>
                        </div>

                        {/* Node details */}
                        <div className="text-center space-y-1 font-mono">
                          <p className="text-[11px] text-slate-700 font-semibold">
                            {step.attempt_count} {step.attempt_count === 1 ? 'attempt' : 'attempts'}
                          </p>
                          <p className="text-[9px] text-slate-400">
                            {(step.ms_first_response / 1000).toFixed(1)}s response
                          </p>
                        </div>

                        {/* Attention overlay label */}
                        {isAttentionFocus && (
                          <div className="absolute left-1/2 bottom-[-10px] transform -translate-x-1/2 bg-blue-600 text-white text-[8px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                            Attention Focus
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recommendations Section */}
            <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm">
              <div className="flex items-center gap-3 mb-4 pb-2 border-b border-slate-100">
                <span className="p-1.5 bg-blue-50 text-blue-500 border border-blue-100 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </span>
                <h3 className="text-sm uppercase tracking-wider text-slate-500 font-semibold">
                  Teacher Action Guide & Targeted Interventions
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-xl">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Recommended Actions</h4>
                  <ul className="space-y-2 text-sm text-slate-600">
                    {data.prediction.predicted_risk_class === 'High Risk' ? (
                      <>
                        <li className="flex items-start gap-2">
                          <span className="text-rose-600 font-bold">▶</span>
                          <span><strong>1-on-1 tutoring block:</strong> Focus on concepts matching timesteps with high response times.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-rose-600 font-bold">▶</span>
                          <span><strong>Concept mapping check:</strong> Examine if the student has prerequisite skill gaps.</span>
                        </li>
                      </>
                    ) : data.prediction.predicted_risk_class === 'Medium Risk' ? (
                      <>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-600 font-bold">▶</span>
                          <span><strong>Targeted practice sets:</strong> Provide hints/worked examples for concepts.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-600 font-bold">▶</span>
                          <span><strong>Active monitoring:</strong> Re-evaluate sequence risk scores after 5 more submissions.</span>
                        </li>
                      </>
                    ) : (
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-600 font-bold">▶</span>
                        <span><strong>Standard progression:</strong> No special changes needed. The student maintains steady concept mastery.</span>
                      </li>
                    )}
                  </ul>
                </div>

                <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-xl">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Sequence Analysis Summary</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Student answered {data.history.filter(h => h.correct === 1).length} out of 10 questions correctly.
                    Average speed per question was {(data.history.reduce((acc, h) => acc + h.ms_first_response, 0) / 10000).toFixed(1)} seconds.
                    The model's recurrent neural network attention layer flagged interaction #{data.prediction.attention_focus_timestep} as the core indicator of struggle.
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

export default App;
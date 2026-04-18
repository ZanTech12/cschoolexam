import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { studentAPI } from '../../api';
import { useParams, useNavigate } from 'react-router-dom';
import { useLayout } from '../../context/LayoutContext';
import Loading from '../common/Loading';

// ==================== LOCAL STORAGE HELPERS ====================
const STORAGE_KEY = 'cbt_submitted_tests';
const AUTOSAVE_KEY = 'cbt_autosave_';
const getSubmittedTests = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
};
const markTestAsSubmitted = (testId) => {
  if (!testId) return;
  const list = getSubmittedTests();
  if (!list.includes(testId)) {
    list.push(testId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }
};
const autoSaveAnswers = (testId, answers, flagged, timings, scratchContent) => {
  if (!testId) return;
  try {
    const data = { answers, flagged: [...flagged], timings, scratchContent, savedAt: Date.now() };
    localStorage.setItem(AUTOSAVE_KEY + testId, JSON.stringify(data));
  } catch { /* quota exceeded */ }
};
const loadAutoSave = (testId) => {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY + testId);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
};
const clearAutoSave = (testId) => {
  try { localStorage.removeItem(AUTOSAVE_KEY + testId); } catch { /* */ }
};

// ==================== SOUND ENGINE ====================
const SoundEngine = {
  ctx: null,
  enabled: true,
  init() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.enabled = false; }
    }
  },
  play(type) {
    if (!this.enabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      const now = this.ctx.currentTime;
      switch (type) {
        case 'select':
          osc.frequency.setValueAtTime(600, now);
          osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
          osc.start(now); osc.stop(now + 0.12);
          break;
        case 'flag':
          osc.frequency.setValueAtTime(500, now);
          osc.frequency.exponentialRampToValueAtTime(900, now + 0.15);
          gain.gain.setValueAtTime(0.1, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          osc.start(now); osc.stop(now + 0.2);
          break;
        case 'unflag':
          osc.frequency.setValueAtTime(800, now);
          osc.frequency.exponentialRampToValueAtTime(400, now + 0.15);
          gain.gain.setValueAtTime(0.1, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          osc.start(now); osc.stop(now + 0.2);
          break;
        case 'warning':
          osc.type = 'square';
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.setValueAtTime(440, now + 0.15);
          osc.frequency.setValueAtTime(440, now + 0.3);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
          osc.start(now); osc.stop(now + 0.45);
          break;
        case 'submit':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(523, now);
          osc.frequency.setValueAtTime(659, now + 0.12);
          osc.frequency.setValueAtTime(784, now + 0.24);
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
          osc.start(now); osc.stop(now + 0.5);
          break;
        case 'error':
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(200, now);
          osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc.start(now); osc.stop(now + 0.35);
          break;
        default: break;
      }
    } catch { /* silent fail */ }
  }
};

// ==================== SIMPLE CALCULATOR ====================
const Calculator = ({ onClose }) => {
  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');
  const [hasResult, setHasResult] = useState(false);

  const handleNum = (n) => {
    SoundEngine.play('select');
    if (hasResult) { setDisplay(String(n)); setExpression(''); setHasResult(false); }
    else setDisplay((prev) => prev === '0' ? String(n) : prev + n);
  };
  const handleOp = (op) => {
    SoundEngine.play('select');
    setHasResult(false);
    const symbol = op === '×' ? '*' : op === '÷' ? '/' : op;
    setExpression((prev) => {
      const base = prev || display;
      return base + symbol;
    });
    setDisplay('0');
  };
  const handleEquals = () => {
    SoundEngine.play('submit');
    try {
      const full = expression + display;
      const result = Function('"use strict"; return (' + full + ')')();
      setExpression(full + ' =');
      setDisplay(String(Math.round(result * 1e10) / 1e10));
      setHasResult(true);
    } catch {
      setDisplay('Error');
      setHasResult(true);
    }
  };
  const handleClear = () => { SoundEngine.play('select'); setDisplay('0'); setExpression(''); setHasResult(false); };
  const handleBackspace = () => { SoundEngine.play('select'); setDisplay((prev) => prev.length > 1 ? prev.slice(0, -1) : '0'); };
  const handlePercent = () => { SoundEngine.play('select'); setDisplay((prev) => String(parseFloat(prev) / 100)); };
  const handleSqrt = () => { SoundEngine.play('select'); setDisplay((prev) => String(Math.round(Math.sqrt(parseFloat(prev)) * 1e10) / 1e10)); setHasResult(true); };
  const handleDot = () => { SoundEngine.play('select'); if (!display.includes('.')) setDisplay((prev) => prev + '.'); };
  const handleToggleSign = () => { SoundEngine.play('select'); setDisplay((prev) => prev.startsWith('-') ? prev.slice(1) : '-' + prev); };

  const btnStyle = (bg, color = '#fff') => ({
    padding: '0.7rem', border: 'none', borderRadius: '6px', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', backgroundColor: bg, color, transition: 'all 0.1s', fontFamily: "'Segoe UI',sans-serif"
  });

  return (
    <div style={calcStyles.container}>
      <div style={calcStyles.header}>
        <span style={calcStyles.title}>CALCULATOR</span>
        <button onClick={onClose} style={calcStyles.closeBtn}>✕</button>
      </div>
      <div style={calcStyles.displayArea}>
        <div style={calcStyles.expression}>{expression || ' '}</div>
        <div style={calcStyles.displayValue}>{display}</div>
      </div>
      <div style={calcStyles.grid}>
        <button onClick={handleClear} style={btnStyle('#e74c3c')}>C</button>
        <button onClick={handleBackspace} style={btnStyle('#e67e22')}>⌫</button>
        <button onClick={handlePercent} style={btnStyle('#e67e22')}>%</button>
        <button onClick={() => handleOp('÷')} style={btnStyle('#006633')}>÷</button>

        <button onClick={() => handleNum(7)} style={btnStyle('#ecf0f1', '#2c3e50')}>7</button>
        <button onClick={() => handleNum(8)} style={btnStyle('#ecf0f1', '#2c3e50')}>8</button>
        <button onClick={() => handleNum(9)} style={btnStyle('#ecf0f1', '#2c3e50')}>9</button>
        <button onClick={() => handleOp('×')} style={btnStyle('#006633')}>×</button>

        <button onClick={() => handleNum(4)} style={btnStyle('#ecf0f1', '#2c3e50')}>4</button>
        <button onClick={() => handleNum(5)} style={btnStyle('#ecf0f1', '#2c3e50')}>5</button>
        <button onClick={() => handleNum(6)} style={btnStyle('#ecf0f1', '#2c3e50')}>6</button>
        <button onClick={() => handleOp('-')} style={btnStyle('#006633')}>−</button>

        <button onClick={() => handleNum(1)} style={btnStyle('#ecf0f1', '#2c3e50')}>1</button>
        <button onClick={() => handleNum(2)} style={btnStyle('#ecf0f1', '#2c3e50')}>2</button>
        <button onClick={() => handleNum(3)} style={btnStyle('#ecf0f1', '#2c3e50')}>3</button>
        <button onClick={() => handleOp('+')} style={btnStyle('#006633')}>+</button>

        <button onClick={handleToggleSign} style={btnStyle('#bdc3c7', '#2c3e50')}>±</button>
        <button onClick={() => handleNum(0)} style={btnStyle('#ecf0f1', '#2c3e50')}>0</button>
        <button onClick={handleDot} style={btnStyle('#ecf0f1', '#2c3e50')}>.</button>
        <button onClick={handleEquals} style={btnStyle('#28a745')}>=</button>

        <button onClick={handleSqrt} style={{ ...btnStyle('#3498db'), gridColumn: 'span 2' }}>√ Square Root</button>
        <button onClick={handleClear} style={{ ...btnStyle('#95a5a6', '#fff'), gridColumn: 'span 2' }}>CE Clear Entry</button>
      </div>
    </div>
  );
};

const calcStyles = {
  container: { width: '280px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.25)', overflow: 'hidden', border: '1px solid #d0d5dd' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 1rem', backgroundColor: '#006633', color: '#fff' },
  title: { fontWeight: 800, fontSize: '0.75rem', letterSpacing: '2px' },
  closeBtn: { background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  displayArea: { padding: '0.8rem 1rem', backgroundColor: '#1a1a2e', textAlign: 'right', minHeight: '70px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' },
  expression: { fontSize: '0.7rem', color: '#888', marginBottom: '2px', minHeight: '14px', wordBreak: 'break-all' },
  displayValue: { fontSize: '1.8rem', fontWeight: 700, color: '#fff', fontFamily: "'Courier New',monospace", wordBreak: 'break-all' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px', padding: '6px' },
};

// ==================== INSTRUCTIONS SCREEN ====================
const InstructionsScreen = ({ test, onStart, onClose }) => {
  const rules = [
    { icon: '⏱️', text: `You have ${test.duration} minutes to complete ${test.questions.length} questions.` },
    { icon: '🚫', text: 'Do NOT refresh or close this browser window/tab during the exam.' },
    { icon: '🚫', text: 'Do NOT switch to other windows or tabs — this will be recorded.' },
    { icon: '🚫', text: 'Right-click, copy, paste, and print are disabled during the exam.' },
    { icon: '🖥️', text: 'Full-screen mode is recommended. Exiting full-screen will be tracked.' },
    { icon: '🏁', text: 'Click "FINISH TEST" when done. You CANNOT retake this test after submission.' },
    { icon: '🚩', text: 'Use the flag feature to mark questions for review later.' },
    { icon: '🧮', text: 'A built-in calculator and scratch pad are available during the test.' },
    { icon: '⌨️', text: 'Keyboard shortcuts: A/B/C/D to select, ←/→ to navigate, S to submit, F for fullscreen.' },
    { icon: '💾', text: 'Your answers are auto-saved every 10 seconds as a backup.' },
  ];

  return (
    <div style={instrStyles.overlay}>
      <div style={instrStyles.card}>
        <div style={instrStyles.cardHeader}>
          <div style={instrStyles.logoArea}>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#006633', letterSpacing: '3px' }}>▲</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#006633', letterSpacing: '3px' }}>DISL CBT</div>
              <div style={{ fontSize: '0.7rem', color: '#888', letterSpacing: '1px' }}>EXAMINATION PORTAL</div>
            </div>
          </div>
        </div>
        <div style={instrStyles.divider} />
        <div style={instrStyles.testInfoBar}>
          <div style={instrStyles.testInfoItem}><span style={instrStyles.testInfoLabel}>SUBJECT:</span><span style={instrStyles.testInfoValue}>{test.subjectId?.name || 'General'}</span></div>
          <div style={instrStyles.testInfoItem}><span style={instrStyles.testInfoLabel}>TITLE:</span><span style={instrStyles.testInfoValue}>{test.title}</span></div>
          <div style={instrStyles.testInfoItem}><span style={instrStyles.testInfoLabel}>QUESTIONS:</span><span style={instrStyles.testInfoValue}>{test.questions.length}</span></div>
          <div style={instrStyles.testInfoItem}><span style={instrStyles.testInfoLabel}>DURATION:</span><span style={instrStyles.testInfoValue}>{test.duration} minutes</span></div>
        </div>
        <div style={instrStyles.divider} />
        <div style={instrStyles.rulesSection}>
          <div style={instrStyles.rulesTitle}>📋 EXAMINATION INSTRUCTIONS</div>
          <div style={instrStyles.rulesList}>
            {rules.map((rule, i) => (
              <div key={i} style={instrStyles.ruleItem}>
                <span style={instrStyles.ruleIcon}>{rule.icon}</span>
                <span style={instrStyles.ruleText}>{rule.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={instrStyles.divider} />
        <div style={instrStyles.warningBox}>
          <span style={{ fontWeight: 800 }}>⚠️ WARNING:</span> Any form of exam malpractice (tab switching, copying, etc.) will be logged and reported. Ensure a stable internet connection before starting.
        </div>
        <div style={instrStyles.actions}>
          <button onClick={onClose} style={instrStyles.cancelBtn}>CANCEL</button>
          <button onClick={onStart} style={instrStyles.startBtn}>🚀 START EXAM</button>
        </div>
      </div>
    </div>
  );
};

const instrStyles = {
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(6px)', padding: '1rem' },
  card: { backgroundColor: '#fff', maxWidth: '600px', width: '100%', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto' },
  cardHeader: { padding: '1.5rem 2rem', textAlign: 'center' },
  logoArea: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem' },
  divider: { height: '1px', backgroundColor: '#e8e8e8', margin: '0 2rem' },
  testInfoBar: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem 1.5rem', padding: '1rem 2rem', backgroundColor: '#f8f9fa' },
  testInfoItem: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  testInfoLabel: { fontSize: '0.65rem', fontWeight: 700, color: '#888', letterSpacing: '1px' },
  testInfoValue: { fontSize: '0.85rem', fontWeight: 600, color: '#1a1a1a' },
  rulesSection: { padding: '1.2rem 2rem' },
  rulesTitle: { fontSize: '0.8rem', fontWeight: 800, color: '#006633', letterSpacing: '1.5px', marginBottom: '0.8rem' },
  rulesList: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  ruleItem: { display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.5rem 0.7rem', borderRadius: '6px', transition: 'background 0.15s' },
  ruleIcon: { fontSize: '0.95rem', flexShrink: 0, marginTop: '1px' },
  ruleText: { fontSize: '0.82rem', color: '#444', lineHeight: 1.5 },
  warningBox: { margin: '0 2rem', padding: '0.8rem 1rem', backgroundColor: '#fff3cd', color: '#856404', borderRadius: '8px', fontSize: '0.78rem', lineHeight: 1.5, border: '1px solid #ffeaa7', fontWeight: 500 },
  actions: { display: 'flex', gap: '0.8rem', justifyContent: 'center', padding: '1.5rem 2rem' },
  cancelBtn: { padding: '0.7rem 2rem', border: '1px solid #ddd', backgroundColor: '#fff', cursor: 'pointer', borderRadius: '8px', fontWeight: 700, fontSize: '0.9rem', color: '#666', transition: 'all 0.15s' },
  startBtn: { padding: '0.7rem 2.5rem', border: 'none', backgroundColor: '#006633', color: '#fff', cursor: 'pointer', borderRadius: '8px', fontWeight: 800, fontSize: '0.95rem', letterSpacing: '1px', boxShadow: '0 4px 15px rgba(0,102,51,0.3)', transition: 'all 0.15s' },
};

// ==================== REVIEW PANEL ====================
const ReviewPanel = ({ test, answers, flagged, timings, onClose, onGoToQuestion, children }) => {
  const sections = [
    { label: 'Answered', filter: (i) => answers[i] !== null, color: '#28a745', icon: '✅' },
    { label: 'Unanswered', filter: (i) => answers[i] === null, color: '#dc3545', icon: '❌' },
    { label: 'Flagged', filter: (i) => flagged.has(i), color: '#e67e22', icon: '🚩' },
  ];

  const formatSecs = (s) => {
    if (!s) return '0s';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  return (
    <div style={reviewStyles.overlay}>
      <div style={reviewStyles.panel}>
        <div style={reviewStyles.header}>
          <div>
            <div style={reviewStyles.title}>📝 ANSWER REVIEW</div>
            <div style={reviewStyles.subtitle}>Review your answers before final submission</div>
          </div>
          <button onClick={onClose} style={reviewStyles.closeBtn}>✕</button>
        </div>
        <div style={reviewStyles.body}>
          {sections.map((sec) => {
            const items = test.questions.map((_, i) => i).filter(sec.filter);
            if (items.length === 0) return null;
            return (
              <div key={sec.label} style={reviewStyles.section}>
                <div style={reviewStyles.sectionHeader}>
                  <span style={{ color: sec.color, fontWeight: 800, fontSize: '0.8rem' }}>{sec.icon} {sec.label}</span>
                  <span style={{ fontSize: '0.75rem', color: '#888', fontWeight: 700 }}>({items.length})</span>
                </div>
                <div style={reviewStyles.itemList}>
                  {items.map((qi) => (
                    <div key={qi} style={reviewStyles.item} onClick={() => { onGoToQuestion(qi); onClose(); }}>
                      <div style={reviewStyles.itemLeft}>
                        <span style={reviewStyles.itemNum}>Q{qi + 1}</span>
                        <span style={{ fontSize: '0.75rem', color: '#666', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {test.questions[qi].questionText?.substring(0, 60)}...
                        </span>
                      </div>
                      <div style={reviewStyles.itemRight}>
                        {timings[qi] !== undefined && <span style={{ fontSize: '0.65rem', color: '#aaa' }}>⏱ {formatSecs(timings[qi])}</span>}
                        {answers[qi] !== null && <span style={{ fontSize: '0.65rem', color: '#28a745', fontWeight: 700 }}>Ans: {String.fromCharCode(65 + answers[qi])}</span>}
                        {flagged.has(qi) && <span style={{ fontSize: '0.7rem' }}>🚩</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {children}
      </div>
    </div>
  );
};

const reviewStyles = {
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1500, backdropFilter: 'blur(3px)', padding: '1rem' },
  panel: { backgroundColor: '#fff', maxWidth: '560px', width: '100%', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1.2rem 1.5rem', borderBottom: '1px solid #eee' },
  title: { fontWeight: 800, fontSize: '1rem', color: '#1a1a1a', letterSpacing: '0.5px' },
  subtitle: { fontSize: '0.75rem', color: '#888', marginTop: '2px' },
  closeBtn: { background: '#f0f0f0', border: 'none', width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', flexShrink: 0 },
  body: { padding: '0.8rem 1.5rem 1.2rem', overflowY: 'auto', flex: 1 },
  section: { marginBottom: '1rem' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', paddingBottom: '0.3rem', borderBottom: '1px solid #f0f0f0' },
  itemList: { display: 'flex', flexDirection: 'column', gap: '2px' },
  item: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.7rem', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.12s', gap: '0.5rem' },
  itemLeft: { display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: 0 },
  itemNum: { fontWeight: 800, fontSize: '0.75rem', color: '#006633', backgroundColor: '#e8f5e9', padding: '0.15rem 0.5rem', borderRadius: '4px', flexShrink: 0 },
  itemRight: { display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 },
};

// ==================== MAIN COMPONENT ====================
const TakeTest = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  const { hideLayout, showLayout } = useLayout();
  const containerRef = useRef(null);
  const layoutRestored = useRef(false);
  const submissionInitiated = useRef(false);
  const timerInitialized = useRef(false);
  const timerActiveRef = useRef(false);
  const questionStartTime = useRef(null);
  const autosaveInterval = useRef(null);

  // ==================== STATE ====================
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [isSimulatedFullscreen, setIsSimulatedFullscreen] = useState(false);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [keyboardHint, setKeyboardHint] = useState(true);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showTabWarning, setShowTabWarning] = useState(false);

  const [flaggedQuestions, setFlaggedQuestions] = useState(new Set());
  const [showCalculator, setShowCalculator] = useState(false);
  const [showScratchPad, setShowScratchPad] = useState(false);
  const [scratchPadContent, setScratchPadContent] = useState('');
  const [showInstructions, setShowInstructions] = useState(true);
  const [fontSize, setFontSize] = useState('medium');
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const [questionFilter, setQuestionFilter] = useState('all');
  const [questionTimings, setQuestionTimings] = useState({});
  const [showCandidateInfo, setShowCandidateInfo] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showPassage, setShowPassage] = useState(false);
  const [examStarted, setExamStarted] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState('');

  const { data: testData, isLoading, error } = useQuery({
    queryKey: ['test', testId],
    queryFn: () => studentAPI.getTestById(testId),
    enabled: !!testId,
    refetchOnWindowFocus: false,
  });

  const test = testData?.data;

  // ==================== SUBMISSION CHECK ====================
  const isBackendSubmitted =
    test?.submitted === true || test?.isCompleted === true || test?.hasSubmitted === true ||
    (test?.submission !== null && test?.submission !== undefined) ||
    test?.status === 'completed' || test?.status === 'submitted';
  const isSessionSubmitted = submissionInitiated.current;
  const isLocalSubmitted = getSubmittedTests().includes(testId);
  const isAlreadySubmitted = isBackendSubmitted || isSessionSubmitted || isLocalSubmitted;

  // ==================== MUTATIONS ====================
  const submitMutation = useMutation({
    mutationFn: ({ testId, answers }) => studentAPI.submitTest(testId, answers),
    onSuccess: (data) => {
      SoundEngine.play('submit');
      submissionInitiated.current = true;
      markTestAsSubmitted(testId);
      clearAutoSave(testId);
      jsExitFullscreen();
      restoreFullLayout();
      navigate('/student/dashboard', {
        replace: true,
        state: { testSubmitted: true, submittedTestId: testId, result: data.data }
      });
    },
    onError: (err) => {
      SoundEngine.play('error');
      submissionInitiated.current = false;
      alert(err.response?.data?.message || 'Failed to submit test. Please try again.');
    }
  });

  // ==================== REDIRECT ====================
  useEffect(() => {
    if (isAlreadySubmitted && !isLoading) {
      submissionInitiated.current = true;
      restoreFullLayout();
      navigate('/student/dashboard', { replace: true, state: { testAlreadyTaken: true, submittedTestId: testId } });
    }
  }, [isAlreadySubmitted, isLoading, navigate, testId]);

  // ==================== AUTO-LOAD SAVED STATE ====================
  useEffect(() => {
    if (test?.questions && !examStarted && !isAlreadySubmitted) {
      const saved = loadAutoSave(testId);
      if (saved && saved.answers && saved.answers.length === test.questions.length) {
        const shouldRestore = window.confirm(
          `A previous session was found (saved ${new Date(saved.savedAt).toLocaleTimeString()}).\n\nRestore your previous answers?`
        );
        if (shouldRestore) {
          setAnswers(saved.answers);
          setFlaggedQuestions(new Set(saved.flagged || []));
          setQuestionTimings(saved.timings || {});
          setScratchPadContent(saved.scratchContent || '');
        }
      }
    }
  }, [test?.questions?.length, examStarted, isAlreadySubmitted, testId]);

  // ==================== TIMER ====================
  useEffect(() => {
    if (test?.duration && timeRemaining === 0 && !isAlreadySubmitted && examStarted && !timerInitialized.current) {
      timerInitialized.current = true;
      setTimeRemaining(test.duration * 60);
    }
  }, [test, timeRemaining, isAlreadySubmitted, examStarted]);

  useEffect(() => {
    if (timeRemaining <= 0 || isAlreadySubmitted || !timerInitialized.current) return;
    const intervalId = setInterval(() => {
      setTimeRemaining((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [timeRemaining > 0, isAlreadySubmitted]);

  useEffect(() => {
    if (timeRemaining > 0 && timerInitialized.current && !timerActiveRef.current) {
      timerActiveRef.current = true;
    }
  }, [timeRemaining]);

  useEffect(() => {
    if (timeRemaining === 60 && examStarted) SoundEngine.play('warning');
    if (timeRemaining === 30 && examStarted) SoundEngine.play('warning');
  }, [timeRemaining, examStarted]);

  useEffect(() => {
    if (timeRemaining === 0 && test && !isAlreadySubmitted && timerActiveRef.current) {
      submissionInitiated.current = true;
      markTestAsSubmitted(testId);
      clearAutoSave(testId);
      submitMutation.mutate({ testId: test._id, answers });
    }
  }, [timeRemaining, test, isAlreadySubmitted, answers, testId]); 

  useEffect(() => {
    if (timeRemaining === 0 && !submitMutation.isPending && submissionInitiated.current && timerActiveRef.current) {
      const timeout = setTimeout(() => {
        jsExitFullscreen();
        restoreFullLayout();
        navigate('/student/dashboard', { replace: true, state: { testSubmitted: true, submittedTestId: testId } });
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [timeRemaining, submitMutation.isPending, testId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ==================== QUESTION TIMING ====================
  useEffect(() => {
    if (!examStarted || isAlreadySubmitted) return;
    questionStartTime.current = Date.now();
    return () => {
      if (questionStartTime.current) {
        const elapsed = Math.floor((Date.now() - questionStartTime.current) / 1000);
        if (elapsed > 0) {
          setQuestionTimings((prev) => ({
            ...prev,
            [currentQuestion]: (prev[currentQuestion] || 0) + elapsed
          }));
        }
      }
    };
  }, [currentQuestion, examStarted, isAlreadySubmitted]);

  // ==================== AUTO-SAVE ====================
  useEffect(() => {
    if (!examStarted || isAlreadySubmitted) return;
    autosaveInterval.current = setInterval(() => {
      autoSaveAnswers(testId, answers, flaggedQuestions, questionTimings, scratchPadContent);
      setAutoSaveStatus('Saved');
      setTimeout(() => setAutoSaveStatus(''), 2000);
    }, 10000);
    return () => { if (autosaveInterval.current) clearInterval(autosaveInterval.current); };
  }, [examStarted, isAlreadySubmitted, testId, answers, flaggedQuestions, questionTimings, scratchPadContent]);

  // ==================== LAYOUT ====================
  const hideFullLayout = useCallback(() => {
    hideLayout();
    const selectors = ['nav', 'aside', '[role="navigation"]', '[role="complementary"]', '.sidebar', '.side-bar', '.navbar', '.nav-bar', '.topbar', '.top-bar', '.app-sidebar', '.main-sidebar', '.main-nav', '[class*="sidebar"]', '[class*="Sidebar"]', '[class*="navbar"]', '[class*="Navbar"]', '[class*="topbar"]', '[class*="Topbar"]', '[id*="sidebar"]', '[id*="navbar"]', '[id*="topbar"]'];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (!el.closest('[data-cbt-root]')) el.setAttribute('data-cbt-hidden', 'true');
      });
    });
    document.body.style.overflow = 'hidden';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    if (!document.getElementById('cbt-layout-styles')) {
      const style = document.createElement('style');
      style.id = 'cbt-layout-styles';
      style.textContent = `[data-cbt-hidden="true"] { display: none !important; }`;
      document.head.appendChild(style);
    }
  }, [hideLayout]);

  const restoreFullLayout = useCallback(() => {
    if (layoutRestored.current) return;
    layoutRestored.current = true;
    showLayout();
    document.querySelectorAll('[data-cbt-hidden]').forEach(el => el.removeAttribute('data-cbt-hidden'));
    const injectedStyle = document.getElementById('cbt-layout-styles');
    if (injectedStyle) injectedStyle.remove();
    document.body.style.overflow = '';
    document.body.style.margin = '';
    document.body.style.padding = '';
  }, [showLayout]);

  useEffect(() => {
    if (isAlreadySubmitted || isLoading) return;
    hideFullLayout();
    return () => {
      restoreFullLayout();
      jsExitFullscreen();
      const fsStyle = document.getElementById('cbt-fs-styles');
      if (fsStyle) fsStyle.remove();
      window.removeEventListener('wheel', preventScroll);
      window.removeEventListener('touchmove', preventScroll);
      window.removeEventListener('keydown', preventScrollKeys);
      window.removeEventListener('contextmenu', preventContextMenu);
      window.removeEventListener('copy', preventCopy);
      window.removeEventListener('paste', preventPaste);
      document.body.style.overflow = '';
      document.body.style.margin = '';
      document.body.style.padding = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.margin = '';
      document.documentElement.style.padding = '';
    };
  }, [isAlreadySubmitted, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ==================== FULLSCREEN ====================
  const lockBody = useCallback(() => { document.body.style.overflow = 'hidden'; document.body.style.margin = '0'; document.body.style.padding = '0'; document.documentElement.style.overflow = 'hidden'; document.documentElement.style.margin = '0'; document.documentElement.style.padding = '0'; }, []);
  const unlockBody = useCallback(() => { document.body.style.overflow = ''; document.body.style.margin = ''; document.body.style.padding = ''; document.documentElement.style.overflow = ''; document.documentElement.style.margin = ''; document.documentElement.style.padding = ''; }, []);
  const tryNativeFullscreen = useCallback(async () => { try { const el = document.documentElement; if (el.requestFullscreen) await el.requestFullscreen(); else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen(); else if (el.msRequestFullscreen) await el.msRequestFullscreen(); else return false; return true; } catch { return false; } }, []);
  const exitNativeFullscreen = useCallback(async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else if (document.webkitFullscreenElement) await document.webkitExitFullscreen(); else if (document.msFullscreenElement) await document.msExitFullscreen(); } catch { /* ignore */ } }, []);
  const checkNativeFullscreen = useCallback(() => !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement), []);
  const preventScroll = useCallback((e) => { if (isSimulatedFullscreen) { e.preventDefault(); e.stopPropagation(); } }, [isSimulatedFullscreen]);
  const preventScrollKeys = useCallback((e) => { if (isSimulatedFullscreen && ['Space', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(e.code)) { if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); } }, [isSimulatedFullscreen]);

  const jsEnterFullscreen = useCallback(async () => {
    lockBody();
    const nativeWorked = await tryNativeFullscreen();
    if (nativeWorked) { setIsNativeFullscreen(true); setIsSimulatedFullscreen(false); }
    else {
      setIsNativeFullscreen(false); setIsSimulatedFullscreen(true);
      if (!document.getElementById('cbt-fs-styles')) {
        const style = document.createElement('style'); style.id = 'cbt-fs-styles';
        style.textContent = `.cbt-simulated-fullscreen { position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 999999 !important; margin: 0 !important; padding: 0 !important; border: none !important; border-radius: 0 !important; box-shadow: none !important; overflow: hidden !important; } .cbt-simulated-fullscreen * { max-height: none !important; }`;
        document.head.appendChild(style);
      }
      if (containerRef.current) containerRef.current.classList.add('cbt-simulated-fullscreen');
      window.addEventListener('wheel', preventScroll, { passive: false }); window.addEventListener('touchmove', preventScroll, { passive: false }); window.addEventListener('keydown', preventScrollKeys, { passive: false });
    }
    setIsFullscreen(true);
  }, [lockBody, tryNativeFullscreen, preventScroll, preventScrollKeys]);

  const jsExitFullscreen = useCallback(async () => {
    if (isNativeFullscreen) { await exitNativeFullscreen(); setIsNativeFullscreen(false); }
    if (isSimulatedFullscreen) {
      if (containerRef.current) containerRef.current.classList.remove('cbt-simulated-fullscreen');
      const fs = document.getElementById('cbt-fs-styles'); if (fs) fs.remove();
      setIsSimulatedFullscreen(false);
      window.removeEventListener('wheel', preventScroll); window.removeEventListener('touchmove', preventScroll); window.removeEventListener('keydown', preventScrollKeys);
    }
    unlockBody(); setIsFullscreen(false);
  }, [isNativeFullscreen, isSimulatedFullscreen, exitNativeFullscreen, unlockBody, preventScroll, preventScrollKeys]);

  useEffect(() => {
    const handleFsChange = () => { const stillNative = checkNativeFullscreen(); if (!stillNative && isNativeFullscreen && !showExitWarning) { setIsNativeFullscreen(false); setIsFullscreen(false); unlockBody(); } };
    document.addEventListener('fullscreenchange', handleFsChange); document.addEventListener('webkitfullscreenchange', handleFsChange); document.addEventListener('MSFullscreenChange', handleFsChange);
    return () => { document.removeEventListener('fullscreenchange', handleFsChange); document.removeEventListener('webkitfullscreenchange', handleFsChange); document.removeEventListener('MSFullscreenChange', handleFsChange); };
  }, [isNativeFullscreen, showExitWarning, checkNativeFullscreen, unlockBody]);

  // ==================== SECURITY: RIGHT-CLICK, COPY, PASTE ====================
  const preventContextMenu = useCallback((e) => { if (examStarted && !isAlreadySubmitted) e.preventDefault(); }, [examStarted, isAlreadySubmitted]);
  const preventCopy = useCallback((e) => { if (examStarted && !isAlreadySubmitted) e.preventDefault(); }, [examStarted, isAlreadySubmitted]);
  const preventPaste = useCallback((e) => { if (examStarted && !isAlreadySubmitted) e.preventDefault(); }, [examStarted, isAlreadySubmitted]);

  useEffect(() => {
    if (!examStarted || isAlreadySubmitted) return;
    window.addEventListener('contextmenu', preventContextMenu);
    window.addEventListener('copy', preventCopy);
    window.addEventListener('paste', preventPaste);
    return () => {
      window.removeEventListener('contextmenu', preventContextMenu);
      window.removeEventListener('copy', preventCopy);
      window.removeEventListener('paste', preventPaste);
    };
  }, [examStarted, isAlreadySubmitted, preventContextMenu, preventCopy, preventPaste]);

  // ==================== TAB SWITCH ====================
  useEffect(() => {
    if (!test || isAlreadySubmitted || !examStarted) return;
    const handleVisibility = () => {
      if (document.hidden && isFullscreen) {
        setTabSwitchCount((p) => p + 1);
        setShowTabWarning(true);
        SoundEngine.play('warning');
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [test, isFullscreen, isAlreadySubmitted, examStarted]);

  useEffect(() => { if (showTabWarning) { const t = setTimeout(() => setShowTabWarning(false), 4000); return () => clearTimeout(t); } }, [showTabWarning]);

  const toggleFullscreen = useCallback(() => { if (isFullscreen) setShowExitWarning(true); else jsEnterFullscreen(); }, [isFullscreen, jsEnterFullscreen]);

  // ==================== KEYBOARD SHORTCUTS ====================
  useEffect(() => {
    if (!test || isAlreadySubmitted || !examStarted) return;
    const handleKeyDown = (e) => {
      if (showConfirmation || showExitWarning || showTabWarning || showCalculator || showScratchPad || showReviewPanel || showInstructions) return;
      if (e.target.tagName === 'TEXTAREA') return;
      switch (e.key.toLowerCase()) {
        case 'a': handleSelectOption(0); break;
        case 'b': handleSelectOption(1); break;
        case 'c': handleSelectOption(2); break;
        case 'd': handleSelectOption(3); break;
        case 'e': handleSelectOption(4); break;
        case 'arrowright': case 'n': e.preventDefault(); handleNext(); break;
        case 'arrowleft': case 'p': e.preventDefault(); handlePrev(); break;
        case 's': e.preventDefault(); handleSubmit(); break;
        case 'f': e.preventDefault(); toggleFullscreen(); break;
        case 'r': e.preventDefault(); setShowReviewPanel(true); break;
        case 'g': e.preventDefault(); handleToggleFlag(); break;
        case 'm': e.preventDefault(); setShowCalculator((p) => !p); break;
        default: break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (keyboardHint) { const t = setTimeout(() => setKeyboardHint(false), 8000); return () => clearTimeout(t); } }, [keyboardHint]);
  useEffect(() => { if (test?.questions && answers.length === 0 && !isAlreadySubmitted) setAnswers(new Array(test.questions.length).fill(null)); }, [test, isAlreadySubmitted]); // eslint-disable-line react-hooks/exhaustive-deps

  // ==================== HANDLERS ====================
  const handleStartExam = useCallback(() => {
    SoundEngine.init();
    SoundEngine.enabled = soundEnabled;
    setShowInstructions(false);
    setExamStarted(true);
    questionStartTime.current = Date.now();
    setTimeout(() => jsEnterFullscreen(), 100);
  }, [soundEnabled, jsEnterFullscreen]);

  const handleSelectOption = (oi) => {
    if (submissionInitiated.current || !examStarted) return;
    if (oi >= (test?.questions[currentQuestion]?.options?.length || 0)) return;
    SoundEngine.play('select');
    const n = [...answers]; n[currentQuestion] = oi; setAnswers(n);
  };

  const handleNext = () => {
    if (submissionInitiated.current || !examStarted) return;
    if (test && currentQuestion < test.questions.length - 1) setCurrentQuestion(currentQuestion + 1);
  };
  const handlePrev = () => {
    if (submissionInitiated.current || !examStarted) return;
    if (currentQuestion > 0) setCurrentQuestion(currentQuestion - 1);
  };

  const handleToggleFlag = () => {
    if (submissionInitiated.current || !examStarted) return;
    setFlaggedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(currentQuestion)) { next.delete(currentQuestion); SoundEngine.play('unflag'); }
      else { next.add(currentQuestion); SoundEngine.play('flag'); }
      return next;
    });
  };

  const handleSubmit = () => {
    if (!test || submissionInitiated.current || !examStarted) return;
    setShowReviewPanel(true);
  };

  const confirmSubmit = () => {
    if (submissionInitiated.current) return;
    setShowConfirmation(false);
    setShowReviewPanel(false);
    submissionInitiated.current = true;
    submitMutation.mutate({ testId: test._id, answers });
  };

  const finalSubmitFromReview = () => {
    if (!test || submissionInitiated.current) return;
    const un = answers.filter(a => a === null).length;
    if (un > 0) { setShowReviewPanel(false); setShowConfirmation(true); }
    else { submissionInitiated.current = true; submitMutation.mutate({ testId: test._id, answers }); }
  };

  // ==================== HELPERS ====================
  const formatTime = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60; return h > 0 ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`; };
  const getTimeColor = () => { if (timeRemaining <= 60) return '#ff1a1a'; if (timeRemaining <= 300) return '#ff6b35'; return '#ffffff'; };
  const getFontSizeMultiplier = () => { switch (fontSize) { case 'small': return 0.88; case 'medium': return 1; case 'large': return 1.12; case 'xlarge': return 1.25; default: return 1; } };
  const getFilteredQuestions = () => {
    return test.questions.map((_, i) => i).filter((i) => {
      switch (questionFilter) {
        case 'unanswered': return answers[i] === null;
        case 'answered': return answers[i] !== null;
        case 'flagged': return flaggedQuestions.has(i);
        default: return true;
      }
    });
  };

  // ==================== LOADING & ERROR ====================
  if (isLoading) return <Loading message="Initializing Test Environment..." />;
  if (isAlreadySubmitted) return null;

  if (error) {
    restoreFullLayout();
    return (<div style={styles.centerContainer}><div style={styles.errorBox}><div style={styles.errorIcon}>⚠</div><div style={styles.errorText}>{error.response?.data?.message || 'Failed to load test'}</div></div><button onClick={() => navigate('/student/dashboard')} style={styles.backBtn}>← Back to Dashboard</button></div>);
  }

  if (test && (!test.questions || test.questions.length === 0)) {
    restoreFullLayout();
    return (<div style={styles.centerContainer}><div style={styles.emptyBox}><div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div><div style={{ color: '#856404', fontWeight: 600, marginBottom: '0.5rem' }}>No Questions Available</div><div style={{ color: '#856404', fontSize: '0.9rem' }}>This test has no questions yet.</div></div><button onClick={() => navigate('/student/dashboard')} style={styles.backBtn}>← Back to Dashboard</button></div>);
  }

  // ==================== MAIN UI ====================
  if (test && test.questions && test.questions.length > 0) {
    const currentQ = test.questions[currentQuestion];
    const isCriticalTime = timeRemaining <= 60 && timeRemaining > 0;
    const isWarningTime = timeRemaining <= 300 && timeRemaining > 60;
    const answeredCount = answers.filter(a => a !== null).length;
    const progressPercent = (answeredCount / test.questions.length) * 100;
    const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const fs = getFontSizeMultiplier();
    const filteredQs = getFilteredQuestions();
    const hasPassage = !!(currentQ.passage || currentQ.readingText || currentQ.comprehension);
    const passageText = currentQ.passage || currentQ.readingText || currentQ.comprehension || '';

    return (
      <div ref={containerRef} data-cbt-root="true" style={{ ...styles.cbtContainer, height: '100vh' }}>

        {/* ═══ INSTRUCTIONS SCREEN ═══ */}
        {showInstructions && !examStarted && (
          <InstructionsScreen test={test} onStart={handleStartExam} onClose={() => navigate('/student/dashboard')} />
        )}

        {/* ═══ TOP BAR ═══ */}
        <div style={styles.topBar}>
          <div style={styles.topBarLeft}>
            <div style={styles.jambLogo}>
              <div style={styles.jambLogoIcon}>▲</div>
              <div style={styles.jambLogoText}>
                <div style={{ fontWeight: 800, fontSize: '0.85rem', letterSpacing: '2px' }}>JAMB</div>
                <div style={{ fontSize: '0.55rem', opacity: 0.8, letterSpacing: '1px' }}>CBT SOFTWARE</div>
              </div>
            </div>
            <div style={styles.topBarDivider} />
            <div style={styles.testInfoTop}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.5px' }}>{test.title}</div>
              <div style={{ fontSize: '0.72rem', opacity: 0.75 }}>{test.subjectId?.name} • {test.questions.length} Questions</div>
            </div>
          </div>
          <div style={styles.topBarRight}>
            {autoSaveStatus && <div style={{ fontSize: '0.6rem', color: '#28a745', fontWeight: 700, letterSpacing: '0.5px', animation: 'cbtFadeOut 2s forwards' }}>💾 {autoSaveStatus}</div>}

            {tabSwitchCount > 0 && <div style={styles.tabSwitchIndicator} title={`${tabSwitchCount} tab switch(es)`}>⚠ {tabSwitchCount}</div>}

            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '6px', padding: '2px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <button onClick={() => setFontSize('small')} title="Small font" style={{ ...styles.fontSizeBtn, fontWeight: fontSize === 'small' ? 900 : 400, backgroundColor: fontSize === 'small' ? 'rgba(255,255,255,0.2)' : 'transparent' }}>A</button>
              <button onClick={() => setFontSize('medium')} title="Medium font" style={{ ...styles.fontSizeBtn, fontWeight: fontSize === 'medium' ? 900 : 400, backgroundColor: fontSize === 'medium' ? 'rgba(255,255,255,0.2)' : 'transparent', fontSize: '0.85rem' }}>A</button>
              <button onClick={() => setFontSize('large')} title="Large font" style={{ ...styles.fontSizeBtn, fontWeight: fontSize === 'large' ? 900 : 400, backgroundColor: fontSize === 'large' ? 'rgba(255,255,255,0.2)' : 'transparent', fontSize: '1rem' }}>A</button>
              <button onClick={() => setFontSize('xlarge')} title="Extra large font" style={{ ...styles.fontSizeBtn, fontWeight: fontSize === 'xlarge' ? 900 : 400, backgroundColor: fontSize === 'xlarge' ? 'rgba(255,255,255,0.2)' : 'transparent', fontSize: '1.15rem' }}>A</button>
            </div>

            <div style={styles.answeredBox}>
              <div style={{ fontSize: '0.6rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '1px' }}>Answered</div>
              <div style={{ fontWeight: 800, fontFamily: "'Courier New', monospace", fontSize: '1.1rem', lineHeight: 1.2 }}>{answeredCount}<span style={{ opacity: 0.5, fontWeight: 400 }}>/ {test.questions.length}</span></div>
            </div>
            <div style={styles.topBarDivider} />

            <div style={{ ...styles.timerBox, backgroundColor: isCriticalTime ? 'rgba(255,26,26,0.25)' : isWarningTime ? 'rgba(255,107,53,0.2)' : 'rgba(255,255,255,0.1)', borderColor: getTimeColor(), animation: isCriticalTime ? 'cbtPulse 0.8s ease-in-out infinite' : 'none' }}>
              <div style={{ fontSize: '0.55rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '1.5px', color: getTimeColor() }}>{isCriticalTime ? '⏰ TIME UP SOON' : 'REMAINING'}</div>
              <div style={{ fontFamily: "'Courier New', monospace", fontWeight: 900, fontSize: '1.5rem', color: getTimeColor(), letterSpacing: '3px', lineHeight: 1.1 }}>{formatTime(timeRemaining)}</div>
            </div>
            <div style={styles.topBarDivider} />

            <button onClick={() => setShowCalculator((p) => !p)} title="Calculator (M)" style={{ ...styles.toolBtn, backgroundColor: showCalculator ? 'rgba(52,152,219,0.4)' : 'rgba(255,255,255,0.08)', borderColor: showCalculator ? 'rgba(52,152,219,0.6)' : 'rgba(255,255,255,0.15)' }}>🧮</button>
            <button onClick={() => setShowScratchPad((p) => !p)} title="Scratch Pad" style={{ ...styles.toolBtn, backgroundColor: showScratchPad ? 'rgba(155,89,182,0.4)' : 'rgba(255,255,255,0.08)', borderColor: showScratchPad ? 'rgba(155,89,182,0.6)' : 'rgba(255,255,255,0.15)' }}>📝</button>
            {hasPassage && <button onClick={() => setShowPassage((p) => !p)} title="Toggle Passage" style={{ ...styles.toolBtn, backgroundColor: showPassage ? 'rgba(230,126,34,0.4)' : 'rgba(255,255,255,0.08)', borderColor: showPassage ? 'rgba(230,126,34,0.6)' : 'rgba(255,255,255,0.15)' }}>📖</button>}
            <button onClick={() => setSoundEnabled((p) => { SoundEngine.enabled = !p; return !p; })} title={soundEnabled ? 'Mute sounds' : 'Enable sounds'} style={{ ...styles.toolBtn, backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)', fontSize: '0.85rem' }}>{soundEnabled ? '🔊' : '🔇'}</button>

            <div style={styles.topBarDivider} />
            <button onClick={toggleFullscreen} title={isFullscreen ? 'Minimize (F)' : 'Full Screen (F)'} style={{ ...styles.fsToggleBtn, backgroundColor: isFullscreen ? 'rgba(255,255,255,0.1)' : 'rgba(40,167,69,0.3)', borderColor: isFullscreen ? 'rgba(255,255,255,0.3)' : 'rgba(40,167,69,0.6)' }}>
              {isFullscreen ? (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 4 20 10 20" /><polyline points="20 10 20 4 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></svg>) : (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>)}
              <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.5px', marginLeft: '6px' }}>{isFullscreen ? 'MINIMIZE' : 'FULL SCREEN'}</span>
            </button>
          </div>
        </div>

        {/* ═══ PROGRESS BAR ═══ */}
        <div style={{ ...styles.progressTrack, position: 'relative' }}>
          <div style={{ ...styles.progressFill, width: `${progressPercent}%`, backgroundColor: progressPercent === 100 ? '#28a745' : '#006633' }} />
          {flaggedQuestions.size > 0 && (
            <div style={{ position: 'absolute', top: '-1px', right: '8px', fontSize: '0.55rem', color: '#e67e22', fontWeight: 800, letterSpacing: '0.5px', backgroundColor: '#fff8f0', padding: '0 4px', borderRadius: '0 0 4px 4px' }}>
              🚩 {flaggedQuestions.size} flagged
            </div>
          )}
        </div>

        {/* ═══ MAIN CONTENT ═══ */}
        <div style={{ ...styles.mainContentCentered, paddingRight: showScratchPad ? '310px' : '1.2rem' }}>
          <div style={{ ...styles.questionWrapper, maxWidth: showPassage && hasPassage ? '55%' : '1400px', flex: 1, overflow: 'hidden' }}>

            {/* ── QUESTION CARD ── */}
            <div style={{ ...styles.questionCard, flex: 1, overflow: 'hidden' }}>
              <div style={styles.questionHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={styles.questionNumber}><span style={styles.questionNumberText}>QUESTION {currentQuestion + 1}</span></div>
                  <button onClick={handleToggleFlag} title={flaggedQuestions.has(currentQuestion) ? 'Remove flag (G)' : 'Flag for review (G)'} style={{
                    padding: '0.3rem 0.6rem', border: `2px solid ${flaggedQuestions.has(currentQuestion) ? '#e67e22' : '#ddd'}`, borderRadius: '6px', cursor: 'pointer', backgroundColor: flaggedQuestions.has(currentQuestion) ? '#fff3e0' : '#fff', fontSize: '0.75rem', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '0.3rem'
                  }}>
                    🚩 <span style={{ fontSize: '0.6rem', fontWeight: 700, color: flaggedQuestions.has(currentQuestion) ? '#e67e22' : '#999' }}>{flaggedQuestions.has(currentQuestion) ? 'FLAGGED' : 'FLAG'}</span>
                  </button>
                </div>
                <div style={styles.questionMeta}>
                  <span style={{ ...styles.difficultyBadge, backgroundColor: currentQ.difficulty === 'easy' ? '#d4edda' : currentQ.difficulty === 'medium' ? '#fff3cd' : '#f8d7da', color: currentQ.difficulty === 'easy' ? '#155724' : currentQ.difficulty === 'medium' ? '#856404' : '#721c24' }}>{currentQ.difficulty?.toUpperCase() || 'NORMAL'}</span>
                  <span style={styles.questionOf}>of {test.questions.length}</span>
                </div>
              </div>
              <div style={{ ...styles.questionText, fontSize: `${1.4 * fs}rem`, lineHeight: `${1.9 * fs}`, overflowY: 'auto' }}>
                {currentQ.questionText}
                {currentQ.image && (
                  <div style={{ marginTop: '0.8rem', textAlign: 'center' }}>
                    <img src={currentQ.image} alt="Question diagram" style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '8px', border: '1px solid #e0e0e0' }} />
                  </div>
                )}
              </div>
            </div>

            {/* ── OPTIONS CARD ── */}
            <div style={styles.optionsCard}>
              <div style={styles.optionsCardLabel}><span style={styles.optionsCardLabelText}>CHOOSE YOUR ANSWER</span></div>
              <div style={styles.optionsContainer}>
                {currentQ.options.map((option, index) => {
                  const isSelected = answers[currentQuestion] === index;
                  return (
                    <div key={index} onClick={() => handleSelectOption(index)} style={{ ...styles.optionCard, borderColor: isSelected ? '#006633' : '#e0e0e0', backgroundColor: isSelected ? '#e8f5e9' : '#ffffff', borderLeftColor: isSelected ? '#006633' : '#e0e0e0', borderLeftWidth: isSelected ? '5px' : '2px' }} onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f5f5f5'; e.currentTarget.style.borderColor = '#006633'; }} onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.borderColor = isSelected ? '#006633' : '#e0e0e0'; }}>
                      <div style={{ ...styles.optionLetter, backgroundColor: isSelected ? '#006633' : '#f0f2f5', color: isSelected ? '#ffffff' : '#555', borderColor: isSelected ? '#006633' : '#ddd' }}>{optionLetters[index]}</div>
                      <div style={{ ...styles.optionText, color: isSelected ? '#004d25' : '#1a1a1a', fontWeight: isSelected ? 600 : 400, fontSize: `${1.05 * fs}rem`, lineHeight: `${1.55 * fs}` }}>{option}</div>
                      {isSelected && <div style={styles.checkMark}>✓</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Navigation Buttons ── */}
            <div style={styles.navRow}>
              <button onClick={handlePrev} disabled={currentQuestion === 0} style={{ ...styles.navBtn, ...styles.prevBtn, opacity: currentQuestion === 0 ? 0.35 : 1, cursor: currentQuestion === 0 ? 'not-allowed' : 'pointer' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg> PREV
              </button>
              <div style={styles.navCenterInfo}>
                <span style={{ fontFamily: "'Courier New', monospace", fontWeight: 700, fontSize: '0.85rem', color: '#006633' }}>{currentQuestion + 1} / {test.questions.length}</span>
                {questionTimings[currentQuestion] !== undefined && (
                  <span style={{ fontSize: '0.65rem', color: '#aaa', marginLeft: '0.4rem' }}>⏱ {questionTimings[currentQuestion]}s</span>
                )}
              </div>
              {currentQuestion < test.questions.length - 1 ? (
                <button onClick={handleNext} style={{ ...styles.navBtn, ...styles.nextBtn }}>NEXT <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg></button>
              ) : (
                <button onClick={handleSubmit} disabled={submitMutation.isPending} style={{ ...styles.navBtn, ...styles.nextBtn, backgroundColor: '#28a745' }}>{submitMutation.isPending ? 'LOADING...' : 'SUBMIT'} <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></button>
              )}
            </div>

            {/* ── Question Navigator (Always Open) ── */}
            <div style={styles.navigatorSection}>
              <div style={styles.navigatorHeader}>
                <span style={styles.navigatorTitle}>Questions</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <select value={questionFilter} onChange={(e) => setQuestionFilter(e.target.value)} style={{
                    fontSize: '0.55rem', fontWeight: 600, padding: '0.1rem 0.25rem', borderRadius: '3px', border: '1px solid #ddd', color: '#555', backgroundColor: '#fff', cursor: 'pointer', outline: 'none'
                  }}>
                    <option value="all">All ({test.questions.length})</option>
                    <option value="answered">Answered ({answeredCount})</option>
                    <option value="unanswered">Unanswered ({test.questions.length - answeredCount})</option>
                    <option value="flagged">Flagged ({flaggedQuestions.size})</option>
                  </select>
                  <div style={styles.navigatorLegend}>
                    <div style={styles.legendItem}><div style={{ ...styles.legendDot, backgroundColor: '#006633' }} /></div>
                    <div style={styles.legendItem}><div style={{ ...styles.legendDot, backgroundColor: '#28a745' }} /></div>
                    <div style={styles.legendItem}><div style={{ ...styles.legendDot, backgroundColor: '#e67e22' }} /></div>
                    <div style={styles.legendItem}><div style={{ ...styles.legendDot, backgroundColor: '#fff', border: '1px solid #ccc' }} /></div>
                  </div>
                  <span style={{ fontSize: '0.5rem', color: '#888', fontWeight: 600 }}>
                    <span style={{ color: '#28a745' }}>{answeredCount}</span>✓ 
                    <span style={{ color: '#dc3545', marginLeft: '0.2rem' }}>{test.questions.length - answeredCount}</span>○ 
                    <span style={{ color: '#e67e22', marginLeft: '0.2rem' }}>{flaggedQuestions.size}</span>🚩
                  </span>
                </div>
              </div>
              
              <div style={styles.questionGridCompact}>
                {filteredQs.map((qi) => {
                  const isA = answers[qi] !== null;
                  const isC = qi === currentQuestion;
                  const isF = flaggedQuestions.has(qi);
                  let bg = '#fff', tc = '#888', bd = '1px solid #ddd';
                  if (isC) { bg = '#006633'; tc = '#fff'; bd = '2px solid #004d25'; }
                  else if (isF && isA) { bg = '#e67e22'; tc = '#fff'; bd = '1px solid #d35400'; }
                  else if (isF) { bg = '#fff3e0'; tc = '#e67e22'; bd = '2px solid #e67e22'; }
                  else if (isA) { bg = '#28a745'; tc = '#fff'; bd = '1px solid #1e7e34'; }
                  return (
                    <button key={qi} onClick={() => setCurrentQuestion(qi)} style={{ ...styles.gridBtnCompact, backgroundColor: bg, color: tc, border: bd, boxShadow: isC ? '0 0 0 2px rgba(0,102,51,0.3)' : 'none', transform: isC ? 'scale(1.15)' : 'scale(1)' }} title={`Q${qi + 1}${isA ? ' ✓' : ''}${isF ? ' 🚩' : ''}`}>{qi + 1}</button>
                  );
                })}
                {filteredQs.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '0.3rem', color: '#aaa', fontSize: '0.65rem' }}>No questions match this filter</div>
                )}
              </div>
            </div>

            {/* ═══ FINISH SECTION ═══ */}
            <div style={styles.finishSection}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setShowReviewPanel(true)} style={{ flex: 1, padding: '0.5rem', backgroundColor: '#3498db', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 800, fontSize: '0.78rem', letterSpacing: '0.5px', boxShadow: '0 2px 8px rgba(52,152,219,0.3)', transition: 'all 0.2s' }}>
                  📝 REVIEW [R]
                </button>
                <button onClick={handleSubmit} disabled={submitMutation.isPending} style={{ flex: 1, ...styles.finishBtnBottom, opacity: submitMutation.isPending ? 0.7 : 1 }}>
                  {submitMutation.isPending ? '⏳ SUBMITTING...' : '🏁 FINISH [S]'}
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* ═══ PASSAGE PANEL ═══ */}
        {showPassage && hasPassage && (
          <div style={{ position: 'fixed', top: '63px', left: 0, width: '38%', height: 'calc(100vh - 63px)', backgroundColor: '#fff', borderRight: '3px solid #006633', overflowY: 'auto', padding: '1.2rem', boxShadow: '4px 0 20px rgba(0,0,0,0.1)', zIndex: 50 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', paddingBottom: '0.6rem', borderBottom: '2px solid #006633' }}>
              <span style={{ fontWeight: 800, fontSize: '0.8rem', color: '#006633', letterSpacing: '1px' }}>📖 READING PASSAGE</span>
              <button onClick={() => setShowPassage(false)} style={{ background: '#f0f0f0', border: 'none', width: '26px', height: '26px', borderRadius: '50%', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>✕</button>
            </div>
            <div style={{ fontSize: `${0.9 * fs}rem`, lineHeight: `${1.7 * fs}`, color: '#333', whiteSpace: 'pre-wrap' }}>{passageText}</div>
          </div>
        )}

        {/* ═══ SCRATCH PAD ═══ */}
        {showScratchPad && (
          <div style={{ position: 'fixed', top: '63px', right: 0, width: '300px', height: 'calc(100vh - 63px)', backgroundColor: '#fffef5', borderLeft: '3px solid #9b59b6', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 20px rgba(0,0,0,0.1)', zIndex: 50 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.8rem', borderBottom: '2px solid #9b59b6', backgroundColor: '#faf5ff' }}>
              <span style={{ fontWeight: 800, fontSize: '0.75rem', color: '#9b59b6', letterSpacing: '1px' }}>📝 SCRATCH PAD</span>
              <button onClick={() => setShowScratchPad(false)} style={{ background: '#f0f0f0', border: 'none', width: '26px', height: '26px', borderRadius: '50%', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>✕</button>
            </div>
            <textarea
              value={scratchPadContent}
              onChange={(e) => setScratchPadContent(e.target.value)}
              placeholder="Type your workings here... (auto-saved)"
              style={{ flex: 1, border: 'none', outline: 'none', resize: 'none', padding: '0.8rem', fontSize: '0.82rem', lineHeight: 1.6, fontFamily: "'Courier New', monospace", backgroundColor: 'transparent', color: '#333' }}
            />
            <div style={{ padding: '0.3rem 0.8rem', borderTop: '1px solid #e8e0f0', fontSize: '0.55rem', color: '#aaa', textAlign: 'center' }}>Auto-saved with your answers</div>
          </div>
        )}

        {/* ═══ CALCULATOR ═══ */}
        {showCalculator && (
          <div style={{ position: 'fixed', bottom: '16px', right: showScratchPad ? '310px' : '16px', zIndex: 100, transition: 'right 0.3s ease' }}>
            <Calculator onClose={() => setShowCalculator(false)} />
          </div>
        )}

        {/* ═══ KEYBOARD HINT ═══ */}
        {keyboardHint && !showConfirmation && !showExitWarning && !showTabWarning && examStarted && (
          <div style={styles.keyboardHint} onClick={() => setKeyboardHint(false)}>
            <div style={styles.keyboardHintContent}>
              <span style={{ fontWeight: 700, fontSize: '0.7rem', color: '#006633' }}>⌨ SHORTCUTS</span>
              <div style={{ display: 'flex', gap: '0.6rem', fontSize: '0.62rem', color: '#666', flexWrap: 'wrap', justifyContent: 'center' }}>
                <span><kbd style={styles.kbd}>A-E</kbd> Select</span>
                <span><kbd style={styles.kbd}>←→</kbd> Navigate</span>
                <span><kbd style={styles.kbd}>G</kbd> Flag</span>
                <span><kbd style={styles.kbd}>M</kbd> Calc</span>
                <span><kbd style={styles.kbd}>R</kbd> Review</span>
                <span><kbd style={styles.kbd}>F</kbd> Full</span>
                <span><kbd style={styles.kbd}>S</kbd> Submit</span>
              </div>
              <span style={{ fontSize: '0.55rem', color: '#aaa', cursor: 'pointer' }}>Click to dismiss</span>
            </div>
          </div>
        )}

        {/* ═══ TAB WARNING ═══ */}
        {showTabWarning && (<div style={styles.tabWarningBar}><span style={{ fontWeight: 800 }}>⚠ WINDOW SWITCH DETECTED</span><span style={{ marginLeft: '1rem', opacity: 0.9 }}>Leaving this window has been recorded. ({tabSwitchCount} switch{tabSwitchCount > 1 ? 'es' : ''})</span></div>)}

        {/* ═══ REVIEW PANEL ═══ */}
        {showReviewPanel && (
          <ReviewPanel
            test={test}
            answers={answers}
            flagged={flaggedQuestions}
            timings={questionTimings}
            onClose={() => setShowReviewPanel(false)}
            onGoToQuestion={(qi) => setCurrentQuestion(qi)}
          >
            <div style={{ padding: '1rem 2rem 1.5rem', borderTop: '1px solid #eee' }}>
              <button onClick={finalSubmitFromReview} disabled={submitMutation.isPending} style={{ width: '100%', padding: '0.8rem', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 800, fontSize: '1rem', letterSpacing: '1px' }}>
                {submitMutation.isPending ? '⏳ SUBMITTING...' : '🏁 FINAL SUBMIT'}
              </button>
            </div>
          </ReviewPanel>
        )}

        {/* ═══ SUBMIT MODAL ═══ */}
        {showConfirmation && (
          <div style={styles.modalOverlay}>
            <div style={styles.confirmModal}>
              <div style={styles.confirmHeader}><div style={{ fontSize: '2.5rem' }}>⚠️</div><h3 style={styles.confirmTitle}>CONFIRM SUBMISSION</h3><p style={styles.confirmSubtitle}>This action cannot be undone</p></div>
              <div style={styles.confirmBody}>
                <div style={styles.confirmStats}>
                  <div style={styles.confirmStat}><span style={{ ...styles.confirmStatNum, color: '#28a745' }}>{answeredCount}</span><span style={styles.confirmStatLabel}>Answered</span></div>
                  <div style={styles.confirmStatDivider} />
                  <div style={styles.confirmStat}><span style={{ ...styles.confirmStatNum, color: '#dc3545' }}>{test.questions.length - answeredCount}</span><span style={styles.confirmStatLabel}>Unanswered</span></div>
                  <div style={styles.confirmStatDivider} />
                  <div style={styles.confirmStat}><span style={{ ...styles.confirmStatNum, color: '#e67e22' }}>{flaggedQuestions.size}</span><span style={styles.confirmStatLabel}>Flagged</span></div>
                </div>
                {tabSwitchCount > 0 && <div style={{ ...styles.confirmWarning, backgroundColor: '#fff3cd', color: '#856404', border: '1px solid #ffeaa7', marginBottom: '0.8rem' }}>⚠ {tabSwitchCount} window switch{tabSwitchCount > 1 ? 'es' : ''} recorded</div>}
                {test.questions.length - answeredCount > 0 && <div style={styles.confirmWarning}>⚠ You have {test.questions.length - answeredCount} unanswered question(s)!</div>}
                {flaggedQuestions.size > 0 && <div style={{ ...styles.confirmWarning, backgroundColor: '#fff3e0', color: '#e65100', border: '1px solid #ffe0b2', marginBottom: '0.8rem' }}>🚩 You have {flaggedQuestions.size} flagged question(s) for review</div>}
                <div style={styles.confirmBtns}>
                  <button onClick={() => setShowConfirmation(false)} style={styles.cancelBtn}>GO BACK & REVIEW</button>
                  <button onClick={confirmSubmit} style={styles.confirmBtn}>YES, SUBMIT</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ EXIT FS MODAL ═══ */}
        {showExitWarning && (
          <div style={styles.modalOverlay}>
            <div style={styles.confirmModal}>
              <div style={styles.confirmHeader}><div style={{ fontSize: '2.5rem' }}>🖥️</div><h3 style={styles.confirmTitle}>EXIT FULL SCREEN?</h3><p style={styles.confirmSubtitle}>Your test is still in progress</p></div>
              <div style={styles.confirmBody}>
                <div style={{ ...styles.confirmWarning, backgroundColor: '#fff3cd', color: '#856404', border: '1px solid #ffeaa7' }}>Exiting full screen will NOT stop your timer. {isNativeFullscreen ? '' : 'Currently using JavaScript fullscreen mode.'}</div>
                <div style={styles.confirmBtns}>
                  <button onClick={() => setShowExitWarning(false)} style={styles.cancelBtn}>STAY FULL SCREEN</button>
                  <button onClick={() => { setShowExitWarning(false); jsExitFullscreen(); }} style={{ ...styles.confirmBtn, backgroundColor: '#6c757d' }}>EXIT</button>
                </div>
              </div>
            </div>
          </div>
        )}

        <style>{`
          @keyframes cbtPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.7;transform:scale(1.02)} }
          @keyframes cbtSlideDown { from{transform:translateY(-100%);opacity:0} to{transform:translateY(0);opacity:1} }
          @keyframes cbtFadeOut { 0%{opacity:1} 70%{opacity:1} 100%{opacity:0} }
          *{box-sizing:border-box} body{margin:0;padding:0}
          ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-track{background:#f1f1f1} ::-webkit-scrollbar-thumb{background:#bbb;border-radius:3px} ::-webkit-scrollbar-thumb:hover{background:#888}
          select { -webkit-appearance: none; -moz-appearance: none; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23888'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 4px center; padding-right: 16px; }
        `}</style>
      </div>
    );
  }
  return null;
};

// ==================== STYLES ====================
const styles = {
  cbtContainer: { backgroundColor: '#f0f2f5', fontFamily: "'Segoe UI','Inter',-apple-system,sans-serif", display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  topBar: { background: 'linear-gradient(135deg,#004d25 0%,#003d1c 50%,#002e14 100%)', color: '#fff', padding: '0 1rem', height: '54px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.3)', zIndex: 100 },
  topBarLeft: { display: 'flex', alignItems: 'center', gap: '0.7rem' },
  jambLogo: { display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0.6rem', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' },
  jambLogoIcon: { color: '#28a745', fontSize: '1.1rem', fontWeight: 900 },
  jambLogoText: { lineHeight: 1.2 },
  topBarDivider: { width: '1px', height: '24px', backgroundColor: 'rgba(255,255,255,0.15)', flexShrink: 0 },
  testInfoTop: { lineHeight: 1.2 },
  topBarRight: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  answeredBox: { textAlign: 'center', padding: '0.2rem 0.5rem', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' },
  timerBox: { padding: '0.2rem 0.8rem', borderRadius: '6px', textAlign: 'center', border: '2px solid', lineHeight: 1.2, minWidth: '110px' },
  fontSizeBtn: { background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: '0.1rem 0.3rem', borderRadius: '3px', fontSize: '0.65rem', lineHeight: 1 },
  toolBtn: { width: '30px', height: '30px', borderRadius: '6px', border: '1px solid', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', background: 'transparent' },
  fsToggleBtn: { display: 'flex', alignItems: 'center', padding: '0.35rem 0.6rem', border: '1px solid', borderRadius: '6px', cursor: 'pointer', color: '#fff', background: 'transparent', fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.5px', transition: 'all 0.2s' },
  tabSwitchIndicator: { fontSize: '0.55rem', fontWeight: 800, padding: '0.15rem 0.4rem', borderRadius: '4px', backgroundColor: 'rgba(255,26,26,0.3)', border: '1px solid rgba(255,26,26,0.5)', color: '#ff6b6b', letterSpacing: '0.5px' },
  progressTrack: { height: '3px', backgroundColor: '#e0e0e0', flexShrink: 0 },
  progressFill: { height: '100%', borderRadius: '0 2px 2px 0', transition: 'width 0.4s ease' },
  mainContentCentered: { flex: 1, overflow: 'hidden', padding: '0.5rem 1.2rem', display: 'flex', justifyContent: 'center', alignItems: 'stretch', minHeight: 0 },
  questionWrapper: { width: '100%', maxWidth: '1400px', display: 'flex', flexDirection: 'column', gap: 0 },
  
  questionCard: { 
    backgroundColor: '#ffffff', 
    borderRadius: '12px', 
    border: '1px solid #d0d5dd', 
    borderLeft: '5px solid #006633', 
    boxShadow: '0 4px 16px rgba(0,0,0,0.06)', 
    overflow: 'hidden', 
    marginBottom: '8px',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  questionHeader: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: '0.5rem 1.2rem', 
    borderBottom: '1px solid #f0f0f0', 
    flexWrap: 'wrap', 
    gap: '0.4rem',
    flexShrink: 0,
  },
  questionNumber: { display: 'inline-flex' },
  questionNumberText: { 
    backgroundColor: '#006633', 
    color: '#fff', 
    padding: '0.3rem 0.8rem', 
    borderRadius: '5px', 
    fontWeight: 800, 
    fontSize: '0.7rem', 
    letterSpacing: '1.5px' 
  },
  questionMeta: { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' },
  difficultyBadge: { 
    padding: '0.15rem 0.5rem', 
    borderRadius: '20px', 
    fontWeight: 700, 
    fontSize: '0.55rem', 
    letterSpacing: '1px', 
    textTransform: 'uppercase' 
  },
  questionOf: { fontSize: '0.75rem', color: '#999', fontWeight: 500 },
  questionText: { 
    fontSize: '1.4rem', 
    fontWeight: 500, 
    color: '#1a1a1a', 
    lineHeight: 1.9, 
    padding: '0.8rem 1.2rem',   
    flex: 1,                           
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  
  optionsCard: { backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #d0d5dd', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', overflow: 'hidden', marginBottom: '6px', flexShrink: 0 },
  optionsCardLabel: { padding: '0.08rem 1.2rem', borderBottom: '1px solid #f0f0f0' },
  optionsCardLabelText: { fontSize: '0.5rem', fontWeight: 700, color: '#888', letterSpacing: '1.5px', textTransform: 'uppercase' },
  optionsContainer: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem', padding: '0.5rem 1.2rem' },
  optionCard: { display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0.6rem', border: '1px solid', borderRadius: '7px', cursor: 'pointer', transition: 'all 0.15s ease', position: 'relative', overflow: 'hidden' },
  optionLetter: { width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.72rem', border: '1px solid', flexShrink: 0, transition: 'all 0.15s ease' },
  optionText: { fontSize: '0.88rem', lineHeight: 1.45, flex: 1, minWidth: 0, whiteSpace: 'normal' },
  checkMark: { color: '#006633', fontWeight: 900, fontSize: '0.9rem', flexShrink: 0 },

  navRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 0, marginBottom: '5px', flexShrink: 0 },
  navCenterInfo: { display: 'flex', alignItems: 'center', gap: '0.3rem' },
  navBtn: { display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.8rem', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.5px', transition: 'all 0.2s' },
  prevBtn: { backgroundColor: '#f5f5f5', color: '#333', border: '1px solid #ddd' },
  nextBtn: { backgroundColor: '#006633', color: '#fff' },

  navigatorSection: { backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #d0d5dd', boxShadow: '0 1px 4px rgba(0,0,0,0.03)', padding: '0.15rem 0.5rem 0.2rem', marginBottom: '5px', flexShrink: 0 },
  navigatorHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.1rem' },
  navigatorTitle: { fontSize: '0.68rem', fontWeight: 700, color: '#666', letterSpacing: '1px', textTransform: 'uppercase' },
  navigatorLegend: { display: 'flex', alignItems: 'center', gap: '0.12rem' },
  legendItem: { display: 'flex', alignItems: 'center' },
  legendDot: { width: '4px', height: '4px', borderRadius: '2px', flexShrink: 0 },
  legendText: { fontSize: '0.6rem', color: '#888', fontWeight: 500 },
  questionGridCompact: { display: 'grid', gridTemplateColumns: 'repeat(20, 1fr)', gap: '0px' },
  gridBtnCompact: { width: '100%', aspectRatio: '1.2', borderRadius: '2px', border: '1px solid', cursor: 'pointer', fontWeight: 700, fontSize: '0.65rem', transition: 'all 0.12s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Courier New', monospace", padding: 0, boxSizing: 'border-box' },
  
  finishSection: { padding: '0.1rem 0 0', borderTop: '1px solid #e0e0e0', marginTop: '4px', flexShrink: 0 },
  finishBtnBottom: { padding: '0.5rem 0.5rem', backgroundColor: '#e67e22', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 800, fontSize: '0.78rem', letterSpacing: '0.3px', boxShadow: '0 2px 8px rgba(230,126,34,0.3)', transition: 'all 0.2s ease' },
  keyboardHint: { position: 'fixed', bottom: '12px', left: '50%', transform: 'translateX(-50%)', zIndex: 200, cursor: 'pointer' },
  keyboardHintContent: { backgroundColor: '#1a1a2e', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.8rem', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', flexWrap: 'wrap', justifyContent: 'center' },
  kbd: { backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '3px', padding: '1px 4px', fontFamily: "'Courier New',monospace", fontSize: '0.6rem', fontWeight: 700, marginRight: '1px' },
  tabWarningBar: { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10000, backgroundColor: '#dc3545', color: '#fff', padding: '0.7rem 1.5rem', display: 'flex', alignItems: 'center', fontSize: '0.82rem', boxShadow: '0 4px 15px rgba(220,53,69,0.4)', animation: 'cbtSlideDown 0.3s ease', fontWeight: 600 },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' },
  confirmModal: { backgroundColor: '#fff', width: '100%', maxWidth: '460px', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
  confirmHeader: { padding: '2rem 2rem 1rem', textAlign: 'center' },
  confirmTitle: { margin: '0.8rem 0 0.3rem', color: '#1a1a1a', fontSize: '1.2rem', fontWeight: 800, letterSpacing: '1px' },
  confirmSubtitle: { margin: 0, color: '#888', fontSize: '0.85rem' },
  confirmBody: { padding: '1rem 2rem 2rem', textAlign: 'center' },
  confirmStats: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem', marginBottom: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' },
  confirmStat: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' },
  confirmStatNum: { fontSize: '1.8rem', fontWeight: 900, fontFamily: "'Courier New',monospace" },
  confirmStatLabel: { fontSize: '0.65rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 },
  confirmStatDivider: { width: '1px', height: '40px', backgroundColor: '#e0e0e0' },
  confirmWarning: { padding: '0.6rem 1rem', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600, marginBottom: '1.2rem', border: '1px solid #f5c6cb' },
  confirmBtns: { display: 'flex', gap: '0.8rem', justifyContent: 'center' },
  cancelBtn: { padding: '0.35rem 0.8rem', border: '1px solid #ddd', backgroundColor: '#fff', cursor: 'pointer', borderRadius: '5px', fontWeight: 700, fontSize: '0.68rem', color: '#555', transition: 'all 0.15s' },
  confirmBtn: { padding: '0.35rem 0.8rem', border: 'none', backgroundColor: '#006633', color: '#fff', cursor: 'pointer', borderRadius: '5px', fontWeight: 700, fontSize: '0.68rem', transition: 'all 0.15s' },
  centerContainer: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f2f5', padding: '2rem' },
  errorBox: { background: '#f8d7da', color: '#721c24', padding: '1.5rem', border: '1px solid #f5c6cb', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' },
  errorIcon: { fontSize: '1.5rem', flexShrink: 0 },
  errorText: { fontWeight: 500 },
  emptyBox: { background: '#fff3cd', color: '#856404', padding: '2rem', border: '1px solid #ffeeba', borderRadius: '8px', textAlign: 'center', marginBottom: '1.5rem' },
  backBtn: { padding: '0.35rem 0.9rem', background: 'linear-gradient(135deg,#006633,#004d25)', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 700, fontSize: '0.7rem' },
};

export { getSubmittedTests, markTestAsSubmitted };
export default TakeTest;
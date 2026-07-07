import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { studentAPI } from '../../api';
import { useParams, useNavigate } from 'react-router-dom';
import { useLayout } from '../../context/LayoutContext';
import Loading from '../common/Loading';

// ==================== LOCAL STORAGE HELPERS ==================
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

// ==================== MATH TEXT FORMATTER ====================
const formatMathText = (text) => {
  if (!text) return '';
  let formatted = String(text);
  formatted = formatted.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  formatted = formatted.replace(/sqrt\(([^)]+)\)/gi, '√($1)');
  formatted = formatted.replace(/\^(\d+)/g, '<sup>$1</sup>');
  formatted = formatted.replace(/\^([a-zA-Z])(?![a-zA-Z])/g, '<sup>$1</sup>');
  formatted = formatted.replace(/\^\(([^)]+)\)/g, '<sup>($1)</sup>');
  formatted = formatted.replace(/\*/g, ' × ');
  formatted = formatted.replace(/(\w)\s*\/\s*(\w)/g, '$1 ÷ $2');
  const fractions = {
    '1 ÷ 2': '½', '1 ÷ 3': '⅓', '1 ÷ 4': '¼', '2 ÷ 3': '⅔', '3 ÷ 4': '¾', 
    '1 ÷ 5': '⅕', '2 ÷ 5': '⅖', '3 ÷ 5': '⅗', '4 ÷ 5': '⅘', '1 ÷ 6': '⅙', 
    '5 ÷ 6': '⅚', '1 ÷ 8': '⅛', '3 ÷ 8': '⅜', '5 ÷ 8': '⅝', '7 ÷ 8': '⅞',
  };
  Object.entries(fractions).forEach(([key, value]) => {
    formatted = formatted.replace(new RegExp(key, 'g'), value);
  });
  formatted = formatted.replace(/&lt;=/g, '≤').replace(/&gt;=/g, '≥').replace(/!=/g, '≠');
  formatted = formatted.replace(/\bpi\b/gi, 'π').replace(/\btheta\b/gi, 'θ').replace(/\balpha\b/gi, 'α').replace(/\bbeta\b/gi, 'β').replace(/\bgamma\b/gi, 'γ').replace(/\bdelta\b/gi, 'δ').replace(/\bsigma\b/gi, 'σ').replace(/\bomega\b/gi, 'ω').replace(/\blambda\b/gi, 'λ').replace(/\bmu\b/gi, 'μ').replace(/\binfinity\b/gi, '∞');
  formatted = formatted.replace(/  +/g, ' ').replace(/\s+×\s+/g, ' × ');
  return formatted;
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
                        <span 
                          style={{ fontSize: '0.75rem', color: '#666', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          dangerouslySetInnerHTML={{ __html: formatMathText(test.questions[qi].questionText?.substring(0, 60) || '') + '...' }}
                        />
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

// ==================== MAIN STYLES ====================
const styles = {
  cbtContainer: { backgroundColor: '#0a0a1a', color: '#fff', fontFamily: "'Segoe UI', 'Roboto', sans-serif", display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 1rem', backgroundColor: '#001a0d', borderBottom: '2px solid #006633', flexShrink: 0, minHeight: '56px' },
  topBarLeft: { display: 'flex', alignItems: 'center', gap: '0.8rem' },
  topBarRight: { display: 'flex', alignItems: 'center', gap: '0.6rem' },
  jambLogo: { display: 'flex', alignItems: 'center', gap: '0.4rem' },
  jambLogoIcon: { fontSize: '1.4rem', color: '#006633', fontWeight: 900 },
  jambLogoText: { lineHeight: 1.2 },
  topBarDivider: { width: '1px', height: '32px', backgroundColor: 'rgba(255,255,255,0.15)' },
  testInfoTop: {},
  answeredBox: { textAlign: 'center', padding: '0.2rem 0.5rem', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' },
  timerBox: { textAlign: 'center', padding: '0.3rem 0.8rem', borderRadius: '6px', border: '2px solid', minWidth: '100px' },
  tabSwitchIndicator: { fontSize: '0.65rem', color: '#ff6b35', fontWeight: 700, backgroundColor: 'rgba(255,107,53,0.15)', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(255,107,53,0.3)' },
  fontSizeBtn: { background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: '0.15rem 0.35rem', borderRadius: '3px', fontSize: '0.7rem', lineHeight: 1 },
  toolBtn: { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' },
  toolBtnActive: { background: 'rgba(0,102,51,0.4)', border: '1px solid #006633', color: '#fff', cursor: 'pointer', padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' },
  finishBtn: { background: '#dc3545', border: 'none', color: '#fff', cursor: 'pointer', padding: '0.5rem 1.2rem', borderRadius: '6px', fontWeight: 800, fontSize: '0.8rem', letterSpacing: '1px' },
  mainContent: { display: 'flex', flex: 1, overflow: 'hidden' },
  questionNav: { width: '220px', backgroundColor: '#0d1b2a', borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' },
  navHeader: { padding: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.08)' },
  navFilterBtns: { display: 'flex', gap: '3px', padding: '0.5rem 0.8rem', flexWrap: 'wrap' },
  navFilterBtn: { padding: '0.25rem 0.5rem', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: 'transparent', color: '#aaa', cursor: 'pointer', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600 },
  navFilterBtnActive: { padding: '0.25rem 0.5rem', border: '1px solid #006633', backgroundColor: 'rgba(0,102,51,0.2)', color: '#006633', cursor: 'pointer', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700 },
  navGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', padding: '0.6rem 0.8rem', overflowY: 'auto', flex: 1 },
  navQBtn: { width: '100%', aspectRatio: '1', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)', color: '#aaa', cursor: 'pointer', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' },
  navQBtnCurrent: { width: '100%', aspectRatio: '1', border: '2px solid #006633', backgroundColor: 'rgba(0,102,51,0.3)', color: '#fff', cursor: 'pointer', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  navQBtnAnswered: { width: '100%', aspectRatio: '1', border: '1px solid rgba(40,167,69,0.4)', backgroundColor: 'rgba(40,167,69,0.2)', color: '#28a745', cursor: 'pointer', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  navQBtnFlagged: { width: '100%', aspectRatio: '1', border: '1px solid rgba(230,126,34,0.4)', backgroundColor: 'rgba(230,126,34,0.15)', color: '#e67e22', cursor: 'pointer', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  navLegend: { padding: '0.6rem 0.8rem', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  legendItem: { display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.6rem', color: '#888' },
  legendDot: { width: '10px', height: '10px', borderRadius: '2px', flexShrink: 0 },
  questionArea: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' },
  questionContent: { flex: 1, overflow: 'auto', padding: '1.5rem 2rem' },
  questionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  questionNumber: { fontWeight: 900, fontSize: '0.8rem', color: '#006633', backgroundColor: 'rgba(0,102,51,0.15)', padding: '0.3rem 0.8rem', borderRadius: '6px', letterSpacing: '1px' },
  questionType: { fontSize: '0.7rem', color: '#888', fontWeight: 600, display: 'flex', alignItems: 'center' },
  questionText: { fontSize: '1.05rem', lineHeight: 1.8, color: '#e8e8e8', marginBottom: '1.5rem', fontWeight: 500 },
  passageBox: { backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '1rem 1.2rem', marginBottom: '1.5rem', maxHeight: '200px', overflowY: 'auto' },
  passageLabel: { fontSize: '0.7rem', fontWeight: 800, color: '#006633', letterSpacing: '1px', marginBottom: '0.5rem' },
  passageText: { fontSize: '0.9rem', lineHeight: 1.7, color: '#bbb' },
  optionsContainer: { display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  optionBtn: { display: 'flex', alignItems: 'flex-start', gap: '0.8rem', padding: '0.9rem 1.2rem', border: '2px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left', width: '100%', color: '#ddd' },
  optionBtnHover: { display: 'flex', alignItems: 'flex-start', gap: '0.8rem', padding: '0.9rem 1.2rem', border: '2px solid rgba(0,102,51,0.3)', backgroundColor: 'rgba(0,102,51,0.08)', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left', width: '100%', color: '#fff' },
  optionBtnSelected: { display: 'flex', alignItems: 'flex-start', gap: '0.8rem', padding: '0.9rem 1.2rem', border: '2px solid #006633', backgroundColor: 'rgba(0,102,51,0.2)', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left', width: '100%', color: '#fff' },
  optionLetter: { width: '32px', height: '32px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', flexShrink: 0, transition: 'all 0.15s' },
  optionLetterSelected: { width: '32px', height: '32px', borderRadius: '50%', border: '2px solid #006633', backgroundColor: '#006633', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', flexShrink: 0 },
  optionText: { fontSize: '0.95rem', lineHeight: 1.6, paddingTop: '4px', flex: 1 },
  questionFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)', backgroundColor: 'rgba(0,0,0,0.2)', flexShrink: 0 },
  navBtn: { display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.2rem', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)', color: '#ccc', cursor: 'pointer', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem' },
  navBtnDisabled: { display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.2rem', border: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'transparent', color: '#555', cursor: 'not-allowed', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem' },
  flagBtn: { display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1rem', border: '1px solid rgba(230,126,34,0.3)', backgroundColor: 'transparent', color: '#e67e22', cursor: 'pointer', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem' },
  flagBtnActive: { display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1rem', border: '1px solid #e67e22', backgroundColor: 'rgba(230,126,34,0.15)', color: '#e67e22', cursor: 'pointer', borderRadius: '8px', fontWeight: 800, fontSize: '0.85rem' },
  progressBar: { height: '3px', backgroundColor: 'rgba(255,255,255,0.05)', flexShrink: 0 },
  progressFill: { height: '100%', backgroundColor: '#006633', transition: 'width 0.3s ease' },
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(3px)' },
  confirmCard: { backgroundColor: '#fff', borderRadius: '12px', padding: '2rem', maxWidth: '420px', width: '90%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' },
  warningCard: { backgroundColor: '#fff3cd', borderRadius: '12px', padding: '1.5rem 2rem', maxWidth: '450px', width: '90%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', border: '2px solid #ffeaa7' },
  tabWarningCard: { backgroundColor: '#dc3545', borderRadius: '12px', padding: '1.5rem 2rem', maxWidth: '400px', width: '90%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', color: '#fff' },
  keyboardHint: { position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(0,0,0,0.85)', color: '#ccc', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.72rem', zIndex: 500, border: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: '1rem', alignItems: 'center' },
  keyboardKey: { backgroundColor: 'rgba(255,255,255,0.15)', padding: '0.1rem 0.4rem', borderRadius: '3px', fontWeight: 700, fontSize: '0.7rem' },
  scratchPad: { position: 'fixed', bottom: '60px', right: '20px', width: '320px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', overflow: 'hidden', border: '1px solid #ddd', zIndex: 600 },
  scratchPadHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 1rem', backgroundColor: '#006633', color: '#fff' },
  scratchPadTextarea: { width: '100%', height: '200px', border: 'none', padding: '0.8rem', fontSize: '0.85rem', resize: 'none', outline: 'none', fontFamily: "'Segoe UI', sans-serif" },
  centerContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#0a0a1a', color: '#fff', padding: '2rem' },
  errorBox: { textAlign: 'center', marginBottom: '1.5rem' },
  errorIcon: { fontSize: '3rem', marginBottom: '1rem', color: '#dc3545' },
  errorText: { fontSize: '1.1rem', color: '#ddd' },
  emptyBox: { textAlign: 'center', marginBottom: '1.5rem' },
  backBtn: { padding: '0.7rem 1.5rem', border: '1px solid #006633', backgroundColor: 'transparent', color: '#006633', cursor: 'pointer', borderRadius: '8px', fontWeight: 700, fontSize: '0.9rem' },
  calculatorWrapper: { position: 'fixed', bottom: '60px', right: '20px', zIndex: 600 },
  soundToggle: { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '0.85rem' },
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
  const [hoveredOption, setHoveredOption] = useState(null);

  const { data: testData, isLoading, error } = useQuery({
    queryKey: ['test', testId],
    queryFn: () => studentAPI.getTestById(testId),
    enabled: !!testId,
    refetchOnWindowFocus: false,
  });

  const test = testData?.data;

  // ==================== INJECT MATH STYLES ====================
  useEffect(() => {
    if (document.getElementById('cbt-math-styles')) return;
    const style = document.createElement('style');
    style.id = 'cbt-math-styles';
    style.textContent = `sup { font-size: 0.7em; vertical-align: super; line-height: 0; color: inherit; } @keyframes cbtPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } } @keyframes cbtFadeOut { 0% { opacity: 1; } 70% { opacity: 1; } 100% { opacity: 0; } }`;
    document.head.appendChild(style);
    return () => { const s = document.getElementById('cbt-math-styles'); if (s) s.remove(); };
  }, []);

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

            <button onClick={() => setShowCalculator((p) => !p)} title="Calculator (M)" style={{ ...styles.toolBtn, backgroundColor: showCalculator ? 'rgba(0,102,51,0.4)' : 'rgba(255,255,255,0.08)', border: showCalculator ? '1px solid #006633' : '1px solid rgba(255,255,255,0.1)' }}>🧮</button>
            <button onClick={() => setShowScratchPad((p) => !p)} title="Scratch Pad" style={{ ...styles.toolBtn, backgroundColor: showScratchPad ? 'rgba(0,102,51,0.4)' : 'rgba(255,255,255,0.08)', border: showScratchPad ? '1px solid #006633' : '1px solid rgba(255,255,255,0.1)' }}>📝</button>
            <button onClick={toggleFullscreen} title="Fullscreen (F)" style={styles.toolBtn}>{isFullscreen ? '⬜' : '⬛'}</button>
            <button onClick={() => setSoundEnabled((p) => { SoundEngine.enabled = !p; return !p; })} title="Toggle Sound" style={styles.soundToggle}>{soundEnabled ? '🔊' : '🔇'}</button>
            <button onClick={handleSubmit} style={styles.finishBtn}>🏁 FINISH</button>
          </div>
        </div>

        {/* ═══ PROGRESS BAR ═══ */}
        <div style={styles.progressBar}>
          <div style={{ ...styles.progressFill, width: `${progressPercent}%` }} />
        </div>

        {/* ═══ MAIN CONTENT ═══ */}
        <div style={styles.mainContent}>

          {/* ═══ QUESTION NAVIGATION ═══ */}
          <div style={styles.questionNav}>
            <div style={styles.navHeader}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#888', letterSpacing: '1px', marginBottom: '0.4rem' }}>QUESTIONS</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#666' }}>
                <span>✅ {answeredCount}</span>
                <span>❌ {test.questions.length - answeredCount}</span>
                <span>🚩 {flaggedQuestions.size}</span>
              </div>
            </div>
            <div style={styles.navFilterBtns}>
              {['all', 'answered', 'unanswered', 'flagged'].map((f) => (
                <button key={f} onClick={() => setQuestionFilter(f)} style={questionFilter === f ? styles.navFilterBtnActive : styles.navFilterBtn}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <div style={styles.navGrid}>
              {filteredQs.map((qi) => {
                const isCurrent = qi === currentQuestion;
                const isAnswered = answers[qi] !== null;
                const isFlagged = flaggedQuestions.has(qi);
                let btnStyle = styles.navQBtn;
                if (isCurrent) btnStyle = styles.navQBtnCurrent;
                else if (isFlagged) btnStyle = styles.navQBtnFlagged;
                else if (isAnswered) btnStyle = styles.navQBtnAnswered;
                return (
                  <button key={qi} onClick={() => setCurrentQuestion(qi)} style={btnStyle} title={isFlagged ? 'Flagged' : isAnswered ? 'Answered' : 'Unanswered'}>
                    {isFlagged ? '🚩' : qi + 1}
                  </button>
                );
              })}
            </div>
            <div style={styles.navLegend}>
              <div style={styles.legendItem}><div style={{ ...styles.legendDot, backgroundColor: 'rgba(40,167,69,0.4)', border: '1px solid rgba(40,167,69,0.6)' }} /> Answered</div>
              <div style={styles.legendItem}><div style={{ ...styles.legendDot, backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)' }} /> Unanswered</div>
              <div style={styles.legendItem}><div style={{ ...styles.legendDot, backgroundColor: 'rgba(0,102,51,0.3)', border: '2px solid #006633' }} /> Current</div>
              <div style={styles.legendItem}><div style={{ ...styles.legendDot, backgroundColor: 'rgba(230,126,34,0.15)', border: '1px solid rgba(230,126,34,0.4)' }} /> Flagged</div>
            </div>
          </div>

          {/* ═══ QUESTION AREA ═══ */}
          <div style={styles.questionArea}>
            <div style={styles.questionContent}>
              {/* Question Header */}
              <div style={styles.questionHeader}>
                <div style={styles.questionNumber}>QUESTION {currentQuestion + 1} OF {test.questions.length}</div>
                <div style={styles.questionType}>
                  {currentQ.type === 'multiple-choice' ? 'Multiple Choice' : currentQ.type || 'Multiple Choice'}
                  {hasPassage && (
                    <button onClick={() => setShowPassage((p) => !p)} style={{ marginLeft: '0.8rem', background: 'rgba(0,102,51,0.2)', border: '1px solid #006633', color: '#006633', padding: '0.2rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 700 }}>
                      {showPassage ? 'Hide Passage' : '📖 Show Passage'}
                    </button>
                  )}
                </div>
              </div>

              {/* Passage */}
              {hasPassage && showPassage && (
                <div style={styles.passageBox}>
                  <div style={styles.passageLabel}>📖 READING PASSAGE</div>
                  <div 
                    style={{ ...styles.passageText, fontSize: `${0.9 * fs}rem` }} 
                    dangerouslySetInnerHTML={{ __html: formatMathText(passageText) }}
                  />
                </div>
              )}

              {/* Question Text */}
              <div 
                style={{ ...styles.questionText, fontSize: `${1.05 * fs}rem` }} 
                dangerouslySetInnerHTML={{ __html: formatMathText(currentQ.questionText) }}
              />

              {/* Options */}
              <div style={styles.optionsContainer}>
                {(currentQ.options || []).map((option, oi) => {
                  const isSelected = answers[currentQuestion] === oi;
                  const isHovered = hoveredOption === oi;
                  let btnStyle = styles.optionBtn;
                  if (isSelected) btnStyle = styles.optionBtnSelected;
                  else if (isHovered) btnStyle = styles.optionBtnHover;

                  return (
                    <button
                      key={oi}
                      onClick={() => handleSelectOption(oi)}
                      onMouseEnter={() => setHoveredOption(oi)}
                      onMouseLeave={() => setHoveredOption(null)}
                      style={btnStyle}
                    >
                      <div style={isSelected ? styles.optionLetterSelected : styles.optionLetter}>
                        {optionLetters[oi]}
                      </div>
                      <div 
                        style={{ ...styles.optionText, fontSize: `${0.95 * fs}rem` }} 
                        dangerouslySetInnerHTML={{ __html: formatMathText(option.text || option) }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Question Footer */}
            <div style={styles.questionFooter}>
              <button
                onClick={handlePrev}
                disabled={currentQuestion === 0}
                style={currentQuestion === 0 ? styles.navBtnDisabled : styles.navBtn}
              >
                ← Previous
              </button>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleToggleFlag}
                  style={flaggedQuestions.has(currentQuestion) ? styles.flagBtnActive : styles.flagBtn}
                >
                  🚩 {flaggedQuestions.has(currentQuestion) ? 'Unflag' : 'Flag'}
                </button>
                <span style={{ fontSize: '0.75rem', color: '#666', display: 'flex', alignItems: 'center' }}>
                  Q{currentQuestion + 1}/{test.questions.length}
                </span>
              </div>

              <button
                onClick={handleNext}
                disabled={currentQuestion === test.questions.length - 1}
                style={currentQuestion === test.questions.length - 1 ? styles.navBtnDisabled : styles.navBtn}
              >
                Next →
              </button>
            </div>
          </div>
        </div>

        {/* ═══ CALCULATOR ═══ */}
        {showCalculator && (
          <div style={styles.calculatorWrapper}>
            <Calculator onClose={() => setShowCalculator(false)} />
          </div>
        )}

        {/* ═══ SCRATCH PAD ═══ */}
        {showScratchPad && (
          <div style={styles.scratchPad}>
            <div style={styles.scratchPadHeader}>
              <span style={{ fontWeight: 800, fontSize: '0.75rem', letterSpacing: '1px' }}>📝 SCRATCH PAD</span>
              <button onClick={() => setShowScratchPad(false)} style={calcStyles.closeBtn}>✕</button>
            </div>
            <textarea
              value={scratchPadContent}
              onChange={(e) => setScratchPadContent(e.target.value)}
              placeholder="Type your working here..."
              style={styles.scratchPadTextarea}
            />
          </div>
        )}

        {/* ═══ KEYBOARD HINT ═══ */}
        {keyboardHint && examStarted && !showInstructions && (
          <div style={styles.keyboardHint}>
            <span><span style={styles.keyboardKey}>A</span><span style={styles.keyboardKey}>B</span><span style={styles.keyboardKey}>C</span><span style={styles.keyboardKey}>D</span> Select</span>
            <span><span style={styles.keyboardKey}>←</span><span style={styles.keyboardKey}>→</span> Navigate</span>
            <span><span style={styles.keyboardKey}>G</span> Flag</span>
            <span><span style={styles.keyboardKey}>M</span> Calculator</span>
            <span><span style={styles.keyboardKey}>F</span> Fullscreen</span>
            <span><span style={styles.keyboardKey}>S</span> Submit</span>
          </div>
        )}

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
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #eee', display: 'flex', gap: '0.8rem', justifyContent: 'center' }}>
              <button onClick={() => setShowReviewPanel(false)} style={{ ...instrStyles.cancelBtn, flex: 1 }}>Continue Exam</button>
              <button onClick={finalSubmitFromReview} style={{ ...instrStyles.startBtn, flex: 1, backgroundColor: '#dc3545', boxShadow: '0 4px 15px rgba(220,53,69,0.3)' }}>🚀 Submit Test</button>
            </div>
          </ReviewPanel>
        )}

        {/* ═══ SUBMIT CONFIRMATION ═══ */}
        {showConfirmation && (
          <div style={styles.overlay}>
            <div style={styles.confirmCard}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1a1a1a', marginBottom: '0.5rem' }}>Confirm Submission</div>
              <div style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                You have <strong style={{ color: '#dc3545' }}>{answers.filter(a => a === null).length} unanswered</strong> question(s) out of {test.questions.length} total.
                <br />Are you sure you want to submit?
              </div>
              <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center' }}>
                <button onClick={() => setShowConfirmation(false)} style={instrStyles.cancelBtn}>Go Back</button>
                <button onClick={confirmSubmit} style={{ ...instrStyles.startBtn, backgroundColor: '#dc3545', boxShadow: '0 4px 15px rgba(220,53,69,0.3)' }}>Yes, Submit</button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ FULLSCREEN EXIT WARNING ═══ */}
        {showExitWarning && (
          <div style={styles.overlay}>
            <div style={styles.warningCard}>
              <div style={{ fontSize: '2rem', marginBottom: '0.8rem' }}>⚠️</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#856404', marginBottom: '0.5rem' }}>Exit Fullscreen?</div>
              <div style={{ color: '#856404', fontSize: '0.85rem', marginBottom: '1.2rem', lineHeight: 1.5 }}>
                Exiting fullscreen may be recorded. Are you sure?
              </div>
              <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center' }}>
                <button onClick={() => { setShowExitWarning(false); }} style={{ padding: '0.6rem 1.5rem', border: '1px solid #856404', background: 'transparent', color: '#856404', cursor: 'pointer', borderRadius: '8px', fontWeight: 700 }}>Stay</button>
                <button onClick={() => { setShowExitWarning(false); jsExitFullscreen(); }} style={{ padding: '0.6rem 1.5rem', border: 'none', background: '#856404', color: '#fff', cursor: 'pointer', borderRadius: '8px', fontWeight: 700 }}>Exit</button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB SWITCH WARNING ═══ */}
        {showTabWarning && (
          <div style={{ position: 'fixed', top: '70px', right: '20px', zIndex: 2000, animation: 'cbtFadeOut 4s forwards' }}>
            <div style={styles.tabWarningCard}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.3rem' }}>🚨</div>
              <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>Tab Switch Detected!</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.9, marginTop: '0.2rem' }}>This has been recorded ({tabSwitchCount} time(s))</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default TakeTest
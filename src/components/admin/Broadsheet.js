// ============================================
// ADMIN BROADSHEET PAGE
// Nigerian Secondary School System
// Bootstrap + Custom Creative Design
// Mobile-Optimized Version
// ============================================
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminBroadsheetAPI, termsAPI, sessionsAPI } from '../../api';
import './Broadsheet.css'

// ============================================
// SVG ICON COMPONENTS
// ============================================
const Icons = {
    ArrowLeft: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
    ),
    Printer: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>
    ),
    Loader: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${p.className || ''} ${p.spin ? 'spinner-border spinner-border-sm' : ''}`}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
    ),
    AlertCircle: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
    ),
    Users: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    ),
    BookOpen: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
    ),
    BarChart: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/></svg>
    ),
    TrendingUp: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
    ),
    Award: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>
    ),
    ChevronDown: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><path d="m6 9 6 6 6-6"/></svg>
    ),
    ChevronRight: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><path d="m9 18 6-6-6-6"/></svg>
    ),
    ChevronLeft: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><path d="m15 18-6-6 6-6"/></svg>
    ),
    Filter: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
    ),
    FileText: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
    ),
    ClipboardCheck: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></svg>
    ),
    MessageSquare: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    ),
    Search: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
    ),
    X: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
    ),
    Maximize2: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" x2="14" y1="3" y2="10"/><line x1="3" x2="10" y1="21" y2="14"/></svg>
    ),
    Minimize2: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" x2="21" y1="10" y2="3"/><line x1="3" x2="10" y1="21" y2="14"/></svg>
    ),
    ArrowUp: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
    ),
    ArrowDown: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><path d="m5 12 7 7 7-7"/><path d="M12 5v14"/></svg>
    ),
    Eye: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
    ),
    AlertTriangle: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
    ),
    Star: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
    ),
    Zap: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>
    ),
    Target: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
    ),
    Layers: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22.54 12.43-1.14.51"/><path d="m22.54 12.43-8.58 3.91a2 2 0 0 1-1.66 0l-8.58-3.9"/><path d="m22.54 16.43-1.14.51"/><path d="m22.54 16.43-8.58 3.91a2 2 0 0 1-1.66 0l-8.58-3.9"/></svg>
    ),
    GraduationCap: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></svg>
    ),
    DoubleArrow: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><path d="m18 8 4 4-4 4"/><path d="m18 4 4 4-4 4"/><path d="m6 8-4 4 4 4"/><path d="m6 4-4 4 4 4"/></svg>
    ),
    User: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    ),
    Shield: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
    ),
    School: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
    ),
    Grid: (p) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
    ),
};

// ============================================
// CONSTANTS & CONFIGURATION
// ============================================
const SCHOOL_INFO = {
    name: 'DATFORTE INTERBATIONAL SCHOOL LIMITED',
    address: 'Ahmadiyyah Lagos state',
    motto: 'Discipline & Excellence',
};

const GRADING_KEY = [
    { grade: 'A', range: '70 – 100', color: '#059669' },
    { grade: 'B', range: '60 – 69', color: '#2563eb' },
    { grade: 'C', range: '50 – 59', color: '#d97706' },
    { grade: 'D', range: '45 – 49', color: '#ea580c' },
    { grade: 'E', range: '40 – 44', color: '#dc2626' },
    { grade: 'F', range: '0 – 39', color: '#991b1b' },
];

const VIEW_MODES = { DETAILED: 'detailed', COMPACT: 'compact', GRADE_ONLY: 'grade_only', CARDS: 'cards' };

const STICKY_COLS = {
    sn: { width: 42, left: 0 },
    admNo: { width: 80, left: 42 },
    name: { width: 170, left: 122 },
    gender: { width: 40, left: 292 },
};
const STICKY_TOTAL_W = 332;

const STICKY_COLS_MOBILE = {
    sn: { width: 32, left: 0 },
    admNo: { width: 56, left: 32 },
    name: { width: 120, left: 88 },
    gender: { width: 0, left: 208 },
};
const STICKY_TOTAL_W_MOBILE = 208;

const SUB_COLS_DETAILED = [
    { key: 'testScore', label: 'T', width: 36 },
    { key: 'noteTakingScore', label: 'NT', width: 36 },
    { key: 'assignmentScore', label: 'AS', width: 36 },
    { key: 'totalCA', label: 'CA', width: 38 },
    { key: 'examScore', label: 'EX', width: 38 },
    { key: 'totalScore', label: 'Tot', width: 40 },
    { key: 'grade', label: 'G', width: 34 },
    { key: 'remark', label: 'R', width: 42 },
];
const SUB_COLS_COMPACT = [
    { key: 'totalScore', label: 'Total', width: 48 },
    { key: 'grade', label: 'G', width: 34 },
];
const SUB_COLS_GRADE_ONLY = [{ key: 'grade', label: 'G', width: 34 }];

const PAL = {
    green: '#008751',
    greenLight: '#34d399',
    greenDark: '#065f46',
    greenGhost: 'rgba(0,135,81,0.08)',
    greenGhostMed: 'rgba(0,135,81,0.15)',
    hdrPrimary: '#1e1b4b',
    hdrSecondary: '#312e81',
    hdrDeep: '#0f0d2e',
    hdrAccent: '#6366f1',
    hdrGlow: 'rgba(99,102,241,0.35)',
    hdrGold: '#fbbf24',
    hdrGoldGlow: 'rgba(251,191,36,0.25)',
    hdrText: '#e0e7ff',
    hdrMuted: '#a5b4fc',
    dark: '#0c0f1a',
    darkCard: '#141829',
    darkSurface: '#1a1f35',
    darkMuted: '#6b7294',
    darkText: '#c8cde0',
    accentGlow: 'rgba(99,102,241,0.3)',
};

// ============================================
// UTILITY FUNCTIONS
// ============================================
function getGradeColor(grade) {
    const g = (grade || '').toUpperCase();
    const map = {
        'A': { text: 'text-success', bg: 'bg-success-subtle', dot: '#059669' },
        'B': { text: 'text-primary', bg: 'bg-primary-subtle', dot: '#2563eb' },
        'C': { text: 'text-warning', bg: 'bg-warning-subtle', dot: '#d97706' },
        'D': { text: 'text-orange', bg: 'bg-orange-subtle', dot: '#ea580c' },
        'E': { text: 'text-danger', bg: 'bg-danger-subtle', dot: '#dc2626' },
        'F': { text: 'text-dark', bg: 'bg-dark-subtle', dot: '#991b1b' }
    };
    return map[g] || { text: 'text-secondary', bg: 'bg-body-tertiary', dot: '#6c757d' };
}
function getScoreColor(key, value) {
    if (key === 'grade') return null;
    if (key === 'remark') return 'text-secondary';
    const num = Number(value);
    if (isNaN(num) || num === 0) return 'text-body-tertiary';
    if (key === 'totalScore' || key === 'totalCA' || key === 'examScore') {
        if (num >= 70) return 'text-success fw-semibold';
        if (num >= 50) return 'text-dark';
        if (num >= 40) return 'text-orange';
        return 'text-danger fw-semibold';
    }
    const maxExpected = key === 'testScore' ? 20 : key === 'examScore' ? 60 : 10;
    const pct = (num / maxExpected) * 100;
    if (pct >= 70) return 'text-success';
    if (pct >= 50) return 'text-dark';
    return 'text-orange';
}
function getPositionStyle(position) {
    if (position === 1) return { bg: 'linear-gradient(135deg, #fbbf24, #f59e0b)', text: '#78350f', border: '#d97706' };
    if (position === 2) return { bg: 'linear-gradient(135deg, #e5e7eb, #d1d5db)', text: '#374151', border: '#9ca3af' };
    if (position === 3) return { bg: 'linear-gradient(135deg, #fdba74, #fb923c)', text: '#7c2d12', border: '#ea580c' };
    if (position <= 10) return { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' };
    return { bg: '#f8f9fa', text: '#6b7280', border: '#dee2e6' };
}
function getPositionSuffix(pos) {
    if (!pos) return '';
    const s = ['th', 'st', 'nd', 'rd'];
    const v = pos % 100;
    return pos + (s[(v - 20) % 10] || s[v] || s[0]);
}
function fmt(n, d = 0) { return (n === null || n === undefined || isNaN(n)) ? '—' : Number(n).toFixed(d); }
function fmtPct(n) { return (n === null || n === undefined || isNaN(n)) ? '—' : `${Math.round(n)}%`; }
function getStudentRowBg(student, subjects) {
    if (student.subjectsWithoutScores > 0 && student.subjectsWithoutScores === subjects.length) return '#fde2e2';
    if (student.subjectsWithoutScores > subjects.length / 2) return '#fff3cd';
    return null;
}

// ============================================
// CUSTOM HOOKS
// ============================================
function useAdminClassList(filters) {
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [meta, setMeta] = useState(null);
    const load = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const r = await adminBroadsheetAPI.getClasses({ termId: filters.termId, sessionId: filters.sessionId });
            if (r.success) { setClasses(r.data || []); setMeta(r.meta || null); } else setError(r.message || 'Failed');
        } catch (e) { setError(e.response?.data?.message || e.message || 'Network error'); }
        finally { setLoading(false); }
    }, [filters.termId, filters.sessionId]);
    useEffect(() => { load(); }, [load]);
    return { classes, loading, error, meta, refetch: load };
}

function useAdminBroadsheet(classId, filters) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const load = useCallback(async () => {
        if (!classId) return;
        setLoading(true); setError(null);
        try {
            const r = await adminBroadsheetAPI.getDetailedBroadsheet(classId, { termId: filters.termId, sessionId: filters.sessionId });
            if (r.success) setData(r.data); else setError(r.message || 'Failed');
        } catch (e) { setError(e.response?.data?.message || e.message || 'Network error'); }
        finally { setLoading(false); }
    }, [classId, filters.termId, filters.sessionId]);
    useEffect(() => { load(); }, [load]);
    return { data, loading, error, refetch: load };
}

function useIsMobile(breakpoint = 640) {
    const [isMobile, setIsMobile] = useState(
        typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
    );
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
        const handler = (e) => setIsMobile(e.matches);
        mql.addEventListener('change', handler);
        setIsMobile(mql.matches);
        return () => mql.removeEventListener('change', handler);
    }, [breakpoint]);
    return isMobile;
}

// ============================================
// MOBILE STUDENT CARD
// ============================================
function MobileStudentCard({ student, subjects, index, showAttendance, showComments }) {
    const [expanded, setExpanded] = useState(false);
    const missingBg = getStudentRowBg(student, subjects);
    const borderColor = student.subjectsWithoutScores === subjects.length
        ? '#ef4444'
        : student.subjectsWithoutScores > subjects.length / 2
            ? '#f59e0b'
            : PAL.hdrAccent + '30';

    const posStyle = student.position ? getPositionStyle(student.position) : null;

    return (
        <div
            className="bs-mobile-student-card"
            style={{
                borderLeft: `4px solid ${borderColor}`,
                background: missingBg ? `${missingBg}30` : 'white',
            }}
        >
            <button
                className="bs-mobile-card-header"
                onClick={() => setExpanded(!expanded)}
                type="button"
            >
                <div className="d-flex align-items-center gap-2 flex-grow-1" style={{ minWidth: 0 }}>
                    <span className="bs-mobile-card-sn">{index + 1}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <p className="bs-mobile-card-name mb-0" title={student.studentName}>
                            {student.studentName}
                        </p>
                        <div className="d-flex align-items-center gap-2" style={{ fontSize: '0.6rem', color: '#868e96' }}>
                            <span className="font-monospace">{student.admissionNumber}</span>
                            <span style={{
                                color: student.gender === 'Male' ? '#2563eb' : '#db2777',
                                fontWeight: 700,
                                fontSize: '0.55rem',
                            }}>{student.gender === 'Male' ? 'M' : 'F'}</span>
                        </div>
                    </div>
                </div>
                <div className="d-flex align-items-center gap-2 flex-shrink-0">
                    {student.totalScore > 0 && (
                        <div className="text-end">
                            <p className="bs-mobile-card-total mb-0">{student.totalScore}</p>
                            <p className="mb-0" style={{ fontSize: '0.55rem', color: '#868e96' }}>
                                Avg: {fmt(student.averageScore, 1)}
                            </p>
                        </div>
                    )}
                    {posStyle && (
                        <span className="bs-pos-badge" style={{
                            background: posStyle.bg,
                            color: posStyle.text,
                            border: `1px solid ${posStyle.border}`,
                            fontSize: '0.5rem',
                            minWidth: 28,
                            padding: '2px 4px',
                        }}>
                            {getPositionSuffix(student.position)}
                        </span>
                    )}
                    <div className="bs-mobile-card-chevron" style={{
                        transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}>
                        <Icons.ChevronDown size={14} />
                    </div>
                </div>
            </button>

            {expanded && (
                <div className="bs-mobile-card-body">
                    <div className="bs-mobile-subjects-grid">
                        {subjects.map((subject) => {
                            const score = student.scores?.[subject.subjectId];
                            if (!score) {
                                return (
                                    <div key={subject.subjectId} className="bs-mobile-subject-item bs-mobile-subject-item--empty">
                                        <p className="bs-mobile-subject-name mb-0">{subject.subjectName}</p>
                                        <span className="bs-mobile-subject-dash">—</span>
                                    </div>
                                );
                            }
                            const gc = getGradeColor(score.grade);
                            const totalColor = score.totalScore >= 70 ? '#059669' : score.totalScore >= 50 ? '#212529' : score.totalScore >= 40 ? '#ea580c' : '#dc2626';
                            return (
                                <div key={subject.subjectId} className="bs-mobile-subject-item">
                                    <p className="bs-mobile-subject-name mb-0">{subject.subjectName}</p>
                                    <div className="d-flex align-items-center gap-1.5">
                                        <span className="bs-mobile-subject-total" style={{ color: totalColor }}>
                                            {fmt(score.totalScore)}
                                        </span>
                                        <span className="bs-grade-badge" style={{
                                            background: `${gc.dot}15`,
                                            color: gc.dot,
                                            width: 20, height: 20,
                                            fontSize: '0.5rem',
                                        }}>
                                            {score.grade}
                                        </span>
                                    </div>
                                    {(score.totalCA !== null && score.totalCA !== undefined) && (
                                        <p className="mb-0" style={{ fontSize: '0.5rem', color: '#868e96' }}>
                                            CA: {fmt(score.totalCA)} | EX: {fmt(score.examScore)}
                                        </p>
                                    )}
                                    {score.remark && (
                                        <p className="mb-0 fst-italic" style={{ fontSize: '0.5rem', color: '#6c757d' }}>
                                            {score.remark}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {showAttendance && student.attendance && (
                        <div className="bs-mobile-att-row">
                            <span className="text-body-tertiary" style={{ fontSize: '0.6rem' }}>Attendance:</span>
                            <span className={`fw-semibold ${student.attendance.percentage >= 75 ? 'text-success' : student.attendance.percentage >= 50 ? 'text-warning' : 'text-danger'}`} style={{ fontSize: '0.65rem' }}>
                                {fmtPct(student.attendance.percentage)}
                            </span>
                        </div>
                    )}
                    {showComments && student.classTeacherComment && (
                        <div className="bs-mobile-comment-row">
                            <span className="text-body-tertiary" style={{ fontSize: '0.6rem' }}>Comment:</span>
                            <span style={{ fontSize: '0.6rem', color: '#6c757d' }}>{student.classTeacherComment}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ============================================
// VERTICAL SCROLL CONTROL BAR
// ============================================
function VerticalScrollBar({ scrollRef }) {
    const [scrollTop, setScrollTop] = useState(0);
    const [maxScroll, setMaxScroll] = useState(0);
    const raf = useRef(null);
    const holdRef = useRef(null);

    useEffect(() => {
        const c = scrollRef?.current; if (!c) return;
        const u = () => {
            if (raf.current) cancelAnimationFrame(raf.current);
            raf.current = requestAnimationFrame(() => {
                setScrollTop(c.scrollTop);
                setMaxScroll(c.scrollHeight - c.clientHeight);
            });
        };
        c.addEventListener('scroll', u, { passive: true });
        u();
        const ro = new ResizeObserver(u);
        ro.observe(c);
        return () => {
            c.removeEventListener('scroll', u);
            if (raf.current) cancelAnimationFrame(raf.current);
            ro.disconnect();
            if (holdRef.current) cancelAnimationFrame(holdRef.current);
        };
    }, [scrollRef]);

    const startHold = useCallback((dir) => {
        const step = () => {
            const c = scrollRef?.current;
            if (c) c.scrollBy({ top: dir * 8, behavior: 'auto' });
            holdRef.current = requestAnimationFrame(step);
        };
        holdRef.current = requestAnimationFrame(step);
    }, [scrollRef]);
    const stopHold = useCallback(() => {
        if (holdRef.current) { cancelAnimationFrame(holdRef.current); holdRef.current = null; }
    }, []);
    const jump = useCallback((pos) => {
        const c = scrollRef?.current;
        if (c) c.scrollTo({ top: pos === 'start' ? 0 : maxScroll, behavior: 'smooth' });
    }, [scrollRef, maxScroll]);
    const pct = maxScroll > 0 ? Math.round((scrollTop / maxScroll) * 100) : 0;

    if (maxScroll <= 20) return null;

    const btnStyle = (isEnd) => ({
        fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.04em',
        background: `linear-gradient(135deg, ${isEnd ? PAL.greenDark : PAL.green}, ${PAL.greenLight})`,
        color: 'white', border: `1px solid ${PAL.green}40`,
        boxShadow: `0 2px 10px ${PAL.accentGlow}, inset 0 1px 0 rgba(255,255,255,0.08)`,
        padding: '4px 10px',
    });
    const arrowStyle = {
        width: 40, height: 40,
        background: `linear-gradient(135deg, ${PAL.green}, ${PAL.greenLight})`,
        color: 'white', border: `1px solid ${PAL.green}50`,
        boxShadow: `0 3px 14px ${PAL.accentGlow}, inset 0 1px 0 rgba(255,255,255,0.1)`,
    };

    return (
        <div className="no-print mt-1 mb-1 px-1 px-md-0">
            <div className="d-flex align-items-center gap-2 mb-1.5 d-none d-md-flex">
                <div className="flex-grow-1" style={{ height: 1, background: `linear-gradient(90deg, transparent, ${PAL.green}20, transparent)` }} />
                <span className="d-flex align-items-center gap-1" style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: PAL.greenDark }}>
                    <Icons.ArrowUp size={10} /><Icons.ArrowDown size={10} /> Scroll Up / Down
                </span>
                <div className="flex-grow-1" style={{ height: 1, background: `linear-gradient(90deg, transparent, ${PAL.green}20, transparent)` }} />
            </div>
            <div className="d-flex align-items-center gap-1 gap-md-2">
                <button onClick={() => jump('start')} className="btn btn-sm d-none d-md-flex align-items-center gap-1 rounded-pill" style={btnStyle(true)}>
                    <Icons.ArrowUp size={11} /> Top
                </button>
                <button onMouseDown={() => startHold(-1)} onMouseUp={stopHold} onMouseLeave={stopHold} onTouchStart={() => startHold(-1)} onTouchEnd={stopHold}
                    className="btn d-flex align-items-center justify-content-center rounded-pill" style={arrowStyle}>
                    <Icons.ArrowUp size={18} />
                </button>
                <div className="flex-grow-1 position-relative rounded-pill" style={{ height: 8, background: 'rgba(0,135,81,0.06)', overflow: 'hidden' }}>
                    <div className="position-absolute top-0 start-0 h-100 rounded-pill" style={{ width: `${Math.max(3, pct)}%`, background: `linear-gradient(90deg, ${PAL.green}, ${PAL.greenLight})`, boxShadow: `0 0 10px ${PAL.accentGlow}`, transition: 'width 0.15s' }} />
                    <div className="position-absolute top-50 rounded-circle" style={{ left: `${pct}%`, width: 14, height: 14, transform: 'translate(-50%,-50%)', background: `linear-gradient(135deg, ${PAL.greenLight}, ${PAL.green})`, boxShadow: `0 0 8px ${PAL.accentGlow}, 0 2px 6px rgba(0,0,0,0.15)`, border: '2px solid white', transition: 'left 0.15s' }} />
                </div>
                <span className="font-monospace fw-bold d-none d-md-block" style={{ fontSize: '0.65rem', color: PAL.greenDark, minWidth: 34, textAlign: 'center' }}>{pct}%</span>
                <button onMouseDown={() => startHold(1)} onMouseUp={stopHold} onMouseLeave={stopHold} onTouchStart={() => startHold(1)} onTouchEnd={stopHold}
                    className="btn d-flex align-items-center justify-content-center rounded-pill" style={arrowStyle}>
                    <Icons.ArrowDown size={18} />
                </button>
                <button onClick={() => jump('end')} className="btn btn-sm d-none d-md-flex align-items-center gap-1 rounded-pill" style={btnStyle(false)}>
                    Bottom <Icons.ArrowDown size={11} />
                </button>
            </div>
        </div>
    );
}

// ============================================
// HORIZONTAL SCROLL CONTROL BAR
// ============================================
function HorizontalScrollBar({ scrollRef }) {
    const [sLeft, setSLeft] = useState(0);
    const [maxS, setMaxS] = useState(0);
    const raf = useRef(null);
    const holdRef = useRef(null);

    useEffect(() => {
        const c = scrollRef?.current; if (!c) return;
        const u = () => {
            if (raf.current) cancelAnimationFrame(raf.current);
            raf.current = requestAnimationFrame(() => {
                setSLeft(c.scrollLeft);
                setMaxS(c.scrollWidth - c.clientWidth);
            });
        };
        c.addEventListener('scroll', u, { passive: true }); u();
        const ro = new ResizeObserver(u); ro.observe(c);
        return () => {
            c.removeEventListener('scroll', u);
            if (raf.current) cancelAnimationFrame(raf.current);
            ro.disconnect();
            if (holdRef.current) cancelAnimationFrame(holdRef.current);
        };
    }, [scrollRef]);

    const startHold = useCallback((dir) => {
        const step = () => {
            const c = scrollRef?.current;
            if (c) c.scrollBy({ left: dir * 8, behavior: 'auto' });
            holdRef.current = requestAnimationFrame(step);
        };
        holdRef.current = requestAnimationFrame(step);
    }, [scrollRef]);
    const stopHold = useCallback(() => {
        if (holdRef.current) { cancelAnimationFrame(holdRef.current); holdRef.current = null; }
    }, []);
    const jump = useCallback((pos) => {
        const c = scrollRef?.current;
        if (c) c.scrollTo({ left: pos === 'start' ? 0 : maxS, behavior: 'smooth' });
    }, [scrollRef, maxS]);
    const pct = maxS > 0 ? Math.round((sLeft / maxS) * 100) : 0;

    if (maxS <= 20) return null;

    const btnStyle = (isEnd) => ({
        fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.04em',
        background: `linear-gradient(135deg, ${isEnd ? PAL.hdrDeep : PAL.hdrPrimary}, ${PAL.hdrSecondary})`,
        color: PAL.hdrGold, border: `1px solid ${PAL.hdrAccent}40`,
        boxShadow: `0 2px 10px ${PAL.hdrGlow}, inset 0 1px 0 rgba(255,255,255,0.08)`,
        padding: '4px 10px',
    });
    const arrowStyle = {
        width: 40, height: 40,
        background: `linear-gradient(135deg, ${PAL.hdrPrimary}, ${PAL.hdrSecondary})`,
        color: 'white', border: `1px solid ${PAL.hdrAccent}50`,
        boxShadow: `0 3px 14px ${PAL.hdrGlow}, inset 0 1px 0 rgba(255,255,255,0.1)`,
    };

    return (
        <div className="no-print mt-1 mb-1 px-1 px-md-0">
            <div className="d-flex align-items-center gap-2 mb-1.5 d-none d-md-flex">
                <div className="flex-grow-1" style={{ height: 1, background: `linear-gradient(90deg, transparent, ${PAL.hdrAccent}25, transparent)` }} />
                <span className="d-flex align-items-center gap-1" style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: PAL.hdrSecondary }}>
                    <Icons.DoubleArrow size={11} style={{ color: PAL.hdrAccent }} /> Scroll Left / Right
                </span>
                <div className="flex-grow-1" style={{ height: 1, background: `linear-gradient(90deg, transparent, ${PAL.hdrAccent}25, transparent)` }} />
            </div>
            <div className="d-flex align-items-center gap-1 gap-md-2">
                <button onClick={() => jump('start')} className="btn btn-sm d-none d-md-flex align-items-center gap-1 rounded-pill" style={btnStyle(true)}>
                    <Icons.ChevronLeft size={11} /> Start
                </button>
                <button onMouseDown={() => startHold(-1)} onMouseUp={stopHold} onMouseLeave={stopHold} onTouchStart={() => startHold(-1)} onTouchEnd={stopHold}
                    className="btn d-flex align-items-center justify-content-center rounded-pill" style={arrowStyle}>
                    <Icons.ChevronLeft size={18} />
                </button>
                <div className="flex-grow-1 position-relative rounded-pill" style={{ height: 8, background: 'rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                    <div className="position-absolute top-0 start-0 h-100 rounded-pill" style={{ width: `${Math.max(3, pct)}%`, background: `linear-gradient(90deg, ${PAL.hdrAccent}, ${PAL.hdrGold})`, boxShadow: `0 0 10px ${PAL.hdrGlow}`, transition: 'width 0.15s' }} />
                    <div className="position-absolute top-50 rounded-circle" style={{ left: `${pct}%`, width: 12, height: 12, transform: 'translate(-50%,-50%)', background: `linear-gradient(135deg, ${PAL.hdrGold}, ${PAL.hdrAccent})`, boxShadow: `0 0 8px ${PAL.hdrGoldGlow}, 0 2px 6px rgba(0,0,0,0.15)`, border: '2px solid white', transition: 'left 0.15s' }} />
                </div>
                <span className="font-monospace fw-bold d-none d-md-block" style={{ fontSize: '0.65rem', color: PAL.hdrSecondary, minWidth: 34, textAlign: 'center' }}>{pct}%</span>
                <button onMouseDown={() => startHold(1)} onMouseUp={stopHold} onMouseLeave={stopHold} onTouchStart={() => startHold(1)} onTouchEnd={stopHold}
                    className="btn d-flex align-items-center justify-content-center rounded-pill" style={arrowStyle}>
                    <Icons.ChevronRight size={18} />
                </button>
                <button onClick={() => jump('end')} className="btn btn-sm d-none d-md-flex align-items-center gap-1 rounded-pill" style={btnStyle(false)}>
                    End <Icons.ChevronRight size={11} />
                </button>
            </div>
        </div>
    );
}

// ============================================
// HERO SCHOOL HEADER (Admin variant)
// ============================================
function HeroSchoolHeader({ data }) {
    return (
        <div className="position-relative overflow-hidden rounded-3 rounded-md-4 mb-2 mb-md-3" style={{
            background: `linear-gradient(135deg, ${PAL.hdrDeep} 0%, ${PAL.hdrPrimary} 35%, ${PAL.hdrSecondary} 70%, ${PAL.hdrDeep} 100%)`,
            boxShadow: `0 8px 40px ${PAL.hdrGlow}, 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)`,
        }}>
            <div className="position-absolute top-0 start-0 end-0 bottom-0 overflow-hidden pointer-events-none">
                <div className="w-100 h-100" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)`, backgroundSize: '36px 36px' }} />
                <div className="position-absolute rounded-circle" style={{ top: -60, right: -40, width: 220, height: 220, background: `radial-gradient(circle, ${PAL.hdrGlow} 0%, transparent 70%)`, filter: 'blur(50px)' }} />
                <div className="position-absolute rounded-circle" style={{ bottom: -50, left: -30, width: 160, height: 160, background: `radial-gradient(circle, ${PAL.hdrGoldGlow} 0%, transparent 70%)`, filter: 'blur(40px)' }} />
                <div className="position-absolute top-0 start-0 end-0" style={{ height: 4, background: `linear-gradient(90deg, #008751 0%, #008751 33%, white 33%, white 66%, #008751 66%, #008751 100%)` }} />
                <div className="position-absolute bottom-0 start-0 end-0" style={{ height: 3, background: `linear-gradient(90deg, transparent 5%, ${PAL.hdrGold} 30%, ${PAL.hdrGold} 70%, transparent 95%)`, opacity: 0.6 }} />
            </div>
            <div className="position-relative z-1 text-center px-2 px-sm-3 px-md-4 py-2 py-sm-3 py-md-4">
                <div className="d-flex justify-content-center mb-1.5 mb-md-3">
                    <div className="position-relative">
                        <div className="d-flex align-items-center justify-content-center rounded-3" style={{ width: 40, height: 40, background: `linear-gradient(145deg, rgba(251,191,36,0.15), rgba(99,102,241,0.1))`, border: `1.5px solid ${PAL.hdrGold}50`, boxShadow: `0 0 40px ${PAL.hdrGoldGlow}` }}>
                            <Icons.GraduationCap size={18} style={{ color: PAL.hdrGold }} />
                        </div>
                        <div className="position-absolute d-flex align-items-center justify-content-center rounded-2" style={{ top: -4, right: -6, width: 18, height: 18, background: `linear-gradient(135deg, ${PAL.hdrAccent}, #818cf8)`, boxShadow: `0 2px 8px ${PAL.hdrGlow}`, border: '1.5px solid white' }}>
                            <Icons.Shield size={9} style={{ color: 'white' }} />
                        </div>
                    </div>
                </div>
                <h1 className="fw-black text-uppercase mb-0.5 mb-md-1" style={{ fontFamily: 'Georgia, "Times New Roman", serif', letterSpacing: '0.15em', color: PAL.hdrGold, textShadow: `0 2px 24px ${PAL.hdrGoldGlow}`, fontSize: 'clamp(0.72rem, 3.2vw, 1.3rem)', lineHeight: 1.2 }}>{SCHOOL_INFO.name}</h1>
                <p className="text-uppercase mb-1 d-none d-md-block" style={{ fontSize: '0.68rem', letterSpacing: '0.16em', color: PAL.hdrMuted }}>{SCHOOL_INFO.address}</p>
                <div className="d-inline-flex align-items-center gap-2 px-2.5 py-0.5 rounded-pill mb-1.5 mb-md-3" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.18)' }}>
                    <span className="rounded-circle d-block" style={{ width: 4, height: 4, background: PAL.hdrGold, boxShadow: `0 0 8px ${PAL.hdrGoldGlow}` }} />
                    <p className="fst-italic fw-medium mb-0" style={{ fontSize: 'clamp(0.5rem, 1.5vw, 0.6rem)', color: PAL.hdrGold }}>"{SCHOOL_INFO.motto}"</p>
                    <span className="rounded-circle d-block" style={{ width: 4, height: 4, background: PAL.hdrGold, boxShadow: `0 0 8px ${PAL.hdrGoldGlow}` }} />
                </div>
                <div className="d-inline-block px-3 px-md-4 py-1 py-md-1.5 rounded-3 text-uppercase mb-1.5 mb-md-3" style={{ fontSize: 'clamp(0.55rem, 1.6vw, 0.65rem)', fontWeight: 900, letterSpacing: '0.3em', background: `linear-gradient(135deg, ${PAL.hdrGold}, #f59e0b)`, color: PAL.hdrDeep, boxShadow: `0 6px 24px ${PAL.hdrGoldGlow}` }}>Admin Broadsheet</div>
                {data && (
                    <div className="d-flex flex-wrap justify-content-center gap-1.5 gap-md-3 mt-1 mt-md-2">
                        {[['Class', data.classInfo?.classFullName], ['Teacher', data.classInfo?.classTeacher?.name], ['Term', data.termInfo?.name], ['Session', data.sessionInfo?.name]].map(([label, value]) => (
                            <div key={label} className="d-flex align-items-center gap-1">
                                <span className="rounded-circle d-block" style={{ width: 3, height: 3, background: PAL.hdrGold }} />
                                <span style={{ fontSize: 'clamp(0.52rem, 1.5vw, 0.62rem)', color: PAL.hdrMuted, fontWeight: 600 }}>{label}:</span>
                                <span className="fw-bold" style={{ fontSize: 'clamp(0.6rem, 2.2vw, 0.78rem)', color: '#ffffff', maxWidth: label === 'Class' ? 'none' : '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: label === 'Class' ? 'normal' : 'nowrap' }}>{value || '—'}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function GradingKeyBadge() {
    return (
        <div className="no-print rounded-3 p-2 p-md-3 mb-2 mb-md-3" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.04), rgba(99,102,241,0.01))', border: '1px solid rgba(99,102,241,0.1)' }}>
            <div className="d-flex align-items-center gap-2 mb-1.5 mb-md-2">
                <span className="badge d-flex align-items-center justify-content-center" style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(99,102,241,0.1)', color: PAL.hdrAccent }}><Icons.Award size={10} /></span>
                <span className="text-uppercase fw-bold tracking-wider" style={{ fontSize: 'clamp(0.55rem, 1.5vw, 0.65rem)', color: '#495057' }}>Grading Key</span>
            </div>
            <div className="d-flex flex-wrap gap-1 gap-md-2">
                {GRADING_KEY.map((g) => (
                    <span key={g.grade} className="d-inline-flex align-items-center gap-0.5 px-1.5 px-md-2 py-0.5 py-md-1 rounded-pill" style={{ fontSize: 'clamp(0.55rem, 1.5vw, 0.65rem)', backgroundColor: g.color + '0d', border: `1px solid ${g.color}22` }}>
                        <span className="rounded-circle d-block" style={{ width: 5, height: 5, backgroundColor: g.color, boxShadow: `0 0 6px ${g.color}40` }} />
                        <span className="fw-black" style={{ color: g.color }}>{g.grade}</span>
                        <span className="fw-medium d-none d-sm-inline" style={{ color: g.color + 'aa', fontSize: '0.6rem' }}>{g.range}</span>
                    </span>
                ))}
            </div>
        </div>
    );
}

// ============================================
// ADMIN CLASS SELECTION VIEW
// ============================================
// ============================================
// ADMIN CLASS SELECTION VIEW
// ============================================
// ============================================
// ADMIN CLASS SELECTION VIEW
// ============================================
// ============================================
// ADMIN CLASS SELECTION VIEW
// ============================================
function AdminClassSelectionView({ classes, loading, error, meta, onSelectClass, onRefresh }) {
    const grouped = useMemo(() => {
        const map = {};
        classes.forEach(c => {
            const lvl = c.classLevel || 'Other';
            if (!map[lvl]) map[lvl] = [];
            map[lvl].push(c);
        });
        return Object.entries(map).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
    }, [classes]);

    if (loading) return (
        <div className="d-flex align-items-center justify-content-center py-5">
            <div className="text-center">
                <div className="spinner-border mb-2" role="status" style={{ width: 48, height: 48, color: PAL.hdrAccent }}><span className="visually-hidden">Loading...</span></div>
                <p className="text-body-secondary small">Loading all classes...</p>
            </div>
        </div>
    );
    if (error) return (
        <div className="d-flex flex-column align-items-center justify-content-center py-5 px-3">
            <div className="rounded-circle d-flex align-items-center justify-content-center mb-3" style={{ width: 56, height: 56, background: 'rgba(99,102,241,0.1)' }}><Icons.AlertCircle size={26} className="text-danger" /></div>
            <h3 className="h6 fw-semibold mb-1">Error Loading Classes</h3>
            <p className="text-body-secondary small text-center mb-3" style={{ maxWidth: 400 }}>{error}</p>
            <button onClick={onRefresh} className="btn btn-sm rounded-3 px-4 shadow text-white" style={{ backgroundColor: PAL.hdrPrimary }}>Try Again</button>
        </div>
    );
    if (classes.length === 0) return (
        <div className="d-flex flex-column align-items-center justify-content-center py-5 px-3">
            <div className="rounded-circle d-flex align-items-center justify-content-center mb-3" style={{ width: 56, height: 56, background: 'rgba(99,102,241,0.08)', border: `1px solid ${PAL.hdrAccent}20` }}><Icons.School size={26} style={{ color: PAL.hdrAccent }} /></div>
            <h3 className="h6 fw-semibold mb-1">No Classes Found</h3>
            <p className="text-body-secondary small text-center">No classes found for the selected term/session.</p>
        </div>
    );

    const totalStudents = classes.reduce((s, c) => s + (c.studentCount || 0), 0);
    const totalAssessments = classes.reduce((s, c) => s + (c.assessmentCount || 0), 0);
    const classesWithData = classes.filter(c => c.hasBroadsheetData).length;

    return (
        <div>
            {/* Meta banner */}
            {meta && (
                <div className="alert d-flex align-items-center gap-2 py-2 px-3 rounded-3 mb-3 border-0" style={{ background: `linear-gradient(135deg, rgba(99,102,241,0.06), rgba(99,102,241,0.02))`, border: `1px solid ${PAL.hdrAccent}20 !important`, color: PAL.hdrPrimary, fontSize: '0.52rem' }} role="alert">
                    <Icons.School size={12} style={{ color: PAL.hdrAccent }} />
                    <span className="fw-medium">{classes.length} class{classes.length !== 1 ? 'es' : ''} &bull; <strong>{totalStudents}</strong> students &bull; <strong>{totalAssessments}</strong> assessments &bull; <strong>{meta.termName}</strong> &bull; <strong>{meta.sessionName}</strong></span>
                </div>
            )}

            {/* Summary stats */}
            <div className="row g-2 justify-content-center mb-4" style={{ maxWidth: 480, margin: '0 auto 1rem auto' }}>
                <div className="col-3"><div className="rounded-3 p-1.5 p-sm-2.5 text-center h-100" style={{ background: 'rgba(99,102,241,0.06)', border: `1px solid ${PAL.hdrAccent}15` }}>
                    <p className="text-uppercase fw-bold mb-0 d-none d-sm-block" style={{ fontSize: '0.38rem', letterSpacing: '0.1em', color: PAL.hdrAccent }}>Classes</p>
                    <p className="fw-black mb-0" style={{ color: PAL.hdrPrimary, fontSize: 'clamp(0.8rem, 2.5vw, 1rem)' }}>{classes.length}</p>
                </div></div>
                <div className="col-3"><div className="rounded-3 p-1.5 p-sm-2.5 text-center h-100" style={{ background: PAL.greenGhost, border: `1px solid ${PAL.green}15` }}>
                    <p className="text-uppercase fw-bold mb-0 d-none d-sm-block" style={{ fontSize: '0.38rem', letterSpacing: '0.1em', color: PAL.green }}>Students</p>
                    <p className="fw-black mb-0" style={{ color: PAL.greenDark, fontSize: 'clamp(0.8rem, 2.5vw, 1rem)' }}>{totalStudents}</p>
                </div></div>
                <div className="col-3"><div className="rounded-3 p-1.5 p-sm-2.5 text-center h-100 bg-primary-subtle border border-primary border-opacity-10">
                    <p className="text-uppercase fw-bold mb-0 d-none d-sm-block text-primary" style={{ fontSize: '0.38rem', letterSpacing: '0.1em' }}>Ready</p>
                    <p className="fw-black text-primary mb-0" style={{ fontSize: 'clamp(0.8rem, 2.5vw, 1rem)' }}>{classesWithData}</p>
                </div></div>
                <div className="col-3"><div className="rounded-3 p-1.5 p-sm-2.5 text-center h-100 bg-warning-subtle border border-warning border-opacity-10">
                    <p className="text-uppercase fw-bold mb-0 d-none d-sm-block text-warning" style={{ fontSize: '0.38rem', letterSpacing: '0.1em' }}>Pending</p>
                    <p className="fw-black text-warning mb-0" style={{ fontSize: 'clamp(0.8rem, 2.5vw, 1rem)' }}>{classes.length - classesWithData}</p>
                </div></div>
            </div>

            {/* Grouped class cards */}
            {grouped.map(([level, cls]) => (
                <div key={level} className="mb-4">
                    {/* Level heading */}
                    <div className="d-flex align-items-center gap-2 mb-2 px-1">
                        <div className="d-flex align-items-center justify-content-center rounded-2 flex-shrink-0" style={{ width: 20, height: 20, background: `linear-gradient(135deg, ${PAL.hdrPrimary}, ${PAL.hdrSecondary})` }}>
                            <Icons.Grid size={9} style={{ color: 'white' }} />
                        </div>
                        <h3 className="fw-bold mb-0" style={{ fontSize: '0.56rem', color: PAL.hdrPrimary }}>{level}</h3>
                        <div className="flex-grow-1" style={{ height: 1, background: `linear-gradient(90deg, ${PAL.hdrAccent}15, transparent)` }} />
                        <span className="badge rounded-pill flex-shrink-0" style={{ fontSize: '0.38rem', fontWeight: 700, background: `${PAL.hdrAccent}10`, color: PAL.hdrAccent }}>{cls.length}</span>
                    </div>

                    {/* 
                        Responsive grid:
                        Mobile (<576px):  2 columns
                        Tablet (576-767): 2 columns  
                        Small desktop (768-991): 3 columns
                        Desktop (992-1199): 4 columns
                        Large (1200+): 4 columns
                    */}
                    <div className="row g-2 g-sm-2.5 g-md-3">
                        {cls.map((c) => (
                            <div key={c.classId} className="col-6 col-sm-6 col-md-4 col-lg-3 col-xl-3">
                                <button
                                    onClick={() => onSelectClass(c.classId)}
                                    className="btn w-100 text-start p-2 p-sm-2.5 p-md-3 rounded-3 border border-opacity-10 h-100 transition-all d-flex flex-column"
                                    style={{
                                        background: 'white',
                                        borderColor: '#dee2e6',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.borderColor = `${PAL.hdrAccent}40`;
                                        e.currentTarget.style.boxShadow = `0 6px 24px ${PAL.accentGlow}`;
                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.borderColor = '#dee2e6';
                                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }}
                                >
                                    {/* Card title row */}
                                    <div className="d-flex align-items-start justify-content-between mb-1.5 mb-sm-2">
                                        <div style={{ minWidth: 0, flex: 1, marginRight: 4 }}>
                                            <h4 className="fw-bold mb-0" style={{
                                                fontSize: 'clamp(0.62rem, 2.2vw, 0.82rem)',
                                                color: '#1e1b4b',
                                                lineHeight: 1.2,
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden',
                                            }}>
                                                {c.className}
                                            </h4>
                                            <p className="mb-0 mt-0.5 d-none d-sm-block" style={{ fontSize: 'clamp(0.45rem, 1.2vw, 0.52rem)', color: '#6b7294' }}>
                                                {c.classSection ? `${c.classLevel} (${c.classSection})` : c.classLevel}
                                            </p>
                                        </div>
                                        <span className={`d-flex align-items-center justify-content-center rounded-2 flex-shrink-0 ${c.hasBroadsheetData ? 'text-success' : 'text-body-tertiary'}`} style={{ width: 22, height: 22, background: c.hasBroadsheetData ? 'rgba(5,150,105,0.08)' : 'rgba(0,0,0,0.03)' }}>
                                            <Icons.ChevronRight size={9} />
                                        </span>
                                    </div>

                                    {/* Mini stat boxes - hidden on very small mobile, shown on sm+ */}
                                    <div className="row g-1.5 mb-1.5 mb-sm-2 d-none d-sm-flex">
                                        <div className="col-6">
                                            <div className="rounded-2 p-1.5 text-center" style={{ background: PAL.greenGhost, border: `1px solid ${PAL.green}12` }}>
                                                <p className="text-uppercase fw-bold mb-0" style={{ fontSize: '0.32rem', letterSpacing: '0.06em', color: PAL.green }}>Students</p>
                                                <p className="fw-black mb-0" style={{ fontSize: 'clamp(0.68rem, 1.8vw, 0.85rem)', color: PAL.greenDark }}>{c.studentCount}</p>
                                            </div>
                                        </div>
                                        <div className="col-6">
                                            <div className="rounded-2 p-1.5 text-center bg-primary-subtle border border-primary border-opacity-10">
                                                <p className="text-uppercase fw-bold mb-0 text-primary" style={{ fontSize: '0.32rem', letterSpacing: '0.06em' }}>CAs</p>
                                                <p className="fw-black text-primary mb-0" style={{ fontSize: 'clamp(0.68rem, 1.8vw, 0.85rem)' }}>{c.assessmentCount}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Inline stats for mobile - shown only on xs */}
                                    <div className="d-flex d-sm-none align-items-center gap-2 mb-1.5" style={{ fontSize: '0.5rem' }}>
                                        <span className="d-flex align-items-center gap-0.5" style={{ color: PAL.greenDark }}>
                                            <Icons.Users size={8} style={{ color: PAL.green }} />
                                            <strong>{c.studentCount}</strong>
                                        </span>
                                        <span className="text-body-tertiary" style={{ fontSize: '0.4rem' }}>•</span>
                                        <span className="d-flex align-items-center gap-0.5 text-primary">
                                            <Icons.FileText size={8} />
                                            <strong>{c.assessmentCount}</strong>
                                        </span>
                                    </div>

                                    {/* Spacer to push status to bottom */}
                                    <div className="flex-grow-1" />

                                    {/* Status + progress */}
                                    <div className="d-flex align-items-center gap-1.5 mt-1">
                                        <span className={`badge d-inline-flex align-items-center gap-0.5 flex-shrink-0 ${c.hasBroadsheetData ? 'bg-success-subtle text-success border border-success border-opacity-25' : 'bg-body-tertiary text-body-tertiary border border-opacity-10'}`} style={{ fontWeight: 600, fontSize: '0.38rem', padding: '2px 5px' }}>
                                            <Icons.BarChart size={6} />
                                            {c.hasBroadsheetData ? 'Ready' : 'Pending'}
                                        </span>
                                        {c.completionPercentage > 0 && (
                                            <div className="d-flex align-items-center gap-1 flex-grow-1" style={{ minWidth: 0 }}>
                                                <div className="progress flex-grow-1" style={{ height: 3 }}>
                                                    <div className={`progress-bar ${c.completionPercentage === 100 ? 'bg-success' : c.completionPercentage >= 50 ? 'bg-warning' : 'bg-danger'}`} style={{ width: `${c.completionPercentage}%` }} />
                                                </div>
                                                <span className="text-body-tertiary flex-shrink-0" style={{ fontSize: '0.34rem' }}>{c.completionPercentage}%</span>
                                            </div>
                                        )}
                                    </div>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
function CompactStatsBar({ statistics, attendance }) {
    if (!statistics) return null;
    const stats = [
        { icon: <Icons.Users size={14} style={{ color: PAL.hdrAccent }} />, label: 'Students', value: statistics.totalStudents, sub: `${statistics.assessedStudents} assessed` },
        { icon: <Icons.TrendingUp size={14} className="text-success" />, label: 'Average', value: fmt(statistics.classAverage, 1) },
        { icon: <Icons.BarChart size={14} className="text-primary" />, label: 'High / Low', value: `${statistics.highestTotal}`, sub: `${statistics.lowestTotal}` },
        { icon: <Icons.Award size={14} className={statistics.passRate >= 70 ? 'text-success' : statistics.passRate >= 50 ? 'text-warning' : 'text-danger'} />, label: 'Pass Rate', value: fmtPct(statistics.passRate) },
    ];
    if (attendance?.schoolOpenDays > 0) stats.push({ icon: <Icons.ClipboardCheck size={14} className="text-info" />, label: 'Days', value: attendance.schoolOpenDays });
    return (
        <div className="no-print row g-1.5 g-md-2 mb-2 mb-md-3">
            {stats.map((s, i) => (
                <div key={i} className="col-6 col-sm col-lg">
                    <div className="card border border-opacity-10 h-100" style={{ borderColor: '#dee2e6', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', borderTop: `3px solid ${PAL.hdrAccent}` }}>
                        <div className="card-body p-1.5 p-md-2">
                            <div className="d-flex align-items-center gap-1 mb-0.5">{s.icon}<span className="text-uppercase fw-medium tracking-wider d-none d-sm-inline" style={{ fontSize: '0.58rem', color: '#868e96' }}>{s.label}</span><span className="text-uppercase fw-medium tracking-wider d-sm-none" style={{ fontSize: '0.5rem', color: '#868e96' }}>{s.label}</span></div>
                            <p className="fw-black mb-0" style={{ fontSize: 'clamp(0.85rem, 2.2vw, 1.3rem)' }}>{s.value}</p>
                            {s.sub && <p className="text-success fw-medium mb-0 d-none d-md-block" style={{ fontSize: '0.62rem' }}>{s.sub}</p>}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function MissingScoresAlert({ statistics }) {
    if (!statistics || statistics.notAssessedStudents === 0) return null;
    return (<div className="no-print alert alert-warning d-flex align-items-center gap-2 py-2 px-3 rounded-3 mb-2 border-0" style={{ fontSize: '0.75rem' }} role="alert"><Icons.AlertTriangle size={14} className="text-warning flex-shrink-0" /><span className="fw-medium"><strong>{statistics.notAssessedStudents}</strong> student{statistics.notAssessedStudents !== 1 ? 's' : ''} have no approved scores</span></div>);
}

function StudentSearchBar({ count, onSearch, searchTerm }) {
    return (
        <div className="position-relative no-print">
            <Icons.Search size={14} className="position-absolute top-50 translate-middle-y text-body-tertiary" style={{ left: 12 }} />
            <input type="text" placeholder={`Search ${count}...`} value={searchTerm} onChange={(e) => onSearch(e.target.value)} className="form-control form-control-sm rounded-3 ps-5 pe-5 py-2" style={{ fontSize: '0.75rem', border: '1px solid #dee2e6' }} />
            {searchTerm && (<button onClick={() => onSearch('')} className="position-absolute top-50 translate-middle-y btn btn-sm p-0 text-body-tertiary rounded-2" style={{ right: 8 }}><Icons.X size={11} /></button>)}
        </div>
    );
}

// ============================================
// BROADSHEET TABLE
// ============================================
function BroadsheetTable({ data, viewMode, showAttendance, showComments, searchTerm, onSearchChange, isFullscreen, scrollRef, isMobile }) {
    const [scrollState, setScrollState] = useState({ left: 0, maxLeft: 0, top: 0, maxTop: 0 });

    const subCols = useMemo(() => {
        if (viewMode === VIEW_MODES.GRADE_ONLY) return SUB_COLS_GRADE_ONLY;
        if (viewMode === VIEW_MODES.COMPACT) return SUB_COLS_COMPACT;
        return SUB_COLS_DETAILED;
    }, [viewMode]);

    const statRows = useMemo(() => [
        { label: 'AVERAGE', key: 'averageScore', fmt: v => fmt(v, 1) },
        { label: 'HIGHEST', key: 'highestScore', fmt: v => fmt(v) },
        { label: 'LOWEST', key: 'lowestScore', fmt: v => fmt(v) },
        { label: 'PASSED', key: 'passCount', fmt: v => v },
        { label: 'FAILED', key: 'failCount', fmt: v => v },
        { label: '% PASS', key: 'passRate', fmt: v => fmtPct(v) },
    ], []);

    const filteredStudents = useMemo(() => {
        if (!searchTerm) return data?.students || [];
        const t = searchTerm.toLowerCase();
        return (data?.students || []).filter(s => s.studentName?.toLowerCase().includes(t) || s.admissionNumber?.toLowerCase().includes(t) || s.firstName?.toLowerCase().includes(t) || s.lastName?.toLowerCase().includes(t));
    }, [data?.students, searchTerm]);

    useEffect(() => {
        const c = scrollRef?.current; if (!c) return;
        let rafId;
        const update = () => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                setScrollState({
                    left: c.scrollLeft,
                    maxLeft: c.scrollWidth - c.clientWidth,
                    top: c.scrollTop,
                    maxTop: c.scrollHeight - c.clientHeight,
                });
            });
        };
        c.addEventListener('scroll', update, { passive: true });
        const ro = new ResizeObserver(update);
        ro.observe(c);
        update();
        return () => {
            c.removeEventListener('scroll', update);
            cancelAnimationFrame(rafId);
            ro.disconnect();
        };
    }, [scrollRef]);

    if (viewMode === VIEW_MODES.CARDS) return null;
    if (!data) return null;

    const { subjects, subjectStats, statistics, attendance } = data;
    const students = filteredStudents;
    const colSpan = subCols.length;

    const extraCols = [];
    if (showAttendance && attendance) extraCols.push({ key: 'attendance', label: 'Att', width: 44 });
    if (showComments) extraCols.push({ key: 'comment', label: 'CT Comment', width: 140 });
    const extraW = extraCols.reduce((s, c) => s + c.width, 0);

    const getScore = (student, subjectId, key) => student.scores?.[subjectId]?.[key] || null;

    const stickyCols = isMobile ? STICKY_COLS_MOBILE : STICKY_COLS;
    const stickyTotalW = isMobile ? STICKY_TOTAL_W_MOBILE : STICKY_TOTAL_W;
    const showGender = !isMobile;

    const subGroupW = subCols.reduce((s, c) => s + c.width, 0);
    const genderW = showGender ? stickyCols.gender.width : 0;
    const totalMinW = stickyTotalW + genderW + subjects.length * subGroupW + extraW + 148;

    const maxH = isFullscreen
        ? 'calc(100vh - 180px)'
        : isMobile
            ? 'clamp(240px, 50vh, 400px)'
            : 'clamp(280px, calc(100vh - 340px), 720px)';

    const H1 = '#1e1b4b', H2 = '#312e81', SH1 = '#1a1845', SH2 = '#15133a';
    const GOLD = PAL.hdrGold, ACCENT = PAL.hdrAccent;

    const cellPad = isMobile ? '4px 3px' : '5px 4px';
    const hdrPad = isMobile ? '5px 3px' : '6px 4px';
    const subPad = isMobile ? '3px 2px' : '4px 2px';

    const totalCols = (showGender ? 4 : 3) + subjects.length * colSpan + extraCols.length + 3;

    const showLeftShadow = scrollState.left > 5;
    const showRightShadow = scrollState.left < scrollState.maxLeft - 5;

    return (
        <div className="card border overflow-hidden rounded-3 rounded-md-4" style={{ borderColor: '#dee2e6', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <div className="card-body p-2 p-md-3 pb-2 border-bottom" style={{ borderColor: '#f1f5f9' }}>
                <div className="d-flex align-items-center gap-2">
                    <div className="flex-grow-1"><StudentSearchBar count={data.students?.length || 0} onSearch={onSearchChange} searchTerm={searchTerm} /></div>
                    {searchTerm && <span className="badge bg-body-tertiary text-body-secondary flex-shrink-0" style={{ fontSize: '0.65rem' }}><span className="fw-bold text-dark">{students.length}</span>/{data.students?.length}</span>}
                </div>
            </div>

            <div className="position-relative">
                <div className="position-absolute top-0 bottom-0 z-2 no-print" style={{ left: 0, width: 18, background: 'linear-gradient(to right, rgba(0,0,0,0.08), transparent)', pointerEvents: 'none', opacity: showLeftShadow ? 1 : 0, transition: 'opacity 0.3s' }} />
                <div className="position-absolute top-0 bottom-0 z-2 no-print" style={{ right: 0, width: 18, background: 'linear-gradient(to left, rgba(0,0,0,0.08), transparent)', pointerEvents: 'none', opacity: showRightShadow ? 1 : 0, transition: 'opacity 0.3s' }} />

                <div ref={scrollRef} className="broadsheet-scroll overflow-auto" style={{ maxHeight: maxH, WebkitOverflowScrolling: 'touch' }}>
                    <table className="broadsheet-table table table-sm table-bordered mb-0" style={{ width: totalMinW, tableLayout: 'fixed', fontSize: isMobile ? '0.65rem' : '0.72rem', borderCollapse: 'separate', borderSpacing: 0 }}>
                        <colgroup>
                            <col style={{ width: stickyCols.sn.width }} />
                            <col style={{ width: stickyCols.admNo.width }} />
                            <col style={{ width: stickyCols.name.width }} />
                            {showGender && <col style={{ width: stickyCols.gender.width }} />}
                            {subjects.map((_, i) => subCols.map((c) => <col key={`cg-${i}-${c.key}`} style={{ width: isMobile ? c.width - 2 : c.width }} />))}
                            {extraCols.map(c => <col key={`cg-${c.key}`} style={{ width: c.width }} />)}
                            <col style={{ width: isMobile ? 44 : 52 }} />
                            <col style={{ width: isMobile ? 38 : 44 }} />
                            <col style={{ width: isMobile ? 44 : 52 }} />
                        </colgroup>

                        <thead>
                            <tr>
                                <th rowSpan="2" className="sticky-col text-center fw-bold text-uppercase align-middle" style={{ left: stickyCols.sn.left, backgroundColor: '#15133a', color: GOLD, fontSize: isMobile ? '0.5rem' : '0.58rem', padding: hdrPad, borderRight: `2px solid ${ACCENT}50`, borderBottom: `1px solid ${ACCENT}30`, letterSpacing: '0.05em' }}>S/N</th>
                                <th rowSpan="2" className="sticky-col text-center fw-bold text-uppercase align-middle" style={{ left: stickyCols.admNo.left, backgroundColor: '#0f0d2e', color: GOLD, fontSize: isMobile ? '0.48rem' : '0.55rem', padding: hdrPad, borderRight: `1px solid ${ACCENT}40`, borderBottom: `1px solid ${ACCENT}30`, letterSpacing: '0.05em' }}>Adm</th>
                                <th rowSpan="2" className="sticky-col text-start fw-bold text-uppercase align-middle" style={{ left: stickyCols.name.left, backgroundColor: '#15133a', color: GOLD, fontSize: isMobile ? '0.5rem' : '0.58rem', padding: hdrPad, borderRight: `1px solid ${ACCENT}40`, borderBottom: `1px solid ${ACCENT}30`, letterSpacing: '0.05em' }}>Name</th>
                                {showGender && <th rowSpan="2" className="sticky-col text-center fw-bold text-uppercase align-middle" style={{ left: stickyCols.gender.left, backgroundColor: '#0c0a25', color: GOLD, fontSize: isMobile ? '0.5rem' : '0.58rem', padding: hdrPad, borderRight: `3px solid ${ACCENT}`, borderBottom: `1px solid ${ACCENT}30`, letterSpacing: '0.05em' }}>M/F</th>}

                                {subjects.map((subject, idx) => (
                                    <th key={subject.subjectId} colSpan={colSpan} className="text-center fw-semibold text-white align-middle" style={{
                                        backgroundColor: idx % 2 === 0 ? H1 : H2,
                                        padding: hdrPad,
                                        borderRight: '1px solid rgba(255,255,255,0.08)',
                                        borderBottom: `2px solid ${ACCENT}60`,
                                        whiteSpace: 'nowrap',
                                        fontSize: isMobile ? '0.55rem' : '0.65rem',
                                        textShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }} title={subject.subjectName}>
                                        {subject.subjectName}
                                    </th>
                                ))}

                                {extraCols.map(col => (
                                    <th key={`th-${col.key}`} rowSpan="2" className="text-center fw-semibold text-uppercase align-middle" style={{ backgroundColor: '#0f0d2e', color: GOLD, fontSize: '0.55rem', padding: hdrPad, borderRight: '1px solid rgba(255,255,255,0.06)', borderBottom: `1px solid ${ACCENT}30`, letterSpacing: '0.05em' }}>{col.label}</th>
                                ))}
                                <th rowSpan="2" className="text-center fw-black text-uppercase align-middle" style={{ backgroundColor: '#15133a', color: 'white', fontSize: isMobile ? '0.5rem' : '0.58rem', padding: hdrPad, borderRight: '1px solid rgba(255,255,255,0.06)', borderBottom: `1px solid ${ACCENT}30`, letterSpacing: '0.05em' }}>Total</th>
                                <th rowSpan="2" className="text-center fw-bold text-uppercase align-middle" style={{ backgroundColor: '#0f0d2e', color: GOLD, fontSize: isMobile ? '0.48rem' : '0.55rem', padding: hdrPad, borderRight: '1px solid rgba(255,255,255,0.06)', borderBottom: `1px solid ${ACCENT}30`, letterSpacing: '0.05em' }}>Avg</th>
                                <th rowSpan="2" className="text-center fw-black text-uppercase align-middle" style={{ backgroundColor: '#15133a', color: GOLD, fontSize: isMobile ? '0.5rem' : '0.58rem', padding: hdrPad, borderBottom: `1px solid ${ACCENT}30`, letterSpacing: '0.05em' }}>Pos</th>
                            </tr>

                            <tr>
                                {subjects.map((_, sIdx) => subCols.map((col) => (
                                    <th key={`sh-${sIdx}-${col.key}`} className="text-center fw-medium text-uppercase" style={{
                                        width: isMobile ? col.width - 2 : col.width,
                                        backgroundColor: sIdx % 2 === 0 ? SH1 : SH2,
                                        color: 'rgba(255,255,255,0.5)',
                                        fontSize: '0.5rem',
                                        padding: subPad,
                                        borderRight: '1px solid rgba(255,255,255,0.05)',
                                        borderBottom: `2px solid ${ACCENT}`,
                                        letterSpacing: '0.06em',
                                    }}>{col.label}</th>
                                )))}
                            </tr>
                        </thead>

                        <tbody>
                            {students.length === 0 && searchTerm && (
                                <tr><td colSpan={totalCols} className="text-center py-5"><div className="text-body-tertiary mb-2"><Icons.Search size={24} className="mx-auto d-block" /></div><p className="text-body-tertiary small">No students match "{searchTerm}"</p></td></tr>
                            )}

                            {students.map((student, sIdx) => {
                                const isEven = sIdx % 2 === 0;
                                const missingBg = getStudentRowBg(student, subjects);
                                const rowBg = missingBg || (isEven ? '#ffffff' : '#f8f9fb');
                                return (
                                    <tr key={student.studentId} style={{ backgroundColor: rowBg }}
                                        onMouseEnter={e => { if (!missingBg) e.currentTarget.style.backgroundColor = '#ede9fe20'; }}
                                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = rowBg; }}>

                                        <td className="sticky-col text-center text-body-tertiary font-monospace" style={{ left: stickyCols.sn.left, backgroundColor: rowBg, fontSize: '0.6rem', padding: cellPad, borderRight: `1px solid ${ACCENT}12` }}>{sIdx + 1}</td>
                                        <td className="sticky-col text-center text-body-secondary font-monospace" style={{ left: stickyCols.admNo.left, backgroundColor: rowBg, fontSize: isMobile ? '0.52rem' : '0.58rem', padding: cellPad, borderRight: `1px solid ${ACCENT}12` }}>{student.admissionNumber}</td>
                                        <td className="sticky-col text-start fw-medium text-dark text-nowrap" style={{ left: stickyCols.name.left, backgroundColor: rowBg, fontSize: isMobile ? '0.62rem' : '0.68rem', padding: cellPad, borderRight: `1px solid ${ACCENT}12`, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            <span className="d-flex align-items-center gap-1.5">
                                                {student.subjectsWithoutScores > 0 && <span className="rounded-circle d-block flex-shrink-0" style={{ width: 6, height: 6, backgroundColor: student.subjectsWithoutScores === subjects.length ? '#ef4444' : '#f59e0b' }} />}
                                                <span title={student.studentName}>{student.studentName}</span>
                                            </span>
                                        </td>
                                        {showGender && <td className="sticky-col text-center fw-bold" style={{ left: stickyCols.gender.left, backgroundColor: isEven ? '#f3f4f6' : '#ebedf0', fontSize: '0.63rem', padding: cellPad, borderRight: `3px solid ${ACCENT}25`, color: student.gender === 'Male' ? '#2563eb' : '#db2777' }}>{student.gender === 'Male' ? 'M' : 'F'}</td>}

                                        {subjects.map((subject) => subCols.map((col) => {
                                            const val = getScore(student, subject.subjectId, col.key);
                                            const isGrade = col.key === 'grade';
                                            const isRemark = col.key === 'remark';
                                            const borderR = col === subCols[subCols.length - 1] ? `1px solid #e9ecef` : '1px solid #f1f3f5';

                                            if (val === null || val === undefined || (val === 0 && !isGrade))
                                                return <td key={`td-${subject.subjectId}-${col.key}`} className="text-center text-body-tertiary" style={{ fontSize: '0.6rem', padding: cellPad, borderRight: borderR }}>–</td>;
                                            if (isGrade) {
                                                const gc = getGradeColor(val);
                                                return <td key={`td-${subject.subjectId}-${col.key}`} className="text-center" style={{ fontSize: '0.6rem', padding: cellPad, borderRight: borderR }}><span className={`badge ${gc.bg} ${gc.text} rounded-2 d-inline-flex align-items-center justify-content-center`} style={{ width: isMobile ? 20 : 22, height: isMobile ? 20 : 22, fontSize: '0.5rem', fontWeight: 900, padding: 0 }}>{val}</span></td>;
                                            }
                                            if (isRemark)
                                                return <td key={`td-${subject.subjectId}-${col.key}`} className="text-center text-secondary fst-italic" style={{ fontSize: '0.5rem', padding: cellPad, borderRight: borderR }} title={val}>{val ? val.substring(0, 3) : ''}</td>;
                                            const sc = getScoreColor(col.key, val);
                                            return <td key={`td-${subject.subjectId}-${col.key}`} className={`text-center ${sc || ''}`} style={{ fontSize: '0.6rem', padding: cellPad, borderRight: borderR }}>{fmt(val)}</td>;
                                        }))}

                                        {showAttendance && attendance && (
                                            <td className="text-center" style={{ fontSize: '0.6rem', padding: cellPad, backgroundColor: '#eef2ff', borderRight: '1px solid #e9ecef' }}>
                                                {student.attendance ? <span className={`fw-semibold ${student.attendance.percentage >= 75 ? 'text-success' : student.attendance.percentage >= 50 ? 'text-warning' : 'text-danger'}`}>{fmtPct(student.attendance.percentage)}</span> : <span className="text-body-tertiary">—</span>}
                                            </td>
                                        )}
                                        {showComments && (
                                            <td className="text-start text-secondary text-truncate" style={{ fontSize: '0.54rem', padding: cellPad, maxWidth: 140, backgroundColor: '#eef2ff', borderRight: '1px solid #e9ecef' }} title={student.classTeacherComment || 'No comment'}>{student.classTeacherComment || <span className="text-body-tertiary fst-italic">—</span>}</td>
                                        )}

                                        <td className="text-center fw-black text-dark" style={{ fontSize: isMobile ? '0.68rem' : '0.73rem', padding: cellPad, backgroundColor: `${ACCENT}08`, borderRight: '1px solid #e9ecef', borderTop: '1px solid #f1f3f5' }}>{student.totalScore > 0 ? student.totalScore : <span className="text-body-tertiary">—</span>}</td>
                                        <td className="text-center fw-semibold" style={{ fontSize: '0.6rem', padding: cellPad, backgroundColor: `${ACCENT}08`, borderRight: '1px solid #e9ecef', borderTop: '1px solid #f1f3f5' }}>{student.averageScore > 0 ? fmt(student.averageScore, 1) : <span className="text-body-tertiary">—</span>}</td>
                                        <td className="text-center" style={{ padding: cellPad, backgroundColor: `${ACCENT}08`, borderTop: '1px solid #f1f3f5' }}>
                                            {student.position ? (() => { const ps = getPositionStyle(student.position); return <span className="badge rounded-pill d-inline-flex align-items-center justify-content-center" style={{ background: ps.bg, color: ps.text, border: `1px solid ${ps.border}`, fontSize: '0.5rem', fontWeight: 700, minWidth: isMobile ? 26 : 30, padding: '2px 4px' }}>{getPositionSuffix(student.position)}</span>; })() : <span className="text-body-tertiary" style={{ fontSize: '0.6rem' }}>—</span>}
                                        </td>
                                    </tr>
                                );
                            })}

                            {subjectStats && statRows.map((stat, srIdx) => {
                                const isLight = srIdx % 2 === 0;
                                const sBg = isLight ? '#eef2ff' : '#e0e7ff';
                                const isLast = stat.key === 'passRate';
                                const statColSpan = showGender ? 4 : 3;
                                return (
                                    <tr key={`stat-${stat.key}`} style={{ backgroundColor: sBg }}>
                                        <td colSpan={statColSpan} className="sticky-col text-start text-uppercase fw-black" style={{ left: 0, minWidth: stickyTotalW + genderW, backgroundColor: sBg, fontSize: '0.5rem', letterSpacing: '0.1em', color: PAL.hdrSecondary, padding: cellPad, borderRight: `3px solid ${ACCENT}35`, borderTop: isLast ? `2px solid ${ACCENT}` : '1px solid #e9ecef' }}>{stat.label}</td>
                                        {subjects.map((subject) => {
                                            const sStat = subjectStats.find((s) => s.subjectId === subject.subjectId);
                                            const val = sStat?.[stat.key];
                                            return subCols.map((col) => {
                                                const show = col.key === stat.key || (col.key === 'totalScore' && stat.key === 'averageScore');
                                                return <td key={`stat-${subject.subjectId}-${stat.key}-${col.key}`} className={`text-center ${show ? 'text-dark fw-bold' : ''}`} style={{ fontSize: '0.5rem', backgroundColor: sBg, padding: cellPad, borderTop: isLast ? `2px solid ${ACCENT}` : '1px solid #e9ecef' }}>{show && val !== undefined && val !== null ? stat.fmt(val) : ''}</td>;
                                            });
                                        })}
                                        {showAttendance && attendance && <td style={{ backgroundColor: sBg, borderTop: isLast ? `2px solid ${ACCENT}` : '1px solid #e9ecef' }} />}
                                        {showComments && <td style={{ backgroundColor: sBg, borderTop: isLast ? `2px solid ${ACCENT}` : '1px solid #e9ecef' }} />}
                                        <td className="text-center text-dark fw-bold" style={{ fontSize: '0.5rem', backgroundColor: `${ACCENT}08`, padding: cellPad, borderTop: isLast ? `2px solid ${ACCENT}` : '1px solid #e9ecef' }}>{stat.key === 'averageScore' ? fmt(statistics?.classAverage, 1) : stat.key === 'highestScore' ? statistics?.highestTotal : stat.key === 'lowestScore' ? statistics?.lowestTotal : ''}</td>
                                        <td className="text-center text-dark fw-bold" style={{ fontSize: '0.5rem', backgroundColor: `${ACCENT}08`, padding: cellPad, borderTop: isLast ? `2px solid ${ACCENT}` : '1px solid #e9ecef' }}>{stat.key === 'averageScore' ? fmt(statistics?.classAverage, 1) : ''}</td>
                                        <td style={{ backgroundColor: `${ACCENT}08`, borderTop: isLast ? `2px solid ${ACCENT}` : '1px solid #e9ecef' }} />
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="print-only border-top border-2 border-dark px-3 py-2">
                <div className="d-flex flex-wrap gap-3 justify-content-center" style={{ fontSize: '0.55rem', color: '#495057' }}>
                    <span className="fw-bold text-uppercase">Grading:</span>
                    {GRADING_KEY.map((g) => (<span key={g.grade} style={{ display: 'inline' }}><strong>{g.grade}</strong>({g.range})</span>))}
                    <span className="text-body-tertiary">|</span>
                    <span><strong>T</strong>=Test <strong>NT</strong>=Notes <strong>AS</strong>=Assign <strong>CA</strong>=Total CA <strong>EX</strong>=Exam <strong>Tot</strong>=Total <strong>G</strong>=Grade <strong>R</strong>=Remark</span>
                </div>
            </div>
        </div>
    );
}

// ============================================
// MOBILE CARDS VIEW
// ============================================
function MobileCardsView({ data, searchTerm, onSearchChange, showAttendance, showComments }) {
    const filteredStudents = useMemo(() => {
        if (!searchTerm) return data?.students || [];
        const t = searchTerm.toLowerCase();
        return (data?.students || []).filter(s => s.studentName?.toLowerCase().includes(t) || s.admissionNumber?.toLowerCase().includes(t) || s.firstName?.toLowerCase().includes(t) || s.lastName?.toLowerCase().includes(t));
    }, [data?.students, searchTerm]);

    return (
        <div className="card border overflow-hidden rounded-3" style={{ borderColor: '#dee2e6', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <div className="card-body p-2 pb-0 border-bottom" style={{ borderColor: '#f1f5f9' }}>
                <div className="d-flex align-items-center gap-2 mb-2">
                    <div className="flex-grow-1"><StudentSearchBar count={data.students?.length || 0} onSearch={onSearchChange} searchTerm={searchTerm} /></div>
                    {searchTerm && <span className="badge bg-body-tertiary text-body-secondary flex-shrink-0" style={{ fontSize: '0.65rem' }}><span className="fw-bold text-dark">{filteredStudents.length}</span>/{data.students?.length}</span>}
                </div>
            </div>

            <div className="p-2" style={{ maxHeight: 'clamp(300px, 60vh, 600px)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
                {filteredStudents.length === 0 && searchTerm && (
                    <div className="text-center py-4">
                        <Icons.Search size={24} className="text-body-tertiary mx-auto d-block mb-2" />
                        <p className="text-body-tertiary small">No students match "{searchTerm}"</p>
                    </div>
                )}
                <div className="d-flex flex-column gap-2">
                    {filteredStudents.map((student, idx) => (
                        <MobileStudentCard
                            key={student.studentId}
                            student={student}
                            subjects={data.subjects || []}
                            index={idx}
                            showAttendance={showAttendance}
                            showComments={showComments}
                        />
                    ))}
                </div>
            </div>

            <div className="print-only border-top border-2 border-dark px-3 py-2">
                <div className="d-flex flex-wrap gap-3 justify-content-center" style={{ fontSize: '0.55rem', color: '#495057' }}>
                    <span className="fw-bold text-uppercase">Grading:</span>
                    {GRADING_KEY.map((g) => (<span key={g.grade} style={{ display: 'inline' }}><strong>{g.grade}</strong>({g.range})</span>))}
                </div>
            </div>
        </div>
    );
}

// ============================================
// SUBJECT STATISTICS TABLE
// ============================================
function SubjectStatisticsTable({ subjectStats }) {
    const [isExpanded, setIsExpanded] = useState(false);
    if (!subjectStats || subjectStats.length === 0) return null;
    return (
        <div className="no-print mt-3 mt-md-4">
            <div className="d-flex align-items-center gap-3 mb-3">
                <div className="flex-grow-1" style={{ height: 1, background: `linear-gradient(90deg, transparent, ${PAL.hdrAccent}25, transparent)` }} />
                <span className="d-flex align-items-center gap-1 px-3 py-1 rounded-pill" style={{ background: `linear-gradient(135deg, ${PAL.hdrDeep}10, ${PAL.hdrAccent}08)`, border: `1px solid ${PAL.hdrAccent}20`, fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: PAL.hdrSecondary }}>
                    <Icons.Layers size={11} style={{ color: PAL.hdrAccent }} /> Subject Analysis
                </span>
                <div className="flex-grow-1" style={{ height: 1, background: `linear-gradient(90deg, transparent, ${PAL.hdrAccent}25, transparent)` }} />
            </div>
            <button onClick={() => setIsExpanded(!isExpanded)} className="btn w-100 text-start px-3 px-md-4 py-2.5 py-md-3 d-flex align-items-center justify-content-between rounded-3 mb-3 transition-all" style={{ background: `linear-gradient(135deg, ${PAL.hdrDeep}08, ${PAL.hdrAccent}04)`, border: `1.5px solid ${PAL.hdrAccent}18` }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = `${PAL.hdrAccent}35`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = `${PAL.hdrAccent}18`; }}>
                <h3 className="h6 mb-0 fw-bold d-flex align-items-center gap-2" style={{ fontSize: '0.72rem', color: PAL.hdrSecondary }}>
                    <span className="d-flex align-items-center justify-content-center rounded-2" style={{ width: 24, height: 24, background: `linear-gradient(135deg, ${PAL.hdrAccent}15, ${PAL.hdrGold}10)`, color: PAL.hdrAccent }}><Icons.BarChart size={12} /></span>
                    Detailed Analysis
                    <span className="badge rounded-pill" style={{ fontSize: '0.56rem', fontWeight: 700, background: `${PAL.hdrAccent}12`, color: PAL.hdrSecondary }}>{subjectStats.length}</span>
                </h3>
                <div className="d-flex align-items-center justify-content-center rounded-circle" style={{ width: 26, height: 26, background: `${PAL.hdrAccent}10`, color: PAL.hdrSecondary, transition: 'transform 0.3s ease', transform: isExpanded ? 'rotate(180deg)' : '' }}>
                    <Icons.ChevronDown size={13} />
                </div>
            </button>
            {isExpanded && (
                <div className="row g-2">
                    {subjectStats.map((stat) => {
                        const passColor = stat.assessedStudents > 0 ? (stat.passRate >= 80 ? '#059669' : stat.passRate >= 60 ? '#2563eb' : stat.passRate >= 50 ? '#d97706' : '#dc2626') : '#94a3b8';
                        const passBg = stat.assessedStudents > 0 ? (stat.passRate >= 80 ? 'rgba(5,150,105,0.06)' : stat.passRate >= 60 ? 'rgba(37,99,235,0.06)' : stat.passRate >= 50 ? 'rgba(217,119,6,0.06)' : 'rgba(220,38,38,0.06)') : '#f8f9fa';
                        return (
                            <div key={stat.subjectId} className="col-12 col-sm-6 col-lg-4 col-xl-3">
                                <div className="rounded-3 p-2.5 p-md-3 h-100 transition-all" style={{ background: `linear-gradient(160deg, white, ${passBg})`, border: `1.5px solid ${passColor}18`, position: 'relative', overflow: 'hidden' }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = `${passColor}35`; e.currentTarget.style.boxShadow = `0 6px 24px rgba(0,0,0,0.06)`; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = `${passColor}18`; e.currentTarget.style.boxShadow = 'none'; }}>
                                    <div className="position-absolute top-0 start-0" style={{ width: 3, height: '100%', background: `linear-gradient(180deg, ${passColor}, ${passColor}60)` }} />
                                    <div className="d-flex align-items-center justify-content-between mb-2 ps-1">
                                        <h4 className="fw-bold mb-0 text-dark" style={{ fontSize: '0.68rem', lineHeight: 1.2 }}>{stat.subjectName}</h4>
                                        {stat.assessedStudents > 0 && <span className="badge rounded-pill fw-bold" style={{ fontSize: '0.52rem', background: `${passColor}12`, color: passColor }}>{fmtPct(stat.passRate)}</span>}
                                    </div>
                                    {stat.assessedStudents > 0 ? (
                                        <div className="ps-1">
                                            <div className="d-grid gap-1" style={{ gridTemplateColumns: '1fr 1fr', fontSize: '0.6rem' }}>
                                                <div className="rounded-2 px-2 py-1" style={{ background: 'rgba(0,0,0,0.02)' }}><span className="text-body-tertiary d-block" style={{ fontSize: '0.5rem', textTransform: 'uppercase', fontWeight: 600 }}>Average</span><span className="fw-black text-dark" style={{ fontSize: '0.75rem' }}>{fmt(stat.averageScore, 1)}</span></div>
                                                <div className="rounded-2 px-2 py-1" style={{ background: 'rgba(0,0,0,0.02)' }}><span className="text-body-tertiary d-block" style={{ fontSize: '0.5rem', textTransform: 'uppercase', fontWeight: 600 }}>Assessed</span><span className={`fw-bold ${stat.assessedStudents === stat.totalStudents ? 'text-success' : 'text-warning'}`} style={{ fontSize: '0.75rem' }}>{stat.assessedStudents}<span className="text-body-tertiary" style={{ fontSize: '0.58rem' }}>/{stat.totalStudents}</span></span></div>
                                                <div className="rounded-2 px-2 py-1" style={{ background: 'rgba(5,150,105,0.04)' }}><span className="text-body-tertiary d-block" style={{ fontSize: '0.5rem', textTransform: 'uppercase', fontWeight: 600 }}>Highest</span><span className="fw-black text-success" style={{ fontSize: '0.75rem' }}>{fmt(stat.highestScore)}</span></div>
                                                <div className="rounded-2 px-2 py-1" style={{ background: 'rgba(220,38,38,0.04)' }}><span className="text-body-tertiary d-block" style={{ fontSize: '0.5rem', textTransform: 'uppercase', fontWeight: 600 }}>Lowest</span><span className="fw-black text-danger" style={{ fontSize: '0.75rem' }}>{fmt(stat.lowestScore)}</span></div>
                                            </div>
                                            <div className="d-flex gap-1 mt-1.5 flex-wrap">{GRADING_KEY.map((g) => { const c = stat.gradeDistribution?.[g.grade] || 0; if (c === 0) return null; return <span key={g.grade} className="d-flex align-items-center gap-0.5 px-1.5 py-0.5 rounded-1" style={{ fontSize: '0.52rem', background: `${g.color}10`, border: `1px solid ${g.color}15` }}><span className="fw-black" style={{ color: g.color }}>{g.grade}</span><span className="fw-semibold" style={{ color: g.color + 'bb' }}>{c}</span></span>; })}</div>
                                            <div className="mt-1.5"><div className="d-flex justify-content-between mb-0.5" style={{ fontSize: '0.48rem' }}><span className="text-success fw-semibold">{stat.passCount || 0} passed</span><span className="text-danger fw-semibold">{stat.failCount || 0} failed</span></div><div className="progress" style={{ height: 4, background: 'rgba(220,38,38,0.15)', borderRadius: 999 }}><div className="progress-bar bg-success" style={{ width: `${stat.passRate || 0}%`, borderRadius: 999 }} /></div></div>
                                        </div>
                                    ) : (<div className="ps-1 text-center py-2"><span className="text-body-tertiary" style={{ fontSize: '0.6rem' }}>No scores entered</span></div>)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function PerformanceInsightsBanner({ data }) {
    if (!data?.statistics || !data?.subjectStats) return null;
    const { subjectStats } = data;
    const topSubject = [...subjectStats].sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0))[0];
    const weakSubject = [...subjectStats].filter(s => s.assessedStudents > 0).sort((a, b) => (a.averageScore || 0) - (b.averageScore || 0))[0];
    const bestPass = [...subjectStats].filter(s => s.assessedStudents > 0).sort((a, b) => (b.passRate || 0) - (a.passRate || 0))[0];
    const insights = [
        { icon: <Icons.Zap size={16} />, label: 'Strongest', value: topSubject?.subjectName || '—', sub: topSubject ? `Avg: ${fmt(topSubject.averageScore, 1)}` : '', color: '#059669', bg: 'rgba(5,150,105,0.06)', border: 'rgba(5,150,105,0.12)' },
        { icon: <Icons.AlertTriangle size={16} />, label: 'Needs Attention', value: weakSubject?.subjectName || '—', sub: weakSubject ? `Avg: ${fmt(weakSubject.averageScore, 1)}` : '', color: '#dc2626', bg: 'rgba(220,38,38,0.04)', border: 'rgba(220,38,38,0.1)' },
        { icon: <Icons.Target size={16} />, label: 'Best Pass Rate', value: bestPass?.subjectName || '—', sub: bestPass ? fmtPct(bestPass.passRate) : '', color: PAL.hdrAccent, bg: 'rgba(99,102,241,0.04)', border: 'rgba(99,102,241,0.1)' },
    ];
    return (
        <div className="no-print mt-3 mt-md-4 mb-2 mb-md-3">
            <div className="d-flex align-items-center gap-3 mb-3 d-none d-md-flex"><div className="flex-grow-1" style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.2), transparent)' }} /><span className="badge d-flex align-items-center gap-1 px-3 py-1 rounded-pill" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.1)', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: PAL.hdrPrimary }}><Icons.Star size={10} style={{ color: PAL.hdrAccent }} /> Performance Insights</span><div className="flex-grow-1" style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.2), transparent)' }} /></div>
            <div className="row g-2">{insights.map((ins, i) => (<div key={i} className="col-12 col-sm-4"><div className="rounded-3 p-2.5 p-md-3 h-100" style={{ background: ins.bg, border: `1px solid ${ins.border}` }}><div className="d-flex align-items-center gap-2 mb-1.5"><div className="d-flex align-items-center justify-content-center rounded-2" style={{ width: 24, height: 24, color: ins.color }}>{ins.icon}</div><span className="text-uppercase fw-semibold tracking-wider" style={{ fontSize: '0.56rem', color: ins.color + 'aa' }}>{ins.label}</span></div><p className="fs-5 fw-black mb-1" style={{ fontSize: 'clamp(0.85rem, 2vw, 1.2rem)' }}>{ins.value}</p>{ins.sub && <p className="fw-medium mb-0" style={{ fontSize: '0.65rem', color: ins.color }}>{ins.sub}</p>}</div></div>))}</div>
        </div>
    );
}

function GradingLegendStrip() {
    return (
        <div className="no-print mt-2 mb-2 px-1 px-md-0">
            <div className="d-flex align-items-center gap-3 mb-2 d-none d-md-flex"><div className="flex-grow-1" style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.06), transparent)' }} /><span className="text-uppercase fw-bold" style={{ fontSize: '0.6rem', letterSpacing: '0.12em', color: '#868e96' }}>Grading Legend</span><div className="flex-grow-1" style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.06), transparent)' }} /></div>
            <div className="d-flex flex-wrap gap-2 gap-md-3" style={{ fontSize: '0.65rem', color: '#6c757d' }}>
                {GRADING_KEY.map((g) => (<span key={g.grade} className="d-flex align-items-center gap-1"><span className="rounded-circle d-block" style={{ width: 7, height: 7, backgroundColor: g.color }} /><span className="fw-black" style={{ color: g.color }}>{g.grade}</span><span className="d-none d-sm-inline">({g.range})</span></span>))}
                <span className="text-body-tertiary d-none d-md-inline">|</span>
                <span className="text-body-secondary d-none d-lg-inline"><strong>T</strong>=Test <strong>NT</strong>=Notes <strong>AS</strong>=Assign <strong>CA</strong>=Total CA <strong>EX</strong>=Exam <strong>Tot</strong>=Total <strong>G</strong>=Grade <strong>R</strong>=Remark</span>
            </div>
        </div>
    );
}

function SignatureBlock({ classTeacher }) {
    return (<div className="print-only mt-5 d-flex justify-content-between px-4"><div className="text-center"><div className="border-top border-2 border-dark pt-1 mt-5" style={{ width: 180 }}><p className="fw-bold mb-0" style={{ fontSize: '0.65rem' }}>{classTeacher || 'Class Teacher'}</p><p className="text-body-secondary mb-0" style={{ fontSize: '0.55rem' }}>Class Teacher</p><p className="text-body-tertiary mt-1 mb-0" style={{ fontSize: '0.55rem' }}>Date: _____________</p></div></div><div className="text-center"><div className="border-top border-2 border-dark pt-1 mt-5" style={{ width: 180 }}><p className="fw-bold mb-0" style={{ fontSize: '0.65rem' }}>_________________</p><p className="text-body-secondary mb-0" style={{ fontSize: '0.55rem' }}>Principal</p><p className="text-body-tertiary mt-1 mb-0" style={{ fontSize: '0.55rem' }}>Date: _____________</p></div></div></div>);
}

function EmptyState({ title, message, Icon }) {
    return (<div className="d-flex flex-column align-items-center justify-content-center py-5 px-3"><div className="rounded-circle d-flex align-items-center justify-content-center mb-3" style={{ width: 56, height: 56, background: 'rgba(99,102,241,0.08)', border: `1px solid ${PAL.hdrAccent}20` }}><Icon size={24} style={{ color: PAL.hdrAccent }} /></div><h3 className="h6 fw-bold mb-1">{title}</h3><p className="text-body-secondary small text-center" style={{ maxWidth: 350 }}>{message}</p></div>);
}

function PrintHeader({ data }) {
    if (!data) return null;
    const { classInfo, termInfo, sessionInfo, attendance } = data;
    return (<div className="print-only text-center mb-3"><div className="mb-2" style={{ height: 8, background: `linear-gradient(90deg, #008751 0%, #008751 33%, white 33%, white 66%, #008751 66%, #008751 100%)` }} /><h1 className="fw-bold text-uppercase" style={{ fontFamily: 'Georgia, serif', fontSize: '0.85rem', letterSpacing: '0.25em' }}>{SCHOOL_INFO.name}</h1><p className="text-body-secondary" style={{ fontSize: '0.6rem' }}>{SCHOOL_INFO.address}</p><p className="fst-italic text-body-tertiary" style={{ fontSize: '0.5rem' }}>"{SCHOOL_INFO.motto}"</p><div className="border-top border-bottom border-2 border-dark mt-2 pt-2 pb-2"><h2 className="text-uppercase text-white d-inline-block px-4 py-1 fw-bold" style={{ fontSize: '0.65rem', letterSpacing: '0.3em', backgroundColor: PAL.hdrPrimary }}>Admin Broadsheet</h2><div className="d-flex justify-content-between mt-2 px-4" style={{ fontSize: '0.55rem' }}><div className="text-start"><p className="mb-0"><span className="fw-bold">Class:</span> {classInfo?.classFullName}</p><p className="mb-0"><span className="fw-bold">CT:</span> {classInfo?.classTeacher?.name || '—'}</p>{attendance && attendance.schoolOpenDays > 0 && <p className="mb-0"><span className="fw-bold">Days:</span> {attendance.schoolOpenDays}</p>}</div><div className="text-end"><p className="mb-0"><span className="fw-bold">Term:</span> {termInfo?.name}</p><p className="mb-0"><span className="fw-bold">Session:</span> {sessionInfo?.name}</p><p className="mb-0"><span className="fw-bold">Date:</span> {new Date().toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })}</p></div></div></div></div>);
}

function PageHeader({ classInfo, termInfo, sessionInfo, onBack, onToggleFullscreen, isFullscreen }) {
    return (
        <div className="d-flex align-items-center justify-content-between mb-2 mb-md-3">
            <div className="d-flex align-items-center gap-2">
                <button onClick={onBack} className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center justify-content-center" style={{ width: 36, height: 36 }}><Icons.ArrowLeft size={15} /></button>
                <div>
                    <div className="d-flex align-items-center gap-2">
                        <h1 className="h6 fw-black mb-0" style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)' }}>Admin Broadsheet</h1>
                        <span className="badge text-white d-flex align-items-center justify-content-center" style={{ fontSize: '0.52rem', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', backgroundColor: PAL.hdrPrimary, boxShadow: `0 2px 8px ${PAL.hdrGlow}`, borderRadius: 6, padding: '2px 7px' }}>
                            <Icons.Shield size={8} className="me-1" />Admin
                        </span>
                    </div>
                    <p className="text-body-tertiary mb-0 d-none d-sm-block" style={{ fontSize: '0.7rem' }}>{classInfo?.classFullName || '—'} &middot; {termInfo?.name || '—'} &middot; {sessionInfo?.name || '—'}</p>
                </div>
            </div>
            <button onClick={onToggleFullscreen} className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center justify-content-center" style={{ width: 36, height: 36 }} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                {isFullscreen ? <Icons.Minimize2 size={15} /> : <Icons.Maximize2 size={15} />}
            </button>
        </div>
    );
}

function MobileViewToggle({ viewMode, setViewMode, isMobile }) {
    const modes = [
        { mode: VIEW_MODES.DETAILED, label: 'Full', icon: <Icons.Eye size={11} /> },
        { mode: VIEW_MODES.COMPACT, label: 'Compact', icon: <Icons.FileText size={11} /> },
        { mode: VIEW_MODES.GRADE_ONLY, label: 'Grades', icon: <Icons.Award size={11} /> },
        ...(isMobile ? [{ mode: VIEW_MODES.CARDS, label: 'Cards', icon: <Icons.User size={11} /> }] : []),
    ];
    return (
        <div className="d-inline-flex align-items-center gap-1 p-1 rounded-3" style={{ background: '#eef2ff', border: '1px solid #c7d2fe' }}>
            {modes.map((opt) => (
                <button key={opt.mode} onClick={() => setViewMode(opt.mode)} className={`btn btn-sm d-flex align-items-center gap-1 rounded-3 ${viewMode === opt.mode ? 'shadow-sm' : ''}`} style={{ fontSize: '0.65rem', fontWeight: 600, padding: '3px 8px', background: viewMode === opt.mode ? 'white' : 'transparent', color: viewMode === opt.mode ? PAL.hdrPrimary : '#94a3b8', border: 'none', boxShadow: viewMode === opt.mode ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
                    {opt.icon}<span className="bs-view-toggle-label">{opt.label}</span>
                </button>
            ))}
        </div>
    );
}

function ScrollHintBanner({ visible }) {
    if (!visible) return null;
    return (<div className="no-print d-flex align-items-center gap-2 px-3 py-2 rounded-3 mb-2 border-0" style={{ background: `linear-gradient(135deg, ${PAL.hdrDeep}08, ${PAL.hdrAccent}04)`, border: `1px solid ${PAL.hdrAccent}15 !important`, color: PAL.hdrSecondary, fontSize: '0.65rem' }} role="alert"><Icons.DoubleArrow size={13} style={{ color: PAL.hdrAccent }} className="flex-shrink-0" /><span className="fw-medium">Scroll ↔ for subjects &bull; ↕ for students</span></div>);
}

function Toolbar({ viewMode, setViewMode, showAttendance, setShowAttendance, showComments, setShowComments, showFilters, setShowFilters, loading, onRefresh, onPrint, data, isMobile }) {
    return (
        <div className="no-print d-flex align-items-center gap-1.5 gap-md-2 flex-wrap mb-2 mb-md-3">
            <MobileViewToggle viewMode={viewMode} setViewMode={setViewMode} isMobile={isMobile} />
            <div className="flex-grow-1" />
            <div className="d-flex align-items-center gap-1">
                {data?.attendance && data.attendance.schoolOpenDays > 0 && (<button onClick={() => setShowAttendance(!showAttendance)} className={`btn btn-sm rounded-3 d-flex align-items-center gap-1 ${showAttendance ? 'bg-success-subtle text-success' : 'btn-outline-secondary'}`} style={{ fontSize: '0.65rem', fontWeight: 600, padding: '3px 8px', border: showAttendance ? '1px solid #99f6e4' : '' }}><Icons.ClipboardCheck size={10} /><span className="d-none d-sm-inline">Att</span></button>)}
                <button onClick={() => setShowComments(!showComments)} className={`btn btn-sm rounded-3 d-flex align-items-center gap-1 ${showComments ? 'bg-primary-subtle text-primary' : 'btn-outline-secondary'}`} style={{ fontSize: '0.65rem', fontWeight: 600, padding: '3px 8px', border: showComments ? '1px solid #bfdbfe' : '' }}><Icons.MessageSquare size={10} /><span className="d-none d-sm-inline">Cmt</span></button>
                <button onClick={() => setShowFilters(!showFilters)} className={`btn btn-sm rounded-3 d-flex align-items-center gap-1 ${showFilters ? '' : 'btn-outline-secondary'}`} style={{ fontSize: '0.65rem', fontWeight: 600, padding: '3px 8px', border: showFilters ? `1px solid ${PAL.hdrAccent}40` : '', background: showFilters ? `${PAL.hdrAccent}10` : '', color: showFilters ? PAL.hdrPrimary : '' }}><Icons.Filter size={10} /></button>
                <button onClick={() => onRefresh()} disabled={loading} className="btn btn-sm btn-outline-secondary rounded-3 d-flex align-items-center gap-1" style={{ fontSize: '0.65rem', padding: '3px 8px' }}>{loading ? <Icons.Loader size={10} spin /> : <Icons.FileText size={10} />}</button>
                <button onClick={onPrint} className="btn btn-sm rounded-3 d-flex align-items-center gap-1 fw-bold text-white" style={{ fontSize: '0.65rem', padding: '3px 10px', backgroundColor: PAL.hdrPrimary, boxShadow: `0 2px 12px ${PAL.hdrGlow}` }}><Icons.Printer size={10} /><span className="d-none d-sm-inline">Print</span></button>
            </div>
        </div>
    );
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================
export default function AdminBroadsheetPage() {
    const { classId } = useParams();
    const navigate = useNavigate();
    const [filters, setFilters] = useState({ termId: '', sessionId: '' });
    const isMobile = useIsMobile(640);
    const [viewMode, setViewMode] = useState(VIEW_MODES.DETAILED);
    const [showAttendance, setShowAttendance] = useState(true);
    const [showComments, setShowComments] = useState(false);
    const [terms, setTerms] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [showFilters, setShowFilters] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showScrollHint, setShowScrollHint] = useState(true);
    const scrollRef = useRef(null);

    useEffect(() => {
        if (isMobile && classId) setViewMode(VIEW_MODES.CARDS);
    }, [isMobile, classId]);

    const { classes, loading: classesLoading, error: classesError, meta, refetch: refetchClasses } = useAdminClassList(filters);
    const { data, loading, error, refetch } = useAdminBroadsheet(classId, filters);

    useEffect(() => {
        const c = scrollRef?.current; if (!c) return;
        const h = () => { setShowScrollHint(false); c.removeEventListener('scroll', h); c.removeEventListener('touchstart', h); };
        c.addEventListener('scroll', h, { once: true });
        c.addEventListener('touchstart', h, { once: true, passive: true });
        const t = setTimeout(() => setShowScrollHint(false), 5000);
        return () => { c.removeEventListener('scroll', h); c.removeEventListener('touchstart', h); clearTimeout(t); };
    }, [data]);

    useEffect(() => {
        (async () => {
            try {
                const [tR, sR] = await Promise.allSettled([termsAPI.getAll(), sessionsAPI.getAll()]);
                if (tR.status === 'fulfilled' && tR.value?.data) setTerms(tR.value.data);
                if (sR.status === 'fulfilled' && sR.value?.data) setSessions(sR.value.data);
            } catch (e) {}
        })();
    }, []);

    const handleSelectClass = useCallback((id) => { navigate(`/admin/broadsheet/${id}`); }, [navigate]);
    const handleBack = useCallback(() => { if (classId) navigate('/admin/broadsheet'); else navigate(-1); }, [classId, navigate]);
    const handlePrint = useCallback(() => {
        setViewMode(VIEW_MODES.DETAILED);
        setSearchTerm('');
        setTimeout(() => window.print(), 200);
    }, []);
    const handleToggleFullscreen = useCallback(() => setIsFullscreen(p => !p), []);

    // ============================================
    // CLASS SELECTION VIEW (no classId)
    // ============================================
        // ============================================
    // CLASS SELECTION VIEW (no classId)
    // ============================================
    if (!classId) {
        return (
            <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
                <div className="container" style={{ maxWidth: 960, paddingTop: 16, paddingBottom: 40 }}>
                    
                    {/* School hero banner */}
                    <div className="position-relative overflow-hidden rounded-3 mb-3 px-4 py-3 py-md-4 text-center" style={{ background: `linear-gradient(135deg, ${PAL.hdrDeep} 0%, ${PAL.hdrPrimary} 35%, ${PAL.hdrSecondary} 70%, ${PAL.hdrDeep} 100%)`, boxShadow: `0 8px 40px ${PAL.hdrGlow}` }}>
                        <div className="position-absolute top-0 start-0 end-0 bottom-0 pointer-events-none">
                            <div className="w-100 h-100" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />
                            <div className="position-absolute top-0 start-0 end-0" style={{ height: 4, background: `linear-gradient(90deg, #008751 0%, #008751 33%, white 33%, white 66%, #008751 66%, #008751 100%)` }} />
                            <div className="position-absolute rounded-circle" style={{ bottom: -40, right: -20, width: 180, height: 180, background: `radial-gradient(circle, ${PAL.hdrGoldGlow} 0%, transparent 70%)`, filter: 'blur(40px)' }} />
                        </div>
                        <div className="position-relative z-1">
                            <div className="d-flex justify-content-center mb-2 mb-md-3">
                                <div className="position-relative">
                                    <div className="d-flex align-items-center justify-content-center rounded-3" style={{ width: 48, height: 48, background: `linear-gradient(145deg, rgba(251,191,36,0.15), rgba(99,102,241,0.08))`, border: `1.5px solid ${PAL.hdrGold}50`, boxShadow: `0 0 30px ${PAL.hdrGoldGlow}` }}>
                                        <Icons.GraduationCap size={22} style={{ color: PAL.hdrGold }} />
                                    </div>
                                    <div className="position-absolute d-flex align-items-center justify-content-center rounded-2" style={{ top: -4, right: -6, width: 18, height: 18, background: `linear-gradient(135deg, ${PAL.hdrAccent}, #818cf8)`, boxShadow: `0 2px 8px ${PAL.hdrGlow}`, border: '1.5px solid white' }}>
                                        <Icons.Shield size={9} style={{ color: 'white' }} />
                                    </div>
                                </div>
                            </div>
                            <h1 className="fw-black text-uppercase mb-1" style={{ fontFamily: 'Georgia, serif', letterSpacing: '0.18em', fontSize: 'clamp(0.8rem, 3vw, 1.1rem)', color: PAL.hdrGold, textShadow: `0 2px 20px ${PAL.hdrGoldGlow}` }}>{SCHOOL_INFO.name}</h1>
                            <p className="text-uppercase mb-2 d-none d-sm-block" style={{ fontSize: '0.62rem', letterSpacing: '0.15em', color: PAL.hdrMuted }}>{SCHOOL_INFO.address}</p>
                            <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.18)' }}>
                                <span className="rounded-circle d-block" style={{ width: 4, height: 4, background: PAL.hdrGold, boxShadow: `0 0 6px ${PAL.hdrGoldGlow}` }} />
                                <p className="fst-italic fw-medium mb-0" style={{ fontSize: '0.56rem', color: PAL.hdrGold }}>"{SCHOOL_INFO.motto}"</p>
                                <span className="rounded-circle d-block" style={{ width: 4, height: 4, background: PAL.hdrGold, boxShadow: `0 0 6px ${PAL.hdrGoldGlow}` }} />
                            </div>
                        </div>
                    </div>

                    {/* Page title row */}
                    <div className="d-flex align-items-center gap-2 mb-3">
                        <button onClick={handleBack} className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 36, height: 36 }}>
                            <Icons.ArrowLeft size={15} />
                        </button>
                        <div style={{ minWidth: 0 }}>
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                <h2 className="h6 fw-black mb-0" style={{ fontSize: 'clamp(0.95rem, 2.5vw, 1.1rem)' }}>Admin Broadsheet</h2>
                                <span className="badge text-white d-flex align-items-center justify-content-center flex-shrink-0" style={{ fontSize: '0.5rem', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', backgroundColor: PAL.hdrPrimary, boxShadow: `0 2px 8px ${PAL.hdrGlow}`, borderRadius: 6, padding: '2px 7px' }}>
                                    <Icons.Shield size={8} className="me-1" />Admin
                                </span>
                            </div>
                            <p className="text-body-tertiary mb-0" style={{ fontSize: '0.68rem' }}>Select a class to view broadsheet</p>
                        </div>
                    </div>

                    {/* Filter / Refresh row */}
                    <div className="d-flex align-items-center gap-2 mb-3">
                        <button onClick={() => setShowFilters(!showFilters)} className={`btn btn-sm rounded-3 d-flex align-items-center gap-1 ${showFilters ? '' : 'btn-outline-secondary'}`} style={{ fontSize: '0.68rem', fontWeight: 600, border: showFilters ? `1px solid ${PAL.hdrAccent}40` : '', background: showFilters ? `${PAL.hdrAccent}10` : '', color: showFilters ? PAL.hdrPrimary : '' }}>
                            <Icons.Filter size={11} /> Filters
                        </button>
                        <button onClick={() => refetchClasses()} disabled={classesLoading} className="btn btn-sm btn-outline-secondary rounded-3 d-flex align-items-center gap-1" style={{ fontSize: '0.68rem' }}>
                            {classesLoading ? <Icons.Loader size={11} spin /> : <Icons.FileText size={11} />} Refresh
                        </button>
                    </div>

                    {/* Filter panel */}
                    {showFilters && (
                        <div className="card border rounded-3 p-3 mb-3" style={{ borderColor: '#dee2e6' }}>
                            <div className="row g-2 justify-content-center" style={{ maxWidth: 400, margin: '0 auto' }}>
                                <div className="col-sm-6">
                                    <label className="form-label text-uppercase fw-semibold" style={{ fontSize: '0.56rem', color: '#868e96', letterSpacing: '0.08em' }}>Session</label>
                                    <select value={filters.sessionId} onChange={(e) => setFilters(f => ({ ...f, sessionId: e.target.value }))} className="form-select form-select-sm rounded-3" style={{ fontSize: '0.7rem' }}>
                                        <option value="">Current / Active</option>
                                        {sessions.map(s => <option key={s._id} value={s._id}>{s.name}{s.isActive ? ' ✓' : ''}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Class list */}
                    <AdminClassSelectionView
                        classes={classes}
                        loading={classesLoading}
                        error={classesError}
                        meta={meta}
                        onSelectClass={handleSelectClass}
                        onRefresh={refetchClasses}
                    />

                </div>
            </div>
        );
    }
    // ============================================
    // LOADING STATE
    // ============================================
    if (loading && !data) return (
        <div className="d-flex align-items-center justify-content-center" style={{ backgroundColor: '#f8fafc', minHeight: '60vh' }}>
            <div className="text-center">
                <div className="spinner-border mb-2" role="status" style={{ width: 48, height: 48, color: PAL.hdrAccent }}><span className="visually-hidden">Loading...</span></div>
                <p className="text-body-secondary small">Loading admin broadsheet...</p>
            </div>
        </div>
    );

    // ============================================
    // ERROR STATE
    // ============================================
    if (error && !data) return (
        <div className="d-flex align-items-center justify-content-center p-3" style={{ backgroundColor: '#f8fafc', minHeight: '60vh' }}>
            <div className="text-center" style={{ maxWidth: 400 }}>
                <div className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3" style={{ width: 56, height: 56, background: 'rgba(99,102,241,0.1)' }}><Icons.AlertCircle size={26} className="text-danger" /></div>
                <h2 className="h6 fw-bold mb-2">Could Not Load</h2>
                <div className="alert alert-danger rounded-3 p-2 mb-3" style={{ fontSize: '0.7rem' }}>{error}</div>
                <div className="d-flex gap-2 justify-content-center">
                    <button onClick={() => refetch()} className="btn btn-sm text-white rounded-3 px-4 shadow" style={{ backgroundColor: PAL.hdrPrimary }}>Retry</button>
                    <button onClick={handleBack} className="btn btn-light btn-sm rounded-3 px-4">Back</button>
                </div>
            </div>
        </div>
    );

    // ============================================
    // EMPTY STATES
    // ============================================
    if (data && data.students?.length === 0) return (
        <div style={{ backgroundColor: '#f8fafc' }} className="p-2 p-md-3">
            <PageHeader classInfo={data.classInfo} termInfo={data.termInfo} sessionInfo={data.sessionInfo} onBack={handleBack} onToggleFullscreen={handleToggleFullscreen} isFullscreen={isFullscreen} />
            <div className="card border rounded-3 rounded-md-4" style={{ borderColor: '#dee2e6' }}>
                <div className="card-body"><EmptyState Icon={Icons.Users} title="No Students" message="No students assigned to this class." /></div>
            </div>
        </div>
    );
    if (data && data.subjects?.length === 0) return (
        <div style={{ backgroundColor: '#f8fafc' }} className="p-2 p-md-3">
            <PageHeader classInfo={data.classInfo} termInfo={data.termInfo} sessionInfo={data.sessionInfo} onBack={handleBack} onToggleFullscreen={handleToggleFullscreen} isFullscreen={isFullscreen} />
            <div className="card border rounded-3 rounded-md-4" style={{ borderColor: '#dee2e6' }}>
                <div className="card-body"><EmptyState Icon={Icons.BookOpen} title="No Subjects" message="No subjects assigned to this class." /></div>
            </div>
        </div>
    );

    // ============================================
    // MAIN BROADSHEET VIEW
    // ============================================
    const isCardsMode = viewMode === VIEW_MODES.CARDS;

    return (
        <div className={`${isFullscreen ? 'position-fixed top-0 start-0 end-0 bottom-0 z-3' : ''}`} style={{ backgroundColor: isFullscreen ? '#f5f3ff' : '#f8fafc' }}>
            <style>{`
                @media print {
                    body { margin: 0; padding: 4mm; background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .no-print { display: none !important; }
                    .print-only { display: block !important; }
                    @page { size: A3 landscape; margin: 4mm; }
                    .broadsheet-scroll { overflow: visible !important; max-height: none !important; }
                    .broadsheet-table { font-size: 6pt !important; }
                    .broadsheet-table th, .broadsheet-table td { padding: 1px 1px !important; }
                    .broadsheet-table .sticky-col { position: relative !important; left: auto !important; z-index: auto !important; }
                }
                .broadsheet-scroll { scrollbar-width: thin; scrollbar-color: #818cf8 #eef2ff; -webkit-overflow-scrolling: touch; }
                .broadsheet-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
                .broadsheet-scroll::-webkit-scrollbar-track { background: #eef2ff; border-radius: 4px; }
                .broadsheet-scroll::-webkit-scrollbar-thumb { background: linear-gradient(135deg, #a5b4fc, #818cf8); border-radius: 4px; border: 1px solid #eef2ff; }
                .broadsheet-scroll::-webkit-scrollbar-thumb:hover { background: linear-gradient(135deg, ${PAL.hdrAccent}, #a5b4fc); }
                .broadsheet-scroll::-webkit-scrollbar-corner { background: #e0e7ff; }
                .broadsheet-scroll { -webkit-overflow-scrolling: touch; }
                .broadsheet-table { border-collapse: separate; border-spacing: 0; }
                .sticky-col { position: sticky !important; z-index: 10 !important; background-clip: padding-box !important; }
                .broadsheet-table thead { position: sticky; top: 0; z-index: 20; }
                .broadsheet-table thead th { position: relative; z-index: 1; }
                .broadsheet-table thead .sticky-col { z-index: 30 !important; }
                tbody tr { position: relative; }
                .print-only { display: none; }
                @media (max-width: 575.98px) {
                    .bs-view-toggle-label { display: inline !important; }
                    .rounded-md-4 { border-radius: 0.75rem !important; }
                }
                @media (min-width: 576px) {
                    .rounded-md-4 { border-radius: 1rem !important; }
                }
                .bs-mobile-student-card { border-radius: 10px; overflow: hidden; background: white; box-shadow: 0 1px 4px rgba(0,0,0,0.06); transition: box-shadow 0.2s ease; }
                .bs-mobile-student-card:active { box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
                .bs-mobile-card-header { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 10px 12px; border: none; background: transparent; cursor: pointer; font-family: inherit; text-align: left; color: inherit; -webkit-tap-highlight-color: transparent; }
                .bs-mobile-card-header:active { background: rgba(0,0,0,0.02); }
                .bs-mobile-card-sn { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 6px; background: rgba(99,102,241,0.08); color: ${PAL.hdrPrimary}; font-size: 0.6rem; font-weight: 700; font-family: ui-monospace, SFMono-Regular, monospace; flex-shrink: 0; }
                .bs-mobile-card-name { font-weight: 600; font-size: 0.78rem; color: #212529; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.2; }
                .bs-mobile-card-total { font-weight: 900; font-size: 1rem; color: #212529; line-height: 1; }
                .bs-mobile-card-chevron { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: rgba(0,0,0,0.04); color: #868e96; transition: transform 0.3s ease; flex-shrink: 0; }
                .bs-mobile-card-body { padding: 0 12px 12px 12px; border-top: 1px solid #f1f3f5; animation: bs-card-slide 0.2s ease; }
                @keyframes bs-card-slide { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
                .bs-mobile-subjects-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 8px; }
                @media (max-width: 767.98px) and (orientation: landscape) {
                    .bs-mobile-subjects-grid { grid-template-columns: repeat(3, 1fr); }
                }
                .bs-mobile-subject-item { padding: 6px 8px; border-radius: 8px; background: #f8f9fb; border: 1px solid #f1f3f5; }
                .bs-mobile-subject-item--empty { opacity: 0.5; }
                .bs-mobile-subject-name { font-size: 0.6rem; font-weight: 600; color: #495057; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .bs-mobile-subject-total { font-weight: 900; font-size: 0.85rem; line-height: 1; }
                .bs-mobile-subject-dash { color: #ced4da; font-size: 0.8rem; }
                .bs-grade-badge { display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; font-weight: 900; padding: 0; }
                .bs-mobile-att-row { display: flex; align-items: center; gap: 6px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #f1f3f5; }
                .bs-mobile-comment-row { display: flex; align-items: flex-start; gap: 6px; margin-top: 6px; padding-top: 6px; }
                .bs-pos-badge { display: inline-flex; align-items: center; justify-content: center; border-radius: 50rem; font-weight: 700; }
            `}</style>

            <div className={`${isFullscreen ? 'd-flex flex-column h-100 overflow-hidden' : ''}`} style={{ padding: isFullscreen ? 8 : undefined }}>
                {/* Page header */}
                <div className="no-print">
                    <PageHeader classInfo={data?.classInfo} termInfo={data?.termInfo} sessionInfo={data?.sessionInfo} onBack={handleBack} onToggleFullscreen={handleToggleFullscreen} isFullscreen={isFullscreen} />
                </div>

                {/* Hero school header */}
                <HeroSchoolHeader data={data} />

                {/* Print-only header */}
                <PrintHeader data={data} />

                {/* Toolbar */}
                <Toolbar viewMode={viewMode} setViewMode={setViewMode} showAttendance={showAttendance} setShowAttendance={setShowAttendance} showComments={showComments} setShowComments={setShowComments} showFilters={showFilters} setShowFilters={setShowFilters} loading={loading} onRefresh={refetch} onPrint={handlePrint} data={data} isMobile={isMobile} />

                {/* Term/Session filters (inline when class is selected) */}
                {showFilters && (
                    <div className="no-print card border rounded-3 p-2 mb-2" style={{ borderColor: '#dee2e6' }}>
                        <div className="row g-2">
                            <div className="col-6">
                                <select value={filters.termId} onChange={(e) => setFilters(f => ({ ...f, termId: e.target.value }))} className="form-select form-select-sm rounded-3" style={{ fontSize: '0.7rem' }}>
                                    <option value="">Current Term</option>
                                    {terms.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                                </select>
                            </div>
                            <div className="col-6">
                                <select value={filters.sessionId} onChange={(e) => setFilters(f => ({ ...f, sessionId: e.target.value }))} className="form-select form-select-sm rounded-3" style={{ fontSize: '0.7rem' }}>
                                    <option value="">Current Session</option>
                                    {sessions.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {/* Loading overlay for refresh */}
                {loading && data && (
                    <div className="no-print position-fixed top-0 start-0 end-0 bottom-0 z-4 d-flex align-items-center justify-content-center" style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(4px)' }}>
                        <div className="card border shadow-lg px-4 py-2 d-flex align-items-center gap-2" style={{ borderColor: '#dee2e6' }}>
                            <Icons.Loader size={14} spin style={{ color: PAL.hdrAccent }} />
                            <span className="small fw-medium text-body">Refreshing...</span>
                        </div>
                    </div>
                )}

                {/* Stats bar */}
                <div className="no-print">
                    <CompactStatsBar statistics={data?.statistics} attendance={data?.attendance} />
                    <MissingScoresAlert statistics={data?.statistics} />
                </div>

                {/* Grading key */}
                <GradingKeyBadge />

                {/* Scroll hint */}
                {!isCardsMode && <ScrollHintBanner visible={showScrollHint} />}

                {/* Main content area */}
                <div className={`${isFullscreen ? 'flex-grow-1 overflow-hidden' : ''}`}>
                    {isCardsMode ? (
                        <MobileCardsView
                            data={data}
                            searchTerm={searchTerm}
                            onSearchChange={setSearchTerm}
                            showAttendance={showAttendance}
                            showComments={showComments}
                        />
                    ) : (
                        <BroadsheetTable data={data} viewMode={viewMode} showAttendance={showAttendance} showComments={showComments} searchTerm={searchTerm} onSearchChange={setSearchTerm} isFullscreen={isFullscreen} scrollRef={scrollRef} isMobile={isMobile} />
                    )}
                </div>

                {/* Scroll bars (table mode only) */}
                {!isCardsMode && (
                    <>
                        <HorizontalScrollBar scrollRef={scrollRef} />
                        <VerticalScrollBar scrollRef={scrollRef} />
                    </>
                )}

                {/* Insights & analysis */}
                <PerformanceInsightsBanner data={data} />
                <GradingLegendStrip />
                <SubjectStatisticsTable subjectStats={data?.subjectStats} />

                {/* Signature block (print) */}
                <SignatureBlock classTeacher={data?.classInfo?.classTeacher?.name} />
            </div>
        </div>
    );
}
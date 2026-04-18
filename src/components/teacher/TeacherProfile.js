import React, { useState, useEffect } from 'react';
import { getAuthData } from '../../api';
import './TeacherProfile.css';

const TeacherProfile = () => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const { user } = getAuthData();
        if (user) {
            setUser(user);
        }
        setLoading(false);
    }, []);

    const initials = user ? `${(user.firstName || '')[0] || ''}${(user.lastName || '')[0] || ''}` : '';

    const infoItems = [
        {
            icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
            ),
            label: 'Full Name',
            value: user ? `${user.firstName} ${user.lastName}` : '—'
        },
        {
            icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
            ),
            label: 'Username',
            value: user?.username || '—'
        },
        {
            icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                </svg>
            ),
            label: 'Role',
            value: 'Teacher',
            isBadge: true
        },
        {
            icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
            ),
            label: 'Email',
            value: user?.email || 'Not set'
        },
        {
            icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
            ),
            label: 'Phone',
            value: user?.phone || 'Not set'
        }
    ];

    if (loading) {
        return (
            <div className="tp-loading-wrap">
                <div className="tp-loader">
                    <div className="tp-loader-ring"></div>
                    <div className="tp-loader-ring"></div>
                    <div className="tp-loader-ring"></div>
                </div>
                <p>Loading profile...</p>
            </div>
        );
    }

    return (
        <div className="tp-root">
            <div className="tp-bg-orb tp-bg-orb--1"></div>
            <div className="tp-bg-orb tp-bg-orb--2"></div>

            {/* Header */}
            <header className="tp-header">
                <div className="tp-header-text">
                    <div className="tp-header-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                        </svg>
                    </div>
                    <div>
                        <h1 className="tp-title">My Profile</h1>
                        <p className="tp-subtitle">View your account information</p>
                    </div>
                </div>
            </header>

            {user && (
                <>
                    {/* Hero Card */}
                    <div className="tp-hero">
                        <div className="tp-hero-bg-pattern"></div>
                        <div className="tp-hero-content">
                            <div className="tp-avatar-ring">
                                <div className="tp-avatar">
                                    {initials}
                                </div>
                            </div>
                            <div className="tp-hero-info">
                                <h2 className="tp-hero-name">{user.firstName} {user.lastName}</h2>
                                <span className="tp-hero-role">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                                    </svg>
                                    Teacher
                                </span>
                                <span className="tp-hero-username">@{user.username}</span>
                            </div>
                        </div>
                    </div>

                    {/* Info Grid */}
                    <div className="tp-info-grid">
                        {infoItems.map((item, index) => (
                            <div
                                key={index}
                                className="tp-info-card"
                                style={{ animationDelay: `${index * 0.06}s` }}
                            >
                                <div className="tp-info-icon">{item.icon}</div>
                                <div className="tp-info-content">
                                    <span className="tp-info-label">{item.label}</span>
                                    {item.isBadge ? (
                                        <span className="tp-info-badge">{item.value}</span>
                                    ) : (
                                        <span className={`tp-info-value ${item.value === 'Not set' ? 'tp-info-value--muted' : ''}`}>
                                            {item.value}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer Note */}
                    <div className="tp-footer-note">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                        </svg>
                        <span>Contact your administrator to update profile details.</span>
                    </div>
                </>
            )}

            {!user && !loading && (
                <div className="tp-empty">
                    <div className="tp-empty-illustration">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                        </svg>
                    </div>
                    <h3>Unable to Load Profile</h3>
                    <p>Your account information could not be retrieved. Please try again later.</p>
                </div>
            )}
        </div>
    );
};

export default TeacherProfile;
import React, { useState } from 'react';
import { reportCardsAPI, sessionsAPI, termsAPI } from '../../api';
import './CheckResultsPage.css';

const CheckResultsPage = () => {
    const [admissionNumber, setAdmissionNumber] = useState('');
    const [firstName, setFirstName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);
    const [terms, setTerms] = useState([]);
    const [selectedTerm, setSelectedTerm] = useState('');

    React.useEffect(() => {
        fetchTerms();
    }, []);

    const fetchTerms = async () => {
        try {
            const response = await termsAPI.getAll();
            if (response.success) {
                setTerms(response.data);
                const activeTerm = response.data.find(t => t.status === 'active');
                if (activeTerm) {
                    setSelectedTerm(activeTerm._id);
                } else if (response.data.length > 0) {
                    setSelectedTerm(response.data[0]._id);
                }
            }
        } catch (error) {
            console.error('Error fetching terms:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setResult(null);

        if (!admissionNumber.trim() || !firstName.trim()) {
            setError('Please enter both Admission Number and First Name');
            return;
        }

        setLoading(true);
        try {
            const response = await reportCardsAPI.checkResults({
                admissionNumber: admissionNumber.trim(),
                firstName: firstName.trim(),
                termId: selectedTerm
            });

            if (response.success) {
                setResult(response.data);
            } else {
                setError(response.message || 'Failed to fetch results');
            }
        } catch (error) {
            setError(error.response?.data?.message || 'Failed to fetch results. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    return (
        <div className="check-results-page">
            <div className="results-header">
                <h1>Check Your Results</h1>
                <p>Enter your details to view your academic performance</p>
            </div>

            <form className="results-form" onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="admissionNumber">Admission Number</label>
                    <input
                        type="text"
                        id="admissionNumber"
                        value={admissionNumber}
                        onChange={(e) => setAdmissionNumber(e.target.value)}
                        placeholder="Enter your admission number"
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="firstName">First Name</label>
                    <input
                        type="text"
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Enter your first name"
                        required
                    />
                </div>

                {terms.length > 0 && (
                    <div className="form-group">
                        <label htmlFor="term">Term</label>
                        <select
                            id="term"
                            value={selectedTerm}
                            onChange={(e) => setSelectedTerm(e.target.value)}
                        >
                            {terms.map(term => (
                                <option key={term._id} value={term._id}>
                                    {term.name} - {term.session?.name || ''}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {error && <div className="error-message">{error}</div>}

                <button type="submit" className="submit-btn" disabled={loading}>
                    {loading ? 'Fetching Results...' : 'Check Results'}
                </button>
            </form>

            {result && (
                <div className="report-card">
                    <div className="report-header">
                        <h2>STUDENT REPORT CARD</h2>
                        <div className="report-meta">
                            <p><strong>Term:</strong> {result.term.name}</p>
                            <p><strong>Session:</strong> {result.session.name}</p>
                        </div>
                    </div>

                    <div className="student-info">
                        <div className="info-row">
                            <span><strong>Name:</strong> {result.student.firstName} {result.student.lastName}</span>
                            <span><strong>Admission No:</strong> {result.student.admissionNumber}</span>
                        </div>
                        <div className="info-row">
                            <span><strong>Class:</strong> {result.student.class?.name} {result.student.class?.section}</span>
                            <span><strong>Gender:</strong> {result.student.gender}</span>
                        </div>
                    </div>

                    <div className="grades-table-container">
                        <table className="grades-table">
                            <thead>
                                <tr>
                                    <th>S/N</th>
                                    <th>Subject</th>
                                    <th>Test (20)</th>
                                    <th>Notes (10)</th>
                                    <th>Assign (10)</th>
                                    <th>CA (40)</th>
                                    <th>Exam (60)</th>
                                    <th>Total (100)</th>
                                    <th>Grade</th>
                                    <th>Remark</th>
                                </tr>
                            </thead>
                            <tbody>
                                {result.subjects.map((subject, index) => (
                                    <tr key={subject._id || index}>
                                        <td>{index + 1}</td>
                                        <td>{subject.subject?.name || 'Unknown'}</td>
                                        <td>{subject.testScore}</td>
                                        <td>{subject.noteTakingScore}</td>
                                        <td>{subject.assignmentScore}</td>
                                        <td className="ca-total">{subject.totalCA}</td>
                                        <td>{subject.examScore}</td>
                                        <td className="total-score">{subject.totalScore}</td>
                                        <td className={`grade-${subject.grade}`}>{subject.grade}</td>
                                        <td>{subject.remark}</td>
                                    </tr>
                                ))}
                                {result.subjects.length === 0 && (
                                    <tr>
                                        <td colSpan="10" className="no-data">
                                            No grades available for this term
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="report-summary">
                        <div className="summary-stats">
                            <div className="stat-item">
                                <span className="stat-label">Total Subjects:</span>
                                <span className="stat-value">{result.statistics.totalSubjects}</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">Total Score:</span>
                                <span className="stat-value">{result.statistics.totalScore}</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">Average Score:</span>
                                <span className="stat-value average">{result.statistics.averageScore}%</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">Position:</span>
                                <span className="stat-value position">
                                    {result.statistics.position} out of {result.statistics.totalInClass}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="report-comments">
                        <div className="comment-section">
                            <h4>Class Teacher's Comment:</h4>
                            <p>{result.classTeacherComment || 'No comment available'}</p>
                        </div>
                        <div className="comment-section">
                            <h4>Principal's Comment:</h4>
                            <p>{result.principalComment || 'No comment available'}</p>
                        </div>
                    </div>

                    <div className="report-footer">
                        <div className="term-dates">
                            <p><strong>Term Begins:</strong> {formatDate(result.term.startDate)}</p>
                            <p><strong>Term Ends:</strong> {formatDate(result.term.endDate)}</p>
                            {result.term.nextTermBegins && (
                                <p><strong>Next Term Begins:</strong> {formatDate(result.term.nextTermBegins)}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CheckResultsPage;
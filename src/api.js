import axios from 'axios';

// Base API configuration
const API_BASE_URL = 'https://schoolcbt.onrender.com';

// Create axios instance with default config
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true // For mobile compatibility
});

// Request interceptor to add auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response) {
            // Handle 401 Unauthorized - token expired or invalid
            if (error.response.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// ============================================
// AUTHENTICATION API
// ============================================
export const authAPI = {
    login: async (credentials) => {
        const response = await api.post('/login', credentials);
        return response.data;
    },

    loginTeacher: async (credentials) => {
        const response = await api.post('/login/teacher', credentials);
        return response.data;
    },

    loginStudent: async (credentials) => {
        const response = await api.post('/login/student', credentials);
        return response.data;
    },
};

// ============================================
// DASHBOARD & STATS API
// ============================================
export const dashboardAPI = {
    getStats: async () => {
        const response = await api.get('/dashboard/stats');
        return response.data;
    },

    getTeacherCount: async () => {
        const response = await api.get('/teachers/count');
        return response.data;
    },

    getStudentCount: async () => {
        const response = await api.get('/students/count');
        return response.data;
    },

    getClassCount: async () => {
        const response = await api.get('/classes/count');
        return response.data;
    },

    getSubjectCount: async () => {
        const response = await api.get('/subjects/count');
        return response.data;
    },

    getQuestionCount: async () => {
        const response = await api.get('/questions/count');
        return response.data;
    },

    getTestCount: async () => {
        const response = await api.get('/tests/count');
        return response.data;
    },

    // Get last teacher logins for teacher dashboard
    getLastTeacherLogins: async () => {
        const response = await api.get('/dashboard/teacher-logins');
        return response.data;
    },

    // ==========================================
    // TEACHER ASSIGNMENTS (For AssignTeachers component)
    // ==========================================

    getTeachers: async () => {
        const response = await api.get('/teachers');
        return response.data;
    },

    getClasses: async () => {
        const response = await api.get('/classes', {
            params: { limit: 1000 }
        });
        return response.data;
    },

    getSubjects: async () => {
        const response = await api.get('/subjects');
        return response.data;
    },

    getTeacherAssignments: async () => {
        const response = await api.get('/teacher-assignments');
        return response.data;
    },

    createTeacherAssignment: async (assignmentData) => {
        const response = await api.post('/teacher-assignments', assignmentData);
        return response.data;
    },

    updateTeacherAssignment: async (id, assignmentData) => {
        const response = await api.put(`/teacher-assignments/${id}`, assignmentData);
        return response.data;
    },

    deleteTeacherAssignment: async (id) => {
        const response = await api.delete(`/teacher-assignments/${id}`);
        return response.data;
    },

    checkAssignmentExists: async (teacherId, classId, subjectId) => {
        const response = await api.get('/teacher-assignments/check', {
            params: { teacher_id: teacherId, class_id: classId, subject_id: subjectId }
        });
        return response.data;
    },

    getAssignmentsByTeacher: async (teacherId) => {
        const response = await api.get(`/teacher-assignments/teacher/${teacherId}`);
        return response.data;
    },

    getAssignmentsByClass: async (classId) => {
        const response = await api.get(`/teacher-assignments/class/${classId}`);
        return response.data;
    },

    getAssignmentsBySubject: async (subjectId) => {
        const response = await api.get(`/teacher-assignments/subject/${subjectId}`);
        return response.data;
    },
};

// ============================================
// TEACHERS API
// ============================================
export const teachersAPI = {
    getAll: async () => {
        const response = await api.get('/teachers');
        return response.data;
    },

    create: async (teacherData) => {
        const response = await api.post('/teachers', teacherData);
        return response.data;
    },

    update: async (id, teacherData) => {
        const response = await api.put(`/teachers/${id}`, teacherData);
        return response.data;
    },

    delete: async (id) => {
        const response = await api.delete(`/teachers/${id}`);
        return response.data;
    },
};

// ============================================
// STUDENTS API (UPDATED WITH RECYCLE BIN FEATURE + RESULT ACCESS BLOCKING)
// ============================================
export const studentsAPI = {
    getAll: async () => {
        const response = await api.get('/students');
        return response.data;
    },

    getById: async (id) => {
        const response = await api.get(`/students/${id}`);
        return response.data;
    },

    create: async (studentData) => {
        const { admissionNumber, ...dataToSubmit } = studentData;
        const response = await api.post('/students', dataToSubmit);
        return response.data;
    },

    update: async (id, studentData) => {
        const { admissionNumber, ...dataToSubmit } = studentData;
        const response = await api.put(`/students/${id}`, dataToSubmit);
        return response.data;
    },

    delete: async (id) => {
        const response = await api.delete(`/students/${id}`);
        return response.data;
    },

    deleteTestResult: async (studentId, testId) => {
        const response = await api.delete(`/students/${studentId}/test-results/${testId}`);
        return response.data;
    },

    // ==========================================
    // FEES ACCESS MANAGEMENT
    // ==========================================

    toggleFeesAccess: async (studentId) => {
        const response = await api.patch(`/students/${studentId}/toggle-fees-access`);
        return response.data;
    },

    toggleOwing: async (studentId) => {
        const response = await api.patch(`/students/${studentId}/toggle-owing`);
        return response.data;
    },

    // ==========================================
    // RESULT ACCESS BLOCKING (NEW)
    // ==========================================

    toggleResultAccess: async (studentId) => {
        const response = await api.patch(`/students/${studentId}/toggle-result-access`);
        return response.data;
    },

    blockResultAccess: async (studentId, data) => {
        const response = await api.patch(`/students/${studentId}/block-result-access`, data);
        return response.data;
    },

    bulkResultAccess: async (data) => {
        const response = await api.patch('/students/bulk-result-access', data);
        return response.data;
    },

    // ==========================================
    // RECYCLE BIN MANAGEMENT
    // ==========================================

    getRecycleBin: async () => {
        const response = await api.get('/students/recycle-bin');
        return response.data;
    },

    restoreFromRecycleBin: async (id) => {
        const response = await api.patch(`/students/recycle-bin/${id}/restore`);
        return response.data;
    },

    permanentlyDelete: async (id) => {
        const response = await api.delete(`/students/recycle-bin/${id}/permanent`);
        return response.data;
    },
};

// ============================================
// SUBJECTS API
// ============================================
export const subjectsAPI = {
    getAll: async () => {
        const response = await api.get('/subjects');
        return response.data;
    },

    create: async (subjectData) => {
        const response = await api.post('/subjects', subjectData);
        return response.data;
    },

    update: async (id, subjectData) => {
        const response = await api.put(`/subjects/${id}`, subjectData);
        return response.data;
    },

    delete: async (id) => {
        const response = await api.delete(`/subjects/${id}`);
        return response.data;
    },

    getByClass: async (classId) => {
        const response = await api.get(`/subjects/by-class/${classId}`);
        return response.data;
    },
};

// ============================================
// CLASSES API (UPDATED WITH RESULT ACCESS BLOCKING)
// ============================================
export const classesAPI = {
    getAll: async (params = {}) => {
        const response = await api.get('/classes', { params });
        return response.data;
    },

    getAllForDropdown: async () => {
        const response = await api.get('/classes', {
            params: { limit: 1000 }
        });
        return response.data;
    },

    getById: async (id) => {
        const response = await api.get(`/classes/${id}`);
        return response.data;
    },

    create: async (classData) => {
        const response = await api.post('/classes', classData);
        return response.data;
    },

    update: async (id, classData) => {
        const response = await api.put(`/classes/${id}`, classData);
        return response.data;
    },

    delete: async (id) => {
        const response = await api.delete(`/classes/${id}`);
        return response.data;
    },

    getByTeacher: async (teacherId) => {
        const response = await api.get(`/classes/teacher/${teacherId}`);
        return response.data;
    },

    getWithSubjects: async (id) => {
        const response = await api.get(`/classes-with-subjects/${id}`);
        return response.data;
    },

    getWithResults: async () => {
        const response = await api.get('/api/classes/results');
        return response.data;
    },

    getClassSubjectResults: async (classId, subjectId) => {
        const response = await api.get(`/api/classes/${classId}/subjects/${subjectId}/results`);
        return response.data;
    },

    // ==========================================
    // RESULT ACCESS BLOCKING (NEW)
    // ==========================================

    toggleResultAccess: async (classId) => {
        const response = await api.patch(`/classes/${classId}/toggle-result-access`);
        return response.data;
    },

    blockResultAccess: async (classId, data) => {
        const response = await api.patch(`/classes/${classId}/block-result-access`, data);
        return response.data;
    },
};

// ============================================
// QUESTION SETS API
// ============================================
export const questionSetsAPI = {
    getAll: async (params = {}) => {
        const response = await api.get('/question-sets', { params });
        return response.data;
    },

    create: async (questionSetData) => {
        const response = await api.post('/question-sets', questionSetData);
        return response.data;
    },

    update: async (id, questionSetData) => {
        const response = await api.put(`/question-sets/${id}`, questionSetData);
        return response.data;
    },

    delete: async (id) => {
        const response = await api.delete(`/question-sets/${id}`);
        return response.data;
    },
};

// ============================================
// TESTS API
// ============================================
export const testsAPI = {
    getAll: async (params = {}) => {
        const response = await api.get('/tests', { params });
        return response.data;
    },

    getAllIncludingInactive: async () => {
        const response = await api.get('/tests/all');
        return response.data;
    },

    getById: async (id) => {
        const response = await api.get(`/tests/${id}`);
        return response.data;
    },

    getByTeacher: async (teacherId) => {
        const response = await api.get(`/tests/teacher/${teacherId}`);
        return response.data;
    },

    create: async (testData) => {
        const response = await api.post('/tests', testData);
        return response.data;
    },

    update: async (id, testData) => {
        const response = await api.put(`/tests/${id}`, testData);
        return response.data;
    },

    delete: async (id) => {
        const response = await api.delete(`/tests/${id}`);
        return response.data;
    },

    publishResults: async (testId) => {
        const response = await api.post(`/tests/${testId}/publish-results`);
        return response.data;
    },

    unpublishResults: async (testId) => {
        const response = await api.post(`/tests/${testId}/unpublish-results`);
        return response.data;
    },
};

// ============================================
// STUDENT-SPECIFIC API (UPDATED WITH RESULT ACCESS STATUS)
// ============================================
export const studentAPI = {
    getDashboard: async () => {
        const response = await api.get('/student/dashboard');
        return response.data;
    },

    getAvailableTests: async () => {
        const response = await api.get('/student/tests');
        return response.data;
    },

    getAllTests: async () => {
        const response = await api.get('/student/all-tests');
        return response.data;
    },

    getTestById: async (testId) => {
        const response = await api.get(`/student/tests/${testId}`);
        return response.data;
    },

    submitTest: async (testId, answers) => {
        const response = await api.post(`/student/tests/${testId}/submit`, { answers });
        return response.data;
    },

    addQuestionsToTest: async (testId, questions) => {
        const response = await api.post(`/student/tests/${testId}/add-questions`, { questions });
        return response.data;
    },

    getTestResults: async () => {
        const response = await api.get('/student/test-results');
        return response.data;
    },

    getTestSchedule: async () => {
        const response = await api.get('/student/test-schedule');
        return response.data;
    },

    // ==========================================
    // RESULT ACCESS STATUS (NEW)
    // ==========================================

    getResultAccessStatus: async () => {
        const response = await api.get('/student/result-access-status');
        return response.data;
    },
};

// ============================================
// STUDENT SUBMISSIONS API
// ============================================
export const submissionsAPI = {
    getAll: async () => {
        const response = await api.get('/student-submissions');
        return response.data;
    },

    create: async (submissionData) => {
        const response = await api.post('/student-submissions', submissionData);
        return response.data;
    },

    update: async (id, submissionData) => {
        const response = await api.put(`/student-submissions/${id}`, submissionData);
        return response.data;
    },
};

// ============================================
// TEST RESULTS API
// ============================================
export const testResultsAPI = {
    getAll: async (params = {}) => {
        const response = await api.get('/test-results', { params });
        return response.data;
    },

    getByTest: async (testId) => {
        const response = await api.get(`/test-results/test/${testId}`);
        return response.data;
    },

    getByClass: async (classId, params = {}) => {
        const response = await api.get(`/test-results/class/${classId}`, { params });
        return response.data;
    },

    getByStudent: async (studentId) => {
        const response = await api.get(`/test-results/student/${studentId}`);
        return response.data;
    },

    exportCSV: async (testId) => {
        const response = await api.get(`/test-results/export/${testId}`, {
            responseType: 'blob',
        });
        return response.data;
    },

    submit: async (resultData) => {
        const response = await api.post('/test-results', resultData);
        return response.data;
    },

    delete: async (studentId, testId) => {
        const response = await api.delete(`/test-results/${studentId}/${testId}`);
        return response.data;
    },

    deleteAllForStudent: async (studentId) => {
        const response = await api.delete(`/test-results/student/${studentId}/all`);
        return response.data;
    },

    deleteAll: async () => {
        const response = await api.delete('/test-results/delete-all');
        return response.data;
    },
};

// ============================================
// SESSIONS API
// ============================================
export const sessionsAPI = {
    getAll: async () => {
        const response = await api.get('/sessions');
        return response.data;
    },

    getById: async (id) => {
        const response = await api.get(`/sessions/${id}`);
        return response.data;
    },

    create: async (sessionData) => {
        const response = await api.post('/sessions', sessionData);
        return response.data;
    },

    update: async (id, sessionData) => {
        const response = await api.put(`/sessions/${id}`, sessionData);
        return response.data;
    },

    delete: async (id) => {
        const response = await api.delete(`/sessions/${id}`);
        return response.data;
    },
};

// ============================================
// TERMS API
// ============================================
export const termsAPI = {
    getAll: async (params = {}) => {
        const response = await api.get('/terms', { params });
        return response.data;
    },

    getActive: async () => {
        const response = await api.get('/terms/active');
        return response.data;
    },

    getById: async (id) => {
        const response = await api.get(`/terms/${id}`);
        return response.data;
    },

    create: async (termData) => {
        const response = await api.post('/terms', termData);
        return response.data;
    },

    update: async (id, termData) => {
        const response = await api.put(`/terms/${id}`, termData);
        return response.data;
    },

    delete: async (id) => {
        const response = await api.delete(`/terms/${id}`);
        return response.data;
    },
};

// ===========================================
// GRADING SYSTEMS API
// ===========================================
export const gradingSystemsAPI = {
    getAll: async () => {
        const response = await api.get('/grading-systems');
        return response.data;
    },

    getDefault: async () => {
        const response = await api.get('/grading-systems/default');
        return response.data;
    },

    create: async (gradingData) => {
        const response = await api.post('/grading-systems', gradingData);
        return response.data;
    },

    update: async (id, gradingData) => {
        const response = await api.put(`/grading-systems/${id}`, gradingData);
        return response.data;
    },

    delete: async (id) => {
        const response = await api.delete(`/grading-systems/${id}`);
        return response.data;
    },
};

// ============================================
// ATTENDANCE API
// ============================================
export const attendanceAPI = {
    getByClass: async (classId, params = {}) => {
        const response = await api.get(`/attendance/class/${classId}`, { params });
        return response.data;
    },

    getByStudent: async (studentId, params = {}) => {
        const response = await api.get(`/attendance/student/${studentId}`, { params });
        return response.data;
    },

    upsert: async (attendanceData) => {
        const response = await api.post('/attendance', attendanceData);
        return response.data;
    },

    bulkUpsert: async (bulkData) => {
        const response = await api.post('/attendance/bulk', bulkData);
        return response.data;
    },

    getSummary: async (classId, params = {}) => {
        const response = await api.get(`/attendance/class/${classId}/summary`, { params });
        return response.data;
    },

    // ==========================================
    // STUDENT ATTENDANCE COUNTS (NEW)
    // ==========================================

    getStudentCountsByClass: async (classId, params = {}) => {
        const response = await api.get(`/attendance/class/${classId}/student-counts`, { params });
        return response.data;
    },

    // ==========================================
    // SCHOOL OPENING DAYS
    // ==========================================

    getSchoolOpenDays: async (params = {}) => {
        const response = await api.get('/attendance/school-open-days', { params });
        return response.data;
    },

    setSchoolOpenDays: async (data) => {
        const response = await api.post('/attendance/school-open-days', data);
        return response.data;
    },

    updateSchoolOpenDays: async (data) => {
        const response = await api.put('/attendance/school-open-days', data);
        return response.data;
    },

    deleteSchoolOpenDays: async (params = {}) => {
        const response = await api.delete('/attendance/school-open-days', { params });
        return response.data;
    },
};

// ============================================
// CONTINUOUS ASSESSMENTS API (Admin)
// ============================================
export const continuousAssessmentsAPI = {
    getAll: async (params = {}, config = {}) => {
        const response = await api.get('/continuous-assessments', { 
            params,
            ...config 
        });
        return response.data;
    },

    getById: async (id) => {
        const response = await api.get(`/continuous-assessments/${id}`);
        return response.data;
    },

    create: async (assessmentData) => {
        const response = await api.post('/continuous-assessments', assessmentData);
        return response.data;
    },

    bulkCreate: async (bulkData) => {
        const response = await api.post('/continuous-assessments/bulk', bulkData);
        return response.data;
    },

    submit: async (id) => {
        const response = await api.put(`/continuous-assessments/${id}/submit`);
        return response.data;
    },

    approve: async (id) => {
        const response = await api.put(`/continuous-assessments/${id}/approve`);
        return response.data;
    },

    unapprove: async (id) => {
        const response = await api.put(`/continuous-assessments/${id}/unapprove`);
        return response.data;
    },

    bulkReapprove: async (ids) => {
        const response = await api.post('/continuous-assessments/bulk/reapprove', { ids });
        return response.data;
    },

    // -------------------------------------------------
    // POST - Bulk approve assessments by filters
    // Approves ALL matching "submitted" records on the server side
    //
    // Usage:
    //   const result = await continuousAssessmentsAPI.bulkApproveByFilters({
    //     termId: '...',
    //     sessionId: '...',
    //     classId: '...',
    //     subjectId: '...',
    //     excludedIds: ['id1', 'id2']  // optional: IDs to exclude from approval
    //   });
    //
    // Returns: { success, message, data: { requested, found, modified, nowInApprovedStatus } }
    // -------------------------------------------------
    bulkApproveByFilters: async (filters) => {
        const response = await api.post('/continuous-assessments/bulk/approve-by-filters', filters);
        return response.data;
    },

    // -------------------------------------------------
    // POST - Bulk unapprove assessments
    // Can unapprove by IDs array OR by filters
    //
    // Usage with IDs:
    //   const result = await continuousAssessmentsAPI.bulkUnapprove({ ids: ['id1', 'id2', 'id3'] });
    //
    // Usage with filters (unapproves ALL matching):
    //   const result = await continuousAssessmentsAPI.bulkUnapprove({
    //     classId: '...',
    //     subjectId: '...',
    //     termId: '...',
    //     sessionId: '...'
    //   });
    //
    // Returns: { success, message, data: { requested, found, modified, nowInSubmittedStatus } }
    // -------------------------------------------------
    bulkUnapprove: async (data) => {
        const response = await api.post('/continuous-assessments/bulk/unapprove', data);
        return response.data;
    },

    delete: async (id) => {
        const response = await api.delete(`/continuous-assessments/${id}`);
        return response.data;
    },
};

// ============================================
// TEACHER CA UPLOAD API (Assignment-Protected)
// ============================================
export const teacherCAAPI = {
    getEligibleClassesSubjects: async () => {
        const response = await api.get('/teacher/ca/eligible');
        return response.data;
    },

    getStudentsForCA: async (classId, subjectId, params = {}) => {
        const response = await api.get(`/teacher/ca/${classId}/${subjectId}/students`, { params });
        return response.data;
    },

    uploadSingleCA: async (caData) => {
        const response = await api.post('/teacher/ca/upload', caData);
        return response.data;
    },

    uploadBulkCA: async (bulkData) => {
        const response = await api.post('/teacher/ca/upload/bulk', bulkData);
        return response.data;
    },

    submitForApproval: async (classId, subjectId, params = {}) => {
        const response = await api.put(`/teacher/ca/submit/${classId}/${subjectId}`, params);
        return response.data;
    },

    getMySubmissions: async (params = {}) => {
        const response = await api.get('/teacher-ca/submissions', { params });
        return response.data;
    },

    deleteDraftCA: async (caId) => {
        const response = await api.delete(`/teacher/ca/${caId}`);
        return response.data;
    },

    pushTestResultsAsCA: async (testId, payload) => {
        const response = await api.post('/api/teacher-ca/push-test-results', payload);
        return response.data;
    },

    getCASubjectsCount: async (params = {}) => {
        const response = await api.get('/teacher/ca/subjects-count', { params });
        const data = response.data;

        console.log('[getCASubjectsCount] Raw response:', data);

        if (data && typeof data === 'object' && data.success !== undefined) {
            const { totalSubjects, completedSubjects, pendingSubjects } = data.data || {};
            
            return {
                success: true,
                data: {
                    totalSubjects: totalSubjects || 0,
                    completedSubjects: completedSubjects || 0,
                    pendingSubjects: pendingSubjects || 0,
                    subjectsCount: completedSubjects || 0,
                    remainingSubjects: pendingSubjects || 0
                }
            };
        }

        if (typeof data === 'string') {
            const completedMatch = data.match(/completed\s+(\d+)\s+of\s+(\d+)/i);
            const needMatch = data.match(/(\d+)\s+subjects?\s+still\s+need/i);

            if (completedMatch) {
                return {
                    success: true,
                    data: {
                        subjectsCount: parseInt(completedMatch[1], 10),
                        totalSubjects: parseInt(completedMatch[2], 10),
                        completedSubjects: parseInt(completedMatch[1], 10),
                        pendingSubjects: parseInt(completedMatch[2], 10) - parseInt(completedMatch[1], 10)
                    }
                };
            }

            if (needMatch) {
                const remaining = parseInt(needMatch[1], 10);
                const totalMatch = data.match(/of\s+(\d+)/i);
                const total = totalMatch ? parseInt(totalMatch[1], 10) : remaining;

                return {
                    success: true,
                    data: {
                        subjectsCount: total - remaining,
                        totalSubjects: total,
                        completedSubjects: total - remaining,
                        pendingSubjects: remaining
                    }
                };
            }
        }

        return { success: false, data: null };
    },

    // -------------------------------------------------
    // GET - Get submitted subjects summary for teacher
    // Returns list of subjects teacher has submitted CA for
    //
    // Usage:
    //   const result = await teacherCAAPI.getSubmittedSubjects();
    //   const result = await teacherCAAPI.getSubmittedSubjects({ termId: '...', sessionId: '...' });
    //   const result = await teacherCAAPI.getSubmittedSubjects({ termId: '...', sessionId: '...', classId: '...' });
    //
    // Returns: {
    //   success: true,
    //   data: {
    //     submittedSubjects: [{
    //       assignmentId, classId, className, classLevel, classSection,
    //       subjectId, subjectName, subjectCode, status, stats: {
    //         totalStudents, draft, submitted, approved, latestUpdate
    //       }
    //     }, ...],
    //     allAssignedSubjects: [{ ... }],  // includes subjects not yet started
    //     summary: { totalAssigned, totalSubmitted, totalPending, totalApproved }
    //   },
    //   termInfo: { name, id },
    //   sessionInfo: { name, id }
    // }
    // -------------------------------------------------
    getSubmittedSubjects: async (params = {}) => {
        const response = await api.get('/teacher-ca/submitted-subjects', { params });
        return response.data;
    },
};

// ============================================
// TEACHER BROADSHEET API
// ============================================
export const teacherBroadsheetAPI = {
    // -------------------------------------------------
    // GET - Get broadsheet for assigned subjects only
    // URL: /teacher/broadsheet/:classId
    // Params: termId, sessionId, subjectFilter ('all' | 'assigned')
    //
    // Usage:
    //   // View ALL subjects (default)
    //   const result = await teacherBroadsheetAPI.getBroadsheet(classId);
    //
    //   // View only ASSIGNED subjects
    //   const result = await teacherBroadsheetAPI.getBroadsheet(classId, {
    //     subjectFilter: 'assigned'
    //   });
    //
    // Returns: {
    //   success: true,
    //   data: {
    //     classInfo: { classId, className, classLevel, classSection, classTeacher, isClassTeacher, assignedSubjects },
    //     termInfo: { id, name, status },
    //     sessionInfo: { id, name },
    //     subjects: [{ subjectId, subjectName, subjectCode }],
    //     subjectStats: [{ subjectId, subjectName, totalStudents, assessedStudents, averageScore, ...gradeDistribution }],
    //     students: [{ studentId, studentName, firstName, lastName, admissionNumber, gender, scores: {...}, totalScore, averageScore, position }, ...],
    //     statistics: { totalStudents, assessedStudents, highestTotal, lowestTotal, classAverage, passRate }
    //   }
    // }
    // -------------------------------------------------
    getBroadsheet: async (classId, params = {}) => {
        const response = await api.get(`/teacher/broadsheet/${classId}`, { params });
        return response.data;
    },

    // -------------------------------------------------
    // GET - Get all classes where teacher is the ASSIGNED class teacher
    // URL: /class-teacher/broadsheet
    // Params: termId, sessionId
    //
    // This endpoint returns a LIST of all classes where this teacher
    // is the assigned class teacher (Class.teacherId === req.user.id).
    // Use this to show a selection list before viewing a specific class broadsheet.
    //
    // Authorization:
    //   - Must be a teacher with role === 'teacher'
    //   - Only returns classes where teacher is the class teacher
    //
    // Usage:
    //   const result = await teacherBroadsheetAPI.getClassTeacherClasses();
    //   const result = await teacherBroadsheetAPI.getClassTeacherClasses({
    //     termId: '...',
    //     sessionId: '...'
    //   });
    //
    // Returns: {
    //   success: true,
    //   data: [{
    //     classId: '...',
    //     className: 'JSS 1A',
    //     classLevel: 'JSS 1',
    //     classSession: '...',
    //     studentCount: 45,
    //     subjectCount: 12,
    //     assessmentCount: 150,      // Number of approved CAs for this class
    //     commentCount: 40,          // Number of class teacher comments
    //     hasBroadsheetData: true,   // assessmentCount > 0
    //     hasComments: true,         // commentCount > 0
    //     completionPercentage: 89   // (commentCount / studentCount) * 100
    //   }, ...],
    //   meta: {
    //     termId: '...',
    //     termName: 'First Term',
    //     sessionId: '...',
    //     sessionName: '2024/2025',
    //     totalClasses: 3
    //   }
    // }
    //
    // Empty case (no classes assigned):
    //   {
    //     success: true,
    //     data: [],
    //     message: 'You are not assigned as a class teacher to any class. Contact admin for assignment.'
    //   }
    // -------------------------------------------------
    getClassTeacherClasses: async (params = {}) => {
        const response = await api.get('/class-teacher/broadsheet', { params });
        return response.data;
    },

    // -------------------------------------------------
    // GET - Class Teacher Broadadsheet (COMPLETE VIEW)
    // URL: /class-teacher/broadsheet/:classId
    // Params: termId, sessionId, includeSubjectTeachers
    //
    // IMPORTANT: This endpoint is ONLY accessible to the assigned class teacher.
    // It shows ALL subjects for the class, not just the teacher's assigned subjects.
    //
    // This allows the class teacher to see the FULL broadsheet with scores from
    // ALL subject teachers in the class, enabling them to:
    // - See the complete academic performance of every student
    // - Identify students with missing scores
    // - Compare performance across all subjects
    // - Have a holistic view for class teacher comments and principal comments
    //
    // Authorization:
    //   - Must be a teacher with role === 'teacher'
    //   - Must be the class teacher (Class.teacherId === req.user.id)
    //   - Regular teacher assignments are NOT sufficient
    //
    // Usage:
    //   // Get all subjects (default)
    //   const result = await teacherBroadsheetAPI.getClassTeacherBroadsheet(classId);
    //
    //   // Include subject teacher assignments in response
    //   const result = await teacherBroadsheetAPI.getClassTeacherBroadsheet(classId, {
    //     includeSubjectTeachers: 'true'
    //   });
    //
    // Returns: {
    //   success: true,
    //   data: {
    //     classInfo: {
    //       classId, className, classLevel, classSection, classSession, classFullName,
    //       classTeacher: { id, name, email } | null,
    //       totalSubjects, totalStudents
    //     },
    //     termInfo: { id, name, status },
    //     sessionInfo: { id, name },
    //     subjects: [{ subjectId, subjectName, subjectCode }],
    //     subjectStats: [{
    //       subjectId, subjectName, subjectCode,
    //       totalStudents, assessedStudents, notAssessedStudents,
    //       averageScore, highestScore, lowestScore, passCount, failCount, passRate,
    //       gradeDistribution: { A: 5, B: 10, C: 8, ... },
    //       teacherAssignment: { teacherId, teacherName } or null
    //     }, ...],
    //     students: [{
    //       studentId, studentName, firstName, lastName, admissionNumber, gender,
    //       scores: { [subjectId]: { testScore, noteTakingScore, assignmentScore, totalCA, examScore, totalScore, grade, remark } | null },
    //       totalScore, averageScore, position,
    //       subjectsWithScores, subjectsWithoutScores, totalSubjects,
    //       attendance: { timesPresent, timesOpen, percentage },
    //       classTeacherComment: '...'
    //     }, ...],
    //     attendance: { schoolOpenDays, totalPresent },
    //     statistics: {
    //       totalStudents, assessedStudents, notAssessedStudents,
    //       highestTotal, lowestTotal, classAverage,
    //       passRate, totalSubjects, subjectsWithScores,
    //       commentsCount, commentsPercentage
    //     },
    //     gradeDistribution: { A: 12, B: 18, C: 15, D: 8, E: 5, F: 2 },
    //     teacherAssignments: [{ teacherId, teacherName }, ...]  // Only if requested
    //   },
    //   meta: { generatedAt: '...' }
    // }
    // -------------------------------------------------
    getClassTeacherBroadsheet: async (classId, params = {}) => {
        const response = await api.get(`/class-teacher/broadsheet/${classId}`, { params });
        return response.data;
    },
};

// ============================================
// TEACHER MY ASSIGNMENTS API
// ============================================
export const myAssignmentsAPI = {
    getMyAssignments: async () => {
        const response = await api.get('/my-assignments');
        return response.data;
    },

    requestAssignment: async (classId, subjectId) => {
        const response = await api.post('/my-assignments/request', { class_id: classId, subject_id: subjectId });
        return response.data;
    },

    requestBulkAssignments: async (assignments) => {
        const response = await api.post('/my-assignments/bulk', { assignments });
        return response.data;
    },

    getAvailableOptions: async () => {
        const response = await api.get('/my-assignments/available');
        return response.data;
    },

    removeAssignment: async (assignmentId) => {
        const response = await api.delete(`/my-assignments/${assignmentId}`);
        return response.data;
    },
};

// ============================================
// PRINCIPAL COMMENTS API (UPDATED)
// ============================================
export const principalCommentsAPI = {
    getAll: async (params = {}) => {
        const response = await api.get('/principal-comments', { params });
        return response.data;
    },

    getById: async (id) => {
        const response = await api.get(`/principal-comments/${id}`);
        return response.data;
    },

    create: async (commentData) => {
        const response = await api.post('/principal-comments', commentData);
        return response.data;
    },

    update: async (id, commentData) => {
        const response = await api.put(`/principal-comments/${id}`, commentData);
        return response.data;
    },

    generate: async (generateData) => {
        const response = await api.post('/principal-comments/generate', generateData);
        return response.data;
    },

    delete: async (id) => {
        const response = await api.delete(`/principal-comments/${id}`);
        return response.data;
    },
};

// ============================================
// CLASS TEACHER COMMENTS API (UPDATED)
// ============================================
export const classTeacherCommentsAPI = {
    getAll: async (params = {}) => {
        const response = await api.get('/class-teacher-comments', { params });
        return response.data;
    },

    getByClass: async (classId, params = {}) => {
        const response = await api.get(`/class-teacher-comments/class/${classId}`, { params });
        return response.data;
    },

    getByStudent: async (studentId, classId) => {
        const response = await api.get(`/class-teacher-comments/student/${studentId}`, { 
            params: { class_id: classId } 
        });
        return response.data;
    },

    create: async (commentData) => {
        const response = await api.post('/class-teacher-comments', commentData);
        return response.data;
    },

    update: async (id, commentData) => {
        const response = await api.put(`/class-teacher-comments/${id}`, commentData);
        return response.data;
    },

    delete: async (id) => {
        const response = await api.delete(`/class-teacher-comments/${id}`);
        return response.data;
    },

    submitForApproval: async (classId, params = {}) => {
        const response = await api.put(`/class-teacher-comments/submit/${classId}`, params);
        return response.data;
    },

    approve: async (id) => {
        const response = await api.put(`/class-teacher-comments/${id}/approve`);
        return response.data;
    },

    unapprove: async (id) => {
        const response = await api.put(`/class-teacher-comments/${id}/unapprove`);
        return response.data;
    },

    bulkReapprove: async (ids) => {
        const response = await api.post('/class-teacher-comments/bulk/reapprove', { ids });
        return response.data;
    },

    getMyComments: async (params = {}) => {
        const response = await api.get('/class-teacher-comments/my', { params });
        return response.data;
    },

    getStudentsForComments: async (classId, params = {}) => {
        const response = await api.get(`/class-teacher-comments/${classId}/students`, { params });
        return response.data;
    },

    bulkCreate: async (bulkData) => {
        const response = await api.post('/class-teacher-comments/bulk', bulkData);
        return response.data;
    },

    getStats: async (params = {}) => {
        const response = await api.get('/class-teacher-comments/stats', { params });
        return response.data;
    },
};

// ============================================
// TEACHER COMMENTS API (Subject Teacher Remarks)
// ============================================
export const teacherCommentsAPI = {
    getAll: async (params = {}) => {
        const response = await api.get('/teacher-comments', { params });
        return response.data;
    },

    getByClass: async (classId, params = {}) => {
        const response = await api.get(`/teacher-comments/class/${classId}`, { params });
        return response.data;
    },

    getByStudent: async (studentId, params = {}) => {
        const response = await api.get(`/teacher-comments/student/${studentId}`, { params });
        return response.data;
    },

    getById: async (id) => {
        const response = await api.get(`/teacher-comments/${id}`);
        return response.data;
    },

    create: async (commentData) => {
        const response = await api.post('/teacher-comments', commentData);
        return response.data;
    },

    update: async (id, commentData) => {
        const response = await api.put(`/teacher-comments/${id}`, commentData);
        return response.data;
    },

    delete: async (id) => {
        const response = await api.delete(`/teacher-comments/${id}`);
        return response.data;
    },

    bulkCreate: async (bulkData) => {
        const response = await api.post('/teacher-comments/bulk', bulkData);
        return response.data;
    },

    submitForApproval: async (classId, subjectId, params = {}) => {
        const response = await api.put(`/teacher-comments/submit/${classId}/${subjectId}`, params);
        return response.data;
    },

    approve: async (id) => {
        const response = await api.put(`/teacher-comments/${id}/approve`);
        return response.data;
    },

    unapprove: async (id) => {
        const response = await api.put(`/teacher-comments/${id}/unapprove`);
        return response.data;
    },

    bulkReapprove: async (ids) => {
        const response = await api.post('/teacher-comments/bulk/reapprove', { ids });
        return response.data;
    },

    getMyComments: async (params = {}) => {
        const response = await api.get('/teacher/comments/my', { params });
        return response.data;
    },

    getStudentsForComments: async (classId, subjectId, params = {}) => {
        const response = await api.get(`/teacher/comments/${classId}/${subjectId}/students`, { params });
        return response.data;
    },

    getStats: async (params = {}) => {
        const response = await api.get('/teacher-comments/stats', { params });
        return response.data;
    },
};

// ============================================
// REPORT CARDS API (UPDATED FOR BULK PRINTING)
// ============================================
export const reportCardsAPI = {
    getStudentReport: async (studentId, params = {}) => {
        const response = await api.get(`/report-cards/student/${studentId}`, { params });
        return response.data;
    },

    getClassReport: async (classId, params = {}) => {
        const response = await api.get(`/report-cards/class/${classId}`, { params });
        return response.data;
    },

    checkResults: async (credentials) => {
        const response = await api.post('/student/check-results', credentials);
        return response.data;
    },

    getStatus: async (termId) => {
        const response = await api.get('/report-cards/status', {
            params: { termId }
        });
        return response.data;
    },

    getPrintData: async (termId, classIds) => {
        const idsString = Array.isArray(classIds) ? classIds.join(',') : classIds;
        const response = await api.get('/report-cards/print-data', {
            params: { 
                termId, 
                classIds: idsString 
            }
        });
        return response.data;
    },

    getStudentPrint: async (studentId, termId, sessionId = null) => {
        const params = { termId };
        if (sessionId) params.sessionId = sessionId;
        
        const response = await api.get(`/report-cards/student-print/${studentId}`, {
            params
        });
        return response.data;
    },

    getSingleClassPrintData: async (classId, termId) => {
        return await reportCardsAPI.getPrintData(termId, [classId]);
    },

    getAllClassesPrintData: async (termId) => {
        const classesResponse = await classesAPI.getAllForDropdown();
        const classes = classesResponse?.data || [];
        const classIds = classes.map(c => c._id);
        
        if (classIds.length === 0) {
            return { success: true, data: { classes: [], allStudents: [] } };
        }
        
        return await reportCardsAPI.getPrintData(termId, classIds);
    },
};

// ============================================
// SCHOOL SETTINGS API (NEW - For Report Card Header)
// ============================================
export const schoolSettingsAPI = {
    get: async () => {
        const response = await api.get('/school-settings');
        return response.data;
    },

    update: async (settingsData) => {
        const response = await api.put('/school-settings', settingsData);
        return response.data;
    },
};

// ============================================
// STUDENT PERFORMANCE API
// ============================================
export const performanceAPI = {
    getStudentPerformance: async (studentId) => {
        const response = await api.get(`/api/students/${studentId}/performance`);
        return response.data;
    },
};

// ============================================
// ADMIN CA FILTERING API (UPDATED WITH CLEAR APPROVAL STATUS + BULK UNAPPROVE)
// ============================================
export const adminCAAPI = {
    getFilterOptions: async (params = {}) => {
        const response = await api.get('/admin/ca/filter-options', { params });
        return response.data;
    },

    // -------------------------------------------------
    // GET - Get ALL active CAs (Admin CA View)
    // Fetches all active CAs without status filter by default
    // Status filter only applies if explicitly provided
    //
    // Usage:
    //   const result = await adminCAAPI.getAssessments();
    //   const result = await adminCAAPI.getAssessments({ termId: '...', sessionId: '...' });
    //   const result = await adminCAAPI.getAssessments({ status: 'approved' });
    //   const result = await adminCAAPI.getAssessments({ status: 'all' }); // No status filter
    //   const result = await adminCAAPI.getAssessments({ search: 'John' });
    //
    // Supported params: termId, sessionId, classId, subjectId, teacherId, status, search
    //
    // Returns: {
    //   success: true,
    //   data: [{ ... }],
    //   summary: { total: 150, byStatus: [{ status: 'approved', count: 100 }] }
    // }
    // -------------------------------------------------
    getAssessments: async (params = {}) => {
        const response = await api.get('/admin/ca/all', { params });
        return response.data;
    },

    // -------------------------------------------------
    // GET - Get ALL approved CAs for unapprove view
    // Fetches all approved CAs across ALL terms/sessions
    //
    // Usage:
    //   const result = await adminCAAPI.getAllApproved();
    //   const result = await adminCAAPI.getAllApproved({ classId: '...', subjectId: '...' });
    //
    // Returns: {
    //   success: true,
    //   data: [{ ... }],
    //   summary: { total: 150, byClassSubject: [{ termId, termName, sessionId, sessionName, count }] }
    // }
    // -------------------------------------------------
    getAllApproved: async (params = {}) => {
        const response = await api.get('/admin/ca/all-approved', { params });
        return response.data;
    },

    approve: async (id) => {
        const response = await api.put(`/continuous-assessments/${id}/approve`);
        return response.data;
    },

    unapprove: async (id) => {
        const response = await api.put(`/continuous-assessments/${id}/unapprove`);
        return response.data;
    },

    bulkApprove: async (ids) => {
        const response = await api.post('/continuous-assessments/bulk/reapprove', { ids });
        return response.data;
    },

    // -------------------------------------------------
    // POST - Bulk approve assessments by filters (Admin CA View)
    // Approves ALL matching "submitted" records on the server side
    //
    // Usage:
    //   const result = await adminCAAPI.bulkApproveByFilters({
    //     termId: '...',
    //     sessionId: '...',
    //     classId: '...',
    //     subjectId: '...',
    //     excludedIds: ['id1', 'id2']  // optional: IDs to exclude from approval
    //   });
    //
    // Returns: { success, message, data: { modified, nowInApprovedStatus } }
    // -------------------------------------------------
    bulkApproveByFilters: async (filters) => {
        const response = await api.post('/continuous-assessments/bulk/approve-by-filters', filters);
        return response.data;
    },

    // -------------------------------------------------
    // POST - Bulk unapprove assessments (Admin CA View)
    // Can unapprove by IDs array OR by filters
    //
    // Usage with IDs:
    //   const result = await adminCAAPI.bulkUnapprove({ ids: ['id1', 'id2', 'id3'] });
    //
    // Usage with filters (unapproves ALL matching):
    //   const result = await adminCAAPI.bulkUnapprove({
    //     classId: '...',
    //     subjectId: '...',
    //     termId: '...',
    //     sessionId: '...'
    //   });
    //
    // Returns: { success, message, data: { requested, found, modified, nowInSubmittedStatus } }
    // -------------------------------------------------
    bulkUnapprove: async (data) => {
        const response = await api.post('/continuous-assessments/bulk/unapprove', data);
        return response.data;
    },

    // ==========================================
    // CLEAR APPROVAL STATUS
    // ==========================================

    getClassesWithApproved: async (params = {}) => {
        const response = await api.get('/admin/ca/classes-with-approved', { params });
        return response.data;
    },

    getSubjectsWithApproved: async (classId, params = {}) => {
        const response = await api.get(`/admin/ca/classes/${classId}/subjects-with-approved`, { params });
        return response.data;
    },

    previewClearApproval: async (params = {}) => {
        const response = await api.get('/admin/ca/clear-approval-status/preview', { params });
        return response.data;
    },

    clearApprovalStatus: async (data) => {
        const response = await api.patch('/admin/ca/clear-approval-status', data);
        return response.data;
    },

    // -------------------------------------------------
    // PATCH - Clear approval by specific assessment IDs
    //
    // Usage:
    //   const result = await adminCAAPI.clearApprovalByIds(['id1', 'id2', 'id3'], 'draft');
    //
    // Returns: { success, message, data: { requested, found, modified, resetTo } }
    // -------------------------------------------------
    clearApprovalByIds: async (assessmentIds, resetTo = 'draft') => {
        const response = await api.patch('/admin/ca/clear-approval-status/by-ids', {
            assessmentIds,
            resetTo
        });
        return response.data;
    },
};

// ============================================
// ADMIN CA PROGRESS API (NEW)
// ============================================
export const adminCAProgressAPI = {
    getTeacherProgress: async (params = {}) => {
        const response = await api.get('/admin/ca/teacher-progress', { params });
        return response.data;
    },

    // -------------------------------------------------
    // GET - Get CA breakdown by specific teacher
    // Returns detailed breakdown of each class-subject combination for a teacher
    //
    // Usage:
    //   const result = await adminCAProgressAPI.getByTeacher(teacherId);
    //   const result = await adminCAProgressAPI.getByTeacher(teacherId, { termId: '...' });
    //   const result = await adminCAProgressAPI.getByTeacher(teacherId, { status: 'approved' });
    //
    // Returns: {
    //   success: true,
    //   data: {
    //     teacher: { id, name, email, username },
    //     assignments: 5,
    //     classSubjects: [{
    //       classId, className, classLevel, subjectId, subjectName, subjectCode,
    //       stats: { totalRecords, draft, submitted, approved, uniqueStudents, avgScore, latestUpdate }
    //     }, ...],
    //     summary: { totalClassSubjects, totalRecords, totalApproved, totalSubmitted, totalDraft }
    //   },
    //   termInfo: { name, id },
    //   sessionInfo: { name, id }
    // }
    // -------------------------------------------------
    getByTeacher: async (teacherId, params = {}) => {
        const response = await api.get(`/admin/ca/by-teacher/${teacherId}`, { params });
        return response.data;
    },
};

// ============================================
// RESULT ACCESS SCHEDULE API
// ============================================
export const resultScheduleAPI = {
    getCurrent: async (params = {}) => {
        const response = await api.get('/result-access-schedule', { params });
        return response.data;
    },

    getAll: async () => {
        const response = await api.get('/result-access-schedules');
        return response.data;
    },

    create: async (scheduleData) => {
        const payload = { ...scheduleData };

        if (payload.resultStartTime instanceof Date) {
            payload.resultStartTime = payload.resultStartTime.toISOString();
        }
        if (payload.resultDeadline instanceof Date) {
            payload.resultDeadline = payload.resultDeadline.toISOString();
        }

        try {
            const response = await api.post('/result-access-schedule', payload);
            
            if (response.data?.existingScheduleId) {
                return {
                    success: false,
                    alreadyExists: true,
                    scheduleId: response.data.existingScheduleId,
                    message: response.data.message
                };
            }
            
            return response.data;
        } catch (error) {
            const backendMessage = error.response?.data?.message || error.message;
            
            if (backendMessage?.includes('already exists')) {
                return {
                    success: false,
                    alreadyExists: true,
                    message: backendMessage
                };
            }

            throw error;
        }
    },

    update: async (id, updateData) => {
        const payload = { ...updateData };

        if (payload.resultStartTime instanceof Date) {
            payload.resultStartTime = payload.resultStartTime.toISOString();
        }
        if (payload.resultDeadline instanceof Date) {
            payload.resultDeadline = payload.resultDeadline.toISOString();
        }

        const response = await api.put(`/result-access-schedule/${id}`, payload);
        return response.data;
    },

    toggleActive: async (id) => {
        const response = await api.patch(`/result-access-schedule/${id}/toggle-active`);
        return response.data;
    },

    delete: async (id) => {
        const response = await api.delete(`/result-access-schedule/${id}`);
        return response.data;
    },
};

// ============================================
// PUBLIC API (No Authentication Required)
// ============================================
export const publicAPI = {
    getTerms: async (params = {}) => {
        const response = await api.get('/public/terms', { params });
        return response.data;
    },

    getSessions: async () => {
        const response = await api.get('/public/sessions');
        return response.data;
    },

    getResultAccessStatus: async () => {
        const response = await api.get('/public/result-access-status');
        return response.data;
    },
};

// ============================================
// ADMIN UTILITIES API
// ============================================
export const adminAPI = {
    addQuestionSetToTest: async (testId, questionSetId) => {
        const response = await api.post('/admin/add-questionset-to-test', { testId, questionSetId });
        return response.data;
    },

    fixAllTests: async () => {
        const response = await api.post('/admin/fix-all-tests');
        return response.data;
    },

    fixScienceTest: async () => {
        const response = await api.post('/admin/fix-science-test');
        return response.data;
    },

    fixTestDates: async () => {
        const response = await api.post('/admin/fix-test-dates');
        return response.data;
    },

    extendTestDates: async (testId, daysToExtend = 7) => {
        const response = await api.post('/admin/extend-test-dates', { testId, daysToExtend });
        return response.data;
    },

    extendAllTests: async (daysToExtend = 7) => {
        const response = await api.post('/admin/extend-all-tests', { daysToExtend });
        return response.data;
    },
};

// ============================================
// DIAGNOSTICS API
// ============================================
export const diagnosticsAPI = {
    diagnoseTestQuestions: async (testId) => {
        const response = await api.get(`/diagnose/test-questions/${testId}`);
        return response.data;
    },

    diagnoseStudentTests: async () => {
        const response = await api.get('/diagnose/student-tests');
        return response.data;
    },

    // -------------------------------------------------
    // GET - Debug CA entries (Admin only)
    // Shows grouped CA entries by term/session for debugging
    //
    // Usage:
    //   const result = await diagnosticsAPI.debugCAEntries();
    //   const result = await diagnosticsAPI.debugCAEntries({ teacherId: '...', classId: '...', subjectId: '...', status: 'approved' });
    //
    // Returns: {
    //   success: true,
    //   data: {
    //     activeTerm: { id, name, status },
    //     allTerms: [...],
    //     allSessions: [...],
    //     entriesByTermSession: [{
    //       termId, termName, termStatus, sessionId, sessionName,
    //       count, uniqueSubjects, uniqueStudents, latestCreated, latestUpdated
    //     }, ...],
    //     statusCounts: { draft: 10, submitted: 5, approved: 85 }
    //   }
    // }
    // -------------------------------------------------
    debugCAEntries: async (params = {}) => {
        const response = await api.get('/debug/ca-entries', { params });
        return response.data;
    },
};

// ===================================================================
// *** STUDENT CLASSES AND SCORES MANAGEMENT ***
// Fetch, Edit, Delete, and Update student scores
// ===================================================================
export const studentsClassesScoresAPI = {
    // -------------------------------------------------
    // GET - Get all students with their classes and scores
    // Query params: termId, sessionId, classId, subjectId, status, page, limit, search
    //
    // Usage:
    //   // Get all with default pagination
    //   const result = await studentsClassesScoresAPI.getAll();
    //
    //   // With filters
    //   const result = await studentsClassesScoresAPI.getAll({
    //     termId: '...',
    //     sessionId: '...',
    //     classId: '...',
    //     subjectId: '...',
    //     status: 'approved',
    //     page: 1,
    //     limit: 50,
    //     search: 'john'
    //   });
    //
    // Returns: {
    //   success: true,
    //   data: [{
    //     id: '...',
    //     student: { id, firstName, lastName, fullName, admissionNumber, gender },
    //     class: { id, name, level, section, session, fullName },
    //     subject: { id, name, code },
    //     teacher: { id, name },
    //     scores: { testScore, noteTakingScore, assignmentScore, totalCA, examScore, totalScore },
    //     grade: 'A',
    //     remark: 'Excellent',
    //     status: 'approved',
    //     approvedBy: 'Admin Name',
    //     updatedAt: '2025-01-15T10:30:00.000Z'
    //   }, ...],
    //   summary: {
    //     totalRecords: 150,
    //     scoredRecords: 145,
    //     averageScore: 72.5,
    //     highestScore: 98,
    //     lowestScore: 25,
    //     statusBreakdown: { draft: 5, submitted: 10, approved: 135 }
    //   },
    //   pagination: { page: 1, limit: 50, total: 150, pages: 3 },
    //   meta: { termName: 'First Term', sessionName: '2024/2025', termId: '...', sessionId: '...' }
    // }
    // -------------------------------------------------
    getAll: async (params = {}) => {
        const response = await api.get('/api/students-classes-scores', { params });
        return response.data;
    },

    // -------------------------------------------------
    // GET - Get single student's complete classes and scores
    // Query params: termId, sessionId, classId, subjectId, status
    //
    // Usage:
    //   const result = await studentsClassesScoresAPI.getByStudentId(studentId);
    //   const result = await studentsClassesScoresAPI.getByStudentId(studentId, { termId: '...', sessionId: '...' });
    //
    // Returns: {
    //   success: true,
    //   data: {
    //     student: { _id, firstName, lastName, admissionNumber, gender, class: { id, name, level, section, fullName, teacher } },
    //     term: { id, name },
    //     session: { id, name },
    //     subjects: [{
    //       subjectId, subjectName, subjectCode,
    //       hasScore: true,
    //       assessment: { id, testScore, noteTakingScore, assignmentScore, totalCA, examScore, totalScore, grade, remark, status, teacherName, approvedBy, updatedAt }
    //     }, ...],
    //     otherClassScores: [{ id, className, subjectName, testScore, ..., grade }],
    //     summary: { totalSubjects, subjectsWithScores, subjectsWithoutScores, totalScore, averageScore, highestScore, lowestScore, gradeDistribution, statusBreakdown }
    //   }
    // }
    // -------------------------------------------------
    getByStudentId: async (studentId, params = {}) => {
        const response = await api.get(`/api/students-classes-scores/${studentId}`, { params });
        return response.data;
    },

    // -------------------------------------------------
    // POST - Create a new score record for a student
    // Body: {
    //   studentId, classId, subjectId, termId, sessionId, teacherId,
    //   testScore, noteTakingScore, assignmentScore, examScore, status
    // }
    //
    // Usage:
    //   const result = await studentsClassesScoresAPI.create({
    //     studentId: '...',
    //     classId: '...',
    //     subjectId: '...',
    //     termId: '...',
    //     sessionId: '...',
    //     testScore: 15,
    //     noteTakingScore: 8,
    //     assignmentScore: 9,
    //     examScore: 45,
    //     status: 'draft'  // optional: 'draft' (default) | 'submitted' | 'approved'
    //   });
    //
    // Returns: {
    //   success: true,
    //   message: 'Score record created successfully.',
    //   data: {
    //     id: '...',
    //     student: { id, name, admissionNumber },
    //     class: { id, name },
    //     subject: { id, name },
    //     scores: { testScore: 15, noteTakingScore: 8, assignmentScore: 9, totalCA: 32, examScore: 45, totalScore: 77 },
    //     grade: 'A',
    //     status: 'draft',
    //     updatedAt: '2025-01-15T10:30:00.000Z'
    //   }
    // }
    // -------------------------------------------------
    create: async (scoreData) => {
        const response = await api.post('/api/students-classes-scores', scoreData);
        return response.data;
    },

    // -------------------------------------------------
    // PUT - Edit a student's score record
    // URL param: assessmentId
    // Body: { testScore, noteTakingScore, assignmentScore, examScore, status }
    //
    // Usage:
    //   const result = await studentsClassesScoresAPI.update(assessmentId, {
    //     testScore: 18,
    //     noteTakingScore: 7,
    //     assignmentScore: 10,
    //     examScore: 50,
    //     status: 'approved'
    //   });
    //
    // Returns: {
    //   success: true,
    //   message: 'Score record updated successfully.',
    //   data: {
    //     id: '...',
    //     student: { id, name, admissionNumber },
    //     class: { id, name },
    //     subject: { id, name },
    //     scores: { testScore: 18, noteTakingScore: 7, assignmentScore: 10, totalCA: 35, examScore: 50, totalScore: 85 },
    //     grade: 'A',
    //     status: 'approved',
    //     approvedBy: 'Admin Name',
    //     updatedAt: '2025-01-15T10:30:00.000Z'
    //   },
    //   changes: {
    //     oldValues: { testScore: 15, noteTakingScore: 8, ..., totalScore: 77, grade: 'A', status: 'draft' },
    //     newValues: { totalScore: 85, grade: 'A', status: 'approved' }
    //   }
    // }
    // -------------------------------------------------
    update: async (assessmentId, scoreData) => {
        const response = await api.put(`/api/students-classes-scores/${assessmentId}`, scoreData);
        return response.data;
    },

    // -------------------------------------------------
    // DELETE - Delete a student's score record
    // URL param: assessmentId
    //
    // Note: 
    //   - Teachers: Can only delete their own non-approved records
    //   - Admins: Can delete any record; approved records are soft-deleted
    //
    // Returns: {
    //   success: true,
    //   message: 'Score record deleted for John Doe (Mathematics).',
    //   data: { id, studentName: 'John Doe', subjectName: 'Mathematics', softDeleted: false }
    // }
    // -------------------------------------------------
    delete: async (assessmentId) => {
        const response = await api.delete(`/api/students-classes-scores/${assessmentId}`);
        return response.data;
    },

    // -------------------------------------------------
    // PATCH - Bulk update scores for multiple students
    // Body: {
    //   termId, sessionId, classId, subjectId,
    //   updates: [
    //     { studentId, testScore?, noteTakingScore?, assignmentScore?, examScore?, status? },
    //     ...
    //   ],
    //   approveAfterUpdate?: boolean
    // }
    //
    // Usage:
    //   const result = await studentsClassesScoresAPI.bulkUpdate({
    //     termId: '...',
    //     sessionId: '...',
    //     classId: '...',           // optional (uses student's current class if omitted)
    //     subjectId: '...',        // REQUIRED
    //     approveAfterUpdate: true,   // optional: auto-approve all edits (default: false)
    //     updates: [
    //       { studentId: '...', testScore: 15, noteTakingScore: 8, assignmentScore: 9, examScore: 45 },
    //       { studentId: '...', testScore: 18, noteTakingScore: 7, assignmentScore: 10, examScore: 50 },
    //       { studentId: '...', status: 'approved' }  // only change status
    //     ]
    //   });
    //
    // Returns: {
    //   success: true,
    //   message: 'Bulk update completed. Created: 1, Updated: 1, Failed: 0.',
    //   data: {
    //     summary: { created: 1, updated: 1, failed: 0, total: 2 },
    //     results: [{ studentId, action: 'created'|'updated', totalScore, grade }],
    //     errors: [{ index, studentId, message }] // only present if there are errors
    //   }
    // }
    // -------------------------------------------------
    bulkUpdate: async (data) => {
        const response = await api.patch('/api/students-classes-scores/bulk', data);
        return response.data;
    },

    // -------------------------------------------------
    // DELETE - Bulk delete score records
    // Body: { assessmentIds: [...], force?: boolean }
    //
    // Usage:
    //   const result = await studentsClassesScoresAPI.bulkDelete(['id1', 'id2', 'id3']);
    //   const result = await studentsClassesScoresAPI.bulkDelete(['id1', 'id2'], true); // force delete approved records too
    //
    // Note:
    //   - Teachers: Can only delete their own non-approved records
    //   - Admins: Can delete any record; approved records require force=true for soft delete
    //
    // Returns: {
    //   success: true,
    //   message: 'Bulk delete completed.',
    //   data: {
    //     summary: { requested: 3, validIds: 3, deleted: 2, notFound: 0 }
    //   }
    // }
    // -------------------------------------------------
    bulkDelete: async (assessmentIds, force = false) => {
        const response = await api.delete('/api/students-classes-scores/bulk', { 
            assessmentIds, 
            force 
        });
        return response.data;
    },

    // -------------------------------------------------
    // GET - Get student's score summary by class (with positions)
    // URL param: classId
    // Query params: termId, sessionId, subjectId
    //
    // Usage:
    //   const result = await studentsClassesScoresAPI.getSummaryByClass(classId);
    //   const result = await studentsClassesScoresAPI.getSummaryByClass(classId, { termId: '...', subjectId: '...' });
    //
    // Returns: {
    //   success: true,
    //   data: {
    //     class: { id, name, level, section, fullName: 'JSS 1A' },
    //     term: { id, name: 'First Term' },
    //     session: { id, name: '2024/2025' },
    //     students: [{
    //       studentId, studentName, firstName, lastName, admissionNumber, gender, position,
    //       subjects: [{ subjectId, subjectName, subjectCode, testScore, ..., totalScore, grade, status }],
    //       totalScore, averageScore, subjectsWithScores, totalSubjects
    //     }, ...],
    //     classStatistics: {
    //       totalStudents: 45,
    //       studentsWithScores: 40,
    //       studentsWithoutScores: 5,
    //       classAverage: 72.5,
    //       highestAverage: 98,
    //       lowestAverage: 45
    //     }
    //   }
    // }
    // -------------------------------------------------
    getSummaryByClass: async (classId, params = {}) => {
        const response = await api.get(`/api/students-classes-scores/summary/${classId}`, { params });
        return response.data;
    },
};

// ===================================================================
// *** END OF STUDENT CLASSES AND SCORES MANAGEMENT ***
// ===================================================================

// ============================================
// HELPER FUNCTIONS
// ============================================

// Save auth data to localStorage
export const saveAuthData = (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
};

// Get auth data from localStorage
export const getAuthData = () => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    return { token, user };
};

// Clear auth data from localStorage
export const clearAuthData = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
};

// Check if user is authenticated
export const isAuthenticated = () => {
    const token = localStorage.getItem('token');
    return !!token;
};

// Get current user role
export const getUserRole = () => {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    return user?.role || null;
};

// Download CSV file
export const downloadCSV = async (testId, filename) => {
    try {
        const blob = await testResultsAPI.exportCSV(testId);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename || 'test_results.csv');
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error downloading CSV:', error);
        throw error;
    }
};

// Default export - the main api instance
export default api;
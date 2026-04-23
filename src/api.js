import axios from 'axios';

// Base API configuration
const API_BASE_URL = 'http://localhost:5000';

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
    // Returns: { success: true, data: [{ _id, name, firstName, lastName, email, lastLogin, device, ip }] }
    getLastTeacherLogins: async () => {
        const response = await api.get('/dashboard/teacher-logins');
        return response.data;
    },

    // ==========================================
    // TEACHER ASSIGNMENTS (For AssignTeachers component)
    // ==========================================

    // Get all teachers (for dropdown selection)
    getTeachers: async () => {
        const response = await api.get('/teachers');
        return response.data;
    },

    // ✅ FIXED: Get ALL classes (for dropdown selection) - no pagination limit
    getClasses: async () => {
        const response = await api.get('/classes', {
            params: {
                limit: 1000 // Fetch all classes instead of default 10
            }
        });
        return response.data;
    },

    // Get all subjects (for dropdown selection)
    getSubjects: async () => {
        const response = await api.get('/subjects');
        return response.data;
    },

    // Get all teacher assignments with joined data
    getTeacherAssignments: async () => {
        const response = await api.get('/teacher-assignments');
        return response.data;
    },

    // Create a new teacher assignment
    createTeacherAssignment: async (assignmentData) => {
        const response = await api.post('/teacher-assignments', assignmentData);
        return response.data;
    },

    // Update an existing teacher assignment
    updateTeacherAssignment: async (id, assignmentData) => {
        const response = await api.put(`/teacher-assignments/${id}`, assignmentData);
        return response.data;
    },

    // Delete a teacher assignment
    deleteTeacherAssignment: async (id) => {
        const response = await api.delete(`/teacher-assignments/${id}`);
        return response.data;
    },

    // Check if assignment already exists
    checkAssignmentExists: async (teacherId, classId, subjectId) => {
        const response = await api.get('/teacher-assignments/check', {
            params: { teacher_id: teacherId, class_id: classId, subject_id: subjectId }
        });
        return response.data;
    },

    // Get assignments by specific teacher
    getAssignmentsByTeacher: async (teacherId) => {
        const response = await api.get(`/teacher-assignments/teacher/${teacherId}`);
        return response.data;
    },

    // Get assignments by specific class
    getAssignmentsByClass: async (classId) => {
        const response = await api.get(`/teacher-assignments/class/${classId}`);
        return response.data;
    },

    // Get assignments by specific subject
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
        // Backend now auto-generates the admission number (e.g., DIS/2025/001)
        // We explicitly remove it from the payload if the frontend form accidentally sends it
        const { admissionNumber, ...dataToSubmit } = studentData;
        
        const response = await api.post('/students', dataToSubmit);
        return response.data; // Response will contain the newly generated admission number
    },

    update: async (id, studentData) => {
        // Backend prevents admission number from being changed after creation
        // We strip it out to ensure no accidental overwrites happen
        const { admissionNumber, ...dataToSubmit } = studentData;
        
        const response = await api.put(`/students/${id}`, dataToSubmit);
        return response.data;
    },

    // SOFT DELETE: Moves student to Recycle Bin (hides them and all their data)
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

    // Toggle fees access (grant/revoke) for a student
    // Admin only - allows temporary login access for students owing fees
    // Returns: { success: true, message: '...', data: { _id, firstName, lastName, admissionNumber, owingFees, feesAccessGranted } }
    toggleFeesAccess: async (studentId) => {
        const response = await api.patch(`/students/${studentId}/toggle-fees-access`);
        return response.data;
    },

    // Toggle owing status for a student
    // Admin only - marks student as owing or clears their fees
    // Note: Clearing fees (marking as NOT owing) automatically revokes any granted access
    // Returns: { success: true, message: '...', data: { _id, firstName, lastName, admissionNumber, owingFees, feesAccessGranted } }
    toggleOwing: async (studentId) => {
        const response = await api.patch(`/students/${studentId}/toggle-owing`);
        return response.data;
    },

    // ==========================================
    // RESULT ACCESS BLOCKING (NEW)
    // ==========================================

    // Toggle individual student result access (block/unblock)
    // Admin only - toggles the student's ability to view their results
    // Returns: { success: true, message: '...', data: { _id, firstName, lastName, admissionNumber, resultAccessBlocked, resultBlockReason, resultBlockedAt } }
    toggleResultAccess: async (studentId) => {
        const response = await api.patch(`/students/${studentId}/toggle-result-access`);
        return response.data;
    },

    // Set student result block with explicit reason
    // Admin only - explicitly sets blocked status with a reason message
    // Usage: await studentsAPI.blockResultAccess(studentId, { blocked: true, reason: 'Outstanding fees - contact bursar' })
    // Returns: { success: true, message: '...', data: { _id, firstName, lastName, admissionNumber, resultAccessBlocked, resultBlockReason, resultBlockedAt } }
    blockResultAccess: async (studentId, data) => {
        const response = await api.patch(`/students/${studentId}/block-result-access`, data);
        return response.data;
    },

    // Bulk block/unblock result access for students
    // Admin only - can target by classId, studentIds array, or both
    // Usage: await studentsAPI.bulkResultAccess({ classId: '...', blocked: true, reason: '...' })
    //        OR await studentsAPI.bulkResultAccess({ studentIds: ['id1', 'id2'], blocked: false })
    // Returns: { success: true, message: '...', data: { modified: number, matched: number } }
    bulkResultAccess: async (data) => {
        const response = await api.patch('/students/bulk-result-access', data);
        return response.data;
    },

    // ==========================================
    // RECYCLE BIN MANAGEMENT
    // ==========================================

    // Get all soft-deleted students in the recycle bin
    // Usage: const deletedStudents = await studentsAPI.getRecycleBin();
    getRecycleBin: async () => {
        const response = await api.get('/students/recycle-bin');
        return response.data;
    },

    // Restore a student and all their hidden data from the recycle bin
    // Usage: await studentsAPI.restoreFromRecycleBin(studentId);
    restoreFromRecycleBin: async (id) => {
        const response = await api.patch(`/students/recycle-bin/${id}/restore`);
        return response.data;
    },

    // Permanently delete a student and wipe ALL their data from the database forever
    // Usage: await studentsAPI.permanentlyDelete(studentId);
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
    // Get all classes with pagination and filtering
    getAll: async (params = {}) => {
        const response = await api.get('/classes', { params });
        return response.data;
    },

    // ✅ FIXED: Get ALL classes without pagination (for dropdowns)
    getAllForDropdown: async () => {
        const response = await api.get('/classes', {
            params: {
                limit: 1000
            }
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

    // Toggle class result access (block/unblock)
    // Admin only - toggles result access for ALL students in a class
    // Returns: { success: true, message: '...', data: { _id, name, section, level, resultAccessBlocked, resultBlockReason, resultBlockedAt, affectedStudents } }
    toggleResultAccess: async (classId) => {
        const response = await api.patch(`/classes/${classId}/toggle-result-access`);
        return response.data;
    },

    // Set class result block with explicit reason
    // Admin only - explicitly sets blocked status with a reason message
    // Usage: await classesAPI.blockResultAccess(classId, { blocked: true, reason: 'Results pending approval' })
    // Returns: { success: true, message: '...', data: { _id, name, section, level, resultAccessBlocked, resultBlockReason, resultBlockedAt, affectedStudents } }
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

    // Get result access status for logged-in student (for dashboard display)
    // Returns: {
    //   success: true,
    //   data: {
    //     canAccess: boolean,
    //     studentBlocked: boolean,
    //     classBlocked: boolean,
    //     scheduleActive: boolean,
    //     scheduleStatus: 'active' | 'before_start' | 'deadline_passed' | null,
    //     scheduleDetails: { resultStartTime, resultDeadline, message, timeRemaining } | null,
    //     blockReason: string | null
    //   }
    // }
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
    // Get attendance records for a specific class
    // Returns array of { student_id, timesPresent, term, session }
    getByClass: async (classId, params = {}) => {
        const response = await api.get(`/attendance/class/${classId}`, { params });
        return response.data;
    },

    // Get attendance record for a specific student
    getByStudent: async (studentId, params = {}) => {
        const response = await api.get(`/attendance/student/${studentId}`, { params });
        return response.data;
    },

    // Create or update (upsert) attendance for a student
    upsert: async (attendanceData) => {
        const response = await api.post('/attendance', attendanceData);
        return response.data;
    },

    // Bulk upsert attendance for multiple students in a class
    bulkUpsert: async (bulkData) => {
        const response = await api.post('/attendance/bulk', bulkData);
        return response.data;
    },

    // Get attendance summary for a class (optional aggregated view)
    getSummary: async (classId, params = {}) => {
        const response = await api.get(`/attendance/class/${classId}/summary`, { params });
        return response.data;
    },

    // ==========================================
    // STUDENT ATTENDANCE COUNTS (NEW)
    // ==========================================

    // Get attendance counts per student for a class, filtered by term/session
    // Usage: await attendanceAPI.getStudentCountsByClass(classId, { term: 'First Term', session: '2024/2025' })
    // Returns: { success: true, data: [{ student_id, times_present }, ...], schoolOpenDays: number | null }
    getStudentCountsByClass: async (classId, params = {}) => {
        const response = await api.get(`/attendance/class/${classId}/student-counts`, { params });
        return response.data;
    },

    // ==========================================
    // SCHOOL OPENING DAYS
    // ==========================================

    // Get the number of times school has opened for a term/session
    // Usage: await attendanceAPI.getSchoolOpenDays({ term_id: '...', session_id: '...' })
    // Returns: { success: true, data: { id, times_open: 45, term_id, session_id, ... } }
    getSchoolOpenDays: async (params = {}) => {
        const response = await api.get('/attendance/school-open-days', { params });
        return response.data;
    },

    // Set or update the number of times school has opened (creates if not exists)
    // Usage: await attendanceAPI.setSchoolOpenDays({ term_id: '...', session_id: '...', times_open: 45 })
    // Returns: { success: true, message: '...', data: { id, times_open, ... } }
    setSchoolOpenDays: async (data) => {
        const response = await api.post('/attendance/school-open-days', data);
        return response.data;
    },

    // Update school open days (supports increment by 1 OR set specific value)
    // Usage (increment): await attendanceAPI.updateSchoolOpenDays({ term_id: '...', session_id: '...', increment: true })
    // Usage (set value): await attendanceAPI.updateSchoolOpenDays({ term_id: '...', session_id: '...', times_open: 46 })
    // Returns: { success: true, message: '...', data: { id, times_open, ... } }
    updateSchoolOpenDays: async (data) => {
        const response = await api.put('/attendance/school-open-days', data);
        return response.data;
    },

    // Delete school open days record for a term/session
    // Usage: await attendanceAPI.deleteSchoolOpenDays({ term_id: '...', session_id: '...' })
    // Returns: { success: true, message: '...' }
    deleteSchoolOpenDays: async (params = {}) => {
        const response = await api.delete('/attendance/school-open-days', { params });
        return response.data;
    },
};

// ============================================
// CONTINUOUS ASSESSMENTS API (Admin)
// ============================================
export const continuousAssessmentsAPI = {
    getAll: async (params = {}) => {
        const response = await api.get('/continuous-assessments', { params });
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

    // ✅ NEW: Bulk re-approve multiple assessments at once
    // Usage: await continuousAssessmentsAPI.bulkReapprove(['id1', 'id2', 'id3']);
    bulkReapprove: async (ids) => {
        const response = await api.post('/continuous-assessments/bulk/reapprove', { ids });
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
        const response = await api.get('/teacher/ca/submissions', { params });
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

    // Get count of subjects where the teacher has entered CA scores
    // Backend returns: { success: true, data: { totalSubjects, completedSubjects, pendingSubjects } }
    // We normalize it to also include: subjectsCount (for backward compatibility)
    getCASubjectsCount: async () => {
        const response = await api.get('/teacher/ca/subjects-count');
        const data = response.data;

        console.log('[getCASubjectsCount] Raw response:', data);

        // Handle proper JSON format from backend
        if (data && typeof data === 'object' && data.success !== undefined) {
            const { totalSubjects, completedSubjects, pendingSubjects } = data.data || {};
            
            return {
                success: true,
                data: {
                    // New field names (from backend)
                    totalSubjects: totalSubjects || 0,
                    completedSubjects: completedSubjects || 0,
                    pendingSubjects: pendingSubjects || 0,
                    // Backward compatibility aliases
                    subjectsCount: completedSubjects || 0,
                    remainingSubjects: pendingSubjects || 0
                }
            };
        }

        // Handle plain text response from backend (legacy fallback)
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

        // Fallback for unexpected formats
        return { success: false, data: null };
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

    // ✅ NEW: Update an existing comment
    update: async (id, commentData) => {
        const response = await api.put(`/principal-comments/${id}`, commentData);
        return response.data;
    },

    // ✅ UPDATED: Generate comments using fixed percentage-based templates
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
    // Get all class teacher comments with optional filtering & pagination
    getAll: async (params = {}) => {
        const response = await api.get('/class-teacher-comments', { params });
        return response.data;
    },

    // Get class teacher comments for a specific class (supports termId filtering)
    getByClass: async (classId, params = {}) => {
        const response = await api.get(`/class-teacher-comments/class/${classId}`, { params });
        return response.data;
    },

    // Get class teacher comment for a specific student in a class
    getByStudent: async (studentId, classId) => {
        const response = await api.get(`/class-teacher-comments/student/${studentId}`, { 
            params: { class_id: classId } 
        });
        return response.data;
    },

    // Create a new class teacher comment
    create: async (commentData) => {
        const response = await api.post('/class-teacher-comments', commentData);
        return response.data;
    },

    // Update an existing class teacher comment
    update: async (id, commentData) => {
        const response = await api.put(`/class-teacher-comments/${id}`, commentData);
        return response.data;
    },

    // Delete a class teacher comment
    delete: async (id) => {
        const response = await api.delete(`/class-teacher-comments/${id}`);
        return response.data;
    },

    // Submit all draft comments for a class for admin approval
    submitForApproval: async (classId, params = {}) => {
        const response = await api.put(`/class-teacher-comments/submit/${classId}`, params);
        return response.data;
    },

    // Admin: Approve a submitted comment
    approve: async (id) => {
        const response = await api.put(`/class-teacher-comments/${id}/approve`);
        return response.data;
    },

    // Admin: Unapprove (revert to submitted) an approved comment
    unapprove: async (id) => {
        const response = await api.put(`/class-teacher-comments/${id}/unapprove`);
        return response.data;
    },

    // ✅ NEW: Bulk re-approve multiple class teacher comments at once
    // Usage: await classTeacherCommentsAPI.bulkReapprove(['id1', 'id2', 'id3']);
    bulkReapprove: async (ids) => {
        const response = await api.post('/class-teacher-comments/bulk/reapprove', { ids });
        return response.data;
    },

    // Teacher: Get own class teacher comments with summary statistics
    getMyComments: async (params = {}) => {
        const response = await api.get('/class-teacher-comments/my', { params });
        return response.data;
    },

    // Get students list with existing class teacher comments for a class
    getStudentsForComments: async (classId, params = {}) => {
        const response = await api.get(`/class-teacher-comments/${classId}/students`, { params });
        return response.data;
    },

    // Bulk create/update multiple class teacher comments
    bulkCreate: async (bulkData) => {
        const response = await api.post('/class-teacher-comments/bulk', bulkData);
        return response.data;
    },

    // Get aggregated statistics for class teacher comments
    getStats: async (params = {}) => {
        const response = await api.get('/class-teacher-comments/stats', { params });
        return response.data;
    },
};

// ============================================
// TEACHER COMMENTS API (Subject Teacher Remarks)
// ============================================
export const teacherCommentsAPI = {
    // Get all teacher comments (admin/teacher view with filtering & pagination)
    getAll: async (params = {}) => {
        const response = await api.get('/teacher-comments', { params });
        return response.data;
    },

    // Get comments grouped by student for a specific class
    getByClass: async (classId, params = {}) => {
        const response = await api.get(`/teacher-comments/class/${classId}`, { params });
        return response.data;
    },

    // Get comments for a specific student (used in report cards)
    getByStudent: async (studentId, params = {}) => {
        const response = await api.get(`/teacher-comments/student/${studentId}`, { params });
        return response.data;
    },

    // Get a single comment by ID
    getById: async (id) => {
        const response = await api.get(`/teacher-comments/${id}`);
        return response.data;
    },

    // Create or update (upsert) a single teacher comment
    create: async (commentData) => {
        const response = await api.post('/teacher-comments', commentData);
        return response.data;
    },

    // Update an existing teacher comment
    update: async (id, commentData) => {
        const response = await api.put(`/teacher-comments/${id}`, commentData);
        return response.data;
    },

    // Soft delete a teacher comment
    delete: async (id) => {
        const response = await api.delete(`/teacher-comments/${id}`);
        return response.data;
    },

    // Bulk create/update multiple comments at once
    bulkCreate: async (bulkData) => {
        const response = await api.post('/teacher-comments/bulk', bulkData);
        return response.data;
    },

    // Submit all draft comments for a class/subject for admin approval
    submitForApproval: async (classId, subjectId, params = {}) => {
        const response = await api.put(`/teacher-comments/submit/${classId}/${subjectId}`, params);
        return response.data;
    },

    // Admin: Approve a submitted comment
    approve: async (id) => {
        const response = await api.put(`/teacher-comments/${id}/approve`);
        return response.data;
    },

    // Admin: Unapprove (revert to submitted) an approved comment
    unapprove: async (id) => {
        const response = await api.put(`/teacher-comments/${id}/unapprove`);
        return response.data;
    },

    // ✅ NEW: Bulk re-approve multiple teacher comments at once
    // Usage: await teacherCommentsAPI.bulkReapprove(['id1', 'id2', 'id3']);
    bulkReapprove: async (ids) => {
        const response = await api.post('/teacher-comments/bulk/reapprove', { ids });
        return response.data;
    },

    // Teacher: Get own comments with summary statistics for the dashboard
    getMyComments: async (params = {}) => {
        const response = await api.get('/teacher/comments/my', { params });
        return response.data;
    },

    // Teacher: Get list of students in assigned class/subject with existing comments
    getStudentsForComments: async (classId, subjectId, params = {}) => {
        const response = await api.get(`/teacher/comments/${classId}/${subjectId}/students`, { params });
        return response.data;
    },

    // Get aggregated statistics for teacher comments
    getStats: async (params = {}) => {
        const response = await api.get('/teacher-comments/stats', { params });
        return response.data;
    },
};

// ============================================
// REPORT CARDS API (UPDATED FOR BULK PRINTING)
// ============================================
export const reportCardsAPI = {
    // ==========================================
    // EXISTING ENDPOINTS
    // ==========================================

    // Get student report card data (existing)
    getStudentReport: async (studentId, params = {}) => {
        const response = await api.get(`/report-cards/student/${studentId}`, { params });
        return response.data;
    },

    // Get class report cards summary (existing)
    getClassReport: async (classId, params = {}) => {
        const response = await api.get(`/report-cards/class/${classId}`, { params });
        return response.data;
    },

    // Public endpoint for students to check results (existing)
    // NOTE: This endpoint now returns blocking codes:
    //   - FEES_BLOCKED: Student owes fees
    //   - STUDENT_BLOCKED: Student individually blocked
    //   - CLASS_BLOCKED: Student's class is blocked
    //   - RESULTS_NOT_YET_AVAILABLE: Before result schedule start time
    //   - RESULTS_DEADLINE_PASSED: After result schedule deadline
    checkResults: async (credentials) => {
        const response = await api.post('/student/check-results', credentials);
        return response.data;
    },

    // ==========================================
    // NEW: BULK STATUS ENDPOINT (Replaces N+1 calls)
    // ==========================================

    // Get report card readiness status for ALL classes at once
    // Usage: await reportCardsAPI.getStatus('termId123')
    // Returns: {
    //   success: true,
    //   data: {
    //     "classId1": { classTeacherCommentCount: 5, teacherCommentCount: 10, uniqueSubjectsCount: 3 },
    //     ...
    //   },
    //   meta: { termName: 'First Term', sessionName: '2024/2025', totalClasses: 20 }
    // }
    getStatus: async (termId) => {
        const response = await api.get('/report-cards/status', {
            params: { termId }
        });
        return response.data;
    },

    // ==========================================
    // NEW: BULK PRINT DATA ENDPOINT
    // ==========================================

    // Get complete report card data for one or more classes
    // Usage: await reportCardsAPI.getPrintData('termId123', ['classId1', 'classId2'])
    //        OR await reportCardsAPI.getPrintData('termId123', 'classId1,classId2')
    getPrintData: async (termId, classIds) => {
        // Handle both array and comma-separated string
        const idsString = Array.isArray(classIds) ? classIds.join(',') : classIds;
        const response = await api.get('/report-cards/print-data', {
            params: { 
                termId, 
                classIds: idsString 
            }
        });
        return response.data;
    },

    // ==========================================
    // NEW: SINGLE STUDENT PRINT ENDPOINT
    // ==========================================

    // Get single student's complete report card (for individual printing)
    // Usage: await reportCardsAPI.getStudentPrint('studentId123', 'termId456', 'sessionId789')
    getStudentPrint: async (studentId, termId, sessionId = null) => {
        const params = { termId };
        if (sessionId) params.sessionId = sessionId;
        
        const response = await api.get(`/report-cards/student-print/${studentId}`, {
            params
        });
        return response.data;
    },

    // ==========================================
    // HELPER METHODS
    // ==========================================

    // Convenience method that wraps getPrintData for a single class
    getSingleClassPrintData: async (classId, termId) => {
        return await reportCardsAPI.getPrintData(termId, [classId]);
    },

    // Get print data for all active classes in the system
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
    // Get school settings (creates default if none exists)
    // Returns: { success: true, data: { schoolName, schoolMotto, schoolAddress, principalName... } }
    get: async () => {
        const response = await api.get('/school-settings');
        return response.data;
    },

    // Update school settings (admin only)
    // Usage: await schoolSettingsAPI.update({ schoolName: 'New Name', principalName: 'Mr. Smith' })
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
// ADMIN CA PROGRESS API (NEW)
// ============================================
export const adminCAProgressAPI = {
    // Get CA completion status for all teachers and their assigned subjects
    // Usage: await adminCAProgressAPI.getTeacherProgress({ termId: '...', sessionId: '...', classId: '...' })
    // Returns: {
    //   success: true,
    //   data: {
    //     summary: { totalTeachers, teachersWithCA, teachersWithoutCA, totalAssignments, assignmentsWithCA, completionPercentage },
    //     termInfo: { id, name, status },
    //     sessionInfo: { id, name },
    //     teachers: [{
    //       teacherId, teacherName, firstName, lastName, email, username, phone,
    //       totalAssignments, filledAssignments, completionPercentage,
    //       subjects: [{
    //         assignmentId, classId, className, classLevel, classSection,
    //         subjectId, subjectName, subjectCode,
    //         hasCA, studentsWithCA, totalStudentsInClass, caPercentage
    //       }]
    //     }]
    //   }
    // }
    getTeacherProgress: async (params = {}) => {
        const response = await api.get('/admin/ca/teacher-progress', { params });
        return response.data;
    },
};

// ============================================
// RESULT ACCESS SCHEDULE API
// ============================================
export const resultScheduleAPI = {
    // Get current result access schedule (for admin/student dashboard)
    getCurrent: async (params = {}) => {
        const response = await api.get('/result-access-schedule', { params });
        return response.data;
    },

    // Get all result access schedules (admin view - includes inactive)
    getAll: async () => {
        const response = await api.get('/result-access-schedules');
        return response.data;
    },

    // ✅ FIXED: Create a new result access schedule
    // IMPORTANT: Dates MUST be valid ISO strings like "2025-01-15T09:00:00.000Z"
    // If your date input gives "2025-01-15T09:00" (no Z), it still works
    // But "2025-01-15" (date only) WILL fail backend validation
    create: async (scheduleData) => {
        // ✅ FIX: Ensure dates are valid ISO strings before sending
        const payload = { ...scheduleData };

        // Convert Date objects to ISO strings if needed
        if (payload.resultStartTime instanceof Date) {
            payload.resultStartTime = payload.resultStartTime.toISOString();
        }
        if (payload.resultDeadline instanceof Date) {
            payload.resultDeadline = payload.resultDeadline.toISOString();
        }

        // ✅ FIX: If you have separate date/time fields, combine them properly
        // Example: if your form has startDate + startTime fields:
        // payload.resultStartTime = `${startDate}T${startTime}:00.000Z`;
        // payload.resultDeadline = `${deadlineDate}T${deadlineTime}:00.000Z`;

        try {
            const response = await api.post('/result-access-schedule', payload);
            
            // ✅ Handle "schedule already exists" error gracefully
            if (response.data?.existingScheduleId) {
                return {
                    success: false,
                    alreadyExists: true,
                    scheduleId: response.data.existingScheduleId,
                    message: 'A schedule already exists for this term. Use the update option instead.'
                };
            }
            
            return response.data;
        } catch (error) {
            // ✅ Better error details
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

    // Update an existing result access schedule
    update: async (id, updateData) => {
        const payload = { ...updateData };

        // Convert Date objects to ISO strings
        if (payload.resultStartTime instanceof Date) {
            payload.resultStartTime = payload.resultStartTime.toISOString();
        }
        if (payload.resultDeadline instanceof Date) {
            payload.resultDeadline = payload.resultDeadline.toISOString();
        }

        const response = await api.put(`/result-access-schedule/${id}`, payload);
        return response.data;
    },

    // Toggle schedule active status
    toggleActive: async (id) => {
        const response = await api.patch(`/result-access-schedule/${id}/toggle-active`);
        return response.data;
    },

    // Delete a result access schedule
    delete: async (id) => {
        const response = await api.delete(`/result-access-schedule/${id}`);
        return response.data;
    },
};
// ============================================
// PUBLIC API (No Authentication Required)
// ============================================
export const publicAPI = {
    // Get all active terms (for public result checking page)
    // Usage: await publicAPI.getTerms({ sessionId: '...', status: 'active' })
    // Returns: { success: true, data: [{ _id, name, session: { name }, startDate, endDate, status }, ...] }
    getTerms: async (params = {}) => {
        const response = await api.get('/public/terms', { params });
        return response.data;
    },

    // Get all active sessions (for public result checking page)
    // Returns: { success: true, data: [{ _id, name, startDate, endDate }, ...] }
    getSessions: async () => {
        const response = await api.get('/public/sessions');
        return response.data;
    },

    // Get public result access status (for result check page - no auth required)
    // Returns: {
    //   success: true,
    //   data: {
    //     scheduleActive: boolean,
    //     scheduleStatus: 'active' | 'before_start' | 'deadline_passed' | null,
    //     scheduleDetails: { resultStartTime, resultDeadline, timeRemaining } | null,
    //     message: string | null
    //   }
    // }
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
};

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
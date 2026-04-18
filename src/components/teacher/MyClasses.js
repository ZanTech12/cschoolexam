import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardAPI, classesAPI, getAuthData } from '../../api';
import Loading from '../common/Loading';
import './myclasses.css';

const MyClasses = () => {
  const { user } = getAuthData();

  // 1. Get assignments to know WHICH classes/subjects are assigned to this teacher
  const { data: assignmentsData, isLoading, isError, error } = useQuery({
    queryKey: ['myAssignments', user?._id],
    queryFn: () => dashboardAPI.getAssignmentsByTeacher(user?._id),
    enabled: !!user?._id,
  });

  // 2. Precisely get ALL classes data to guarantee accurate level, capacity, session, and student arrays
  const { data: classesData } = useQuery({
    queryKey: ['allClassesDetails'],
    queryFn: () => classesAPI.getAll(),
  });

  // Create a precise lookup map: classId -> full class details
  const classDetailsMap = React.useMemo(() => {
    if (!classesData?.data) return {};
    return classesData.data.reduce((acc, cls) => {
      acc[cls._id] = cls;
      return acc;
    }, {});
  }, [classesData]);

  // Merge assignment links with the precise class/student data
  const uniqueClasses = React.useMemo(() => {
    if (!assignmentsData?.data) return [];

    const classMap = new Map();

    assignmentsData.data.forEach((assignment) => {
      const classId = assignment.class_id?._id || assignment.class_id;
      if (!classId) return;

      const subjectData = assignment.subject_id?._id 
        ? assignment.subject_id 
        : assignment.subject?.id 
          ? assignment.subject 
          : null;

      if (!classMap.has(classId)) {
        // Pull PRECISE class info from the classesAPI map
        const preciseInfo = classDetailsMap[classId] || {};

        classMap.set(classId, {
          _id: classId,
          name: preciseInfo.name || assignment.class_id?.name || 'Unknown Class',
          section: preciseInfo.section || assignment.class_id?.section || 'N/A',
          level: preciseInfo.level || assignment.class_id?.level || 'N/A',
          session: preciseInfo.session || assignment.class_id?.session || 'N/A',
          capacity: preciseInfo.capacity || assignment.class_id?.capacity || null,
          students: preciseInfo.students || [], // Use the populated students array directly
          subjects: subjectData ? [subjectData] : [],
        });
      } else {
        const existingClass = classMap.get(classId);
        if (subjectData) {
          const subjectId = subjectData._id || subjectData.id;
          const alreadyAdded = existingClass.subjects.some(
            (s) => (s._id || s.id) === subjectId
          );
          if (!alreadyAdded) {
            existingClass.subjects.push(subjectData);
          }
        }
      }
    });

    return Array.from(classMap.values());
  }, [assignmentsData, classDetailsMap]);

  if (isLoading) return <Loading message="Loading assigned classes..." />;

  if (isError) {
    return (
      <div className="error-state">
        <div className="error-state-icon">⚠️</div>
        <div className="error-state-title">Error Loading Classes</div>
        <div className="error-state-text">
          {error?.response?.data?.message || error.message || 'Something went wrong'}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">My Classes</h1>
      <p className="page-subtitle">Classes assigned to you through teacher assignments</p>

      {uniqueClasses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏫</div>
          <div className="empty-state-title">No Classes Assigned</div>
          <div className="empty-state-text">
            Contact the administrator to get classes assigned to you
          </div>
        </div>
      ) : (
        <>
          <div className="assignment-summary">
            <div className="summary-item">
              <span className="summary-label">Total Classes:</span>
              <span className="summary-value">{uniqueClasses.length}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Assignments:</span>
              <span className="summary-value">{assignmentsData?.data?.length || 0}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Subjects:</span>
              <span className="summary-value">
                {uniqueClasses.reduce((acc, cls) => acc + cls.subjects.length, 0)}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Students:</span>
              <span className="summary-value">
                {uniqueClasses.reduce((acc, cls) => acc + (cls.students?.length || 0), 0)}
              </span>
            </div>
          </div>

          <div className="stats-grid">
            {uniqueClasses.map((cls) => (
              <div key={cls._id} className="card">
                <div className="card-header card-header-primary">
                  <h3>{cls.name}</h3>
                  <span className="badge badge-light">{cls.section}</span>
                </div>
                <div className="card-body">
                  <div className="class-info-row">
                    <strong>Level:</strong> {cls.level || 'N/A'}
                  </div>
                  <div className="class-info-row">
                    <strong>Session:</strong> {cls.session || 'N/A'}
                  </div>
                  <div className="class-info-row">
                    <strong>Students:</strong>{' '}
                    {cls.students?.length || 0}
                  </div>
                  <div className="class-info-row">
                    <strong>Assigned Subjects:</strong>
                    {cls.subjects.length > 0 ? (
                      <div className="subjects-list">
                        {cls.subjects.map((subject) => (
                          <span key={subject._id || subject.id} className="subject-badge">
                            {subject.name || 'Unknown Subject'}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="no-subjects">None</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default MyClasses;
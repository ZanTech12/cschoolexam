import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { classesAPI, classTeacherCommentsAPI, termsAPI, sessionsAPI, attendanceAPI, getAuthData } from '../../api';
import Loading from '../common/Loading';
import './MyStudents.css';

// ─── Helper: Safely extract array from various API response structures ──────
const extractArray = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;

  if (typeof data === 'object') {
    const arrayFields = ['data', 'comments', 'results', 'records', 'items', 'list'];

    for (const field of arrayFields) {
      if (data[field]) {
        if (Array.isArray(data[field])) return data[field];
        if (typeof data[field] === 'object') {
          for (const innerField of arrayFields) {
            if (Array.isArray(data[field][innerField])) {
              return data[field][innerField];
            }
          }
        }
      }
    }
  }

  return [];
};

// ─── Helper: Normalize any ID to a comparable string ───────────────────────
const normalizeId = (id) => {
  if (!id) return null;
  
  if (typeof id === 'string') return id.trim();
  
  if (typeof id === 'object') {
    if (id._id) return normalizeId(id._id);
    if (id.str) return id.str.trim();
    if (typeof id.toString === 'function' && id.toString() !== '[object Object]') {
      return String(id).trim();
    }
  }
  
  return String(id).trim();
};

// ─── Helper: Get student ID from comment object ────────────────────────────
const getStudentIdFromComment = (comment) => {
  if (!comment) return null;

  const possibleFields = ['student_id', 'studentId', 'student'];

  for (const field of possibleFields) {
    const value = comment[field];
    if (!value) continue;

    const normalized = normalizeId(value);
    if (normalized) return normalized;
  }

  return null;
};

// ─── Helper: Get student ID from student object in cls.students array ──────
const getStudentId = (student) => {
  if (!student) return null;
  
  if (typeof student === 'string') return student.trim();
  
  if (typeof student === 'object' && !student.firstName) {
    return normalizeId(student._id || student);
  }
  
  return normalizeId(student._id);
};

// ─── Teacher Comment Templates ─────────────────────────────────────────────
const COMMENT_CATEGORIES = [
  { key: 'academic-positive', label: 'Academic ✓', icon: '📚' },
  { key: 'academic-needs-work', label: 'Academic ⚠', icon: '📖' },
  { key: 'behavior-positive', label: 'Behavior ✓', icon: '👍' },
  { key: 'behavior-needs-work', label: 'Behavior ⚠', icon: '⚠️' },
  { key: 'attitude-positive', label: 'Attitude ✓', icon: '💪' },
  { key: 'attitude-needs-work', label: 'Attitude ⚠', icon: '🔄' },
  { key: 'participation-positive', label: 'Participation ✓', icon: '🙌' },
  { key: 'participation-needs-work', label: 'Participation ⚠', icon: '🔇' },
  { key: 'social-positive', label: 'Social ✓', icon: '🤝' },
  { key: 'social-needs-work', label: 'Social ⚠', icon: '😔' },
  { key: 'special-attributes', label: 'Special ★', icon: '⭐' },
  { key: 'mixed-constructive', label: 'Mixed', icon: '⚖️' },
];

const TEACHER_COMMENTS = [
  { text: 'An industrious and hardworking student who shows great dedication to studies.', label: 'Hardworking', category: 'academic-positive' },
  { text: 'An excellent student with outstanding academic performance and good conduct.', label: 'Excellent', category: 'academic-positive' },
  { text: 'Shows remarkable understanding of concepts and applies them effectively.', label: 'Concept Master', category: 'academic-positive' },
  { text: 'Consistently produces high-quality work and demonstrates deep understanding of topics.', label: 'High Quality', category: 'academic-positive' },
  { text: 'A brilliant student who excels in all subjects and always strives for perfection.', label: 'Brilliant', category: 'academic-positive' },
  { text: 'Demonstrates exceptional analytical and problem-solving skills in all subjects.', label: 'Analytical', category: 'academic-positive' },
  { text: 'Academically sound with a natural flair for learning new concepts quickly.', label: 'Quick Learner', category: 'academic-positive' },
  { text: 'Shows great enthusiasm for learning and consistently achieves excellent results.', label: 'Enthusiastic', category: 'academic-positive' },
  { text: 'A highly motivated learner who takes pride in academic achievements and successes.', label: 'Self-Motivated', category: 'academic-positive' },
  { text: 'Displays outstanding intellectual ability and grasps new concepts with ease.', label: 'Outstanding', category: 'academic-positive' },
  { text: 'Maintains an impressive academic record throughout the term with consistent performance.', label: 'Consistent', category: 'academic-positive' },
  { text: 'Shows excellent retention and application of learned concepts in examinations.', label: 'Good Retention', category: 'academic-positive' },
  { text: 'A diligent student whose academic performance is highly commendable and praiseworthy.', label: 'Diligent', category: 'academic-positive' },
  { text: 'Demonstrates clarity of thought and expression in all academic activities and assessments.', label: 'Clear Thinker', category: 'academic-positive' },
  { text: 'Consistently ranks among the top performers in the class; a true academic star.', label: 'Top Performer', category: 'academic-positive' },
  { text: 'Shows potential but needs to be more focused and dedicated to academic work.', label: 'Needs Focus', category: 'academic-needs-work' },
  { text: 'Needs to put in more effort to improve academic performance across all subjects.', label: 'More Effort', category: 'academic-needs-work' },
  { text: 'Academic performance is below expectations; requires extra coaching and attention.', label: 'Below Average', category: 'academic-needs-work' },
  { text: 'Struggles with some subjects but shows willingness to learn when properly guided.', label: 'Struggling', category: 'academic-needs-work' },
  { text: 'Needs to develop better study habits to improve academic standing significantly.', label: 'Study Habits', category: 'academic-needs-work' },
  { text: 'Should spend more time on revision and practice exercises at home.', label: 'Needs Revision', category: 'academic-needs-work' },
  { text: 'Performance has declined compared to the previous term; urgent attention needed.', label: 'Declining', category: 'academic-needs-work' },
  { text: 'Requires additional support in core subjects to catch up with peers.', label: 'Needs Support', category: 'academic-needs-work' },
  { text: 'Can do better if more attention is paid to classwork and homework assignments.', label: 'Can Improve', category: 'academic-needs-work' },
  { text: 'Needs to seek help from teachers when facing academic difficulties.', label: 'Ask for Help', category: 'academic-needs-work' },
  { text: 'A well-behaved and respectful student who relates well with peers and teachers.', label: 'Well-behaved', category: 'behavior-positive' },
  { text: 'Exhibits excellent manners and is a role model for other students in the school.', label: 'Role Model', category: 'behavior-positive' },
  { text: 'Always polite, courteous, and respectful to everyone in the school community.', label: 'Polite', category: 'behavior-positive' },
  { text: 'Demonstrates high standards of discipline and self-control at all times.', label: 'Disciplined', category: 'behavior-positive' },
  { text: 'A disciplined student who adheres strictly to all school rules and regulations.', label: 'Rule Follower', category: 'behavior-positive' },
  { text: 'Shows respect for authority and maintains good relationships with all staff members.', label: 'Respectful', category: 'behavior-positive' },
  { text: 'Well-mannered and demonstrates maturity beyond their age in all situations.', label: 'Mature', category: 'behavior-positive' },
  { text: 'Maintains excellent conduct both inside and outside the classroom consistently.', label: 'Good Conduct', category: 'behavior-positive' },
  { text: 'A student of impeccable character who upholds the core values of the school.', label: 'Impeccable', category: 'behavior-positive' },
  { text: 'Consistently demonstrates good behavior and a positive attitude towards others.', label: 'Consistently Good', category: 'behavior-positive' },
  { text: 'Needs to improve behavior and show more respect for school rules and regulations.', label: 'Improve Behavior', category: 'behavior-needs-work' },
  { text: 'Frequently talks in class and distracts other students from learning activities.', label: 'Talkative', category: 'behavior-needs-work' },
  { text: 'Can be disruptive at times and needs to develop better self-control skills.', label: 'Disruptive', category: 'behavior-needs-work' },
  { text: 'Should learn to follow instructions without argument or resistance.', label: 'Follow Instructions', category: 'behavior-needs-work' },
  { text: 'Needs to be more mindful of how behavior affects other students in the class.', label: 'Mindful', category: 'behavior-needs-work' },
  { text: 'Shows tendencies of being stubborn; needs to be more cooperative with others.', label: 'Stubborn', category: 'behavior-needs-work' },
  { text: 'Must learn to respect the rights and opinions of other students in the class.', label: 'Respect Others', category: 'behavior-needs-work' },
  { text: 'Sometimes engages in activities that are contrary to school rules and expectations.', label: 'Rule Breaker', category: 'behavior-needs-work' },
  { text: 'Needs to work on anger management and emotional regulation in school.', label: 'Anger Issues', category: 'behavior-needs-work' },
  { text: 'Should refrain from using inappropriate language in school and towards peers.', label: 'Language', category: 'behavior-needs-work' },
  { text: 'Demonstrates a very positive attitude towards learning and all school activities.', label: 'Positive', category: 'attitude-positive' },
  { text: 'Shows enthusiasm and eagerness to learn new things every single day.', label: 'Eager', category: 'attitude-positive' },
  { text: 'A self-motivated student who takes initiative in academic pursuits without prompting.', label: 'Self-Starter', category: 'attitude-positive' },
  { text: 'Approaches challenges with a positive mindset and never gives up easily.', label: 'Resilient', category: 'attitude-positive' },
  { text: 'Shows great interest in all subjects and participates actively in every class.', label: 'Interested', category: 'attitude-positive' },
  { text: 'Always willing to help classmates and works excellently in group activities.', label: 'Helpful', category: 'attitude-positive' },
  { text: 'Demonstrates resilience and determination in the face of academic difficulties.', label: 'Determined', category: 'attitude-positive' },
  { text: 'Has a growth mindset and always seeks to improve in all areas of learning.', label: 'Growth Mindset', category: 'attitude-positive' },
  { text: 'Shows curiosity and asks thoughtful questions that enrich class discussions.', label: 'Curious', category: 'attitude-positive' },
  { text: 'Maintains an optimistic outlook and encourages other students to do their best.', label: 'Optimistic', category: 'attitude-positive' },
  { text: 'Needs to develop a more positive attitude towards studies and school life.', label: 'Be Positive', category: 'attitude-needs-work' },
  { text: 'Shows apathy and lack of interest in academic activities and school programs.', label: 'Apathetic', category: 'attitude-needs-work' },
  { text: 'Tends to give up easily when faced with challenging tasks and assignments.', label: 'Gives Up', category: 'attitude-needs-work' },
  { text: 'Needs to be more cooperative and work well with other students in groups.', label: 'Uncooperative', category: 'attitude-needs-work' },
  { text: 'Should develop a more serious approach towards academic work and responsibilities.', label: 'Not Serious', category: 'attitude-needs-work' },
  { text: 'Often displays a negative attitude that affects overall performance and morale.', label: 'Negative', category: 'attitude-needs-work' },
  { text: 'Needs to show more commitment and dedication to learning and self-improvement.', label: 'Lacks Commitment', category: 'attitude-needs-work' },
  { text: 'Lacks motivation and needs constant encouragement to participate in class activities.', label: 'Unmotivated', category: 'attitude-needs-work' },
  { text: 'Should try to be more enthusiastic about school activities and events.', label: 'Unenthusiastic', category: 'attitude-needs-work' },
  { text: 'Needs to take school work more seriously to achieve better academic results.', label: 'Take Seriously', category: 'attitude-needs-work' },
  { text: 'Very active in class but needs to channel energy towards academic excellence.', label: 'Active', category: 'participation-positive' },
  { text: 'Actively participates in class discussions and contributes valuable ideas.', label: 'Contributor', category: 'participation-positive' },
  { text: 'A natural leader who takes charge of group activities and class projects.', label: 'Leader', category: 'participation-positive' },
  { text: 'Always raises hand to answer questions and shows eagerness to participate.', label: 'Volunteers', category: 'participation-positive' },
  { text: 'Makes meaningful contributions during group discussions and class activities.', label: 'Meaningful Input', category: 'participation-positive' },
  { text: 'Takes active part in extracurricular activities and represents the school well.', label: 'Extracurricular', category: 'participation-positive' },
  { text: 'Shows leadership qualities and organizes peers effectively during group work.', label: 'Organizer', category: 'participation-positive' },
  { text: 'Volunteers readily for assignments and takes responsibility very seriously.', label: 'Responsible', category: 'participation-positive' },
  { text: 'An active participant in all school programs, events, and special activities.', label: 'All-Rounder', category: 'participation-positive' },
  { text: 'Shows initiative and creativity in completing class assignments and projects.', label: 'Creative', category: 'participation-positive' },
  { text: 'A quiet and reserved student who needs to participate more in class activities.', label: 'Reserved', category: 'participation-needs-work' },
  { text: 'Needs to speak up more in class and share ideas with classmates regularly.', label: 'Speak Up', category: 'participation-needs-work' },
  { text: 'Should take more active part in group discussions and collaborative activities.', label: 'Join Groups', category: 'participation-needs-work' },
  { text: 'Rarely volunteers to answer questions or participate in class exercises.', label: 'Passive', category: 'participation-needs-work' },
  { text: 'Needs to overcome shyness and be more expressive in class discussions.', label: 'Shy', category: 'participation-needs-work' },
  { text: 'Should participate more in extracurricular activities for holistic development.', label: 'Join Activities', category: 'participation-needs-work' },
  { text: 'Tends to be a passive learner; needs to engage more actively in class sessions.', label: 'Passive Learner', category: 'participation-needs-work' },
  { text: 'Needs to contribute more during group work and collaborative learning activities.', label: 'Contribute More', category: 'participation-needs-work' },
  { text: 'Should take advantage of class presentations to build confidence and skills.', label: 'Build Confidence', category: 'participation-needs-work' },
  { text: 'Needs to be more involved in school activities beyond the regular academics.', label: 'Get Involved', category: 'participation-needs-work' },
  { text: 'Gets along well with classmates and is well-liked by peers and teachers alike.', label: 'Friendly', category: 'social-positive' },
  { text: 'Shows empathy and kindness towards other students in all interactions.', label: 'Empathetic', category: 'social-positive' },
  { text: 'A team player who works harmoniously with others in all group settings.', label: 'Team Player', category: 'social-positive' },
  { text: 'Demonstrates good interpersonal skills and resolves conflicts maturely.', label: 'Conflict Resolver', category: 'social-positive' },
  { text: 'Friendly and approachable; serves as a mediator during peer disagreements.', label: 'Mediator', category: 'social-positive' },
  { text: 'Shows genuine concern for the well-being of other students in the school.', label: 'Caring', category: 'social-positive' },
  { text: 'Easily makes friends and creates a warm, positive atmosphere in class.', label: 'Warm', category: 'social-positive' },
  { text: 'Demonstrates inclusivity and ensures no one is left out in group activities.', label: 'Inclusive', category: 'social-positive' },
  { text: 'Has excellent communication skills and expresses ideas clearly and effectively.', label: 'Good Communicator', category: 'social-positive' },
  { text: 'A supportive classmate who encourages others to do their best at all times.', label: 'Supportive', category: 'social-positive' },
  { text: 'Needs to improve social skills and interact more with classmates and peers.', label: 'Improve Social', category: 'social-needs-work' },
  { text: 'Tends to keep to self and should try to make more friends in school.', label: 'Too Solitary', category: 'social-needs-work' },
  { text: 'Sometimes has difficulty working in groups; needs to be more collaborative.', label: 'Poor Teamwork', category: 'social-needs-work' },
  { text: 'Should learn to share and take turns during group activities and games.', label: 'Share and Turn', category: 'social-needs-work' },
  { text: 'Needs to develop better conflict resolution skills when dealing with peers.', label: 'Conflict Skills', category: 'social-needs-work' },
  { text: 'Highly creative and shows exceptional talent in art and creative writing.', label: 'Creative Talent', category: 'special-attributes' },
  { text: 'An outstanding athlete who brings glory to the school in sports competitions.', label: 'Athletic Star', category: 'special-attributes' },
  { text: 'Shows exceptional talent in music and performing arts; a delight to watch.', label: 'Musical Talent', category: 'special-attributes' },
  { text: 'A gifted student who demonstrates abilities far beyond their current grade level.', label: 'Gifted', category: 'special-attributes' },
  { text: 'Very neat and organized in all academic work and maintains excellent personal appearance.', label: 'Neat and Organized', category: 'special-attributes' },
  { text: 'Shows great responsibility and can be trusted with important tasks and duties.', label: 'Trustworthy', category: 'special-attributes' },
  { text: 'Punctual and regular in school attendance; sets a good example for others.', label: 'Punctual', category: 'special-attributes' },
  { text: 'Demonstrates strong moral values and integrity in all dealings and interactions.', label: 'High Integrity', category: 'special-attributes' },
  { text: 'A technology-savvy student who excels in computer-related activities and projects.', label: 'Tech Savvy', category: 'special-attributes' },
  { text: 'Shows strong leadership potential and can inspire other students to excellence.', label: 'Born Leader', category: 'special-attributes' },
  { text: 'Excellent in public speaking and debates; represents the school commendably.', label: 'Great Orator', category: 'special-attributes' },
  { text: 'A voracious reader with an impressive vocabulary and comprehension skills.', label: 'Avid Reader', category: 'special-attributes' },
  { text: 'Shows great organizational skills and manages time effectively across all tasks.', label: 'Time Manager', category: 'special-attributes' },
  { text: 'Demonstrates environmental consciousness and actively promotes cleanliness.', label: 'Eco-Conscious', category: 'special-attributes' },
  { text: 'A multi-talented student who excels in both academics and extracurricular activities.', label: 'Multi-Talented', category: 'special-attributes' },
  { text: 'Good in practical work but needs significant improvement in theoretical aspects.', label: 'Practical over Theory', category: 'mixed-constructive' },
  { text: 'Performs well in some subjects but needs to put more effort into weaker ones.', label: 'Uneven Performance', category: 'mixed-constructive' },
  { text: 'Has the ability to do well but is easily distracted in class and loses focus.', label: 'Easily Distracted', category: 'mixed-constructive' },
  { text: 'Shows noticeable improvement compared to last term; should keep up the good work.', label: 'Improving', category: 'mixed-constructive' },
  { text: 'A smart student who has the capability but needs to take academic work more seriously.', label: 'Smart but Casual', category: 'mixed-constructive' },
];

const MyStudents = () => {
  const { user } = getAuthData();
  const queryClient = useQueryClient();
  const [expandedClass, setExpandedClass] = useState(null);

  // ✅ State to track the currently viewed Term and Session
  const [activeFilterTerm, setActiveFilterTerm] = useState('');
  const [activeFilterSession, setActiveFilterSession] = useState('');

  // ✅ NEW: State to handle individual student input loading states
  const [savingAttendance, setSavingAttendance] = useState({});

  const [commentModal, setCommentModal] = useState({
    isOpen: false,
    student: null,
    classId: null,
    existingComment: null,
    term: '',
    session: '',
  });
  const [commentText, setCommentText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [commentCategory, setCommentCategory] = useState('all');
  const [commentSearch, setCommentSearch] = useState('');

  // ─── Fetch Classes where user is class teacher ───────────────────────────
  const {
    data: classTeacherData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['myClassesAsClassTeacher', user?._id],
    queryFn: () => classesAPI.getByTeacher(user?._id),
    enabled: !!user?._id,
  });

  // ─── Fetch Terms ─�───────────────────────────────────────────────────────
  const { data: termsData } = useQuery({
    queryKey: ['terms'],
    queryFn: termsAPI.getAll,
  });

  // ─── Fetch Sessions ─�───────────────────────────────────────────────────
  const { data: sessionsData } = useQuery({
    queryKey: ['sessions'],
    queryFn: sessionsAPI.getAll,
  });

  // ─── Fetch comments for the currently expanded class ─────────────────────
  const {
    data: commentsData,
    error: commentsError,
    isError: isCommentsError,
  } = useQuery({
    queryKey: ['classTeacherComments', expandedClass],
    queryFn: () => classTeacherCommentsAPI.getByClass(expandedClass),
    enabled: !!expandedClass,
    retry: 1,
    staleTime: 30000,
  });

  // ✅ Fetch attendance counts for the currently expanded class
  const {
    data: attendanceCountsData,
    error: attendanceError,
    isError: isAttendanceError,
  } = useQuery({
    queryKey: [
      'attendanceStudentCounts', 
      expandedClass, 
      activeFilterTerm, 
      activeFilterSession
    ],
    queryFn: () => {
      const params = {};
      if (activeFilterTerm) params.term = activeFilterTerm;
      if (activeFilterSession) params.session = activeFilterSession;
      return attendanceAPI.getStudentCountsByClass(expandedClass, params);
    },
    enabled: !!expandedClass,
    retry: 1,
    staleTime: 60000,
  });

  // ─── Extract data safely ─────────────────────────────────────────────────
  const classes = React.useMemo(() => extractArray(classTeacherData), [classTeacherData]);
  const terms = React.useMemo(() => extractArray(termsData), [termsData]);
  const sessions = React.useMemo(() => extractArray(sessionsData), [sessionsData]);
  const comments = React.useMemo(() => extractArray(commentsData), [commentsData]);
  const attendanceCounts = React.useMemo(() => extractArray(attendanceCountsData?.data), [attendanceCountsData]);

  const schoolOpenDays = React.useMemo(() => {
    return attendanceCountsData?.schoolOpenDays ?? null;
  }, [attendanceCountsData]);

  // ─── Determine active term and session ───────────────────────────────────
  const activeTerm = React.useMemo(() => {
    return terms.find((t) => t.isActive || t.is_active) || terms[0];
  }, [terms]);

  const activeSession = React.useMemo(() => {
    return sessions.find((s) => s.isActive || s.is_active) || sessions[0];
  }, [sessions]);

  React.useEffect(() => {
    if (activeTerm?.name && !activeFilterTerm) {
      setActiveFilterTerm(activeTerm.name);
    }
    if (activeSession?.name && !activeFilterSession) {
      setActiveFilterSession(activeSession.name);
    }
  }, [activeTerm, activeSession]);

  // ─── Build a lookup map: studentId -> comment ──
  const commentsMap = React.useMemo(() => {
    const map = {};
    const filterTerm = activeFilterTerm || activeTerm?.name || '';
    const filterSession = activeFilterSession || activeSession?.name || '';

    comments.forEach((comment) => {
      const studentId = getStudentIdFromComment(comment);
      if (!studentId) return;

      const termMatch = !filterTerm || comment.term === filterTerm;
      const sessionMatch = !filterSession || comment.session === filterSession;

      if (termMatch && sessionMatch) {
        const normalizedId = normalizeId(studentId);
        if (normalizedId) {
          const existing = map[normalizedId];
          if (!existing || 
              new Date(comment.updatedAt || comment.createdAt) > 
              new Date(existing.updatedAt || existing.createdAt)) {
            map[normalizedId] = comment;
          }
        }
      }
    });

    return map;
  }, [comments, activeFilterTerm, activeFilterSession, activeTerm, activeSession]);

  // ─── Build a lookup map: studentId -> times_present ──
  const attendanceMap = React.useMemo(() => {
    const map = {};
    attendanceCounts.forEach((record) => {
      if (record.student_id) {
        const normalizedId = normalizeId(record.student_id);
        if (normalizedId) {
          map[normalizedId] = record.times_present || 0;
        }
      }
    });
    return map;
  }, [attendanceCounts]);

  // ─── Filtered quick comments ──────────────────────────────────────────────
  const filteredComments = useMemo(() => {
    let result = TEACHER_COMMENTS;

    if (commentCategory !== 'all') {
      result = result.filter((c) => c.category === commentCategory);
    }

    if (commentSearch.trim()) {
      const searchLower = commentSearch.toLowerCase();
      result = result.filter(
        (c) =>
          c.text.toLowerCase().includes(searchLower) ||
          c.label.toLowerCase().includes(searchLower)
      );
    }

    return result;
  }, [commentCategory, commentSearch]);

  // ✅ Helpers for attendance UI
  const getAttendancePercentage = (timesPresent) => {
    if (!schoolOpenDays || schoolOpenDays === 0) return null;
    const percentage = (timesPresent / schoolOpenDays) * 100;
    return Math.round(percentage * 10) / 10;
  };

  const getAttendanceStatus = (percentage) => {
    if (percentage === null) return 'neutral';
    if (percentage >= 75) return 'good';
    if (percentage >= 50) return 'fair';
    return 'poor';
  };

  // ✅ NEW: Handle saving attendance when teacher types in the input
  const handleAttendanceSave = async (studentId, classId, value) => {
    const numVal = Math.max(0, parseInt(value, 10) || 0);
    const currentTerm = activeFilterTerm || '';
    const currentSession = activeFilterSession || '';

    if (!currentTerm || !currentSession) {
      alert("Please select a Term and Session before entering attendance.");
      return;
    }

    setSavingAttendance(prev => ({ ...prev, [studentId]: true }));

    try {
      await attendanceAPI.upsert({
        student_id: studentId,
        class_id: classId,
        term: currentTerm,
        session: currentSession,
        times_present: numVal,
        teacher_id: user._id,
      });
      
      // Refetch attendance to update percentages immediately
      await queryClient.invalidateQueries({ 
        queryKey: ['attendanceStudentCounts', expandedClass, activeFilterTerm, activeFilterSession] 
      });
    } catch (error) {
      console.error('Error saving attendance:', error);
      alert(error?.response?.data?.message || 'Failed to save attendance.');
    } finally {
      setSavingAttendance(prev => ({ ...prev, [studentId]: false }));
    }
  };

  const totalStudents = classes.reduce(
    (acc, cls) => acc + (cls.students?.length || 0),
    0
  );

  const toggleExpandClass = (classId) => {
    setExpandedClass((prev) => (prev === classId ? null : classId));
  };

  React.useEffect(() => {
    if (classes.length === 1 && !expandedClass) {
      setExpandedClass(classes[0]._id);
    }
  }, [classes.length]);

  const openCommentModal = (student, classId) => {
    const studentId = getStudentId(student);
    const existingComment = studentId ? commentsMap[studentId] : null;

    const modalTerm = activeFilterTerm || activeTerm?.name || '';
    const modalSession = activeFilterSession || activeSession?.name || '';

    setCommentModal({
      isOpen: true,
      student,
      classId,
      existingComment,
      term: existingComment?.term || modalTerm,
      session: existingComment?.session || modalSession,
    });
    setCommentText(existingComment?.comment || '');
    setCommentCategory('all');
    setCommentSearch('');
  };

  const closeCommentModal = () => {
    setCommentModal({
      isOpen: false,
      student: null,
      classId: null,
      existingComment: null,
      term: '',
      session: '',
    });
    setCommentText('');
    setCommentCategory('all');
    setCommentSearch('');
  };

  const saveComment = async () => {
    if (!commentText.trim() || !commentModal.term || !commentModal.session) return;

    setIsSaving(true);
    try {
      const studentId = getStudentId(commentModal.student);
      
      const commentData = {
        student_id: studentId || commentModal.student._id,
        class_id: commentModal.classId,
        teacher_id: user._id,
        comment: commentText.trim(),
        term: commentModal.term,
        session: commentModal.session,
      };

      if (commentModal.existingComment?._id) {
        await classTeacherCommentsAPI.update(commentModal.existingComment._id, commentData);
      } else {
        await classTeacherCommentsAPI.create(commentData);
      }

      await queryClient.invalidateQueries({
        queryKey: ['classTeacherComments', commentModal.classId],
      });
      closeCommentModal();
    } catch (error) {
      console.error('Error saving comment:', error);
      alert(error?.response?.data?.message || 'Failed to save comment. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteComment = async () => {
    if (!commentModal.existingComment?._id) return;
    if (!window.confirm('Are you sure you want to delete this comment?')) return;

    setIsSaving(true);
    try {
      await classTeacherCommentsAPI.delete(commentModal.existingComment._id);
      await queryClient.invalidateQueries({
        queryKey: ['classTeacherComments', commentModal.classId],
      });
      closeCommentModal();
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert(error?.response?.data?.message || 'Failed to delete comment. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <Loading message="Loading your students..." />;

  if (isError) {
    return (
      <div className="ms-error">
        <div className="ms-error-icon">⚠️</div>
        <h3>Error Loading Classes</h3>
        <p>{error?.response?.data?.message || error.message || 'Something went wrong'}</p>
      </div>
    );
  }

  return (
    <div className="ms-page">
      {/* Header */}
      <div className="ms-header">
        <div className="ms-header-text">
          <h1>My Students</h1>
          <p>View students in your assigned classes, manage attendance and add comments</p>
        </div>
      </div>

      {/* Stats */}
      <div className="ms-stats">
        <div className="ms-stat">
          <span className="ms-stat-icon">🏫</span>
          <div className="ms-stat-content">
            <span className="ms-stat-num">{classes.length}</span>
            <span className="ms-stat-label">Classes</span>
          </div>
        </div>
        <div className="ms-stat">
          <span className="ms-stat-icon">👥</span>
          <div className="ms-stat-content">
            <span className="ms-stat-num">{totalStudents}</span>
            <span className="ms-stat-label">Students</span>
          </div>
        </div>
        <div className="ms-stat">
          <span className="ms-stat-icon">💬</span>
          <div className="ms-stat-content">
            <span className="ms-stat-num">{Object.keys(commentsMap).length}</span>
            <span className="ms-stat-label">Comments</span>
          </div>
        </div>
        {schoolOpenDays !== null && (
          <div className="ms-stat">
            <span className="ms-stat-icon">📅</span>
            <div className="ms-stat-content">
              <span className="ms-stat-num">{schoolOpenDays}</span>
              <span className="ms-stat-label">School Days</span>
            </div>
          </div>
        )}
      </div>

      {/* Term & Session Filter Bar */}
      {expandedClass && (
        <div className="ms-filter-bar">
          <div className="ms-filter-group">
            <label className="ms-filter-label">Viewing for:</label>
            <select
              className="ms-filter-select"
              value={activeFilterTerm}
              onChange={(e) => setActiveFilterTerm(e.target.value)}
            >
              <option value="">All Terms</option>
              {terms.map((term) => (
                <option key={term._id} value={term.name}>
                  {term.name} {(term.isActive || term.is_active) ? '(Active)' : ''}
                </option>
              ))}
            </select>
            <select
              className="ms-filter-select"
              value={activeFilterSession}
              onChange={(e) => setActiveFilterSession(e.target.value)}
            >
              <option value="">All Sessions</option>
              {sessions.map((session) => (
                <option key={session._id} value={session.name}>
                  {session.name} {(session.isActive || session.is_active) ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="ms-filter-info">
            {Object.keys(commentsMap).length} comments • {Object.keys(attendanceMap).length} attendance records
            {schoolOpenDays !== null && ` • ${schoolOpenDays} school days`}
          </div>
        </div>
      )}

      {/* Comments Fetch Error Banner */}
      {isCommentsError && expandedClass && (
        <div className="ms-error-banner">
          <span>
            ⚠️ Failed to load comments:{' '}
            {commentsError?.response?.data?.message || commentsError.message}
          </span>
          <button
            onClick={() =>
              queryClient.invalidateQueries({
                queryKey: ['classTeacherComments', expandedClass],
              })
            }
            className="ms-retry-btn"
          >
            Retry
          </button>
        </div>
      )}

      {/* Attendance Fetch Error Banner */}
      {isAttendanceError && expandedClass && (
        <div className="ms-error-banner ms-warning-banner">
          <span>
            ⚠️ Could not load attendance data:{' '}
            {attendanceError?.response?.data?.message || attendanceError.message}
          </span>
          <button
            onClick={() =>
              queryClient.invalidateQueries({
                queryKey: ['attendanceStudentCounts', expandedClass, activeFilterTerm, activeFilterSession],
              })
            }
            className="ms-retry-btn"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {classes.length === 0 ? (
        <div className="ms-empty">
          <span className="ms-empty-icon">📋</span>
          <h3>No Classes Assigned</h3>
          <p>You are not assigned as a class teacher to any class.</p>
        </div>
      ) : (
        <div className="ms-classes">
          {classes.map((cls) => {
            const isOpen = expandedClass === cls._id;
            const studentCount = cls.students?.length || 0;

            return (
              <div key={cls._id} className="ms-card">
                {/* Card Header */}
                <div
                  className={`ms-card-head ${isOpen ? 'open' : ''}`}
                  onClick={() => toggleExpandClass(cls._id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && toggleExpandClass(cls._id)}
                >
                  <div className="ms-card-info">
                    <h2>
                      {cls.name}
                      {cls.section && <span className="ms-section"> {cls.section}</span>}
                    </h2>
                    <div className="ms-card-meta">
                      {cls.level && <span>{cls.level}</span>}
                      {cls.session && (
                        <>
                          <span className="ms-dot">•</span>
                          <span>{cls.session}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="ms-card-right">
                    <div className="ms-count-badge">
                      <span className="ms-count-num">{studentCount}</span>
                    </div>
                    <div className={`ms-chevron ${isOpen ? 'up' : ''}`}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Students Panel */}
                {isOpen && (
                  <div className="ms-students-panel">
                    {studentCount === 0 ? (
                      <div className="ms-no-data">
                        <p>No students enrolled yet</p>
                      </div>
                    ) : (
                      <>
                        {/* Desktop Table View */}
                        <div className="ms-table-wrap">
                          <table className="ms-table">
                            <thead>
                              <tr>
                                <th>S/N</th>
                                <th>Student Name</th>
                                <th>Admission No.</th>
                                <th>Gender</th>
                                {/* ✅ UPDATED: Attendance Input Column */}
                                <th>Days Present <span className="ms-th-sub">Type & Tab out</span></th>
                                <th>Comment</th>
                                <th>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cls.students.map((student, idx) => {
                                const studentId = getStudentId(student);
                                const comment = studentId ? commentsMap[studentId] : null;
                                const hasComment = !!comment;
                                const commentPreview = comment?.comment || '';
                                
                                const timesPresent = studentId ? (attendanceMap[studentId] ?? 0) : 0;
                                const attendancePercentage = getAttendancePercentage(timesPresent);
                                const attendanceStatus = getAttendanceStatus(attendancePercentage);
                                const isSavingStudent = savingAttendance[studentId];

                                return (
                                  <tr key={studentId || idx}>
                                    <td><span className="ms-sno">{idx + 1}</span></td>
                                    <td>
                                      <div className="ms-name-cell">
                                        <span className="ms-avatar">
                                          {(student.firstName?.[0] || '')}
                                          {(student.lastName?.[0] || '')}
                                        </span>
                                        <span className="ms-name">
                                          {student.firstName} {student.lastName}
                                        </span>
                                      </div>
                                    </td>
                                    <td><code className="ms-adm">{student.admissionNumber || '—'}</code></td>
                                    <td>
                                      <span className={`ms-gender ${(student.gender || '').toLowerCase()}`}>
                                        {student.gender === 'Male' && '♂ '}
                                        {student.gender === 'Female' && '♀ '}
                                        {student.gender || '—'}
                                      </span>
                                    </td>
                                    {/* ✅ UPDATED: Editable Attendance Cell */}
                                    <td>
                                      <div className="ms-attendance-cell">
                                        <input
                                          type="number"
                                          className={`ms-attendance-input ${isSavingStudent ? 'saving' : ''} ${attendanceStatus}`}
                                          min="0"
                                          max="200"
                                          defaultValue={timesPresent || ''}
                                          disabled={isSavingStudent}
                                          onBlur={(e) => handleAttendanceSave(studentId, cls._id, e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.target.blur();
                                            }
                                          }}
                                        />
                                        {isSavingStudent && <span className="ms-saving-spinner">💾</span>}
                                        
                                        <div className="ms-attendance-meta">
                                          {attendancePercentage !== null && (
                                            <span className={`ms-attendance-pct ${attendanceStatus}`}>
                                              {attendancePercentage}%
                                            </span>
                                          )}
                                          <span className="ms-attendance-note">
                                            / {schoolOpenDays ?? '?'} days
                                          </span>
                                        </div>
                                      </div>
                                    </td>
                                    <td>
                                      <span className={`ms-comment-preview ${hasComment ? 'has-comment' : 'no-comment'}`}>
                                        {hasComment
                                          ? commentPreview.length > 40
                                            ? commentPreview.substring(0, 40) + '...'
                                            : commentPreview
                                          : 'No comment'}
                                      </span>
                                    </td>
                                    <td>
                                      <button
                                        className={`ms-comment-btn ${hasComment ? 'edit' : 'add'}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openCommentModal(student, cls._id);
                                        }}
                                        title={hasComment ? 'Edit comment' : 'Add comment'}
                                      >
                                        {hasComment ? '✏️ Edit' : '+ Add'}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="ms-mobile-list">
                          {cls.students.map((student, idx) => {
                            const studentId = getStudentId(student);
                            const comment = studentId ? commentsMap[studentId] : null;
                            const hasComment = !!comment;
                            const commentPreview = comment?.comment || '';
                            
                            const timesPresent = studentId ? (attendanceMap[studentId] ?? 0) : 0;
                            const attendancePercentage = getAttendancePercentage(timesPresent);
                            const attendanceStatus = getAttendanceStatus(attendancePercentage);
                            const isSavingStudent = savingAttendance[studentId];

                            return (
                              <div key={studentId || idx} className="ms-mobile-card">
                                <div className="ms-mobile-top">
                                  <span className="ms-sno">{idx + 1}</span>
                                  <span className={`ms-gender ${(student.gender || '').toLowerCase()}`}>
                                    {student.gender === 'Male' && '♂ '}
                                    {student.gender === 'Female' && '♀ '}
                                    {student.gender || '—'}
                                  </span>
                                </div>
                                <div className="ms-mobile-name">
                                  <span className="ms-avatar">
                                    {(student.firstName?.[0] || '')}
                                    {(student.lastName?.[0] || '')}
                                  </span>
                                  <span>{student.firstName} {student.lastName}</span>
                                </div>
                                <div className="ms-mobile-adm">
                                  {student.admissionNumber || '—'}
                                </div>

                                {/* ✅ UPDATED: Mobile Editable Attendance */}
                                <div className="ms-mobile-attendance">
                                  <span className="ms-mobile-attendance-label">
                                    📅 Present:
                                  </span>
                                  <input
                                    type="number"
                                    className={`ms-attendance-input ${isSavingStudent ? 'saving' : ''}`}
                                    min="0"
                                    max="200"
                                    defaultValue={timesPresent || ''}
                                    disabled={isSavingStudent}
                                    onBlur={(e) => handleAttendanceSave(studentId, cls._id, e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                  />
                                  {isSavingStudent && <span className="ms-saving-spinner">Saving...</span>}
                                  <div className="ms-mobile-attendance-meta">
                                    {attendancePercentage !== null && (
                                      <span className={`ms-attendance-pct ${attendanceStatus}`}>
                                        {attendancePercentage}%
                                      </span>
                                    )}
                                    <span className="ms-attendance-note">
                                      / {schoolOpenDays ?? '?'} days
                                    </span>
                                  </div>
                                </div>

                                {hasComment && (
                                  <div className="ms-mobile-comment-preview">
                                    {commentPreview.length > 60
                                      ? commentPreview.substring(0, 60) + '...'
                                      : commentPreview}
                                  </div>
                                )}

                                <button
                                  className={`ms-comment-btn ${hasComment ? 'edit' : 'add'} ms-mobile-comment-btn`}
                                  onClick={() => openCommentModal(student, cls._id)}
                                >
                                  {hasComment ? '✏️ Edit Comment' : '+ Add Comment'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Comment Modal */}
      {commentModal.isOpen && (
        <div className="ms-modal-overlay" onClick={closeCommentModal}>
          <div className="ms-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ms-modal-header">
              <div>
                <h3>
                  {commentModal.existingComment ? 'Edit' : 'Add'} Teacher's Comment
                </h3>
                <p className="ms-modal-student-name">
                  {commentModal.student?.firstName} {commentModal.student?.lastName}
                  {commentModal.student?.admissionNumber && (
                    <span className="ms-modal-adm">
                      ({commentModal.student.admissionNumber})
                    </span>
                  )}
                  {/* Show attendance in modal header */}
                  {commentModal.student && (() => {
                    const studentId = getStudentId(commentModal.student);
                    const timesPresent = studentId ? (attendanceMap[studentId] ?? 0) : 0;
                    const pct = getAttendancePercentage(timesPresent);
                    const status = getAttendanceStatus(pct);
                    return (
                      <span className={`ms-modal-attendance ${status}`}>
                        📅 {timesPresent} days present
                        {pct !== null && ` (${pct}%)`}
                        {schoolOpenDays !== null && ` / ${schoolOpenDays}`}
                      </span>
                    );
                  })()}
                </p>
              </div>
              <button className="ms-modal-close" onClick={closeCommentModal}>✕</button>
            </div>

            <div className="ms-modal-body">
              <div className="ms-form-row">
                <div className="ms-form-group">
                  <label className="ms-form-label">Term <span className="ms-required">*</span></label>
                  <select
                    className="ms-select"
                    value={commentModal.term}
                    onChange={(e) => setCommentModal((prev) => ({ ...prev, term: e.target.value }))}
                  >
                    <option value="">Select Term</option>
                    {terms.map((term) => (
                      <option key={term._id} value={term.name}>
                        {term.name} {(term.isActive || term.is_active) ? '(Active)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="ms-form-group">
                  <label className="ms-form-label">Session <span className="ms-required">*</span></label>
                  <select
                    className="ms-select"
                    value={commentModal.session}
                    onChange={(e) => setCommentModal((prev) => ({ ...prev, session: e.target.value }))}
                  >
                    <option value="">Select Session</option>
                    {sessions.map((session) => (
                      <option key={session._id} value={session.name}>
                        {session.name} {(session.isActive || session.is_active) ? '(Active)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="ms-form-group">
                <label className="ms-form-label">Comment <span className="ms-required">*</span></label>
                <textarea
                  className="ms-textarea"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Enter your comment about this student's behavior, attitude, and general conduct..."
                  rows={6}
                  maxLength={500}
                />
                <div className="ms-char-count">{commentText.length}/500</div>
              </div>

              {commentModal.existingComment && (
                <div className="ms-comment-meta">
                  <span>
                    📅 Last updated:{' '}
                    {new Date(
                      commentModal.existingComment.updatedAt ||
                        commentModal.existingComment.createdAt
                    ).toLocaleDateString()}
                  </span>
                </div>
              )}

              {/* Quick Comment Templates */}
              <div className="ms-quick-comments">
                <label className="ms-form-label">
                  Quick Templates:{' '}
                  <span className="ms-template-count">
                    ({filteredComments.length} of {TEACHER_COMMENTS.length})
                  </span>
                </label>

                <div className="ms-template-search-wrap">
                  <span className="ms-template-search-icon">🔍</span>
                  <input
                    type="text"
                    className="ms-template-search"
                    value={commentSearch}
                    onChange={(e) => setCommentSearch(e.target.value)}
                    placeholder="Search templates..."
                  />
                  {commentSearch && (
                    <button
                      type="button"
                      className="ms-template-search-clear"
                      onClick={() => setCommentSearch('')}
                    >✕</button>
                  )}
                </div>

                <div className="ms-template-categories">
                  {COMMENT_CATEGORIES.map((cat) => (
                    <button
                      key={cat.key}
                      type="button"
                      className={`ms-category-tab ${commentCategory === cat.key ? 'active' : ''}`}
                      onClick={() =>
                        setCommentCategory(commentCategory === cat.key ? 'all' : cat.key)
                      }
                      title={cat.label}
                    >
                      <span className="ms-cat-icon">{cat.icon}</span>
                      <span className="ms-cat-label">{cat.label}</span>
                    </button>
                  ))}
                </div>

                <div className="ms-quick-btns-scroll">
                  {filteredComments.length === 0 ? (
                    <div className="ms-no-templates"><span>No templates match your search.</span></div>
                  ) : (
                    <div className="ms-quick-btns">
                      {filteredComments.map((comment) => (
                        <button
                          key={comment.label}
                          type="button"
                          className={`ms-quick-btn ms-quick-btn-cat-${comment.category}`}
                          onClick={() => setCommentText(comment.text)}
                          title={comment.text}
                        >
                          {comment.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="ms-modal-footer">
              <div className="ms-modal-footer-left">
                {commentModal.existingComment && (
                  <button
                    type="button"
                    className="ms-btn ms-btn-danger"
                    onClick={deleteComment}
                    disabled={isSaving}
                  >🗑️ Delete</button>
                )}
              </div>
              <div className="ms-modal-footer-right">
                <button
                  type="button"
                  className="ms-btn ms-btn-secondary"
                  onClick={closeCommentModal}
                  disabled={isSaving}
                >Cancel</button>
                <button
                  type="button"
                  className="ms-btn ms-btn-primary"
                  onClick={saveComment}
                  disabled={
                    isSaving ||
                    !commentText.trim() ||
                    !commentModal.term ||
                    !commentModal.session
                  }
                >
                  {isSaving ? (
                    <span className="ms-spinner"></span>
                  ) : commentModal.existingComment ? (
                    '💾 Update'
                  ) : (
                    '💾 Save'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyStudents;
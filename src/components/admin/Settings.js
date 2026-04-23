import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Container,
    Typography,
    Paper,
    Tabs,
    Tab,
    Button,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Switch,
    FormControlLabel,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    DialogContentText,
    Alert,
    Snackbar,
    Chip,
    IconButton,
    Tooltip,
    LinearProgress,
    Card,
    CardContent,
    Grid,
    Divider,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Checkbox,
    InputAdornment,
    Fade,
    Zoom,
} from '@mui/material';
import {
    Schedule as ScheduleIcon,
    Block as BlockIcon,
    CheckCircle as CheckCircleIcon,
    Cancel as CancelIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    Add as AddIcon,
    Refresh as RefreshIcon,
    Warning as WarningIcon,
    Info as InfoIcon,
    People as PeopleIcon,
    Class as ClassIcon,
    Timer as TimerIcon,
    Save as SaveIcon,
    Close as CloseIcon,
    FilterList as FilterListIcon,
} from '@mui/icons-material';
import { resultScheduleAPI, termsAPI, sessionsAPI, classesAPI, studentsAPI } from '../../api';
import { useTheme } from '@mui/material/styles';

// ============================================
// REUSABLE COMPONENTS
// ============================================

const StatusChip = ({ status }) => {
    const statusConfig = {
        active: { color: 'success', label: 'Active', icon: <CheckCircleIcon fontSize="small" /> },
        before_start: { color: 'warning', label: 'Not Started', icon: <TimerIcon fontSize="small" /> },
        deadline_passed: { color: 'error', label: 'Expired', icon: <CancelIcon fontSize="small" /> },
        inactive: { color: 'default', label: 'Inactive', icon: <CancelIcon fontSize="small" /> },
        no_schedule: { color: 'default', label: 'No Schedule', icon: <InfoIcon fontSize="small" /> },
    };

    const config = statusConfig[status] || statusConfig.no_schedule;

    return (
        <Chip
            icon={config.icon}
            label={config.label}
            color={config.color}
            size="small"
            variant="outlined"
            sx={{ fontWeight: 500 }}
        />
    );
};

const TimeRemainingDisplay = ({ timeRemaining, status }) => {
    if (!timeRemaining || status === 'no_schedule' || status === 'inactive') return null;

    const { days, hours, minutes } = timeRemaining;

    const formatTime = () => {
        const parts = [];
        if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
        if (hours > 0 || days > 0) parts.push(`${hours} hr${hours !== 1 ? 's' : ''}`);
        if (minutes >= 0) parts.push(`${minutes} min`);
        return parts.join(' ');
    };

    const getLabel = () => {
        switch (status) {
            case 'before_start': return 'Starts in';
            case 'active': return 'Remaining';
            case 'deadline_passed': return 'Expired';
            default: return '';
        }
    };

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
                {getLabel()}:
            </Typography>
            <Typography
                variant="caption"
                sx={{
                    fontWeight: 600,
                    color: status === 'deadline_passed' ? 'error.main' : 'primary.main',
                }}
            >
                {formatTime()}
            </Typography>
        </Box>
    );
};

const LoadingOverlay = ({ loading }) => (
    <Fade in={loading} unmountOnExit>
        <Box
            sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                borderRadius: 'inherit',
            }}
        >
            <Box sx={{ width: '60%' }}>
                <LinearProgress />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                    Processing...
                </Typography>
            </Box>
        </Box>
    </Fade>
);

const EmptyState = ({ icon: Icon, title, description, action }) => (
    <Box
        sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: 8,
            px: 2,
        }}
    >
        <Icon sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
            {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 400, textAlign: 'center' }}>
            {description}
        </Typography>
        {action}
    </Box>
);

// ============================================
// MAIN SETTINGS COMPONENT
// ============================================

const Settings = () => {
    const theme = useTheme();
    const [activeTab, setActiveTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    const showSnackbar = (message, severity = 'success') => {
        setSnackbar({ open: true, message, severity });
    };

    const handleCloseSnackbar = () => {
        setSnackbar((prev) => ({ ...prev, open: false }));
    };

    return (
        <Container maxWidth="xl" sx={{ py: 3 }}>
            {/* Header */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" fontWeight={700} gutterBottom>
                    Settings
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Manage result access schedules, student blocking, and system configuration
                </Typography>
            </Box>

            {/* Tabs */}
            <Paper sx={{ mb: 3 }} elevation={0} variant="outlined">
                <Tabs
                    value={activeTab}
                    onChange={(_, newValue) => setActiveTab(newValue)}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{
                        '& .MuiTab-root': {
                            minHeight: 64,
                            textTransform: 'none',
                            fontWeight: 500,
                        },
                    }}
                >
                    <Tab
                        icon={<ScheduleIcon />}
                        iconPosition="start"
                        label="Result Schedule"
                    />
                    <Tab
                        icon={<BlockIcon />}
                        iconPosition="start"
                        label="Student Blocking"
                    />
                    <Tab
                        icon={<ClassIcon />}
                        iconPosition="start"
                        label="Class Blocking"
                    />
                    <Tab
                        icon={<PeopleIcon />}
                        iconPosition="start"
                        label="Bulk Operations"
                    />
                </Tabs>
            </Paper>

            {/* Tab Panels */}
            <Box sx={{ position: 'relative' }}>
                <LoadingOverlay loading={loading} />

                <Box role="tabpanel" hidden={activeTab !== 0}>
                    {activeTab === 0 && <ResultScheduleTab setLoading={setLoading} showSnackbar={showSnackbar} />}
                </Box>

                <Box role="tabpanel" hidden={activeTab !== 1}>
                    {activeTab === 1 && <StudentBlockingTab setLoading={setLoading} showSnackbar={showSnackbar} />}
                </Box>

                <Box role="tabpanel" hidden={activeTab !== 2}>
                    {activeTab === 2 && <ClassBlockingTab setLoading={setLoading} showSnackbar={showSnackbar} />}
                </Box>

                <Box role="tabpanel" hidden={activeTab !== 3}>
                    {activeTab === 3 && <BulkOperationsTab setLoading={setLoading} showSnackbar={showSnackbar} />}
                </Box>
            </Box>

            {/* Snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={handleCloseSnackbar}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                sx={{ mb: 2 }}
            >
                <Alert
                    onClose={handleCloseSnackbar}
                    severity={snackbar.severity}
                    variant="filled"
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Container>
    );
};

// ============================================
// TAB 1: RESULT SCHEDULE
// ============================================

const ResultScheduleTab = ({ setLoading, showSnackbar }) => {
    const [schedules, setSchedules] = useState([]);
    const [currentSchedule, setCurrentSchedule] = useState(null);
    const [currentStatus, setCurrentStatus] = useState('no_schedule');
    const [currentTimeRemaining, setCurrentTimeRemaining] = useState(null);
    const [terms, setTerms] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [formData, setFormData] = useState({
        termId: '',
        sessionId: '',
        resultStartTime: '',
        resultDeadline: '',
        message: '',
        isActive: true,
    });

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            // Fetch dropdown data and all schedules in parallel
            const [termsRes, sessionsRes, schedulesRes, currentRes] = await Promise.all([
                termsAPI.getAll(),
                sessionsAPI.getAll(),
                resultScheduleAPI.getAll(),
                resultScheduleAPI.getCurrent(),
            ]);

            // ✅ FIXED: API functions return response.data directly, so access .data once
            setTerms(termsRes?.data || []);
            setSessions(sessionsRes?.data || []);
            setSchedules(schedulesRes?.data || []);

            // ✅ FIXED: Access data and meta from the returned object directly
            const currentData = currentRes?.data;
            const currentMeta = currentRes?.meta;

            setCurrentSchedule(currentData || null);
            setCurrentStatus(currentMeta?.currentStatus || 'no_schedule');
            setCurrentTimeRemaining(currentMeta?.timeRemaining || null);
        } catch (error) {
            console.error('Error fetching initial data:', error);
            showSnackbar('Failed to load schedule data', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenCreateDialog = () => {
        setEditingSchedule(null);
        setFormData({
            termId: '',
            sessionId: '',
            resultStartTime: '',
            resultDeadline: '',
            message: 'Results are not available at this time. Please check back later.',
            isActive: true,
        });
        setDialogOpen(true);
    };

    const handleOpenEditDialog = (schedule) => {
        setEditingSchedule(schedule);

        const formatDateTime = (dateStr) => {
            if (!dateStr) return '';
            const date = new Date(dateStr);
            return date.toISOString().slice(0, 16);
        };

        setFormData({
            termId: schedule.termId?._id || '',
            sessionId: schedule.sessionId?._id || '',
            resultStartTime: formatDateTime(schedule.resultStartTime),
            resultDeadline: formatDateTime(schedule.resultDeadline),
            message: schedule.message || '',
            isActive: schedule.isActive ?? true,
        });
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setEditingSchedule(null);
    };

    const handleFormChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async () => {
        if (!formData.termId || !formData.sessionId) {
            showSnackbar('Please select term and session', 'warning');
            return;
        }
        if (!formData.resultStartTime || !formData.resultDeadline) {
            showSnackbar('Please set start time and deadline', 'warning');
            return;
        }
        if (new Date(formData.resultDeadline) <= new Date(formData.resultStartTime)) {
            showSnackbar('Deadline must be after start time', 'warning');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                ...formData,
                resultStartTime: new Date(formData.resultStartTime).toISOString(),
                resultDeadline: new Date(formData.resultDeadline).toISOString(),
            };

            if (editingSchedule) {
                await resultScheduleAPI.update(editingSchedule._id, payload);
                showSnackbar('Schedule updated successfully');
            } else {
                const result = await resultScheduleAPI.create(payload);
                
                // Handle "already exists" case from API
                if (result?.alreadyExists) {
                    showSnackbar(result.message || 'A schedule already exists for this term. Use update instead.', 'warning');
                    setLoading(false);
                    return;
                }
                
                showSnackbar('Schedule created successfully');
            }

            handleCloseDialog();
            await fetchInitialData();
        } catch (error) {
            const message = error.response?.data?.message || error.message || 'Failed to save schedule';
            showSnackbar(message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleActive = async (id) => {
        setLoading(true);
        try {
            await resultScheduleAPI.toggleActive(id);
            showSnackbar('Schedule status updated');
            await fetchInitialData();
        } catch (error) {
            showSnackbar('Failed to toggle schedule status', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClick = (id) => {
        setDeletingId(id);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        setLoading(true);
        try {
            await resultScheduleAPI.delete(deletingId);
            showSnackbar('Schedule deleted successfully');
            setDeleteDialogOpen(false);
            setDeletingId(null);
            await fetchInitialData();
        } catch (error) {
            showSnackbar('Failed to delete schedule', 'error');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const activeTerm = terms.find((t) => t.status === 'active');

    const isCurrentlyActive = currentStatus === 'active';

    return (
        <Box>
            {/* Current Schedule Card */}
            <Card sx={{ mb: 3, border: '1px solid', borderColor: currentSchedule ? 'success.light' : 'grey.200' }}>
                <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Box>
                            <Typography variant="h6" fontWeight={600} gutterBottom>
                                Current Result Schedule
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Active Term: {activeTerm?.name || 'None'}
                            </Typography>
                        </Box>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={handleOpenCreateDialog}
                            disabled={!activeTerm}
                        >
                            New Schedule
                        </Button>
                    </Box>

                    {currentSchedule ? (
                        <Box sx={{ p: 2, backgroundColor: isCurrentlyActive ? 'success.50' : 'grey.50', borderRadius: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                {isCurrentlyActive ? (
                                    <>
                                        <CheckCircleIcon color="success" />
                                        <Typography variant="subtitle1" fontWeight={600} color="success.dark">
                                            Results Currently Accessible
                                        </Typography>
                                    </>
                                ) : (
                                    <>
                                        <StatusChip status={currentStatus} />
                                        <Typography variant="subtitle1" fontWeight={600} color="text.secondary">
                                            Schedule Exists - Not Currently Active
                                        </Typography>
                                    </>
                                )}
                            </Box>
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="body2" color="text.secondary">
                                        Start Time
                                    </Typography>
                                    <Typography variant="body1" fontWeight={500}>
                                        {formatDate(currentSchedule.resultStartTime)}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="body2" color="text.secondary">
                                        Deadline
                                    </Typography>
                                    <Typography variant="body1" fontWeight={500}>
                                        {formatDate(currentSchedule.resultDeadline)}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12}>
                                    <TimeRemainingDisplay
                                        timeRemaining={currentTimeRemaining}
                                        status={currentStatus}
                                    />
                                </Grid>
                            </Grid>
                            {currentSchedule.message && (
                                <Alert severity="info" sx={{ mt: 2 }} icon={<InfoIcon />}>
                                    {currentSchedule.message}
                                </Alert>
                            )}
                        </Box>
                    ) : (
                        <Box sx={{ p: 2, backgroundColor: 'grey.50', borderRadius: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <WarningIcon color="warning" />
                                <Typography variant="subtitle1" fontWeight={600} color="text.secondary">
                                    No Active Schedule
                                </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                {!activeTerm
                                    ? 'Please set an active term first before creating a schedule.'
                                    : 'Create a schedule to control when students can access their results.'}
                            </Typography>
                        </Box>
                    )}
                </CardContent>
            </Card>

            {/* All Schedules Table */}
            <Paper variant="outlined">
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6" fontWeight={600}>
                        All Schedules ({schedules.length})
                    </Typography>
                    <Tooltip title="Refresh">
                        <IconButton onClick={fetchInitialData}>
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                </Box>

                {schedules.length === 0 ? (
                    <EmptyState
                        icon={ScheduleIcon}
                        title="No Schedules Created"
                        description="Create a result access schedule to control when students can view their results."
                        action={
                            <Button
                                variant="outlined"
                                startIcon={<AddIcon />}
                                onClick={handleOpenCreateDialog}
                                disabled={!activeTerm}
                            >
                                Create First Schedule
                            </Button>
                        }
                    />
                ) : (
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Term</TableCell>
                                    <TableCell>Session</TableCell>
                                    <TableCell>Start Time</TableCell>
                                    <TableCell>Deadline</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Time Remaining</TableCell>
                                    <TableCell>Active</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {schedules.map((schedule) => (
                                    <TableRow key={schedule._id} hover>
                                        <TableCell>
                                            <Typography variant="body2" fontWeight={500}>
                                                {schedule.termId?.name || 'N/A'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2">
                                                {schedule.sessionId?.name || 'N/A'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2">
                                                {formatDate(schedule.resultStartTime)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2">
                                                {formatDate(schedule.resultDeadline)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <StatusChip status={schedule.currentStatus} />
                                        </TableCell>
                                        <TableCell>
                                            <TimeRemainingDisplay
                                                timeRemaining={schedule.timeRemaining}
                                                status={schedule.currentStatus}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Switch
                                                checked={schedule.isActive}
                                                onChange={() => handleToggleActive(schedule._id)}
                                                color="primary"
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell align="right">
                                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                <Tooltip title="Edit">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleOpenEditDialog(schedule)}
                                                    >
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete">
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        onClick={() => handleDeleteClick(schedule._id)}
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Paper>

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {editingSchedule ? 'Edit Schedule' : 'Create New Schedule'}
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
                        <FormControl fullWidth>
                            <InputLabel>Term</InputLabel>
                            <Select
                                value={formData.termId}
                                onChange={(e) => handleFormChange('termId', e.target.value)}
                                label="Term"
                            >
                                {terms.map((term) => (
                                    <MenuItem key={term._id} value={term._id}>
                                        {term.name}
                                        {term.status === 'active' && (
                                            <Chip
                                                label="Active"
                                                size="small"
                                                color="primary"
                                                sx={{ ml: 1 }}
                                            />
                                        )}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl fullWidth>
                            <InputLabel>Session</InputLabel>
                            <Select
                                value={formData.sessionId}
                                onChange={(e) => handleFormChange('sessionId', e.target.value)}
                                label="Session"
                            >
                                {sessions.map((session) => (
                                    <MenuItem key={session._id} value={session._id}>
                                        {session.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <TextField
                            fullWidth
                            type="datetime-local"
                            label="Result Start Time"
                            value={formData.resultStartTime}
                            onChange={(e) => handleFormChange('resultStartTime', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                        />

                        <TextField
                            fullWidth
                            type="datetime-local"
                            label="Result Deadline"
                            value={formData.resultDeadline}
                            onChange={(e) => handleFormChange('resultDeadline', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                        />

                        <TextField
                            fullWidth
                            multiline
                            rows={3}
                            label="Public Message (shown to students)"
                            value={formData.message}
                            onChange={(e) => handleFormChange('message', e.target.value)}
                            placeholder="e.g., Results are not available at this time. Please check back later."
                        />

                        <FormControlLabel
                            control={
                                <Switch
                                    checked={formData.isActive}
                                    onChange={(e) => handleFormChange('isActive', e.target.checked)}
                                    color="primary"
                                />
                            }
                            label="Activate immediately after creation"
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleSubmit}
                        startIcon={<SaveIcon />}
                    >
                        {editingSchedule ? 'Update' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
                        <WarningIcon />
                        Delete Schedule
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete this schedule? This action cannot be undone.
                        Students will be able to access results at any time if no other schedule is active.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleConfirmDelete} color="error" variant="contained">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

// ============================================
// TAB 2: STUDENT BLOCKING
// ============================================

const StudentBlockingTab = ({ setLoading, showSnackbar }) => {
    const [students, setStudents] = useState([]);
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [blockDialogOpen, setBlockDialogOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [blockReason, setBlockReason] = useState('');
    const [blockAction, setBlockAction] = useState(true);
    const [filterBlocked, setFilterBlocked] = useState('all');

    useEffect(() => {
        fetchClasses();
    }, []);

    useEffect(() => {
        if (selectedClass) {
            fetchStudents();
        }
    }, [selectedClass]);

    const fetchClasses = async () => {
        setLoading(true);
        try {
            const response = await classesAPI.getAllForDropdown();
            // ✅ FIXED: Access .data directly (not .data.data)
            setClasses(response?.data || []);
        } catch (error) {
            showSnackbar('Failed to load classes', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchStudents = async () => {
        setLoading(true);
        try {
            const response = await studentsAPI.getAll();
            // ✅ FIXED: Access .data directly (not .data.data)
            let studentList = response?.data || [];

            if (selectedClass) {
                studentList = studentList.filter(
                    (s) => s.classId?._id === selectedClass
                );
            }

            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                studentList = studentList.filter(
                    (s) =>
                        s.firstName?.toLowerCase().includes(query) ||
                        s.lastName?.toLowerCase().includes(query) ||
                        s.admissionNumber?.toLowerCase().includes(query)
                );
            }

            if (filterBlocked === 'blocked') {
                studentList = studentList.filter((s) => s.resultAccessBlocked);
            } else if (filterBlocked === 'unblocked') {
                studentList = studentList.filter((s) => !s.resultAccessBlocked);
            }

            setStudents(studentList);
        } catch (error) {
            showSnackbar('Failed to load students', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleBlockClick = (student) => {
        setSelectedStudent(student);
        setBlockAction(true);
        setBlockReason('');
        setBlockDialogOpen(true);
    };

    const handleQuickUnblock = async (student) => {
        setLoading(true);
        try {
            await studentsAPI.toggleResultAccess(student._id);
            showSnackbar(`${student.firstName} ${student.lastName} unblocked successfully`);
            fetchStudents();
        } catch (error) {
            showSnackbar('Failed to unblock student', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleBlockSubmit = async () => {
        setLoading(true);
        try {
            await studentsAPI.blockResultAccess(selectedStudent._id, {
                blocked: blockAction,
                reason: blockReason,
            });

            const actionText = blockAction ? 'blocked' : 'unblocked';
            showSnackbar(`${selectedStudent.firstName} ${selectedStudent.lastName} ${actionText} successfully`);
            setBlockDialogOpen(false);
            fetchStudents();
        } catch (error) {
            showSnackbar('Failed to update student blocking', 'error');
        } finally {
            setLoading(false);
        }
    };

    const blockedCount = students.filter((s) => s.resultAccessBlocked).length;

    return (
        <Box>
            {/* Filters */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={3}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Class</InputLabel>
                            <Select
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                                label="Class"
                            >
                                <MenuItem value="">All Classes</MenuItem>
                                {classes.map((cls) => (
                                    <MenuItem key={cls._id} value={cls._id}>
                                        {cls.name} {cls.section} - {cls.level}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder="Search by name or admission number..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <FilterListIcon fontSize="small" />
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Filter</InputLabel>
                            <Select
                                value={filterBlocked}
                                onChange={(e) => setFilterBlocked(e.target.value)}
                                label="Filter"
                            >
                                <MenuItem value="all">All Students</MenuItem>
                                <MenuItem value="blocked">Blocked Only</MenuItem>
                                <MenuItem value="unblocked">Unblocked Only</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={2}>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Chip
                                label={`${blockedCount} Blocked`}
                                color="error"
                                size="small"
                                variant="outlined"
                            />
                            <Chip
                                label={`${students.length - blockedCount} Active`}
                                color="success"
                                size="small"
                                variant="outlined"
                            />
                        </Box>
                    </Grid>
                </Grid>
            </Paper>

            {/* Students Table */}
            <Paper variant="outlined">
                {!selectedClass ? (
                    <EmptyState
                        icon={ClassIcon}
                        title="Select a Class"
                        description="Choose a class from the dropdown above to view and manage student result access."
                    />
                ) : students.length === 0 ? (
                    <EmptyState
                        icon={PeopleIcon}
                        title="No Students Found"
                        description={searchQuery ? 'No students match your search criteria.' : 'No students in this class.'}
                    />
                ) : (
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Admission No.</TableCell>
                                    <TableCell>Name</TableCell>
                                    <TableCell>Gender</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Block Reason</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {students.map((student) => (
                                    <TableRow key={student._id} hover>
                                        <TableCell>
                                            <Typography variant="body2" fontFamily="monospace">
                                                {student.admissionNumber}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" fontWeight={500}>
                                                {student.firstName} {student.lastName}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2">{student.gender}</Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={student.resultAccessBlocked ? 'Blocked' : 'Active'}
                                                color={student.resultAccessBlocked ? 'error' : 'success'}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                                sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                            >
                                                {student.resultBlockReason || '-'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                            {student.resultAccessBlocked ? (
                                                <Tooltip title="Click to quickly unblock this student">
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        color="success"
                                                        startIcon={<CheckCircleIcon />}
                                                        onClick={() => handleQuickUnblock(student)}
                                                    >
                                                        Unblock
                                                    </Button>
                                                </Tooltip>
                                            ) : (
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    color="error"
                                                    startIcon={<BlockIcon />}
                                                    onClick={() => handleBlockClick(student)}
                                                >
                                                    Block
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Paper>

            {/* Block Dialog */}
            <Dialog open={blockDialogOpen} onClose={() => setBlockDialogOpen(false)} maxWidth="sm">
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
                        <BlockIcon />
                        Block Student Result Access
                    </Box>
                </DialogTitle>
                <DialogContent>
                    {selectedStudent && (
                        <Box sx={{ mt: 1 }}>
                            <Alert severity="warning" sx={{ mb: 2 }}>
                                This will prevent {selectedStudent.firstName} {selectedStudent.lastName} ({selectedStudent.admissionNumber}) from viewing their results.
                            </Alert>

                            <TextField
                                fullWidth
                                multiline
                                rows={3}
                                label="Block Reason (optional)"
                                value={blockReason}
                                onChange={(e) => setBlockReason(e.target.value)}
                                placeholder="e.g., Outstanding fees - contact bursar"
                                sx={{ mt: 2 }}
                            />
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setBlockDialogOpen(false)}>Cancel</Button>
                    <Button
                        onClick={handleBlockSubmit}
                        variant="contained"
                        color="error"
                    >
                        Block Access
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

// ============================================
// TAB 3: CLASS BLOCKING
// ============================================

const ClassBlockingTab = ({ setLoading, showSnackbar }) => {
    const [classes, setClasses] = useState([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedClass, setSelectedClass] = useState(null);
    const [blockReason, setBlockReason] = useState('');
    const [blockAction, setBlockAction] = useState(true);

    useEffect(() => {
        fetchClasses();
    }, []);

    const fetchClasses = async () => {
        setLoading(true);
        try {
            const response = await classesAPI.getAllForDropdown();
            // ✅ FIXED: Access .data directly (not .data.data)
            setClasses(response?.data || []);
        } catch (error) {
            showSnackbar('Failed to load classes', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleBlockClick = (cls) => {
        setSelectedClass(cls);
        setBlockAction(true);
        setBlockReason('');
        setDialogOpen(true);
    };

    const handleQuickUnblock = async (cls) => {
        setLoading(true);
        try {
            await classesAPI.toggleResultAccess(cls._id);
            const className = `${cls.name} ${cls.section}`;
            showSnackbar(`${className} unblocked successfully`);
            fetchClasses();
        } catch (error) {
            showSnackbar('Failed to unblock class', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleBlockSubmit = async () => {
        setLoading(true);
        try {
            await classesAPI.blockResultAccess(selectedClass._id, {
                blocked: blockAction,
                reason: blockReason,
            });

            const className = `${selectedClass.name} ${selectedClass.section}`;
            const actionText = blockAction ? 'blocked' : 'unblocked';
            showSnackbar(`${className} ${actionText} successfully`);
            setDialogOpen(false);
            fetchClasses();
        } catch (error) {
            showSnackbar('Failed to update class blocking', 'error');
        } finally {
            setLoading(false);
        }
    };

    const blockedCount = classes.filter((c) => c.resultAccessBlocked).length;

    return (
        <Box>
            {/* Stats */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6} md={3}>
                    <Card variant="outlined">
                        <CardContent sx={{ textAlign: 'center', py: 2 }}>
                            <Typography variant="h4" fontWeight={700} color="primary.main">
                                {classes.length}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Total Classes
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={6} md={3}>
                    <Card variant="outlined" sx={{ borderColor: 'success.light' }}>
                        <CardContent sx={{ textAlign: 'center', py: 2 }}>
                            <Typography variant="h4" fontWeight={700} color="success.main">
                                {classes.length - blockedCount}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Active Classes
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={6} md={3}>
                    <Card variant="outlined" sx={{ borderColor: 'error.light' }}>
                        <CardContent sx={{ textAlign: 'center', py: 2 }}>
                            <Typography variant="h4" fontWeight={700} color="error.main">
                                {blockedCount}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Blocked Classes
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={6} md={3}>
                    <Card variant="outlined">
                        <CardContent sx={{ textAlign: 'center', py: 2 }}>
                            <Typography variant="h4" fontWeight={700}>
                                {classes.length > 0
                                    ? Math.round((blockedCount / classes.length) * 100)
                                    : 0}
                                %
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Block Rate
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Classes Grid */}
            <Grid container spacing={2}>
                {classes.map((cls) => (
                    <Grid item xs={12} sm={6} md={4} key={cls._id}>
                        <Zoom in>
                            <Card
                                variant="outlined"
                                sx={{
                                    borderColor: cls.resultAccessBlocked ? 'error.main' : 'success.light',
                                    position: 'relative',
                                    overflow: 'visible',
                                }}
                            >
                                {cls.resultAccessBlocked && (
                                    <Box
                                        sx={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            height: 4,
                                            backgroundColor: 'error.main',
                                        }}
                                    />
                                )}
                                <CardContent>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                        <Box>
                                            <Typography variant="h6" fontWeight={600}>
                                                {cls.name} {cls.section}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {cls.level} | {cls.session}
                                            </Typography>
                                        </Box>
                                        <Chip
                                            label={cls.resultAccessBlocked ? 'Blocked' : 'Active'}
                                            color={cls.resultAccessBlocked ? 'error' : 'success'}
                                            size="small"
                                        />
                                    </Box>

                                    {cls.resultBlockReason && (
                                        <Alert severity="warning" sx={{ mt: 1, py: 0 }}>
                                            <Typography variant="caption">{cls.resultBlockReason}</Typography>
                                        </Alert>
                                    )}

                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                                        <Typography variant="caption" color="text.secondary">
                                            {cls.resultAccessBlocked
                                                ? `Blocked on ${cls.resultBlockedAt ? new Date(cls.resultBlockedAt).toLocaleDateString() : 'N/A'}`
                                                : 'Students can access results'}
                                        </Typography>
                                        {cls.resultAccessBlocked ? (
                                            <Tooltip title="Click to quickly unblock this class">
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    color="success"
                                                    startIcon={<CheckCircleIcon />}
                                                    onClick={() => handleQuickUnblock(cls)}
                                                >
                                                    Unblock
                                                </Button>
                                            </Tooltip>
                                        ) : (
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                color="error"
                                                startIcon={<BlockIcon />}
                                                onClick={() => handleBlockClick(cls)}
                                            >
                                                Block
                                            </Button>
                                        )}
                                    </Box>
                                </CardContent>
                            </Card>
                        </Zoom>
                    </Grid>
                ))}
            </Grid>

            {/* Block Dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm">
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
                        <BlockIcon />
                        Block Class Result Access
                    </Box>
                </DialogTitle>
                <DialogContent>
                    {selectedClass && (
                        <Box sx={{ mt: 1 }}>
                            <Alert severity="warning" sx={{ mb: 2 }}>
                                This will prevent ALL students in {selectedClass.name} {selectedClass.section} from viewing their results.
                            </Alert>

                            <TextField
                                fullWidth
                                multiline
                                rows={3}
                                label="Block Reason (optional)"
                                value={blockReason}
                                onChange={(e) => setBlockReason(e.target.value)}
                                placeholder="e.g., Results pending approval"
                                sx={{ mt: 2 }}
                            />
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button
                        onClick={handleBlockSubmit}
                        variant="contained"
                        color="error"
                    >
                        Block Access
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

// ============================================
// TAB 4: BULK OPERATIONS
// ============================================

const BulkOperationsTab = ({ setLoading, showSnackbar }) => {
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [students, setStudents] = useState([]);
    const [selectedStudents, setSelectedStudents] = useState([]);
    const [selectAll, setSelectAll] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [blockAction, setBlockAction] = useState(true);
    const [blockReason, setBlockReason] = useState('');
    const [operationMode, setOperationMode] = useState('selected');

    useEffect(() => {
        fetchClasses();
    }, []);

    useEffect(() => {
        if (selectedClass) {
            fetchStudents();
        } else {
            setStudents([]);
            setSelectedStudents([]);
            setSelectAll(false);
        }
    }, [selectedClass]);

    const fetchClasses = async () => {
        setLoading(true);
        try {
            const response = await classesAPI.getAllForDropdown();
            // ✅ FIXED: Access .data directly (not .data.data)
            setClasses(response?.data || []);
        } catch (error) {
            showSnackbar('Failed to load classes', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchStudents = async () => {
        setLoading(true);
        try {
            const response = await studentsAPI.getAll();
            // ✅ FIXED: Access .data directly (not .data.data)
            const classStudents = (response?.data || []).filter(
                (s) => s.classId?._id === selectedClass
            );
            setStudents(classStudents);
            setSelectedStudents([]);
            setSelectAll(false);
        } catch (error) {
            showSnackbar('Failed to load students', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectAll = (event) => {
        const checked = event.target.checked;
        setSelectAll(checked);
        setSelectedStudents(checked ? students.map((s) => s._id) : []);
    };

    const handleSelectStudent = (studentId) => {
        setSelectedStudents((prev) =>
            prev.includes(studentId)
                ? prev.filter((id) => id !== studentId)
                : [...prev, studentId]
        );
        setSelectAll(students.length > 0 && students.every((s) => [...selectedStudents, studentId].includes(s._id)));
    };

    const handleOpenBlockDialog = (mode) => {
        setBlockAction(true);
        setOperationMode(mode);
        setBlockReason('');
        setDialogOpen(true);
    };

    const handleQuickUnblockSelected = async () => {
        if (selectedStudents.length === 0) {
            showSnackbar('Please select at least one student', 'warning');
            return;
        }

        setLoading(true);
        try {
            await studentsAPI.bulkResultAccess({
                studentIds: selectedStudents,
                blocked: false,
            });

            showSnackbar(`Successfully unblocked ${selectedStudents.length} student(s)`);
            setSelectedStudents([]);
            setSelectAll(false);
            fetchStudents();
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to unblock students';
            showSnackbar(message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleQuickUnblockClass = async () => {
        if (!selectedClass) return;

        setLoading(true);
        try {
            await classesAPI.toggleResultAccess(selectedClass);
            showSnackbar('Successfully unblocked all students in class');
            fetchClasses();
            fetchStudents();
        } catch (error) {
            showSnackbar('Failed to unblock class', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (operationMode === 'selected' && selectedStudents.length === 0) {
            showSnackbar('Please select at least one student', 'warning');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                blocked: blockAction,
                reason: blockReason,
            };

            if (operationMode === 'selected') {
                payload.studentIds = selectedStudents;
            } else {
                payload.classId = selectedClass;
            }

            await studentsAPI.bulkResultAccess(payload);

            const actionText = blockAction ? 'blocked' : 'unblocked';
            const countText = operationMode === 'class' ? 'all students in class' : `${selectedStudents.length} student(s)`;
            showSnackbar(`Successfully ${actionText} ${countText}`);

            setDialogOpen(false);
            setSelectedStudents([]);
            setSelectAll(false);

            if (operationMode === 'class') {
                fetchClasses();
            }
            fetchStudents();
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to perform bulk operation';
            showSnackbar(message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box>
            {/* Operation Selection */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                    Bulk Operations
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Block or unblock result access for multiple students at once.
                </Typography>

                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={4}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Class</InputLabel>
                            <Select
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                                label="Class"
                            >
                                <MenuItem value="">Select a class...</MenuItem>
                                {classes.map((cls) => (
                                    <MenuItem key={cls._id} value={cls._id}>
                                        {cls.name} {cls.section} - {cls.level}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={8}>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <Button
                                variant="outlined"
                                color="error"
                                startIcon={<BlockIcon />}
                                onClick={() => handleOpenBlockDialog('selected')}
                                disabled={selectedStudents.length === 0}
                            >
                                Block Selected ({selectedStudents.length})
                            </Button>
                            <Button
                                variant="contained"
                                color="error"
                                startIcon={<BlockIcon />}
                                onClick={() => handleOpenBlockDialog('class')}
                                disabled={!selectedClass}
                            >
                                Block Entire Class
                            </Button>

                            <Divider orientation="vertical" flexItem />

                            <Tooltip title="Quickly unblock without entering a reason">
                                <Button
                                    variant="outlined"
                                    color="success"
                                    startIcon={<CheckCircleIcon />}
                                    onClick={handleQuickUnblockSelected}
                                    disabled={selectedStudents.length === 0}
                                >
                                    Unblock Selected ({selectedStudents.length})
                                </Button>
                            </Tooltip>
                            <Tooltip title="Quickly unblock entire class without entering a reason">
                                <Button
                                    variant="contained"
                                    color="success"
                                    startIcon={<CheckCircleIcon />}
                                    onClick={handleQuickUnblockClass}
                                    disabled={!selectedClass}
                                >
                                    Unblock Entire Class
                                </Button>
                            </Tooltip>
                        </Box>
                    </Grid>
                </Grid>
            </Paper>

            {/* Info Alert */}
            <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2">
                    <strong>Block</strong> requires a reason (opens dialog). 
                    <strong>Unblock</strong> is instant (no dialog needed).
                </Typography>
            </Alert>

            {/* Students Selection Table */}
            {selectedClass && students.length > 0 && (
                <Paper variant="outlined" sx={{ mb: 3 }}>
                    <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="subtitle1" fontWeight={600}>
                            Select Students ({students.length} total)
                        </Typography>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={selectAll}
                                    onChange={handleSelectAll}
                                    indeterminate={selectedStudents.length > 0 && selectedStudents.length < students.length}
                                />
                            }
                            label="Select All"
                        />
                    </Box>
                    <TableContainer sx={{ maxHeight: 400 }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            checked={selectAll}
                                            onChange={handleSelectAll}
                                            indeterminate={selectedStudents.length > 0 && selectedStudents.length < students.length}
                                        />
                                    </TableCell>
                                    <TableCell>Admission No.</TableCell>
                                    <TableCell>Name</TableCell>
                                    <TableCell>Current Status</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {students.map((student) => (
                                    <TableRow
                                        key={student._id}
                                        hover
                                        selected={selectedStudents.includes(student._id)}
                                        onClick={() => handleSelectStudent(student._id)}
                                        sx={{ cursor: 'pointer' }}
                                    >
                                        <TableCell padding="checkbox">
                                            <Checkbox
                                                checked={selectedStudents.includes(student._id)}
                                                onChange={() => handleSelectStudent(student._id)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" fontFamily="monospace">
                                                {student.admissionNumber}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" fontWeight={500}>
                                                {student.firstName} {student.lastName}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={student.resultAccessBlocked ? 'Blocked' : 'Active'}
                                                color={student.resultAccessBlocked ? 'error' : 'success'}
                                                size="small"
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            )}

            {/* Bulk Block Dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm">
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
                        <BlockIcon />
                        Bulk Block Result Access
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        {operationMode === 'class'
                            ? `This will block ALL students in the selected class.`
                            : `This will block ${selectedStudents.length} selected student(s).`}
                    </Alert>

                    <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Block Reason (optional)"
                        value={blockReason}
                        onChange={(e) => setBlockReason(e.target.value)}
                        placeholder="e.g., End of term result review period"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button
                        onClick={handleSubmit}
                        variant="contained"
                        color="error"
                        startIcon={<BlockIcon />}
                    >
                        Confirm Block
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Settings;
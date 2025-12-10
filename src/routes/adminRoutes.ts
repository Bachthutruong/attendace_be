import express from 'express';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getAllAttendances,
  getTodayAttendances,
  getAttendanceStats,
  getAttendanceDetail,
  updateAttendanceStatus,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getSettings,
  updateSettings,
  getCurrentIP,
} from '../controllers/adminController';
import {
  getAllLeaveRequests,
  approveLeaveRequest,
  rejectLeaveRequest,
} from '../controllers/leaveRequestController';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin'));

// User management
router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

// Attendance management
router.get('/attendances', getAllAttendances);
router.get('/attendances/today', getTodayAttendances);
router.get('/attendances/stats', getAttendanceStats);
router.get('/attendances/:id', getAttendanceDetail);
router.patch('/attendances/:id/status', updateAttendanceStatus);

// Notifications
router.get('/notifications', getNotifications);
router.patch('/notifications/:id/read', markNotificationAsRead);
router.patch('/notifications/read-all', markAllNotificationsAsRead);

// Settings
router.get('/settings', getSettings);
router.put('/settings', updateSettings);
router.get('/current-ip', getCurrentIP);

// Leave requests management
router.get('/leave-requests', getAllLeaveRequests);
router.patch('/leave-requests/:id/approve', approveLeaveRequest);
router.patch('/leave-requests/:id/reject', rejectLeaveRequest);

export default router;


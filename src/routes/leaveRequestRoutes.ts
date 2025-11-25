import express from 'express';
import {
  createLeaveRequest,
  getMyLeaveRequests,
  getLeaveRequestById,
  updateLeaveRequest,
  deleteLeaveRequest,
  getEmployeesForSupport,
} from '../controllers/leaveRequestController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Employee routes
router.post('/', createLeaveRequest);
router.get('/my-requests', getMyLeaveRequests);
router.get('/employees', getEmployeesForSupport);
router.get('/:id', getLeaveRequestById);
router.put('/:id', updateLeaveRequest);
router.delete('/:id', deleteLeaveRequest);

export default router;


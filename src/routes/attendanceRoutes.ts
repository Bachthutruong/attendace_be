import express from 'express';
import {
  preCheckFraud,
  checkIn,
  checkOut,
  getTodayAttendance,
  getMyAttendanceHistory,
} from '../controllers/attendanceController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.use(authenticate);

router.get('/pre-check-fraud', preCheckFraud);
router.post('/check-in', checkIn);
router.post('/check-out', checkOut);
router.get('/today', getTodayAttendance);
router.get('/history', getMyAttendanceHistory);

export default router;




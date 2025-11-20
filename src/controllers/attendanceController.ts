import { Response } from 'express';
import Attendance from '../models/Attendance';
import Notification from '../models/Notification';
import { AuthRequest } from '../middleware/auth';
import { getClientIp, parseDeviceInfo, generateDeviceFingerprint } from '../utils/deviceParser';
import { getStartOfDay, getEndOfDay, calculateWorkedHours, formatDateTime } from '../utils/dateHelper';

// Helper function to check device/IP alerts by comparing with all previous records
const checkDeviceAndIpAlerts = (
  currentDeviceInfo: any,
  currentIp: string,
  previousAttendances: any[]
): { hasDeviceAlert: boolean; hasIpAlert: boolean; alertMessage: string } => {
  let hasDeviceAlert = false;
  let hasIpAlert = false;
  let alertMessage = '';

  if (previousAttendances.length === 0) {
    return { hasDeviceAlert, hasIpAlert, alertMessage };
  }

  const currentFingerprint = generateDeviceFingerprint(currentDeviceInfo);
  const previousFingerprints = new Set<string>();
  const previousIps = new Set<string>();

  // Collect all fingerprints and IPs from previous check-in/check-out records
  for (const prevAttendance of previousAttendances) {
    if (prevAttendance.checkIn) {
      const fingerprint = generateDeviceFingerprint(prevAttendance.checkIn.deviceInfo);
      previousFingerprints.add(fingerprint);
      previousIps.add(prevAttendance.checkIn.ipAddress);
    }
    if (prevAttendance.checkOut) {
      const fingerprint = generateDeviceFingerprint(prevAttendance.checkOut.deviceInfo);
      previousFingerprints.add(fingerprint);
      previousIps.add(prevAttendance.checkOut.ipAddress);
    }
  }

  // Check if current device is different from all previous devices
  if (!previousFingerprints.has(currentFingerprint)) {
    hasDeviceAlert = true;
    alertMessage += 'Thiết bị khác với các lần trước. ';
  }

  // Check if current IP is different from all previous IPs
  if (!previousIps.has(currentIp)) {
    hasIpAlert = true;
    alertMessage += 'Địa chỉ IP khác với các lần trước. ';
  }

  return { hasDeviceAlert, hasIpAlert, alertMessage };
};

export const checkIn = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const today = getStartOfDay();
    
    // Get device and IP information
    const ipAddress = getClientIp(req);
    const deviceInfo = parseDeviceInfo(req);
    
    // Check if already checked in today
    let attendance = await Attendance.findOne({
      userId,
      date: today,
    });

    if (attendance && attendance.checkIn) {
      res.status(400).json({
        success: false,
        message: 'Bạn đã chấm công vào rồi. Vui lòng chấm công ra.',
      });
      return;
    }

    // Check for device/IP alerts - compare with all previous check-in/check-out records
    const previousAttendances = await Attendance.find({
      userId,
      $or: [
        { checkIn: { $exists: true } },
        { checkOut: { $exists: true } }
      ],
      date: { $lt: today }, // Only previous days, not today
    }).sort({ date: -1, createdAt: -1 }).limit(30); // Get more records for better comparison

    const { hasDeviceAlert, hasIpAlert, alertMessage } = checkDeviceAndIpAlerts(
      deviceInfo,
      ipAddress,
      previousAttendances
    );

    // Create or update attendance
    if (!attendance) {
      attendance = await Attendance.create({
        userId,
        date: today,
        checkIn: {
          type: 'check-in',
          time: new Date(),
          ipAddress,
          deviceInfo,
        },
        status: 'pending',
        hasDeviceAlert,
        hasIpAlert,
        alertMessage: alertMessage || undefined,
      });
    } else {
      attendance.checkIn = {
        type: 'check-in',
        time: new Date(),
        ipAddress,
        deviceInfo,
      };
      attendance.hasDeviceAlert = hasDeviceAlert;
      attendance.hasIpAlert = hasIpAlert;
      attendance.alertMessage = alertMessage || undefined;
      await attendance.save();
    }

    // Create notification for admin
    const notificationTitle = hasDeviceAlert || hasIpAlert 
      ? '⚠️ Check-in với cảnh báo'
      : '✅ Check-in thành công';
    
    const notificationMessage = `${req.user?.name} đã check-in lúc ${formatDateTime(new Date())}. IP: ${ipAddress}. Thiết bị: ${deviceInfo.browser} trên ${deviceInfo.os}. ${alertMessage}`;

    // Find all admins and create notifications
    const User = require('../models/User').default;
    const admins = await User.find({ role: 'admin', isActive: true });
    
    for (const admin of admins) {
      await Notification.create({
        userId: admin._id,
        type: hasDeviceAlert || hasIpAlert ? 'alert' : 'check-in',
        title: notificationTitle,
        message: notificationMessage,
        metadata: {
          attendanceId: attendance._id,
          ipAddress,
          deviceInfo: JSON.stringify(deviceInfo),
          timestamp: new Date(),
        },
      });
    }

    await attendance.populate('userId', 'name email');

    res.status(200).json({
      success: true,
      message: 'Check-in thành công',
      data: attendance,
      alert: hasDeviceAlert || hasIpAlert ? {
        hasDeviceAlert,
        hasIpAlert,
        message: alertMessage,
      } : null,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi check-in',
      error: error.message,
    });
  }
};

export const checkOut = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const today = getStartOfDay();
    
    // Get device and IP information
    const ipAddress = getClientIp(req);
    const deviceInfo = parseDeviceInfo(req);

    // Find today's attendance
    const attendance = await Attendance.findOne({
      userId,
      date: today,
    });

    if (!attendance || !attendance.checkIn) {
      res.status(400).json({
        success: false,
        message: 'Bạn chưa check-in. Vui lòng check-in trước.',
      });
      return;
    }

    if (attendance.checkOut) {
      res.status(400).json({
        success: false,
        message: 'Bạn đã check-out rồi.',
      });
      return;
    }

    // Check for device/IP alerts
    // 1. Compare with check-in in the same day
    let hasDeviceAlert = attendance.hasDeviceAlert || false;
    let hasIpAlert = attendance.hasIpAlert || false;
    let alertMessage = attendance.alertMessage || '';

    const checkInFingerprint = generateDeviceFingerprint(attendance.checkIn.deviceInfo);
    const checkOutFingerprint = generateDeviceFingerprint(deviceInfo);

    if (checkInFingerprint !== checkOutFingerprint) {
      hasDeviceAlert = true;
      alertMessage += 'Thiết bị check-out khác với check-in. ';
    }

    if (attendance.checkIn.ipAddress !== ipAddress) {
      hasIpAlert = true;
      alertMessage += 'IP check-out khác với check-in. ';
    }

    // 2. Compare with all previous check-in/check-out records from other days
    const previousAttendances = await Attendance.find({
      userId,
      $or: [
        { checkIn: { $exists: true } },
        { checkOut: { $exists: true } }
      ],
      date: { $lt: today }, // Only previous days, not today
    }).sort({ date: -1, createdAt: -1 }).limit(30);

    const previousAlerts = checkDeviceAndIpAlerts(
      deviceInfo,
      ipAddress,
      previousAttendances
    );

    // Merge alerts from previous days
    if (previousAlerts.hasDeviceAlert) {
      hasDeviceAlert = true;
      if (!alertMessage.includes('Thiết bị khác với các lần trước')) {
        alertMessage += 'Thiết bị khác với các lần trước. ';
      }
    }

    if (previousAlerts.hasIpAlert) {
      hasIpAlert = true;
      if (!alertMessage.includes('Địa chỉ IP khác với các lần trước')) {
        alertMessage += 'Địa chỉ IP khác với các lần trước. ';
      }
    }

    // Update attendance with check-out
    const checkOutTime = new Date();
    attendance.checkOut = {
      type: 'check-out',
      time: checkOutTime,
      ipAddress,
      deviceInfo,
    };
    attendance.workedHours = calculateWorkedHours(attendance.checkIn.time, checkOutTime);
    // Keep status as 'pending' for admin approval, don't auto-complete
    attendance.status = 'pending';
    attendance.hasDeviceAlert = hasDeviceAlert;
    attendance.hasIpAlert = hasIpAlert;
    attendance.alertMessage = alertMessage || undefined;

    await attendance.save();

    // Create notification for admin
    const notificationTitle = hasDeviceAlert || hasIpAlert 
      ? '⚠️ Check-out với cảnh báo'
      : '✅ Check-out thành công';
    
    const notificationMessage = `${req.user?.name} đã check-out lúc ${formatDateTime(new Date())}. Thời gian làm việc: ${attendance.workedHours}h. IP: ${ipAddress}. Thiết bị: ${deviceInfo.browser} trên ${deviceInfo.os}. ${alertMessage}`;

    // Find all admins and create notifications
    const User = require('../models/User').default;
    const admins = await User.find({ role: 'admin', isActive: true });
    
    for (const admin of admins) {
      await Notification.create({
        userId: admin._id,
        type: hasDeviceAlert || hasIpAlert ? 'alert' : 'check-out',
        title: notificationTitle,
        message: notificationMessage,
        metadata: {
          attendanceId: attendance._id,
          ipAddress,
          deviceInfo: JSON.stringify(deviceInfo),
          timestamp: new Date(),
        },
      });
    }

    await attendance.populate('userId', 'name email');

    res.status(200).json({
      success: true,
      message: 'Check-out thành công',
      data: attendance,
      alert: hasDeviceAlert || hasIpAlert ? {
        hasDeviceAlert,
        hasIpAlert,
        message: alertMessage,
      } : null,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi check-out',
      error: error.message,
    });
  }
};

export const getTodayAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const today = getStartOfDay();

    const attendance = await Attendance.findOne({
      userId,
      date: today,
    }).populate('userId', 'name email');

    res.status(200).json({
      success: true,
      data: attendance,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi',
      error: error.message,
    });
  }
};

export const getMyAttendanceHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { startDate, endDate, page = 1, limit = 30 } = req.query;

    const query: any = { userId };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate as string);
      if (endDate) query.date.$lte = getEndOfDay(new Date(endDate as string));
    }

    const skip = (Number(page) - 1) * Number(limit);

    const attendances = await Attendance.find(query)
      .populate('userId', 'name email')
      .sort({ date: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Attendance.countDocuments(query);

    res.status(200).json({
      success: true,
      data: attendances,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi',
      error: error.message,
    });
  }
};



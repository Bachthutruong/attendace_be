import { Response } from 'express';
import Attendance from '../models/Attendance';
import Notification from '../models/Notification';
import User from '../models/User';
import Settings from '../models/Settings';
import { AuthRequest } from '../middleware/auth';
import { getClientIp, parseDeviceInfo, generateDeviceFingerprint, compareDeviceInfo } from '../utils/deviceParser';
import { 
  getStartOfDay, 
  getEndOfDay, 
  calculateWorkedHours, 
  formatDateTime,
  getExpectedCheckInTime,
  getExpectedCheckOutTime,
  getMinutesDifference,
  formatTimeDifference
} from '../utils/dateHelper';

// Helper function to check device/IP alerts by comparing with all previous records
const checkDeviceAndIpAlerts = (
  currentDeviceInfo: any,
  currentIp: string,
  previousAttendances: any[],
  allowedIPs?: string[]
): { hasDeviceAlert: boolean; hasIpAlert: boolean; alertMessage: string; isFraud: boolean } => {
  let hasDeviceAlert = false;
  let hasIpAlert = false;
  let alertMessage = '';
  let isFraud = false;

  // Check IP whitelist if configured
  if (allowedIPs && allowedIPs.length > 0) {
    if (!allowedIPs.includes(currentIp)) {
      hasIpAlert = true;
      isFraud = true;
      alertMessage += `IP 不在白名單中。目前 IP：${currentIp}。 `;
    }
  }

  if (previousAttendances.length === 0) {
    return { hasDeviceAlert, hasIpAlert, alertMessage, isFraud };
  }

  const currentFingerprint = generateDeviceFingerprint(currentDeviceInfo);
  const previousFingerprints = new Set<string>();
  const previousIps = new Set<string>();
  let foundMatchingDevice = false;

  // Collect all fingerprints and IPs from previous check-in/check-out records
  for (const prevAttendance of previousAttendances) {
    if (prevAttendance.checkIn) {
      const fingerprint = generateDeviceFingerprint(prevAttendance.checkIn.deviceInfo);
      previousFingerprints.add(fingerprint);
      previousIps.add(prevAttendance.checkIn.ipAddress);
      
      // Detailed device comparison
      if (compareDeviceInfo(currentDeviceInfo, prevAttendance.checkIn.deviceInfo)) {
        foundMatchingDevice = true;
      }
    }
    if (prevAttendance.checkOut) {
      const fingerprint = generateDeviceFingerprint(prevAttendance.checkOut.deviceInfo);
      previousFingerprints.add(fingerprint);
      previousIps.add(prevAttendance.checkOut.ipAddress);
      
      // Detailed device comparison
      if (compareDeviceInfo(currentDeviceInfo, prevAttendance.checkOut.deviceInfo)) {
        foundMatchingDevice = true;
      }
    }
  }

  // Check if current device is different from all previous devices (detailed comparison)
  if (!foundMatchingDevice && previousAttendances.length > 0) {
    hasDeviceAlert = true;
    isFraud = true;
    alertMessage += '裝置與之前不同。 ';
    // Add device details to message
    alertMessage += `目前裝置：${currentDeviceInfo.browser} ${currentDeviceInfo.browserVersion} 於 ${currentDeviceInfo.os} ${currentDeviceInfo.osVersion}。 `;
  }

  // Check if current IP is different from all previous IPs (only if not already flagged by whitelist)
  if (!hasIpAlert && !previousIps.has(currentIp)) {
    hasIpAlert = true;
    isFraud = true;
    alertMessage += 'IP 位址與之前不同。 ';
  }

  return { hasDeviceAlert, hasIpAlert, alertMessage, isFraud };
};

export const checkIn = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const today = getStartOfDay();
    const { fraudReason } = req.body; // Get fraud reason if provided
    
    // Get device and IP information
    const ipAddress = getClientIp(req);
    const deviceInfo = parseDeviceInfo(req);
    
    // Get user to check time settings
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: '找不到使用者',
      });
      return;
    }
    
    // Get settings for default times and IP whitelist
    const settings = await Settings.findOne();
    
    // Check if already checked in today
    let attendance = await Attendance.findOne({
      userId,
      date: today,
    });

    if (attendance && attendance.checkIn) {
      res.status(400).json({
        success: false,
        message: '您已經打卡上班。請打卡下班。',
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

    const { hasDeviceAlert, hasIpAlert, alertMessage, isFraud } = checkDeviceAndIpAlerts(
      deviceInfo,
      ipAddress,
      previousAttendances,
      settings?.allowedIPs
    );

    // Check for time-based alerts (late check-in)
    const checkInTime = new Date();
    const expectedCheckInTime = await getExpectedCheckInTime(user, settings, today);
    let hasTimeAlert = false;
    let timeAlertMessage = '';
    let checkInLateMinutes: number | undefined = undefined;

    if (expectedCheckInTime) {
      if (checkInTime > expectedCheckInTime) {
        hasTimeAlert = true;
        checkInLateMinutes = getMinutesDifference(checkInTime, expectedCheckInTime);
        const timeDiffStr = formatTimeDifference(checkInLateMinutes);
        timeAlertMessage = `遲到 ${timeDiffStr}。規定時間：${expectedCheckInTime.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}。 `;
      }
    }

    // Combine all alert messages
    const combinedAlertMessage = (alertMessage || '') + timeAlertMessage;

    // Create or update attendance
    if (!attendance) {
      attendance = await Attendance.create({
        userId,
        date: today,
        checkIn: {
          type: 'check-in',
          time: checkInTime,
          ipAddress,
          deviceInfo,
        },
        status: 'pending',
        hasDeviceAlert,
        hasIpAlert,
        alertMessage: combinedAlertMessage || undefined,
        hasTimeAlert,
        timeAlertMessage: timeAlertMessage || undefined,
        checkInLateMinutes,
        fraudReason: isFraud && fraudReason ? fraudReason : undefined,
      });
    } else {
      attendance.checkIn = {
        type: 'check-in',
        time: checkInTime,
        ipAddress,
        deviceInfo,
      };
      attendance.hasDeviceAlert = hasDeviceAlert;
      attendance.hasIpAlert = hasIpAlert;
      attendance.alertMessage = combinedAlertMessage || undefined;
      attendance.hasTimeAlert = hasTimeAlert;
      attendance.timeAlertMessage = timeAlertMessage || undefined;
      attendance.checkInLateMinutes = checkInLateMinutes;
      if (isFraud && fraudReason) {
        attendance.fraudReason = fraudReason;
      }
      await attendance.save();
    }

    // Create notification for admin
    const hasAnyAlert = hasDeviceAlert || hasIpAlert || hasTimeAlert;
    const notificationTitle = hasAnyAlert 
      ? '⚠️ 上班打卡 (有警告)'
      : '✅ 上班打卡成功';
    
    const notificationMessage = `${req.user?.name} 已於 ${formatDateTime(checkInTime)} 打卡上班。IP：${ipAddress}。裝置：${deviceInfo.browser} 於 ${deviceInfo.os}。 ${combinedAlertMessage}`;

    // Find all admins and create notifications
    const admins = await User.find({ role: 'admin', isActive: true });
    
    for (const admin of admins) {
      await Notification.create({
        userId: admin._id,
        type: hasAnyAlert ? 'alert' : 'check-in',
        title: notificationTitle,
        message: notificationMessage,
        metadata: {
          attendanceId: attendance._id,
          ipAddress,
          deviceInfo: JSON.stringify(deviceInfo),
          timestamp: checkInTime,
          hasTimeAlert,
          checkInLateMinutes,
        },
      });
    }

    // Create notification for the employee if there's a time alert
    if (hasTimeAlert) {
      await Notification.create({
        userId: userId,
        type: 'alert',
        title: '⚠️ 警告：遲到',
        message: timeAlertMessage,
        metadata: {
          attendanceId: attendance._id,
          checkInLateMinutes,
          timestamp: checkInTime,
        },
      });
    }

    await attendance.populate('userId', 'name email');

    res.status(200).json({
      success: true,
      message: '上班打卡成功',
      data: attendance,
      alert: hasAnyAlert ? {
        hasDeviceAlert,
        hasIpAlert,
        hasTimeAlert,
        message: combinedAlertMessage,
        timeAlert: hasTimeAlert ? {
          checkInLateMinutes,
          message: timeAlertMessage,
        } : null,
      } : null,
      fraud: isFraud ? {
        detected: true,
        hasDeviceAlert,
        hasIpAlert,
        message: alertMessage,
      } : null,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: '打卡上班時發生錯誤',
      error: error.message,
    });
  }
};

export const checkOut = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const today = getStartOfDay();
    const { fraudReason } = req.body; // Get fraud reason if provided
    
    // Get device and IP information
    const ipAddress = getClientIp(req);
    const deviceInfo = parseDeviceInfo(req);

    // Get user to check time settings
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: '找不到使用者',
      });
      return;
    }

    // Get settings for default times and IP whitelist
    const settings = await Settings.findOne();

    // Find today's attendance
    const attendance = await Attendance.findOne({
      userId,
      date: today,
    });

    if (!attendance || !attendance.checkIn) {
      res.status(400).json({
        success: false,
        message: '您尚未打卡上班。請先打卡上班。',
      });
      return;
    }

    if (attendance.checkOut) {
      res.status(400).json({
        success: false,
        message: '您已經打卡下班了。',
      });
      return;
    }

    // Check for device/IP alerts
    // 1. Compare with check-in in the same day
    let hasDeviceAlert = attendance.hasDeviceAlert || false;
    let hasIpAlert = attendance.hasIpAlert || false;
    let alertMessage = attendance.alertMessage || '';
    let isFraud = false;

    // Check IP whitelist if configured
    if (settings?.allowedIPs && settings.allowedIPs.length > 0) {
      if (!settings.allowedIPs.includes(ipAddress)) {
        hasIpAlert = true;
        isFraud = true;
        alertMessage += `IP 不在白名單中。目前 IP：${ipAddress}。 `;
      }
    }

    // Detailed device comparison with check-in
    if (!compareDeviceInfo(attendance.checkIn.deviceInfo, deviceInfo)) {
      hasDeviceAlert = true;
      isFraud = true;
      alertMessage += '下班打卡裝置與上班打卡不同。 ';
      alertMessage += `下班打卡裝置：${deviceInfo.browser} ${deviceInfo.browserVersion} 於 ${deviceInfo.os} ${deviceInfo.osVersion}。 `;
    }

    if (attendance.checkIn.ipAddress !== ipAddress) {
      hasIpAlert = true;
      isFraud = true;
      alertMessage += '下班打卡 IP 與上班打卡不同。 ';
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
      previousAttendances,
      settings?.allowedIPs
    );

    // Merge alerts from previous days
    if (previousAlerts.hasDeviceAlert) {
      hasDeviceAlert = true;
      isFraud = true;
      if (!alertMessage.includes('裝置與之前不同')) {
        alertMessage += '裝置與之前不同。 ';
      }
    }

    if (previousAlerts.hasIpAlert && !hasIpAlert) {
      hasIpAlert = true;
      isFraud = true;
      if (!alertMessage.includes('IP 位址與之前不同')) {
        alertMessage += 'IP 位址與之前不同。 ';
      }
    }

    if (previousAlerts.isFraud) {
      isFraud = true;
    }

    // Check for time-based alerts (early check-out)
    const checkOutTime = new Date();
    const expectedCheckOutTime = await getExpectedCheckOutTime(user, settings, today);
    let hasTimeAlert = attendance.hasTimeAlert || false;
    let timeAlertMessage = attendance.timeAlertMessage || '';
    let checkOutEarlyMinutes: number | undefined = attendance.checkOutEarlyMinutes;

    if (expectedCheckOutTime) {
      if (checkOutTime < expectedCheckOutTime) {
        hasTimeAlert = true;
        checkOutEarlyMinutes = getMinutesDifference(expectedCheckOutTime, checkOutTime);
        const timeDiffStr = formatTimeDifference(checkOutEarlyMinutes);
        timeAlertMessage += `早退 ${timeDiffStr}。規定時間：${expectedCheckOutTime.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}。 `;
      }
    }

    // Combine all alert messages
    const combinedAlertMessage = alertMessage + timeAlertMessage;

    // Update attendance with check-out
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
    attendance.alertMessage = combinedAlertMessage || undefined;
    attendance.hasTimeAlert = hasTimeAlert;
    attendance.timeAlertMessage = timeAlertMessage || undefined;
    attendance.checkOutEarlyMinutes = checkOutEarlyMinutes;
    if (isFraud && fraudReason) {
      attendance.fraudReason = fraudReason;
    }

    await attendance.save();

    // Create notification for admin
    const hasAnyAlert = hasDeviceAlert || hasIpAlert || hasTimeAlert;
    const notificationTitle = hasAnyAlert 
      ? '⚠️ 下班打卡 (有警告)'
      : '✅ 下班打卡成功';
    
    const notificationMessage = `${req.user?.name} 已於 ${formatDateTime(checkOutTime)} 打卡下班。工作時數：${attendance.workedHours}小時。IP：${ipAddress}。裝置：${deviceInfo.browser} 於 ${deviceInfo.os}。 ${combinedAlertMessage}`;

    // Find all admins and create notifications
    const admins = await User.find({ role: 'admin', isActive: true });
    
    for (const admin of admins) {
      await Notification.create({
        userId: admin._id,
        type: hasAnyAlert ? 'alert' : 'check-out',
        title: notificationTitle,
        message: notificationMessage,
        metadata: {
          attendanceId: attendance._id,
          ipAddress,
          deviceInfo: JSON.stringify(deviceInfo),
          timestamp: checkOutTime,
          hasTimeAlert,
          checkOutEarlyMinutes,
        },
      });
    }

    // Create notification for the employee if there's a time alert
    if (hasTimeAlert && checkOutEarlyMinutes) {
      await Notification.create({
        userId: userId,
        type: 'alert',
        title: '⚠️ 警告：早退',
        message: timeAlertMessage,
        metadata: {
          attendanceId: attendance._id,
          checkOutEarlyMinutes,
          timestamp: checkOutTime,
        },
      });
    }

    await attendance.populate('userId', 'name email');

    res.status(200).json({
      success: true,
      message: '打卡下班成功',
      data: attendance,
      alert: hasAnyAlert ? {
        hasDeviceAlert,
        hasIpAlert,
        hasTimeAlert,
        message: combinedAlertMessage,
        timeAlert: hasTimeAlert ? {
          checkOutEarlyMinutes,
          message: timeAlertMessage,
        } : null,
      } : null,
      fraud: isFraud ? {
        detected: true,
        hasDeviceAlert,
        hasIpAlert,
        message: alertMessage,
      } : null,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: '打卡下班時發生錯誤',
      error: error.message,
    });
  }
};

// Pre-check for fraud detection before actual check-in/check-out
export const preCheckFraud = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const today = getStartOfDay();
    const { type } = req.query; // 'check-in' or 'check-out'
    
    // Get device and IP information
    const ipAddress = getClientIp(req);
    const deviceInfo = parseDeviceInfo(req);
    
    // Get settings for IP whitelist
    const settings = await Settings.findOne();
    
    // Get previous attendances for comparison
    const previousAttendances = await Attendance.find({
      userId,
      $or: [
        { checkIn: { $exists: true } },
        { checkOut: { $exists: true } }
      ],
      date: { $lt: today },
    }).sort({ date: -1, createdAt: -1 }).limit(30);

    const fraudCheckResult = checkDeviceAndIpAlerts(
      deviceInfo,
      ipAddress,
      previousAttendances,
      settings?.allowedIPs
    );

    let hasDeviceAlert = fraudCheckResult.hasDeviceAlert;
    let hasIpAlert = fraudCheckResult.hasIpAlert;
    let alertMessage = fraudCheckResult.alertMessage;
    let isFraud = fraudCheckResult.isFraud;

    // For check-out, also compare with today's check-in
    if (type === 'check-out') {
      const todayAttendance = await Attendance.findOne({
        userId,
        date: today,
        checkIn: { $exists: true },
      });

      if (todayAttendance && todayAttendance.checkIn) {
        if (!compareDeviceInfo(todayAttendance.checkIn.deviceInfo, deviceInfo)) {
          hasDeviceAlert = true;
          isFraud = true;
          alertMessage += '下班打卡裝置與上班打卡不同。 ';
        }
        if (todayAttendance.checkIn.ipAddress !== ipAddress) {
          hasIpAlert = true;
          isFraud = true;
          alertMessage += '下班打卡 IP 與上班打卡不同。 ';
        }
      }
    }

    res.status(200).json({
      success: true,
      fraud: isFraud ? {
        detected: true,
        hasDeviceAlert,
        hasIpAlert,
        message: alertMessage,
      } : null,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: '發生錯誤',
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
      message: '發生錯誤',
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
      message: '發生錯誤',
      error: error.message,
    });
  }
};



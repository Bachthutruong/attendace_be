"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyAttendanceHistory = exports.getTodayAttendance = exports.preCheckFraud = exports.checkOut = exports.checkIn = void 0;
const Attendance_1 = __importDefault(require("../models/Attendance"));
const Notification_1 = __importDefault(require("../models/Notification"));
const User_1 = __importDefault(require("../models/User"));
const Settings_1 = __importDefault(require("../models/Settings"));
const deviceParser_1 = require("../utils/deviceParser");
const dateHelper_1 = require("../utils/dateHelper");
const checkDeviceAndIpAlerts = (currentDeviceInfo, currentIp, previousAttendances, allowedIPs) => {
    let hasDeviceAlert = false;
    let hasIpAlert = false;
    let alertMessage = '';
    let isFraud = false;
    if (allowedIPs && allowedIPs.length > 0) {
        if (!allowedIPs.includes(currentIp)) {
            hasIpAlert = true;
            isFraud = true;
            alertMessage += `IP không nằm trong danh sách IP xác thực. IP hiện tại: ${currentIp}. `;
        }
    }
    if (previousAttendances.length === 0) {
        return { hasDeviceAlert, hasIpAlert, alertMessage, isFraud };
    }
    const currentFingerprint = (0, deviceParser_1.generateDeviceFingerprint)(currentDeviceInfo);
    const previousFingerprints = new Set();
    const previousIps = new Set();
    let foundMatchingDevice = false;
    for (const prevAttendance of previousAttendances) {
        if (prevAttendance.checkIn) {
            const fingerprint = (0, deviceParser_1.generateDeviceFingerprint)(prevAttendance.checkIn.deviceInfo);
            previousFingerprints.add(fingerprint);
            previousIps.add(prevAttendance.checkIn.ipAddress);
            if ((0, deviceParser_1.compareDeviceInfo)(currentDeviceInfo, prevAttendance.checkIn.deviceInfo)) {
                foundMatchingDevice = true;
            }
        }
        if (prevAttendance.checkOut) {
            const fingerprint = (0, deviceParser_1.generateDeviceFingerprint)(prevAttendance.checkOut.deviceInfo);
            previousFingerprints.add(fingerprint);
            previousIps.add(prevAttendance.checkOut.ipAddress);
            if ((0, deviceParser_1.compareDeviceInfo)(currentDeviceInfo, prevAttendance.checkOut.deviceInfo)) {
                foundMatchingDevice = true;
            }
        }
    }
    if (!foundMatchingDevice && previousAttendances.length > 0) {
        hasDeviceAlert = true;
        isFraud = true;
        alertMessage += 'Thiết bị khác với các lần trước. ';
        alertMessage += `Thiết bị hiện tại: ${currentDeviceInfo.browser} ${currentDeviceInfo.browserVersion} trên ${currentDeviceInfo.os} ${currentDeviceInfo.osVersion}. `;
    }
    if (!hasIpAlert && !previousIps.has(currentIp)) {
        hasIpAlert = true;
        isFraud = true;
        alertMessage += 'Địa chỉ IP khác với các lần trước. ';
    }
    return { hasDeviceAlert, hasIpAlert, alertMessage, isFraud };
};
const checkIn = async (req, res) => {
    try {
        const userId = req.user?._id;
        const today = (0, dateHelper_1.getStartOfDay)();
        const { fraudReason } = req.body;
        const ipAddress = (0, deviceParser_1.getClientIp)(req);
        const deviceInfo = (0, deviceParser_1.parseDeviceInfo)(req);
        const user = await User_1.default.findById(userId);
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng',
            });
            return;
        }
        const settings = await Settings_1.default.findOne();
        let attendance = await Attendance_1.default.findOne({
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
        const previousAttendances = await Attendance_1.default.find({
            userId,
            $or: [
                { checkIn: { $exists: true } },
                { checkOut: { $exists: true } }
            ],
            date: { $lt: today },
        }).sort({ date: -1, createdAt: -1 }).limit(30);
        const { hasDeviceAlert, hasIpAlert, alertMessage, isFraud } = checkDeviceAndIpAlerts(deviceInfo, ipAddress, previousAttendances, settings?.allowedIPs);
        const checkInTime = new Date();
        const expectedCheckInTime = await (0, dateHelper_1.getExpectedCheckInTime)(user, settings, today);
        let hasTimeAlert = false;
        let timeAlertMessage = '';
        let checkInLateMinutes = undefined;
        if (expectedCheckInTime) {
            if (checkInTime > expectedCheckInTime) {
                hasTimeAlert = true;
                checkInLateMinutes = (0, dateHelper_1.getMinutesDifference)(checkInTime, expectedCheckInTime);
                const timeDiffStr = (0, dateHelper_1.formatTimeDifference)(checkInLateMinutes);
                timeAlertMessage = `Check-in muộn ${timeDiffStr}. Giờ quy định: ${expectedCheckInTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}. `;
            }
        }
        const combinedAlertMessage = (alertMessage || '') + timeAlertMessage;
        if (!attendance) {
            attendance = await Attendance_1.default.create({
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
        }
        else {
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
        const hasAnyAlert = hasDeviceAlert || hasIpAlert || hasTimeAlert;
        const notificationTitle = hasAnyAlert
            ? '⚠️ Check-in với cảnh báo'
            : '✅ Check-in thành công';
        const notificationMessage = `${req.user?.name} đã check-in lúc ${(0, dateHelper_1.formatDateTime)(checkInTime)}. IP: ${ipAddress}. Thiết bị: ${deviceInfo.browser} trên ${deviceInfo.os}. ${combinedAlertMessage}`;
        const admins = await User_1.default.find({ role: 'admin', isActive: true });
        for (const admin of admins) {
            await Notification_1.default.create({
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
        if (hasTimeAlert) {
            await Notification_1.default.create({
                userId: userId,
                type: 'alert',
                title: '⚠️ Cảnh báo: Check-in muộn',
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
            message: 'Check-in thành công',
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi check-in',
            error: error.message,
        });
    }
};
exports.checkIn = checkIn;
const checkOut = async (req, res) => {
    try {
        const userId = req.user?._id;
        const today = (0, dateHelper_1.getStartOfDay)();
        const { fraudReason } = req.body;
        const ipAddress = (0, deviceParser_1.getClientIp)(req);
        const deviceInfo = (0, deviceParser_1.parseDeviceInfo)(req);
        const user = await User_1.default.findById(userId);
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng',
            });
            return;
        }
        const settings = await Settings_1.default.findOne();
        const attendance = await Attendance_1.default.findOne({
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
        let hasDeviceAlert = attendance.hasDeviceAlert || false;
        let hasIpAlert = attendance.hasIpAlert || false;
        let alertMessage = attendance.alertMessage || '';
        let isFraud = false;
        if (settings?.allowedIPs && settings.allowedIPs.length > 0) {
            if (!settings.allowedIPs.includes(ipAddress)) {
                hasIpAlert = true;
                isFraud = true;
                alertMessage += `IP không nằm trong danh sách IP xác thực. IP hiện tại: ${ipAddress}. `;
            }
        }
        if (!(0, deviceParser_1.compareDeviceInfo)(attendance.checkIn.deviceInfo, deviceInfo)) {
            hasDeviceAlert = true;
            isFraud = true;
            alertMessage += 'Thiết bị check-out khác với check-in. ';
            alertMessage += `Thiết bị check-out: ${deviceInfo.browser} ${deviceInfo.browserVersion} trên ${deviceInfo.os} ${deviceInfo.osVersion}. `;
        }
        if (attendance.checkIn.ipAddress !== ipAddress) {
            hasIpAlert = true;
            isFraud = true;
            alertMessage += 'IP check-out khác với check-in. ';
        }
        const previousAttendances = await Attendance_1.default.find({
            userId,
            $or: [
                { checkIn: { $exists: true } },
                { checkOut: { $exists: true } }
            ],
            date: { $lt: today },
        }).sort({ date: -1, createdAt: -1 }).limit(30);
        const previousAlerts = checkDeviceAndIpAlerts(deviceInfo, ipAddress, previousAttendances, settings?.allowedIPs);
        if (previousAlerts.hasDeviceAlert) {
            hasDeviceAlert = true;
            isFraud = true;
            if (!alertMessage.includes('Thiết bị khác với các lần trước')) {
                alertMessage += 'Thiết bị khác với các lần trước. ';
            }
        }
        if (previousAlerts.hasIpAlert && !hasIpAlert) {
            hasIpAlert = true;
            isFraud = true;
            if (!alertMessage.includes('Địa chỉ IP khác với các lần trước')) {
                alertMessage += 'Địa chỉ IP khác với các lần trước. ';
            }
        }
        if (previousAlerts.isFraud) {
            isFraud = true;
        }
        const checkOutTime = new Date();
        const expectedCheckOutTime = await (0, dateHelper_1.getExpectedCheckOutTime)(user, settings, today);
        let hasTimeAlert = attendance.hasTimeAlert || false;
        let timeAlertMessage = attendance.timeAlertMessage || '';
        let checkOutEarlyMinutes = attendance.checkOutEarlyMinutes;
        if (expectedCheckOutTime) {
            if (checkOutTime < expectedCheckOutTime) {
                hasTimeAlert = true;
                checkOutEarlyMinutes = (0, dateHelper_1.getMinutesDifference)(expectedCheckOutTime, checkOutTime);
                const timeDiffStr = (0, dateHelper_1.formatTimeDifference)(checkOutEarlyMinutes);
                timeAlertMessage += `Check-out sớm ${timeDiffStr}. Giờ quy định: ${expectedCheckOutTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}. `;
            }
        }
        const combinedAlertMessage = alertMessage + timeAlertMessage;
        attendance.checkOut = {
            type: 'check-out',
            time: checkOutTime,
            ipAddress,
            deviceInfo,
        };
        attendance.workedHours = (0, dateHelper_1.calculateWorkedHours)(attendance.checkIn.time, checkOutTime);
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
        const hasAnyAlert = hasDeviceAlert || hasIpAlert || hasTimeAlert;
        const notificationTitle = hasAnyAlert
            ? '⚠️ Check-out với cảnh báo'
            : '✅ Check-out thành công';
        const notificationMessage = `${req.user?.name} đã check-out lúc ${(0, dateHelper_1.formatDateTime)(checkOutTime)}. Thời gian làm việc: ${attendance.workedHours}h. IP: ${ipAddress}. Thiết bị: ${deviceInfo.browser} trên ${deviceInfo.os}. ${combinedAlertMessage}`;
        const admins = await User_1.default.find({ role: 'admin', isActive: true });
        for (const admin of admins) {
            await Notification_1.default.create({
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
        if (hasTimeAlert && checkOutEarlyMinutes) {
            await Notification_1.default.create({
                userId: userId,
                type: 'alert',
                title: '⚠️ Cảnh báo: Check-out sớm',
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
            message: 'Check-out thành công',
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi check-out',
            error: error.message,
        });
    }
};
exports.checkOut = checkOut;
const preCheckFraud = async (req, res) => {
    try {
        const userId = req.user?._id;
        const today = (0, dateHelper_1.getStartOfDay)();
        const { type } = req.query;
        const ipAddress = (0, deviceParser_1.getClientIp)(req);
        const deviceInfo = (0, deviceParser_1.parseDeviceInfo)(req);
        const settings = await Settings_1.default.findOne();
        const previousAttendances = await Attendance_1.default.find({
            userId,
            $or: [
                { checkIn: { $exists: true } },
                { checkOut: { $exists: true } }
            ],
            date: { $lt: today },
        }).sort({ date: -1, createdAt: -1 }).limit(30);
        const fraudCheckResult = checkDeviceAndIpAlerts(deviceInfo, ipAddress, previousAttendances, settings?.allowedIPs);
        let hasDeviceAlert = fraudCheckResult.hasDeviceAlert;
        let hasIpAlert = fraudCheckResult.hasIpAlert;
        let alertMessage = fraudCheckResult.alertMessage;
        let isFraud = fraudCheckResult.isFraud;
        if (type === 'check-out') {
            const todayAttendance = await Attendance_1.default.findOne({
                userId,
                date: today,
                checkIn: { $exists: true },
            });
            if (todayAttendance && todayAttendance.checkIn) {
                if (!(0, deviceParser_1.compareDeviceInfo)(todayAttendance.checkIn.deviceInfo, deviceInfo)) {
                    hasDeviceAlert = true;
                    isFraud = true;
                    alertMessage += 'Thiết bị check-out khác với check-in. ';
                }
                if (todayAttendance.checkIn.ipAddress !== ipAddress) {
                    hasIpAlert = true;
                    isFraud = true;
                    alertMessage += 'IP check-out khác với check-in. ';
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi',
            error: error.message,
        });
    }
};
exports.preCheckFraud = preCheckFraud;
const getTodayAttendance = async (req, res) => {
    try {
        const userId = req.user?._id;
        const today = (0, dateHelper_1.getStartOfDay)();
        const attendance = await Attendance_1.default.findOne({
            userId,
            date: today,
        }).populate('userId', 'name email');
        res.status(200).json({
            success: true,
            data: attendance,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi',
            error: error.message,
        });
    }
};
exports.getTodayAttendance = getTodayAttendance;
const getMyAttendanceHistory = async (req, res) => {
    try {
        const userId = req.user?._id;
        const { startDate, endDate, page = 1, limit = 30 } = req.query;
        const query = { userId };
        if (startDate || endDate) {
            query.date = {};
            if (startDate)
                query.date.$gte = new Date(startDate);
            if (endDate)
                query.date.$lte = (0, dateHelper_1.getEndOfDay)(new Date(endDate));
        }
        const skip = (Number(page) - 1) * Number(limit);
        const attendances = await Attendance_1.default.find(query)
            .populate('userId', 'name email')
            .sort({ date: -1 })
            .skip(skip)
            .limit(Number(limit));
        const total = await Attendance_1.default.countDocuments(query);
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi',
            error: error.message,
        });
    }
};
exports.getMyAttendanceHistory = getMyAttendanceHistory;

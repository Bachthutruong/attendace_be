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
            alertMessage += `IP 不在白名單中。目前 IP：${currentIp}。 `;
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
        alertMessage += '裝置與之前不同。 ';
        alertMessage += `目前裝置：${currentDeviceInfo.browser} ${currentDeviceInfo.browserVersion} 於 ${currentDeviceInfo.os} ${currentDeviceInfo.osVersion}。 `;
    }
    if (!hasIpAlert && !previousIps.has(currentIp)) {
        hasIpAlert = true;
        isFraud = true;
        alertMessage += 'IP 位址與之前不同。 ';
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
                message: '找不到使用者',
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
                message: '您已經打卡上班。請打卡下班。',
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
                timeAlertMessage = `遲到 ${timeDiffStr}。規定時間：${expectedCheckInTime.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}。 `;
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
            ? '⚠️ 上班打卡 (有警告)'
            : '✅ 上班打卡成功';
        const notificationMessage = `${req.user?.name} 已於 ${(0, dateHelper_1.formatDateTime)(checkInTime)} 打卡上班。IP：${ipAddress}。裝置：${deviceInfo.browser} 於 ${deviceInfo.os}。 ${combinedAlertMessage}`;
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '打卡上班時發生錯誤',
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
                message: '找不到使用者',
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
        let hasDeviceAlert = attendance.hasDeviceAlert || false;
        let hasIpAlert = attendance.hasIpAlert || false;
        let alertMessage = attendance.alertMessage || '';
        let isFraud = false;
        if (settings?.allowedIPs && settings.allowedIPs.length > 0) {
            if (!settings.allowedIPs.includes(ipAddress)) {
                hasIpAlert = true;
                isFraud = true;
                alertMessage += `IP 不在白名單中。目前 IP：${ipAddress}。 `;
            }
        }
        if (!(0, deviceParser_1.compareDeviceInfo)(attendance.checkIn.deviceInfo, deviceInfo)) {
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
                timeAlertMessage += `早退 ${timeDiffStr}。規定時間：${expectedCheckOutTime.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}。 `;
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
            ? '⚠️ 下班打卡 (有警告)'
            : '✅ 下班打卡成功';
        const notificationMessage = `${req.user?.name} 已於 ${(0, dateHelper_1.formatDateTime)(checkOutTime)} 打卡下班。工作時數：${attendance.workedHours}小時。IP：${ipAddress}。裝置：${deviceInfo.browser} 於 ${deviceInfo.os}。 ${combinedAlertMessage}`;
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '打卡下班時發生錯誤',
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '發生錯誤',
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
            message: '發生錯誤',
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
            message: '發生錯誤',
            error: error.message,
        });
    }
};
exports.getMyAttendanceHistory = getMyAttendanceHistory;

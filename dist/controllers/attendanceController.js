"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyAttendanceHistory = exports.getTodayAttendance = exports.checkOut = exports.checkIn = void 0;
const Attendance_1 = __importDefault(require("../models/Attendance"));
const Notification_1 = __importDefault(require("../models/Notification"));
const deviceParser_1 = require("../utils/deviceParser");
const dateHelper_1 = require("../utils/dateHelper");
const checkDeviceAndIpAlerts = (currentDeviceInfo, currentIp, previousAttendances) => {
    let hasDeviceAlert = false;
    let hasIpAlert = false;
    let alertMessage = '';
    if (previousAttendances.length === 0) {
        return { hasDeviceAlert, hasIpAlert, alertMessage };
    }
    const currentFingerprint = (0, deviceParser_1.generateDeviceFingerprint)(currentDeviceInfo);
    const previousFingerprints = new Set();
    const previousIps = new Set();
    for (const prevAttendance of previousAttendances) {
        if (prevAttendance.checkIn) {
            const fingerprint = (0, deviceParser_1.generateDeviceFingerprint)(prevAttendance.checkIn.deviceInfo);
            previousFingerprints.add(fingerprint);
            previousIps.add(prevAttendance.checkIn.ipAddress);
        }
        if (prevAttendance.checkOut) {
            const fingerprint = (0, deviceParser_1.generateDeviceFingerprint)(prevAttendance.checkOut.deviceInfo);
            previousFingerprints.add(fingerprint);
            previousIps.add(prevAttendance.checkOut.ipAddress);
        }
    }
    if (!previousFingerprints.has(currentFingerprint)) {
        hasDeviceAlert = true;
        alertMessage += 'Thiết bị khác với các lần trước. ';
    }
    if (!previousIps.has(currentIp)) {
        hasIpAlert = true;
        alertMessage += 'Địa chỉ IP khác với các lần trước. ';
    }
    return { hasDeviceAlert, hasIpAlert, alertMessage };
};
const checkIn = async (req, res) => {
    try {
        const userId = req.user?._id;
        const today = (0, dateHelper_1.getStartOfDay)();
        const ipAddress = (0, deviceParser_1.getClientIp)(req);
        const deviceInfo = (0, deviceParser_1.parseDeviceInfo)(req);
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
        const { hasDeviceAlert, hasIpAlert, alertMessage } = checkDeviceAndIpAlerts(deviceInfo, ipAddress, previousAttendances);
        if (!attendance) {
            attendance = await Attendance_1.default.create({
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
        }
        else {
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
        const notificationTitle = hasDeviceAlert || hasIpAlert
            ? '⚠️ Check-in với cảnh báo'
            : '✅ Check-in thành công';
        const notificationMessage = `${req.user?.name} đã check-in lúc ${(0, dateHelper_1.formatDateTime)(new Date())}. IP: ${ipAddress}. Thiết bị: ${deviceInfo.browser} trên ${deviceInfo.os}. ${alertMessage}`;
        const User = require('../models/User').default;
        const admins = await User.find({ role: 'admin', isActive: true });
        for (const admin of admins) {
            await Notification_1.default.create({
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
        const ipAddress = (0, deviceParser_1.getClientIp)(req);
        const deviceInfo = (0, deviceParser_1.parseDeviceInfo)(req);
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
        const checkInFingerprint = (0, deviceParser_1.generateDeviceFingerprint)(attendance.checkIn.deviceInfo);
        const checkOutFingerprint = (0, deviceParser_1.generateDeviceFingerprint)(deviceInfo);
        if (checkInFingerprint !== checkOutFingerprint) {
            hasDeviceAlert = true;
            alertMessage += 'Thiết bị check-out khác với check-in. ';
        }
        if (attendance.checkIn.ipAddress !== ipAddress) {
            hasIpAlert = true;
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
        const previousAlerts = checkDeviceAndIpAlerts(deviceInfo, ipAddress, previousAttendances);
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
        const checkOutTime = new Date();
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
        attendance.alertMessage = alertMessage || undefined;
        await attendance.save();
        const notificationTitle = hasDeviceAlert || hasIpAlert
            ? '⚠️ Check-out với cảnh báo'
            : '✅ Check-out thành công';
        const notificationMessage = `${req.user?.name} đã check-out lúc ${(0, dateHelper_1.formatDateTime)(new Date())}. Thời gian làm việc: ${attendance.workedHours}h. IP: ${ipAddress}. Thiết bị: ${deviceInfo.browser} trên ${deviceInfo.os}. ${alertMessage}`;
        const User = require('../models/User').default;
        const admins = await User.find({ role: 'admin', isActive: true });
        for (const admin of admins) {
            await Notification_1.default.create({
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

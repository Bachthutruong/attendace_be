"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAttendanceStatus = exports.getAttendanceDetail = exports.markAllNotificationsAsRead = exports.markNotificationAsRead = exports.getNotifications = exports.getAttendanceStats = exports.getTodayAttendances = exports.getAllAttendances = exports.deleteUser = exports.updateUser = exports.createUser = exports.getUserById = exports.getAllUsers = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const User_1 = __importDefault(require("../models/User"));
const Attendance_1 = __importDefault(require("../models/Attendance"));
const Notification_1 = __importDefault(require("../models/Notification"));
const dateHelper_1 = require("../utils/dateHelper");
const getAllUsers = async (req, res) => {
    try {
        const { search, role, isActive, page = 1, limit = 10 } = req.query;
        const query = {};
        if (search) {
            query.$or = [
                { employeeCode: { $regex: search, $options: 'i' } },
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }
        if (role) {
            query.role = role;
        }
        if (isActive !== undefined) {
            query.isActive = isActive === 'true';
        }
        const skip = (Number(page) - 1) * Number(limit);
        const users = await User_1.default.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));
        const total = await User_1.default.countDocuments(query);
        const usersWithId = users.map((user) => ({
            id: user._id.toString(),
            employeeCode: user.employeeCode,
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        }));
        res.status(200).json({
            success: true,
            data: usersWithId,
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
exports.getAllUsers = getAllUsers;
const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User_1.default.findById(id).select('-password');
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy nhân viên',
            });
            return;
        }
        res.status(200).json({
            success: true,
            data: {
                id: user._id.toString(),
                employeeCode: user.employeeCode,
                name: user.name,
                email: user.email,
                role: user.role,
                isActive: user.isActive,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
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
exports.getUserById = getUserById;
const createUser = async (req, res) => {
    try {
        const { employeeCode, name, email, password, role } = req.body;
        const existingCode = await User_1.default.findOne({ employeeCode: employeeCode.toUpperCase() });
        if (existingCode) {
            res.status(400).json({
                success: false,
                message: 'Mã nhân viên đã được sử dụng',
            });
            return;
        }
        const existingEmail = await User_1.default.findOne({ email });
        if (existingEmail) {
            res.status(400).json({
                success: false,
                message: 'Email đã được sử dụng',
            });
            return;
        }
        const user = await User_1.default.create({
            employeeCode: employeeCode.toUpperCase(),
            name,
            email,
            password,
            role: role || 'employee',
        });
        res.status(201).json({
            success: true,
            message: 'Tạo nhân viên thành công',
            data: {
                id: user._id,
                employeeCode: user.employeeCode,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi tạo nhân viên',
            error: error.message,
        });
    }
};
exports.createUser = createUser;
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { employeeCode, name, email, role, isActive } = req.body;
        const user = await User_1.default.findById(id);
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy nhân viên',
            });
            return;
        }
        if (employeeCode && employeeCode.toUpperCase() !== user.employeeCode) {
            const existingCode = await User_1.default.findOne({ employeeCode: employeeCode.toUpperCase() });
            if (existingCode) {
                res.status(400).json({
                    success: false,
                    message: 'Mã nhân viên đã được sử dụng',
                });
                return;
            }
        }
        if (email && email !== user.email) {
            const existingEmail = await User_1.default.findOne({ email });
            if (existingEmail) {
                res.status(400).json({
                    success: false,
                    message: 'Email đã được sử dụng',
                });
                return;
            }
        }
        if (employeeCode)
            user.employeeCode = employeeCode.toUpperCase();
        if (name)
            user.name = name;
        if (email)
            user.email = email;
        if (role)
            user.role = role;
        if (isActive !== undefined)
            user.isActive = isActive;
        await user.save();
        res.status(200).json({
            success: true,
            message: 'Cập nhật nhân viên thành công',
            data: {
                id: user._id,
                employeeCode: user.employeeCode,
                name: user.name,
                email: user.email,
                role: user.role,
                isActive: user.isActive,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi cập nhật nhân viên',
            error: error.message,
        });
    }
};
exports.updateUser = updateUser;
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        if (id === req.user?._id.toString()) {
            res.status(400).json({
                success: false,
                message: 'Bạn không thể xóa tài khoản của chính mình',
            });
            return;
        }
        const user = await User_1.default.findByIdAndDelete(id);
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy nhân viên',
            });
            return;
        }
        res.status(200).json({
            success: true,
            message: 'Xóa nhân viên thành công',
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi xóa nhân viên',
            error: error.message,
        });
    }
};
exports.deleteUser = deleteUser;
const getAllAttendances = async (req, res) => {
    try {
        const { userId, startDate, endDate, month, year, status, hasAlert, page = 1, limit = 20 } = req.query;
        const query = {};
        if (userId) {
            if (mongoose_1.default.Types.ObjectId.isValid(userId)) {
                query.userId = new mongoose_1.default.Types.ObjectId(userId);
            }
            else {
                const user = await User_1.default.findOne({
                    $or: [
                        { employeeCode: userId.toUpperCase() },
                        { name: { $regex: userId, $options: 'i' } },
                    ],
                });
                if (user) {
                    query.userId = user._id;
                }
                else {
                    res.status(200).json({
                        success: true,
                        data: [],
                        pagination: {
                            page: Number(page),
                            limit: Number(limit),
                            total: 0,
                            pages: 0,
                        },
                    });
                    return;
                }
            }
        }
        if (startDate || endDate) {
            query.date = {};
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                query.date.$gte = start;
            }
            if (endDate) {
                query.date.$lte = (0, dateHelper_1.getEndOfDay)(new Date(endDate));
            }
        }
        else if (month && year) {
            const monthNum = Number(month);
            const yearNum = Number(year);
            const startOfMonth = new Date(yearNum, monthNum - 1, 1);
            const endOfMonth = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);
            query.date = { $gte: startOfMonth, $lte: endOfMonth };
        }
        else if (year) {
            const yearNum = Number(year);
            const startOfYear = new Date(yearNum, 0, 1);
            const endOfYear = new Date(yearNum, 11, 31, 23, 59, 59, 999);
            query.date = { $gte: startOfYear, $lte: endOfYear };
        }
        if (status) {
            query.status = status;
        }
        if (hasAlert === 'true') {
            query.$or = [
                { hasDeviceAlert: true },
                { hasIpAlert: true },
            ];
        }
        else if (hasAlert === 'false') {
            query.hasDeviceAlert = false;
            query.hasIpAlert = false;
        }
        const skip = (Number(page) - 1) * Number(limit);
        const attendances = await Attendance_1.default.find(query)
            .populate('userId', 'employeeCode name email role')
            .sort({ date: -1, createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));
        const total = await Attendance_1.default.countDocuments(query);
        const attendancesWithId = attendances.map((attendance) => {
            const attendanceObj = attendance.toObject();
            if (attendanceObj.userId && typeof attendanceObj.userId === 'object' && attendanceObj.userId._id) {
                attendanceObj.userId = {
                    id: attendanceObj.userId._id.toString(),
                    employeeCode: attendanceObj.userId.employeeCode,
                    name: attendanceObj.userId.name,
                    email: attendanceObj.userId.email,
                    role: attendanceObj.userId.role,
                };
            }
            else if (attendanceObj.userId && typeof attendanceObj.userId === 'object') {
                attendanceObj.userId = attendanceObj.userId.toString();
            }
            return attendanceObj;
        });
        res.status(200).json({
            success: true,
            data: attendancesWithId,
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
exports.getAllAttendances = getAllAttendances;
const getTodayAttendances = async (req, res) => {
    try {
        const today = (0, dateHelper_1.getStartOfDay)();
        const attendances = await Attendance_1.default.find({
            date: today,
        })
            .populate('userId', 'employeeCode name email role')
            .sort({ createdAt: -1 });
        const allEmployees = await User_1.default.find({ role: 'employee', isActive: true }).select('employeeCode name email');
        const checkedInUserIds = attendances.map((a) => {
            const userId = typeof a.userId === 'object' ? a.userId._id : a.userId;
            return userId.toString();
        });
        const absentEmployees = allEmployees.filter(emp => !checkedInUserIds.includes(emp._id.toString()));
        const attendancesWithId = attendances.map((attendance) => {
            const attendanceObj = attendance.toObject ? attendance.toObject() : attendance;
            if (attendanceObj.userId && typeof attendanceObj.userId === 'object' && attendanceObj.userId._id) {
                attendanceObj.userId = {
                    id: attendanceObj.userId._id.toString(),
                    employeeCode: attendanceObj.userId.employeeCode,
                    name: attendanceObj.userId.name,
                    email: attendanceObj.userId.email,
                    role: attendanceObj.userId.role,
                };
            }
            return attendanceObj;
        });
        const absentEmployeesWithId = absentEmployees.map((emp) => ({
            id: emp._id.toString(),
            employeeCode: emp.employeeCode,
            name: emp.name,
            email: emp.email,
        }));
        res.status(200).json({
            success: true,
            data: {
                attendances: attendancesWithId,
                absentEmployees: absentEmployeesWithId,
                stats: {
                    total: allEmployees.length,
                    present: attendances.length,
                    absent: absentEmployees.length,
                    completed: attendances.filter((a) => a.status === 'completed').length,
                    pending: attendances.filter((a) => a.status === 'pending').length,
                    withAlerts: attendances.filter((a) => a.hasDeviceAlert || a.hasIpAlert).length,
                },
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
exports.getTodayAttendances = getTodayAttendances;
const getAttendanceStats = async (req, res) => {
    try {
        const { userId, startDate, endDate } = req.query;
        const query = {};
        if (userId) {
            query.userId = userId;
        }
        if (startDate || endDate) {
            query.date = {};
            if (startDate)
                query.date.$gte = new Date(startDate);
            if (endDate)
                query.date.$lte = (0, dateHelper_1.getEndOfDay)(new Date(endDate));
        }
        const attendances = await Attendance_1.default.find(query);
        const stats = {
            totalDays: attendances.length,
            completedDays: attendances.filter(a => a.status === 'completed').length,
            pendingDays: attendances.filter(a => a.status === 'pending').length,
            totalWorkedHours: attendances.reduce((sum, a) => sum + (a.workedHours || 0), 0),
            averageWorkedHours: attendances.length > 0
                ? attendances.reduce((sum, a) => sum + (a.workedHours || 0), 0) / attendances.length
                : 0,
            alertCount: attendances.filter(a => a.hasDeviceAlert || a.hasIpAlert).length,
            deviceAlertCount: attendances.filter(a => a.hasDeviceAlert).length,
            ipAlertCount: attendances.filter(a => a.hasIpAlert).length,
        };
        res.status(200).json({
            success: true,
            data: stats,
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
exports.getAttendanceStats = getAttendanceStats;
const getNotifications = async (req, res) => {
    try {
        const { isRead, type, page = 1, limit = 20 } = req.query;
        const query = { userId: req.user?._id };
        if (isRead !== undefined) {
            query.isRead = isRead === 'true';
        }
        if (type) {
            query.type = type;
        }
        const skip = (Number(page) - 1) * Number(limit);
        const notifications = await Notification_1.default.find(query)
            .populate('metadata.attendanceId')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));
        const total = await Notification_1.default.countDocuments(query);
        const unreadCount = await Notification_1.default.countDocuments({ userId: req.user?._id, isRead: false });
        res.status(200).json({
            success: true,
            data: notifications,
            unreadCount,
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
exports.getNotifications = getNotifications;
const markNotificationAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await Notification_1.default.findOneAndUpdate({ _id: id, userId: req.user?._id }, { isRead: true }, { new: true });
        if (!notification) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy thông báo',
            });
            return;
        }
        res.status(200).json({
            success: true,
            data: notification,
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
exports.markNotificationAsRead = markNotificationAsRead;
const markAllNotificationsAsRead = async (req, res) => {
    try {
        await Notification_1.default.updateMany({ userId: req.user?._id, isRead: false }, { isRead: true });
        res.status(200).json({
            success: true,
            message: 'Đã đánh dấu tất cả thông báo là đã đọc',
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
exports.markAllNotificationsAsRead = markAllNotificationsAsRead;
const getAttendanceDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const attendance = await Attendance_1.default.findById(id)
            .populate('userId', 'employeeCode name email role');
        if (!attendance) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy bản ghi chấm công',
            });
            return;
        }
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
exports.getAttendanceDetail = getAttendanceDetail;
const updateAttendanceStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!['completed', 'rejected', 'pending'].includes(status)) {
            res.status(400).json({
                success: false,
                message: 'Trạng thái không hợp lệ',
            });
            return;
        }
        const attendance = await Attendance_1.default.findById(id);
        if (!attendance) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy bản ghi chấm công',
            });
            return;
        }
        attendance.status = status;
        await attendance.save();
        await attendance.populate('userId', 'employeeCode name email role');
        res.status(200).json({
            success: true,
            message: status === 'completed' ? 'Đã phê duyệt chấm công' : status === 'rejected' ? 'Đã từ chối chấm công' : 'Đã cập nhật trạng thái',
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
exports.updateAttendanceStatus = updateAttendanceStatus;

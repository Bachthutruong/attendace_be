"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmployeesForSupport = exports.rejectLeaveRequest = exports.approveLeaveRequest = exports.getAllLeaveRequests = exports.deleteLeaveRequest = exports.updateLeaveRequest = exports.getLeaveRequestById = exports.getMyLeaveRequests = exports.createLeaveRequest = void 0;
const LeaveRequest_1 = __importDefault(require("../models/LeaveRequest"));
const User_1 = __importDefault(require("../models/User"));
const createLeaveRequest = async (req, res) => {
    try {
        const { leaveDate, leaveType, reason, supportingStaff } = req.body;
        const userId = req.user._id;
        if (!leaveDate || !leaveType || !reason) {
            res.status(400).json({
                success: false,
                message: '請填寫完整資訊',
            });
            return;
        }
        const leaveDateObj = new Date(leaveDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        leaveDateObj.setHours(0, 0, 0, 0);
        if (leaveDateObj < today) {
            res.status(400).json({
                success: false,
                message: '無法申請過去日期的休假',
            });
            return;
        }
        const existingRequest = await LeaveRequest_1.default.findOne({
            userId,
            leaveDate: leaveDateObj,
            status: { $in: ['pending', 'approved'] },
        });
        if (existingRequest) {
            res.status(400).json({
                success: false,
                message: '您已申請該日期的休假',
            });
            return;
        }
        if (supportingStaff && supportingStaff.length > 0) {
            const filteredStaff = supportingStaff.filter((id) => id.toString() !== userId.toString());
            const validStaff = await User_1.default.find({
                _id: { $in: filteredStaff },
                isActive: true,
            });
            if (validStaff.length !== filteredStaff.length) {
                res.status(400).json({
                    success: false,
                    message: '部分代理人無效',
                });
                return;
            }
        }
        const leaveRequest = await LeaveRequest_1.default.create({
            userId,
            leaveDate: leaveDateObj,
            leaveType,
            reason,
            supportingStaff: supportingStaff || [],
        });
        const populatedRequest = await LeaveRequest_1.default.findById(leaveRequest._id)
            .populate('userId', 'employeeCode name email')
            .populate('supportingStaff', 'employeeCode name email');
        res.status(201).json({
            success: true,
            message: '建立請假單成功',
            data: populatedRequest,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '建立請假單時發生錯誤',
            error: error.message,
        });
    }
};
exports.createLeaveRequest = createLeaveRequest;
const getMyLeaveRequests = async (req, res) => {
    try {
        const userId = req.user._id;
        const { page = 1, limit = 10, status } = req.query;
        const query = { userId };
        if (status) {
            query.status = status;
        }
        const skip = (Number(page) - 1) * Number(limit);
        const leaveRequests = await LeaveRequest_1.default.find(query)
            .populate('userId', 'employeeCode name email')
            .populate('supportingStaff', 'employeeCode name email')
            .populate('reviewedBy', 'employeeCode name email')
            .sort({ leaveDate: -1, createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));
        const total = await LeaveRequest_1.default.countDocuments(query);
        res.status(200).json({
            success: true,
            data: leaveRequests,
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
            message: '取得請假單列表時發生錯誤',
            error: error.message,
        });
    }
};
exports.getMyLeaveRequests = getMyLeaveRequests;
const getLeaveRequestById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        const leaveRequest = await LeaveRequest_1.default.findOne({ _id: id, userId })
            .populate('userId', 'employeeCode name email')
            .populate('supportingStaff', 'employeeCode name email')
            .populate('reviewedBy', 'employeeCode name email');
        if (!leaveRequest) {
            res.status(404).json({
                success: false,
                message: '找不到請假單',
            });
            return;
        }
        res.status(200).json({
            success: true,
            data: leaveRequest,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '取得請假單資訊時發生錯誤',
            error: error.message,
        });
    }
};
exports.getLeaveRequestById = getLeaveRequestById;
const updateLeaveRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        const { leaveDate, leaveType, reason, supportingStaff } = req.body;
        const leaveRequest = await LeaveRequest_1.default.findOne({ _id: id, userId });
        if (!leaveRequest) {
            res.status(404).json({
                success: false,
                message: '找不到請假單',
            });
            return;
        }
        if (leaveRequest.status !== 'pending') {
            res.status(400).json({
                success: false,
                message: '只能修改待審核的請假單',
            });
            return;
        }
        if (leaveDate) {
            const leaveDateObj = new Date(leaveDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            leaveDateObj.setHours(0, 0, 0, 0);
            if (leaveDateObj < today) {
                res.status(400).json({
                    success: false,
                    message: '無法申請過去日期的休假',
                });
                return;
            }
            const existingRequest = await LeaveRequest_1.default.findOne({
                userId,
                leaveDate: leaveDateObj,
                _id: { $ne: id },
                status: { $in: ['pending', 'approved'] },
            });
            if (existingRequest) {
                res.status(400).json({
                    success: false,
                    message: '您已申請該日期的休假',
                });
                return;
            }
        }
        if (supportingStaff && supportingStaff.length > 0) {
            const filteredStaff = supportingStaff.filter((id) => id.toString() !== userId.toString());
            const validStaff = await User_1.default.find({
                _id: { $in: filteredStaff },
                isActive: true,
            });
            if (validStaff.length !== filteredStaff.length) {
                res.status(400).json({
                    success: false,
                    message: '部分代理人無效',
                });
                return;
            }
        }
        if (leaveDate)
            leaveRequest.leaveDate = new Date(leaveDate);
        if (leaveType)
            leaveRequest.leaveType = leaveType;
        if (reason)
            leaveRequest.reason = reason;
        if (supportingStaff !== undefined)
            leaveRequest.supportingStaff = supportingStaff;
        await leaveRequest.save();
        const populatedRequest = await LeaveRequest_1.default.findById(leaveRequest._id)
            .populate('userId', 'employeeCode name email')
            .populate('supportingStaff', 'employeeCode name email')
            .populate('reviewedBy', 'employeeCode name email');
        res.status(200).json({
            success: true,
            message: '更新請假單成功',
            data: populatedRequest,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '更新請假單時發生錯誤',
            error: error.message,
        });
    }
};
exports.updateLeaveRequest = updateLeaveRequest;
const deleteLeaveRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        const leaveRequest = await LeaveRequest_1.default.findOne({ _id: id, userId });
        if (!leaveRequest) {
            res.status(404).json({
                success: false,
                message: '找不到請假單',
            });
            return;
        }
        if (leaveRequest.status !== 'pending') {
            res.status(400).json({
                success: false,
                message: '只能刪除待審核的請假單',
            });
            return;
        }
        await LeaveRequest_1.default.findByIdAndDelete(id);
        res.status(200).json({
            success: true,
            message: '刪除請假單成功',
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '刪除請假單時發生錯誤',
            error: error.message,
        });
    }
};
exports.deleteLeaveRequest = deleteLeaveRequest;
const getAllLeaveRequests = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, userId, startDate, endDate } = req.query;
        const query = {};
        if (status)
            query.status = status;
        if (userId)
            query.userId = userId;
        if (startDate || endDate) {
            query.leaveDate = {};
            if (startDate)
                query.leaveDate.$gte = new Date(startDate);
            if (endDate)
                query.leaveDate.$lte = new Date(endDate);
        }
        const skip = (Number(page) - 1) * Number(limit);
        const leaveRequests = await LeaveRequest_1.default.find(query)
            .populate('userId', 'employeeCode name email')
            .populate('supportingStaff', 'employeeCode name email')
            .populate('reviewedBy', 'employeeCode name email')
            .sort({ leaveDate: -1, createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));
        const total = await LeaveRequest_1.default.countDocuments(query);
        res.status(200).json({
            success: true,
            data: leaveRequests,
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
            message: '取得請假單列表時發生錯誤',
            error: error.message,
        });
    }
};
exports.getAllLeaveRequests = getAllLeaveRequests;
const approveLeaveRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user._id;
        const leaveRequest = await LeaveRequest_1.default.findById(id);
        if (!leaveRequest) {
            res.status(404).json({
                success: false,
                message: '找不到請假單',
            });
            return;
        }
        if (leaveRequest.status !== 'pending') {
            res.status(400).json({
                success: false,
                message: '此請假單已處理',
            });
            return;
        }
        leaveRequest.status = 'approved';
        leaveRequest.reviewedBy = adminId;
        leaveRequest.reviewedAt = new Date();
        await leaveRequest.save();
        const populatedRequest = await LeaveRequest_1.default.findById(leaveRequest._id)
            .populate('userId', 'employeeCode name email')
            .populate('supportingStaff', 'employeeCode name email')
            .populate('reviewedBy', 'employeeCode name email');
        res.status(200).json({
            success: true,
            message: '批准請假單成功',
            data: populatedRequest,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '批准請假單時發生錯誤',
            error: error.message,
        });
    }
};
exports.approveLeaveRequest = approveLeaveRequest;
const rejectLeaveRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { rejectionReason } = req.body;
        const adminId = req.user._id;
        if (!rejectionReason) {
            res.status(400).json({
                success: false,
                message: '請輸入拒絕理由',
            });
            return;
        }
        const leaveRequest = await LeaveRequest_1.default.findById(id);
        if (!leaveRequest) {
            res.status(404).json({
                success: false,
                message: '找不到請假單',
            });
            return;
        }
        if (leaveRequest.status !== 'pending') {
            res.status(400).json({
                success: false,
                message: '此請假單已處理',
            });
            return;
        }
        leaveRequest.status = 'rejected';
        leaveRequest.rejectionReason = rejectionReason;
        leaveRequest.reviewedBy = adminId;
        leaveRequest.reviewedAt = new Date();
        await leaveRequest.save();
        const populatedRequest = await LeaveRequest_1.default.findById(leaveRequest._id)
            .populate('userId', 'employeeCode name email')
            .populate('supportingStaff', 'employeeCode name email')
            .populate('reviewedBy', 'employeeCode name email');
        res.status(200).json({
            success: true,
            message: '拒絕請假單成功',
            data: populatedRequest,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '拒絕請假單時發生錯誤',
            error: error.message,
        });
    }
};
exports.rejectLeaveRequest = rejectLeaveRequest;
const getEmployeesForSupport = async (req, res) => {
    try {
        const currentUserId = req.user._id;
        const employees = await User_1.default.find({
            _id: { $ne: currentUserId },
            isActive: true,
        })
            .select('employeeCode name email')
            .sort({ name: 1 });
        res.status(200).json({
            success: true,
            data: employees,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '取得員工列表時發生錯誤',
            error: error.message,
        });
    }
};
exports.getEmployeesForSupport = getEmployeesForSupport;

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
                message: 'Vui lòng điền đầy đủ thông tin',
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
                message: 'Không thể xin nghỉ phép cho ngày đã qua',
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
                message: 'Bạn đã có đơn nghỉ phép cho ngày này',
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
                    message: 'Một số nhân viên hỗ trợ không hợp lệ',
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
            message: 'Tạo đơn nghỉ phép thành công',
            data: populatedRequest,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi tạo đơn nghỉ phép',
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
            message: 'Đã xảy ra lỗi khi lấy danh sách đơn nghỉ phép',
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
                message: 'Không tìm thấy đơn nghỉ phép',
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
            message: 'Đã xảy ra lỗi khi lấy thông tin đơn nghỉ phép',
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
                message: 'Không tìm thấy đơn nghỉ phép',
            });
            return;
        }
        if (leaveRequest.status !== 'pending') {
            res.status(400).json({
                success: false,
                message: 'Chỉ có thể sửa đơn nghỉ phép đang chờ duyệt',
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
                    message: 'Không thể xin nghỉ phép cho ngày đã qua',
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
                    message: 'Bạn đã có đơn nghỉ phép cho ngày này',
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
                    message: 'Một số nhân viên hỗ trợ không hợp lệ',
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
            message: 'Cập nhật đơn nghỉ phép thành công',
            data: populatedRequest,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi cập nhật đơn nghỉ phép',
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
                message: 'Không tìm thấy đơn nghỉ phép',
            });
            return;
        }
        if (leaveRequest.status !== 'pending') {
            res.status(400).json({
                success: false,
                message: 'Chỉ có thể xóa đơn nghỉ phép đang chờ duyệt',
            });
            return;
        }
        await LeaveRequest_1.default.findByIdAndDelete(id);
        res.status(200).json({
            success: true,
            message: 'Xóa đơn nghỉ phép thành công',
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi xóa đơn nghỉ phép',
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
            message: 'Đã xảy ra lỗi khi lấy danh sách đơn nghỉ phép',
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
                message: 'Không tìm thấy đơn nghỉ phép',
            });
            return;
        }
        if (leaveRequest.status !== 'pending') {
            res.status(400).json({
                success: false,
                message: 'Đơn nghỉ phép này đã được xử lý',
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
            message: 'Duyệt đơn nghỉ phép thành công',
            data: populatedRequest,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi duyệt đơn nghỉ phép',
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
                message: 'Vui lòng nhập lý do từ chối',
            });
            return;
        }
        const leaveRequest = await LeaveRequest_1.default.findById(id);
        if (!leaveRequest) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy đơn nghỉ phép',
            });
            return;
        }
        if (leaveRequest.status !== 'pending') {
            res.status(400).json({
                success: false,
                message: 'Đơn nghỉ phép này đã được xử lý',
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
            message: 'Từ chối đơn nghỉ phép thành công',
            data: populatedRequest,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi từ chối đơn nghỉ phép',
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
            message: 'Đã xảy ra lỗi khi lấy danh sách nhân viên',
            error: error.message,
        });
    }
};
exports.getEmployeesForSupport = getEmployeesForSupport;

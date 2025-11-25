import { Response } from 'express';
import LeaveRequest from '../models/LeaveRequest';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';

// Employee: Create leave request
export const createLeaveRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { leaveDate, leaveType, reason, supportingStaff } = req.body;
    const userId = req.user!._id;

    if (!leaveDate || !leaveType || !reason) {
      res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ thông tin',
      });
      return;
    }

    // Check if leave date is in the past
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

    // Check if there's already a leave request for this date
    const existingRequest = await LeaveRequest.findOne({
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

    // Validate supporting staff if provided
    if (supportingStaff && supportingStaff.length > 0) {
      // Filter out current user from supporting staff
      const filteredStaff = supportingStaff.filter((id: any) => id.toString() !== userId.toString());
      const validStaff = await User.find({
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

    const leaveRequest = await LeaveRequest.create({
      userId,
      leaveDate: leaveDateObj,
      leaveType,
      reason,
      supportingStaff: supportingStaff || [],
    });

    const populatedRequest = await LeaveRequest.findById(leaveRequest._id)
      .populate('userId', 'employeeCode name email')
      .populate('supportingStaff', 'employeeCode name email');

    res.status(201).json({
      success: true,
      message: 'Tạo đơn nghỉ phép thành công',
      data: populatedRequest,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi tạo đơn nghỉ phép',
      error: error.message,
    });
  }
};

// Employee: Get my leave requests
export const getMyLeaveRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id;
    const { page = 1, limit = 10, status } = req.query;

    const query: any = { userId };
    if (status) {
      query.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const leaveRequests = await LeaveRequest.find(query)
      .populate('userId', 'employeeCode name email')
      .populate('supportingStaff', 'employeeCode name email')
      .populate('reviewedBy', 'employeeCode name email')
      .sort({ leaveDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await LeaveRequest.countDocuments(query);

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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi lấy danh sách đơn nghỉ phép',
      error: error.message,
    });
  }
};

// Employee: Get single leave request
export const getLeaveRequestById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!._id;

    const leaveRequest = await LeaveRequest.findOne({ _id: id, userId })
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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi lấy thông tin đơn nghỉ phép',
      error: error.message,
    });
  }
};

// Employee: Update leave request (only if pending)
export const updateLeaveRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!._id;
    const { leaveDate, leaveType, reason, supportingStaff } = req.body;

    const leaveRequest = await LeaveRequest.findOne({ _id: id, userId });

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

    // Check if leave date is in the past
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

      // Check if there's another leave request for this date
      const existingRequest = await LeaveRequest.findOne({
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

    // Validate supporting staff if provided
    if (supportingStaff && supportingStaff.length > 0) {
      // Filter out current user from supporting staff
      const filteredStaff = supportingStaff.filter((id: any) => id.toString() !== userId.toString());
      const validStaff = await User.find({
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

    if (leaveDate) leaveRequest.leaveDate = new Date(leaveDate);
    if (leaveType) leaveRequest.leaveType = leaveType;
    if (reason) leaveRequest.reason = reason;
    if (supportingStaff !== undefined) leaveRequest.supportingStaff = supportingStaff;

    await leaveRequest.save();

    const populatedRequest = await LeaveRequest.findById(leaveRequest._id)
      .populate('userId', 'employeeCode name email')
      .populate('supportingStaff', 'employeeCode name email')
      .populate('reviewedBy', 'employeeCode name email');

    res.status(200).json({
      success: true,
      message: 'Cập nhật đơn nghỉ phép thành công',
      data: populatedRequest,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi cập nhật đơn nghỉ phép',
      error: error.message,
    });
  }
};

// Employee: Delete leave request (only if pending)
export const deleteLeaveRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!._id;

    const leaveRequest = await LeaveRequest.findOne({ _id: id, userId });

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

    await LeaveRequest.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Xóa đơn nghỉ phép thành công',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi xóa đơn nghỉ phép',
      error: error.message,
    });
  }
};

// Admin: Get all leave requests
export const getAllLeaveRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 10, status, userId, startDate, endDate } = req.query;

    const query: any = {};
    if (status) query.status = status;
    if (userId) query.userId = userId;
    if (startDate || endDate) {
      query.leaveDate = {};
      if (startDate) query.leaveDate.$gte = new Date(startDate as string);
      if (endDate) query.leaveDate.$lte = new Date(endDate as string);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const leaveRequests = await LeaveRequest.find(query)
      .populate('userId', 'employeeCode name email')
      .populate('supportingStaff', 'employeeCode name email')
      .populate('reviewedBy', 'employeeCode name email')
      .sort({ leaveDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await LeaveRequest.countDocuments(query);

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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi lấy danh sách đơn nghỉ phép',
      error: error.message,
    });
  }
};

// Admin: Approve leave request
export const approveLeaveRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const adminId = req.user!._id;

    const leaveRequest = await LeaveRequest.findById(id);

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

    const populatedRequest = await LeaveRequest.findById(leaveRequest._id)
      .populate('userId', 'employeeCode name email')
      .populate('supportingStaff', 'employeeCode name email')
      .populate('reviewedBy', 'employeeCode name email');

    res.status(200).json({
      success: true,
      message: 'Duyệt đơn nghỉ phép thành công',
      data: populatedRequest,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi duyệt đơn nghỉ phép',
      error: error.message,
    });
  }
};

// Admin: Reject leave request
export const rejectLeaveRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const adminId = req.user!._id;

    if (!rejectionReason) {
      res.status(400).json({
        success: false,
        message: 'Vui lòng nhập lý do từ chối',
      });
      return;
    }

    const leaveRequest = await LeaveRequest.findById(id);

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

    const populatedRequest = await LeaveRequest.findById(leaveRequest._id)
      .populate('userId', 'employeeCode name email')
      .populate('supportingStaff', 'employeeCode name email')
      .populate('reviewedBy', 'employeeCode name email');

    res.status(200).json({
      success: true,
      message: 'Từ chối đơn nghỉ phép thành công',
      data: populatedRequest,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi từ chối đơn nghỉ phép',
      error: error.message,
    });
  }
};

// Get list of employees for supporting staff selection
export const getEmployeesForSupport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const currentUserId = req.user!._id;

    const employees = await User.find({
      _id: { $ne: currentUserId },
      isActive: true,
    })
      .select('employeeCode name email')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: employees,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi lấy danh sách nhân viên',
      error: error.message,
    });
  }
};


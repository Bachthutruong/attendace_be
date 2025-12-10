import { Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/User';
import Attendance from '../models/Attendance';
import Notification from '../models/Notification';
import Settings from '../models/Settings';
import { AuthRequest } from '../middleware/auth';
import { getStartOfDay, getEndOfDay } from '../utils/dateHelper';
import { getClientIp } from '../utils/deviceParser';

// User Management
export const getAllUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, role, isActive, page = 1, limit = 10 } = req.query;

    const query: any = {};

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

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await User.countDocuments(query);

    // Map _id to id for consistency
    const usersWithId = users.map((user) => ({
      id: user._id.toString(),
      employeeCode: user.employeeCode,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      customCheckInTime: user.customCheckInTime,
      customCheckOutTime: user.customCheckOutTime,
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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: '發生錯誤',
      error: error.message,
    });
  }
};

export const getUserById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-password');

    if (!user) {
      res.status(404).json({
        success: false,
        message: '找不到員工',
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
        customCheckInTime: user.customCheckInTime,
        customCheckOutTime: user.customCheckOutTime,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
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

export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { 
      employeeCode, 
      name, 
      email, 
      password, 
      role,
      customCheckInTime,
      customCheckOutTime,
    } = req.body;

    // Check if employeeCode exists
    const existingCode = await User.findOne({ employeeCode: employeeCode.toUpperCase() });
    if (existingCode) {
      res.status(400).json({
        success: false,
        message: '員工編號已被使用',
      });
      return;
    }

    // Check if email exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      res.status(400).json({
        success: false,
        message: '電子郵件已被使用',
      });
      return;
    }

    const user = await User.create({
      employeeCode: employeeCode.toUpperCase(),
      name,
      email,
      password,
      role: role || 'employee',
      customCheckInTime,
      customCheckOutTime,
    });

    res.status(201).json({
      success: true,
      message: '建立員工成功',
      data: {
        id: user._id,
        employeeCode: user.employeeCode,
        name: user.name,
        email: user.email,
        role: user.role,
        customCheckInTime: user.customCheckInTime,
        customCheckOutTime: user.customCheckOutTime,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: '建立員工時發生錯誤',
      error: error.message,
    });
  }
};

export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { 
      employeeCode, 
      name, 
      email, 
      role, 
      isActive,
      customCheckInTime,
      customCheckOutTime,
    } = req.body;

    const user = await User.findById(id);

    if (!user) {
      res.status(404).json({
        success: false,
        message: '找不到員工',
      });
      return;
    }

    // Check if employeeCode is being changed and if it's already in use
    if (employeeCode && employeeCode.toUpperCase() !== user.employeeCode) {
      const existingCode = await User.findOne({ employeeCode: employeeCode.toUpperCase() });
      if (existingCode) {
        res.status(400).json({
          success: false,
          message: '員工編號已被使用',
        });
        return;
      }
    }

    // Check if email is being changed and if it's already in use
    if (email && email !== user.email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        res.status(400).json({
          success: false,
          message: '電子郵件已被使用',
        });
        return;
      }
    }

    if (employeeCode) user.employeeCode = employeeCode.toUpperCase();
    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    
    // Update custom time settings
    if (customCheckInTime !== undefined) user.customCheckInTime = customCheckInTime || undefined;
    if (customCheckOutTime !== undefined) user.customCheckOutTime = customCheckOutTime || undefined;

    await user.save();

    res.status(200).json({
      success: true,
      message: '更新員工成功',
      data: {
        id: user._id,
        employeeCode: user.employeeCode,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        customCheckInTime: user.customCheckInTime,
        customCheckOutTime: user.customCheckOutTime,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: '更新員工時發生錯誤',
      error: error.message,
    });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (id === req.user?._id.toString()) {
      res.status(400).json({
        success: false,
        message: '您無法刪除自己的帳戶',
      });
      return;
    }

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      res.status(404).json({
        success: false,
        message: '找不到員工',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: '刪除員工成功',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: '刪除員工時發生錯誤',
      error: error.message,
    });
  }
};

// Attendance Management
export const getAllAttendances = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { 
      userId, 
      startDate, 
      endDate, 
      month,
      year,
      status, 
      hasAlert, 
      page = 1, 
      limit = 20 
    } = req.query;

    const query: any = {};

    // Filter by user
    if (userId) {
      // Validate if userId is a valid ObjectId
      if (mongoose.Types.ObjectId.isValid(userId as string)) {
        query.userId = new mongoose.Types.ObjectId(userId as string);
      } else {
        // If not a valid ObjectId, try to find user by employeeCode or name
        const user = await User.findOne({
          $or: [
            { employeeCode: (userId as string).toUpperCase() },
            { name: { $regex: userId as string, $options: 'i' } },
          ],
        });
        
        if (user) {
          query.userId = user._id;
        } else {
          // If user not found, return empty result
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

    // Filter by date - Priority: startDate/endDate > month/year > year only
    if (startDate || endDate) {
      // If startDate/endDate provided, use them (highest priority)
      query.date = {};
      if (startDate) {
        const start = new Date(startDate as string);
        start.setHours(0, 0, 0, 0);
        query.date.$gte = start;
      }
      if (endDate) {
        query.date.$lte = getEndOfDay(new Date(endDate as string));
      }
    } else if (month && year) {
      // If month and year provided (but no startDate/endDate)
      const monthNum = Number(month);
      const yearNum = Number(year);
      const startOfMonth = new Date(yearNum, monthNum - 1, 1);
      const endOfMonth = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);
      query.date = { $gte: startOfMonth, $lte: endOfMonth };
    } else if (year) {
      // If only year provided (but no startDate/endDate/month)
      const yearNum = Number(year);
      const startOfYear = new Date(yearNum, 0, 1);
      const endOfYear = new Date(yearNum, 11, 31, 23, 59, 59, 999);
      query.date = { $gte: startOfYear, $lte: endOfYear };
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by alert
    if (hasAlert === 'true') {
      query.$or = [
        { hasDeviceAlert: true },
        { hasIpAlert: true },
      ];
    } else if (hasAlert === 'false') {
      query.hasDeviceAlert = false;
      query.hasIpAlert = false;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const attendances = await Attendance.find(query)
      .populate('userId', 'employeeCode name email role')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Attendance.countDocuments(query);

    // Map attendances to ensure userId has id field
    const attendancesWithId = attendances.map((attendance) => {
      const attendanceObj = attendance.toObject() as any;
      if (attendanceObj.userId && typeof attendanceObj.userId === 'object' && attendanceObj.userId._id) {
        // userId is populated User object
        attendanceObj.userId = {
          id: attendanceObj.userId._id.toString(),
          employeeCode: attendanceObj.userId.employeeCode,
          name: attendanceObj.userId.name,
          email: attendanceObj.userId.email,
          role: attendanceObj.userId.role,
        };
      } else if (attendanceObj.userId && typeof attendanceObj.userId === 'object') {
        // userId might be ObjectId, keep as is
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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: '發生錯誤',
      error: error.message,
    });
  }
};

export const getTodayAttendances = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = getStartOfDay();

    const attendances = await Attendance.find({
      date: today,
    })
      .populate('userId', 'employeeCode name email role')
      .sort({ createdAt: -1 });

    // Get all employees
    const allEmployees = await User.find({ role: 'employee', isActive: true }).select('employeeCode name email');
    
    // Mark employees who haven't checked in
    const checkedInUserIds = attendances.map((a: any) => {
      const userId = typeof a.userId === 'object' ? a.userId._id : a.userId;
      return userId.toString();
    });
    const absentEmployees = allEmployees.filter(emp => !checkedInUserIds.includes(emp._id.toString()));

    // Map attendances to ensure userId has id field
    const attendancesWithId = attendances.map((attendance: any) => {
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

    // Map absentEmployees to have id field
    const absentEmployeesWithId = absentEmployees.map((emp: any) => ({
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
          completed: attendances.filter((a: any) => a.status === 'completed').length,
          pending: attendances.filter((a: any) => a.status === 'pending').length,
          withAlerts: attendances.filter((a: any) => a.hasDeviceAlert || a.hasIpAlert).length,
        },
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

export const getAttendanceStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, startDate, endDate } = req.query;

    const query: any = {};

    if (userId) {
      query.userId = userId;
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate as string);
      if (endDate) query.date.$lte = getEndOfDay(new Date(endDate as string));
    }

    const attendances = await Attendance.find(query);

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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: '發生錯誤',
      error: error.message,
    });
  }
};

// Notifications
export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { isRead, type, page = 1, limit = 20 } = req.query;

    const query: any = { userId: req.user?._id };

    if (isRead !== undefined) {
      query.isRead = isRead === 'true';
    }

    if (type) {
      query.type = type;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const notifications = await Notification.find(query)
      .populate('metadata.attendanceId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ userId: req.user?._id, isRead: false });

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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: '發生錯誤',
      error: error.message,
    });
  }
};

export const markNotificationAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: req.user?._id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      res.status(404).json({
        success: false,
        message: '找不到通知',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: '發生錯誤',
      error: error.message,
    });
  }
};

export const markAllNotificationsAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Notification.updateMany(
      { userId: req.user?._id, isRead: false },
      { isRead: true }
    );

    res.status(200).json({
      success: true,
      message: '已將所有通知標記為已讀',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: '發生錯誤',
      error: error.message,
    });
  }
};

// Get attendance detail
export const getAttendanceDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const attendance = await Attendance.findById(id)
      .populate('userId', 'employeeCode name email role');

    if (!attendance) {
      res.status(404).json({
        success: false,
        message: '找不到考勤記錄',
      });
      return;
    }

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

// Update attendance status (Approve/Reject)
export const updateAttendanceStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['completed', 'rejected', 'pending'].includes(status)) {
      res.status(400).json({
        success: false,
        message: '狀態無效',
      });
      return;
    }

    const attendance = await Attendance.findById(id);

    if (!attendance) {
      res.status(404).json({
        success: false,
        message: '找不到考勤記錄',
      });
      return;
    }

    attendance.status = status as 'completed' | 'rejected' | 'pending';
    await attendance.save();

    await attendance.populate('userId', 'employeeCode name email role');

    res.status(200).json({
      success: true,
      message: status === 'completed' ? '已批准考勤' : status === 'rejected' ? '已拒絕考勤' : '狀態已更新',
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

// Settings Management
export const getSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const settings = await Settings.findOne();
    
    if (!settings) {
      // Create default settings if not exists
      const newSettings = await Settings.create({});
      res.status(200).json({
        success: true,
        data: newSettings,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: '發生錯誤',
      error: error.message,
    });
  }
};

export const updateSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { defaultCheckInTime, defaultCheckOutTime, allowedIPs } = req.body;

    let settings = await Settings.findOne();
    
    if (!settings) {
      settings = await Settings.create({
        defaultCheckInTime,
        defaultCheckOutTime,
        allowedIPs: allowedIPs || [],
      });
    } else {
      if (defaultCheckInTime !== undefined) {
        settings.defaultCheckInTime = defaultCheckInTime || undefined;
      }
      if (defaultCheckOutTime !== undefined) {
        settings.defaultCheckOutTime = defaultCheckOutTime || undefined;
      }
      if (allowedIPs !== undefined) {
        // Validate IPs - basic validation
        if (Array.isArray(allowedIPs)) {
          settings.allowedIPs = allowedIPs.filter(ip => ip && ip.trim() !== '');
        } else {
          settings.allowedIPs = [];
        }
      }
      await settings.save();
    }

    res.status(200).json({
      success: true,
      message: '設定更新成功',
      data: settings,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: '更新設定時發生錯誤',
      error: error.message,
    });
  }
};

export const getCurrentIP = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const currentIp = getClientIp(req);
    
    res.status(200).json({
      success: true,
      data: {
        currentIp,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: '取得目前 IP 時發生錯誤',
      error: error.message,
    });
  }
};


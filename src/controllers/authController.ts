import { Request, Response } from 'express';
import User from '../models/User';
import { generateToken } from '../utils/tokenGenerator';
import { AuthRequest } from '../middleware/auth';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeCode, name, email, password, role } = req.body;

    // Check if employeeCode already exists
    const existingCode = await User.findOne({ employeeCode: employeeCode.toUpperCase() });
    if (existingCode) {
      res.status(400).json({
        success: false,
        message: 'Mã nhân viên đã được sử dụng',
      });
      return;
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      res.status(400).json({
        success: false,
        message: 'Email đã được sử dụng',
      });
      return;
    }

    // Create new user
    const user = await User.create({
      employeeCode: employeeCode.toUpperCase(),
      name,
      email,
      password,
      role: role || 'employee',
    });

    const token = generateToken(user._id.toString());

    res.status(201).json({
      success: true,
      message: 'Đăng ký thành công',
      data: {
        token,
        user: {
          id: user._id,
          employeeCode: user.employeeCode,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi đăng ký',
      error: error.message,
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { loginId, password } = req.body;

    // Find user by email or employeeCode
    const user = await User.findOne({
      $or: [
        { email: loginId.toLowerCase() },
        { employeeCode: loginId.toUpperCase() },
      ],
    }).select('+password');

    if (!user || !user.isActive) {
      res.status(401).json({
        success: false,
        message: 'Mã nhân viên/Email hoặc mật khẩu không chính xác',
      });
      return;
    }

    // Check password
    const isPasswordMatch = await user.comparePassword(password);

    if (!isPasswordMatch) {
      res.status(401).json({
        success: false,
        message: 'Mã nhân viên/Email hoặc mật khẩu không chính xác',
      });
      return;
    }

    const token = generateToken(user._id.toString());

    res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công',
      data: {
        token,
        user: {
          id: user._id,
          employeeCode: user.employeeCode,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi đăng nhập',
      error: error.message,
    });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;

    res.status(200).json({
      success: true,
      data: {
        id: user?._id,
        employeeCode: user?.employeeCode,
        name: user?.name,
        email: user?.email,
        role: user?.role,
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


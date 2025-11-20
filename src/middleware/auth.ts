import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';

export interface AuthRequest extends Request {
  user?: IUser;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập để tiếp tục',
      });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || '') as { id: string };
    
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user || !user.isActive) {
      res.status(401).json({
        success: false,
        message: 'Tài khoản không tồn tại hoặc đã bị khóa',
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Token không hợp lệ hoặc đã hết hạn',
    });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập chức năng này',
      });
      return;
    }
    next();
  };
};




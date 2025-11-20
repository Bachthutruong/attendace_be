"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const authenticate = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            res.status(401).json({
                success: false,
                message: 'Vui lòng đăng nhập để tiếp tục',
            });
            return;
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || '');
        const user = await User_1.default.findById(decoded.id).select('-password');
        if (!user || !user.isActive) {
            res.status(401).json({
                success: false,
                message: 'Tài khoản không tồn tại hoặc đã bị khóa',
            });
            return;
        }
        req.user = user;
        next();
    }
    catch (error) {
        res.status(401).json({
            success: false,
            message: 'Token không hợp lệ hoặc đã hết hạn',
        });
    }
};
exports.authenticate = authenticate;
const authorize = (...roles) => {
    return (req, res, next) => {
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
exports.authorize = authorize;

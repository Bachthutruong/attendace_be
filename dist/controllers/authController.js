"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = exports.login = exports.register = void 0;
const User_1 = __importDefault(require("../models/User"));
const tokenGenerator_1 = require("../utils/tokenGenerator");
const register = async (req, res) => {
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
        const token = (0, tokenGenerator_1.generateToken)(user._id.toString());
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi đăng ký',
            error: error.message,
        });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { loginId, password } = req.body;
        const user = await User_1.default.findOne({
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
        const isPasswordMatch = await user.comparePassword(password);
        if (!isPasswordMatch) {
            res.status(401).json({
                success: false,
                message: 'Mã nhân viên/Email hoặc mật khẩu không chính xác',
            });
            return;
        }
        const token = (0, tokenGenerator_1.generateToken)(user._id.toString());
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi đăng nhập',
            error: error.message,
        });
    }
};
exports.login = login;
const getMe = async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi',
            error: error.message,
        });
    }
};
exports.getMe = getMe;

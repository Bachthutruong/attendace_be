"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = exports.login = exports.register = void 0;
const User_1 = __importDefault(require("../models/User"));
const tokenGenerator_1 = require("../utils/tokenGenerator");
const deviceParser_1 = require("../utils/deviceParser");
const register = async (req, res) => {
    try {
        const { employeeCode, name, email, password, role } = req.body;
        const existingCode = await User_1.default.findOne({ employeeCode: employeeCode.toUpperCase() });
        if (existingCode) {
            res.status(400).json({
                success: false,
                message: '員工編號已被使用',
            });
            return;
        }
        const existingEmail = await User_1.default.findOne({ email });
        if (existingEmail) {
            res.status(400).json({
                success: false,
                message: '電子郵件已被使用',
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
            message: '註冊成功',
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
            message: '註冊時發生錯誤',
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
                message: '員工編號/電子郵件或密碼不正確',
            });
            return;
        }
        const isPasswordMatch = await user.comparePassword(password);
        if (!isPasswordMatch) {
            res.status(401).json({
                success: false,
                message: '員工編號/電子郵件或密碼不正確',
            });
            return;
        }
        const token = (0, tokenGenerator_1.generateToken)(user._id.toString());
        const currentIp = (0, deviceParser_1.getClientIp)(req);
        res.status(200).json({
            success: true,
            message: '登入成功',
            data: {
                token,
                user: {
                    id: user._id,
                    employeeCode: user.employeeCode,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                },
                currentIp,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '登入時發生錯誤',
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
            message: '發生錯誤',
            error: error.message,
        });
    }
};
exports.getMe = getMe;

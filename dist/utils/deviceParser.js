"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDeviceFingerprint = exports.parseDeviceInfo = exports.getClientIp = void 0;
const ua_parser_js_1 = __importDefault(require("ua-parser-js"));
const getClientIp = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        const ips = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',');
        return ips[0].trim();
    }
    return req.headers['x-real-ip'] || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
};
exports.getClientIp = getClientIp;
const parseDeviceInfo = (req) => {
    const userAgent = req.headers['user-agent'] || '';
    const parser = new ua_parser_js_1.default(userAgent);
    const result = parser.getResult();
    return {
        browser: result.browser.name || 'Unknown',
        browserVersion: result.browser.version || 'Unknown',
        os: result.os.name || 'Unknown',
        osVersion: result.os.version || 'Unknown',
        device: result.device.model || 'Unknown',
        deviceType: result.device.type || 'desktop',
    };
};
exports.parseDeviceInfo = parseDeviceInfo;
const generateDeviceFingerprint = (deviceInfo) => {
    return `${deviceInfo.browser}-${deviceInfo.os}-${deviceInfo.device}-${deviceInfo.deviceType}`;
};
exports.generateDeviceFingerprint = generateDeviceFingerprint;

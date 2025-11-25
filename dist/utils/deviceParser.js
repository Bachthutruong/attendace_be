"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareDeviceInfo = exports.generateDeviceFingerprint = exports.parseDeviceInfo = exports.getClientIp = void 0;
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
        userAgent: userAgent,
    };
};
exports.parseDeviceInfo = parseDeviceInfo;
const generateDeviceFingerprint = (deviceInfo) => {
    return `${deviceInfo.browser}-${deviceInfo.browserVersion}-${deviceInfo.os}-${deviceInfo.osVersion}-${deviceInfo.device}-${deviceInfo.deviceType}`;
};
exports.generateDeviceFingerprint = generateDeviceFingerprint;
const compareDeviceInfo = (device1, device2) => {
    return (device1.browser === device2.browser &&
        device1.browserVersion === device2.browserVersion &&
        device1.os === device2.os &&
        device1.osVersion === device2.osVersion &&
        device1.device === device2.device &&
        device1.deviceType === device2.deviceType &&
        (device1.userAgent === device2.userAgent || (!device1.userAgent && !device2.userAgent)));
};
exports.compareDeviceInfo = compareDeviceInfo;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareDeviceInfo = exports.generateDeviceFingerprint = exports.parseDeviceInfo = exports.getClientIp = void 0;
const ua_parser_js_1 = __importDefault(require("ua-parser-js"));
const normalizeToIPv4 = (ip) => {
    if (!ip || ip === 'unknown') {
        return 'unknown';
    }
    if (ip === '::1') {
        return '127.0.0.1';
    }
    if (ip.startsWith('::ffff:')) {
        return ip.replace('::ffff:', '');
    }
    if (ip === '::ffff:127.0.0.1' || ip === '0:0:0:0:0:0:0:1') {
        return '127.0.0.1';
    }
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Regex.test(ip)) {
        return ip;
    }
    return ip;
};
const isIPv6 = (ip) => {
    if (!ip || ip === 'unknown')
        return false;
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    return !ipv4Regex.test(ip) && ip.includes(':');
};
const getClientIp = (req) => {
    let ip;
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        const ips = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',');
        ip = ips[0].trim();
    }
    if (!ip) {
        ip = req.headers['x-real-ip'];
    }
    if (!ip) {
        ip = req.headers['x-client-ip'];
    }
    if (!ip) {
        ip = req.headers['cf-connecting-ip'];
    }
    if (!ip && req.ip) {
        ip = req.ip;
    }
    if (!ip) {
        ip = req.socket?.remoteAddress || req.connection?.remoteAddress;
    }
    if (!ip) {
        return 'unknown';
    }
    const normalizedIp = normalizeToIPv4(ip);
    if (isIPv6(normalizedIp) && normalizedIp !== '127.0.0.1') {
        console.warn(`Warning: Received IPv6 address ${normalizedIp}, expected IPv4. Check proxy configuration.`);
    }
    return normalizedIp;
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

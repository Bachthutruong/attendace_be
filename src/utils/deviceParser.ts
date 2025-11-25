import { Request } from 'express';
import UAParser from 'ua-parser-js';
import { IDeviceInfo } from '../models/Attendance';

export const getClientIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  
  if (forwarded) {
    const ips = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',');
    return ips[0].trim();
  }
  
  return req.headers['x-real-ip'] as string || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
};

export const parseDeviceInfo = (req: Request): IDeviceInfo => {
  const userAgent = req.headers['user-agent'] || '';
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  return {
    browser: result.browser.name || 'Unknown',
    browserVersion: result.browser.version || 'Unknown',
    os: result.os.name || 'Unknown',
    osVersion: result.os.version || 'Unknown',
    device: result.device.model || 'Unknown',
    deviceType: result.device.type || 'desktop',
    userAgent: userAgent, // Store full user agent for detailed comparison
  };
};

export const generateDeviceFingerprint = (deviceInfo: IDeviceInfo): string => {
  // Include more details for better fraud detection
  return `${deviceInfo.browser}-${deviceInfo.browserVersion}-${deviceInfo.os}-${deviceInfo.osVersion}-${deviceInfo.device}-${deviceInfo.deviceType}`;
};

// Compare device info in detail
export const compareDeviceInfo = (device1: IDeviceInfo, device2: IDeviceInfo): boolean => {
  // Compare all fields
  return (
    device1.browser === device2.browser &&
    device1.browserVersion === device2.browserVersion &&
    device1.os === device2.os &&
    device1.osVersion === device2.osVersion &&
    device1.device === device2.device &&
    device1.deviceType === device2.deviceType &&
    (device1.userAgent === device2.userAgent || (!device1.userAgent && !device2.userAgent))
  );
};




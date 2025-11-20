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
  };
};

export const generateDeviceFingerprint = (deviceInfo: IDeviceInfo): string => {
  return `${deviceInfo.browser}-${deviceInfo.os}-${deviceInfo.device}-${deviceInfo.deviceType}`;
};




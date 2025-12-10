import { Request } from 'express';
import UAParser from 'ua-parser-js';
import { IDeviceInfo } from '../models/Attendance';

/**
 * Normalize IP address to IPv4 format
 * Converts IPv6 localhost and IPv6-mapped IPv4 addresses to IPv4
 */
const normalizeToIPv4 = (ip: string): string => {
  if (!ip || ip === 'unknown') {
    return 'unknown';
  }

  // IPv6 localhost
  if (ip === '::1') {
    return '127.0.0.1';
  }

  // IPv6-mapped IPv4 (::ffff:xxx.xxx.xxx.xxx)
  if (ip.startsWith('::ffff:')) {
    return ip.replace('::ffff:', '');
  }

  // IPv6 loopback variants
  if (ip === '::ffff:127.0.0.1' || ip === '0:0:0:0:0:0:0:1') {
    return '127.0.0.1';
  }

  // If it's already IPv4, return as is
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(ip)) {
    return ip;
  }

  // If it's IPv6 and not localhost, try to extract IPv4 from mapped format
  // Otherwise return the IPv6 address (we'll handle this case separately)
  return ip;
};

/**
 * Check if an IP is IPv6 (not IPv4)
 */
const isIPv6 = (ip: string): boolean => {
  if (!ip || ip === 'unknown') return false;
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  return !ipv4Regex.test(ip) && ip.includes(':');
};

/**
 * Get client IP address, always returning IPv4 when possible
 * Priority:
 * 1. x-forwarded-for header (for proxy/load balancer)
 * 2. x-real-ip header
 * 3. req.ip (if Express trust proxy is configured)
 * 4. req.socket.remoteAddress or req.connection.remoteAddress
 */
export const getClientIp = (req: Request): string => {
  let ip: string | undefined;

  // 1. Try x-forwarded-for header (most reliable for proxied requests)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',');
    ip = ips[0].trim();
  }

  // 2. Try x-real-ip header
  if (!ip) {
    ip = req.headers['x-real-ip'] as string | undefined;
  }

  // 3. Try x-client-ip header (some proxies use this)
  if (!ip) {
    ip = req.headers['x-client-ip'] as string | undefined;
  }

  // 4. Try cf-connecting-ip header (Cloudflare)
  if (!ip) {
    ip = req.headers['cf-connecting-ip'] as string | undefined;
  }

  // 5. Try req.ip (if Express trust proxy is configured)
  if (!ip && req.ip) {
    ip = req.ip;
  }

  // 6. Try socket addresses (fallback)
  if (!ip) {
    ip = req.socket?.remoteAddress || (req.connection as any)?.remoteAddress;
  }

  // If no IP found, return unknown
  if (!ip) {
    return 'unknown';
  }

  // Normalize to IPv4
  const normalizedIp = normalizeToIPv4(ip);

  // If still IPv6 after normalization, try to get IPv4 from alternative sources
  if (isIPv6(normalizedIp) && normalizedIp !== '127.0.0.1') {
    // For IPv6 addresses that aren't localhost, we might need to handle differently
    // In production with proper proxy setup, this shouldn't happen
    // For now, we'll return the normalized IP (which might still be IPv6)
    // In a real scenario, you'd want to configure your proxy to forward the real IP
    console.warn(`Warning: Received IPv6 address ${normalizedIp}, expected IPv4. Check proxy configuration.`);
  }

  return normalizedIp;
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




export const getStartOfDay = (date: Date = new Date()): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const getEndOfDay = (date: Date = new Date()): Date => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

export const calculateWorkedHours = (checkIn: Date, checkOut: Date): number => {
  const diff = checkOut.getTime() - checkIn.getTime();
  return Math.round((diff / (1000 * 60 * 60)) * 100) / 100; // Round to 2 decimal places
};

export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const formatDateTime = (date: Date): string => {
  return date.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

/**
 * Parse time string (HH:mm) to Date object for today
 */
export const parseTimeString = (timeString: string, date: Date = new Date()): Date => {
  const [hours, minutes] = timeString.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
};

/**
 * Get expected check-in time for a user (custom or from settings)
 */
export const getExpectedCheckInTime = async (user: any, settings: any, date: Date = new Date()): Promise<Date | null> => {
  // Priority: customCheckInTime > settings.defaultCheckInTime
  const timeString = user.customCheckInTime || settings?.defaultCheckInTime;
  if (!timeString) return null;
  return parseTimeString(timeString, date);
};

/**
 * Get expected check-out time for a user (custom or from settings)
 */
export const getExpectedCheckOutTime = async (user: any, settings: any, date: Date = new Date()): Promise<Date | null> => {
  // Priority: customCheckOutTime > settings.defaultCheckOutTime
  const timeString = user.customCheckOutTime || settings?.defaultCheckOutTime;
  if (!timeString) return null;
  return parseTimeString(timeString, date);
};

/**
 * Calculate minutes difference between two dates
 */
export const getMinutesDifference = (date1: Date, date2: Date): number => {
  return Math.round((date1.getTime() - date2.getTime()) / (1000 * 60));
};

/**
 * Format minutes to human-readable time string
 * - If less than 60 minutes: shows "X phút"
 * - If 60 minutes or more: shows "X giờ Y phút"
 */
export const formatTimeDifference = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes} phút`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return `${hours} giờ`;
  }
  
  return `${hours} giờ ${remainingMinutes} phút`;
};




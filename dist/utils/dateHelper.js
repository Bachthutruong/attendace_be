"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatTimeDifference = exports.getMinutesDifference = exports.getExpectedCheckOutTime = exports.getExpectedCheckInTime = exports.parseTimeString = exports.formatDateTime = exports.formatDate = exports.calculateWorkedHours = exports.getEndOfDay = exports.getStartOfDay = void 0;
const getStartOfDay = (date = new Date()) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};
exports.getStartOfDay = getStartOfDay;
const getEndOfDay = (date = new Date()) => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
};
exports.getEndOfDay = getEndOfDay;
const calculateWorkedHours = (checkIn, checkOut) => {
    const diff = checkOut.getTime() - checkIn.getTime();
    return Math.round((diff / (1000 * 60 * 60)) * 100) / 100;
};
exports.calculateWorkedHours = calculateWorkedHours;
const formatDate = (date) => {
    return date.toISOString().split('T')[0];
};
exports.formatDate = formatDate;
const formatDateTime = (date) => {
    return date.toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
};
exports.formatDateTime = formatDateTime;
const parseTimeString = (timeString, date = new Date()) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
};
exports.parseTimeString = parseTimeString;
const getExpectedCheckInTime = async (user, settings, date = new Date()) => {
    const timeString = user.customCheckInTime || settings?.defaultCheckInTime;
    if (!timeString)
        return null;
    return (0, exports.parseTimeString)(timeString, date);
};
exports.getExpectedCheckInTime = getExpectedCheckInTime;
const getExpectedCheckOutTime = async (user, settings, date = new Date()) => {
    const timeString = user.customCheckOutTime || settings?.defaultCheckOutTime;
    if (!timeString)
        return null;
    return (0, exports.parseTimeString)(timeString, date);
};
exports.getExpectedCheckOutTime = getExpectedCheckOutTime;
const getMinutesDifference = (date1, date2) => {
    return Math.round((date1.getTime() - date2.getTime()) / (1000 * 60));
};
exports.getMinutesDifference = getMinutesDifference;
const formatTimeDifference = (minutes) => {
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
exports.formatTimeDifference = formatTimeDifference;

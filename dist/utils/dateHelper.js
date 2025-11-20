"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDateTime = exports.formatDate = exports.calculateWorkedHours = exports.getEndOfDay = exports.getStartOfDay = void 0;
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

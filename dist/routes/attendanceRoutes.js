"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const attendanceController_1 = require("../controllers/attendanceController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.use(auth_1.authenticate);
router.post('/check-in', attendanceController_1.checkIn);
router.post('/check-out', attendanceController_1.checkOut);
router.get('/today', attendanceController_1.getTodayAttendance);
router.get('/history', attendanceController_1.getMyAttendanceHistory);
exports.default = router;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const leaveRequestController_1 = require("../controllers/leaveRequestController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.use(auth_1.authenticate);
router.post('/', leaveRequestController_1.createLeaveRequest);
router.get('/my-requests', leaveRequestController_1.getMyLeaveRequests);
router.get('/employees', leaveRequestController_1.getEmployeesForSupport);
router.get('/:id', leaveRequestController_1.getLeaveRequestById);
router.put('/:id', leaveRequestController_1.updateLeaveRequest);
router.delete('/:id', leaveRequestController_1.deleteLeaveRequest);
exports.default = router;

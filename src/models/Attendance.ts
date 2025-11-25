import mongoose, { Document, Schema } from 'mongoose';

export interface IDeviceInfo {
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  device: string;
  deviceType: string;
  userAgent?: string; // Full user agent string for detailed comparison
}

export interface IAttendanceRecord {
  type: 'check-in' | 'check-out';
  time: Date;
  ipAddress: string;
  deviceInfo: IDeviceInfo;
  location?: string;
}

export interface IAttendance extends Document {
  userId: mongoose.Types.ObjectId;
  date: Date;
  checkIn?: IAttendanceRecord;
  checkOut?: IAttendanceRecord;
  workedHours?: number;
  status: 'pending' | 'completed' | 'absent' | 'rejected';
  hasDeviceAlert: boolean;
  hasIpAlert: boolean;
  alertMessage?: string;
  // Time-based alerts
  hasTimeAlert: boolean;
  timeAlertMessage?: string;
  checkInLateMinutes?: number; // Minutes late for check-in
  checkOutEarlyMinutes?: number; // Minutes early for check-out
  // Fraud detection
  fraudReason?: string; // Reason provided when fraud is detected
  createdAt: Date;
  updatedAt: Date;
}

const deviceInfoSchema = new Schema<IDeviceInfo>(
  {
    browser: String,
    browserVersion: String,
    os: String,
    osVersion: String,
    device: String,
    deviceType: String,
    userAgent: String, // Full user agent string for detailed comparison
  },
  { _id: false }
);

const attendanceRecordSchema = new Schema<IAttendanceRecord>(
  {
    type: {
      type: String,
      enum: ['check-in', 'check-out'],
      required: true,
    },
    time: {
      type: Date,
      required: true,
    },
    ipAddress: {
      type: String,
      required: true,
    },
    deviceInfo: {
      type: deviceInfoSchema,
      required: true,
    },
    location: String,
  },
  { _id: false }
);

const attendanceSchema = new Schema<IAttendance>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    checkIn: attendanceRecordSchema,
    checkOut: attendanceRecordSchema,
    workedHours: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'absent', 'rejected'],
      default: 'pending',
    },
    hasDeviceAlert: {
      type: Boolean,
      default: false,
    },
    hasIpAlert: {
      type: Boolean,
      default: false,
    },
    alertMessage: String,
    hasTimeAlert: {
      type: Boolean,
      default: false,
    },
    timeAlertMessage: String,
    checkInLateMinutes: Number,
    checkOutEarlyMinutes: Number,
    fraudReason: String, // Reason provided when fraud is detected
  },
  {
    timestamps: true,
  }
);

// Create compound index for userId and date
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

export default mongoose.model<IAttendance>('Attendance', attendanceSchema);



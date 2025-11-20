import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'check-in' | 'check-out' | 'alert';
  title: string;
  message: string;
  isRead: boolean;
  metadata?: {
    attendanceId?: mongoose.Types.ObjectId;
    ipAddress?: string;
    deviceInfo?: string;
    timestamp?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['check-in', 'check-out', 'alert'],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    metadata: {
      attendanceId: {
        type: Schema.Types.ObjectId,
        ref: 'Attendance',
      },
      ipAddress: String,
      deviceInfo: String,
      timestamp: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });

export default mongoose.model<INotification>('Notification', notificationSchema);




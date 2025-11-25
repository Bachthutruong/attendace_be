import mongoose, { Document, Schema } from 'mongoose';

export interface ILeaveRequest extends Document {
  userId: mongoose.Types.ObjectId;
  leaveDate: Date;
  leaveType: 'half-day-morning' | 'half-day-afternoon' | 'full-day';
  reason: string;
  supportingStaff?: mongoose.Types.ObjectId[]; // Array of user IDs who will support
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  reviewedBy?: mongoose.Types.ObjectId; // Admin who reviewed
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const leaveRequestSchema = new Schema<ILeaveRequest>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    leaveDate: {
      type: Date,
      required: true,
      index: true,
    },
    leaveType: {
      type: String,
      enum: ['half-day-morning', 'half-day-afternoon', 'full-day'],
      required: true,
    },
    reason: {
      type: String,
      required: [true, 'Lý do nghỉ phép là bắt buộc'],
      trim: true,
    },
    supportingStaff: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Create compound index for userId and leaveDate
leaveRequestSchema.index({ userId: 1, leaveDate: 1 });

export default mongoose.model<ILeaveRequest>('LeaveRequest', leaveRequestSchema);


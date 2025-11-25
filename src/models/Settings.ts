import mongoose, { Document, Schema } from 'mongoose';

export interface ISettings extends Document {
  defaultCheckInTime?: string; // Format: "HH:mm", e.g., "08:00"
  defaultCheckOutTime?: string; // Format: "HH:mm", e.g., "17:00"
  allowedIPs?: string[]; // List of allowed IP addresses for check-in/check-out
  createdAt: Date;
  updatedAt: Date;
}

const settingsSchema = new Schema<ISettings>(
  {
    defaultCheckInTime: {
      type: String,
      match: [/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Định dạng thời gian không hợp lệ (HH:mm)'],
    },
    defaultCheckOutTime: {
      type: String,
      match: [/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Định dạng thời gian không hợp lệ (HH:mm)'],
    },
    allowedIPs: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one settings document exists
settingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

export default mongoose.model<ISettings>('Settings', settingsSchema);


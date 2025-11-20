import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User';
import Attendance from '../models/Attendance';

dotenv.config();

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance_system';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Attendance.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Create Admin
    const admin = await User.create({
      employeeCode: 'ADMIN001',
      name: 'Quản trị viên',
      email: 'admin@gmail.com',
      password: 'admin123',
      role: 'admin',
    });
    console.log('✅ Created admin account');

    // Create Employees
    const employees = await User.create([
      {
        employeeCode: 'NV001',
        name: 'Vũ Duy Bách',
        email: 'bach@gmail.com',
        password: 'password123',
        role: 'employee',
      },
      {
        employeeCode: 'NV002',
        name: 'Nguyễn Văn A',
        email: 'nguyenvana@company.com',
        password: 'password123',
        role: 'employee',
      },
      {
        employeeCode: 'NV003',
        name: 'Trần Thị B',
        email: 'tranthib@company.com',
        password: 'password123',
        role: 'employee',
      },
      {
        employeeCode: 'NV004',
        name: 'Lê Văn C',
        email: 'levanc@company.com',
        password: 'password123',
        role: 'employee',
      },
      {
        employeeCode: 'NV005',
        name: 'Phạm Thị D',
        email: 'phamthid@company.com',
        password: 'password123',
        role: 'employee',
      },
    ]);
    console.log(`✅ Created ${employees.length} employee accounts`);

    // Create sample attendances for the last 7 days
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      for (const employee of employees.slice(0, 3)) {
        // Only first 3 employees have records
        const checkInTime = new Date(date);
        checkInTime.setHours(8 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60));

        const checkOutTime = new Date(date);
        checkOutTime.setHours(17 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60));

        const workedHours =
          (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

        await Attendance.create({
          userId: employee._id,
          date,
          checkIn: {
            type: 'check-in',
            time: checkInTime,
            ipAddress: `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
            deviceInfo: {
              browser: 'Chrome',
              browserVersion: '120.0.0',
              os: 'Windows',
              osVersion: '10',
              device: 'Unknown',
              deviceType: 'desktop',
            },
          },
          checkOut: {
            type: 'check-out',
            time: checkOutTime,
            ipAddress: `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
            deviceInfo: {
              browser: 'Chrome',
              browserVersion: '120.0.0',
              os: 'Windows',
              osVersion: '10',
              device: 'Unknown',
              deviceType: 'desktop',
            },
          },
          workedHours,
          status: 'completed',
          hasDeviceAlert: i === 0 && employee === employees[0], // Add alert for first employee's today record
          hasIpAlert: i === 0 && employee === employees[0],
          alertMessage:
            i === 0 && employee === employees[0]
              ? 'Thiết bị khác với lần trước. Địa chỉ IP khác với lần trước.'
              : undefined,
        });
      }
    }
    console.log('✅ Created sample attendance records for the last 7 days');

    console.log('\n🎉 Database seeded successfully!\n');
    console.log('📝 Accounts created:');
    console.log('👤 Admin:');
    console.log('   Mã NV: ADMIN001');
    console.log('   Email: admin@company.com');
    console.log('   Password: admin123');
    console.log('   Đăng nhập bằng: ADMIN001 hoặc admin@company.com\n');
    console.log('👥 Employees:');
    console.log('   1. NV001 - bach@company.com - password123');
    console.log('   2. NV002 - nguyenvana@company.com - password123');
    console.log('   3. NV003 - tranthib@company.com - password123');
    console.log('   4. NV004 - levanc@company.com - password123');
    console.log('   5. NV005 - phamthid@company.com - password123');
    console.log('\n💡 Có thể đăng nhập bằng Mã NV hoặc Email\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();


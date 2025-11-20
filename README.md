# Attendance System - Backend

Backend API cho hệ thống chấm công nhân viên.

## Công nghệ sử dụng

- Node.js
- Express.js
- TypeScript
- MongoDB với Mongoose
- JWT Authentication
- bcryptjs cho mã hóa mật khẩu
- UA Parser JS cho phát hiện thiết bị

## Cài đặt

1. Cài đặt dependencies:
```bash
npm install
```

2. Tạo file `.env` từ `.env.example`:
```bash
cp .env.example .env
```

3. Cập nhật các biến môi trường trong file `.env`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/attendance_system
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRE=7d
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

## Chạy ứng dụng

### Development mode:
```bash
npm run dev
```

### Production mode:
```bash
npm run build
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Đăng ký tài khoản
- `POST /api/auth/login` - Đăng nhập
- `GET /api/auth/me` - Lấy thông tin người dùng hiện tại

### Attendance (Employee)
- `POST /api/attendance/check-in` - Check-in
- `POST /api/attendance/check-out` - Check-out
- `GET /api/attendance/today` - Lấy thông tin chấm công hôm nay
- `GET /api/attendance/history` - Lịch sử chấm công

### Admin
- `GET /api/admin/users` - Danh sách nhân viên
- `GET /api/admin/users/:id` - Chi tiết nhân viên
- `POST /api/admin/users` - Tạo nhân viên mới
- `PUT /api/admin/users/:id` - Cập nhật nhân viên
- `DELETE /api/admin/users/:id` - Xóa nhân viên
- `GET /api/admin/attendances` - Danh sách chấm công
- `GET /api/admin/attendances/today` - Chấm công hôm nay
- `GET /api/admin/attendances/stats` - Thống kê chấm công
- `GET /api/admin/notifications` - Danh sách thông báo
- `PATCH /api/admin/notifications/:id/read` - Đánh dấu đã đọc
- `PATCH /api/admin/notifications/read-all` - Đánh dấu tất cả đã đọc

## Tính năng

### Xác thực và phân quyền
- JWT-based authentication
- Role-based access control (Admin, Employee)

### Chấm công
- Check-in/Check-out
- Theo dõi thiết bị và IP
- Cảnh báo khi thiết bị hoặc IP thay đổi
- Tính toán giờ làm việc tự động

### Quản lý
- Quản lý nhân viên (CRUD)
- Theo dõi lịch sử chấm công
- Thống kê và báo cáo
- Hệ thống thông báo real-time

### Bảo mật
- Mã hóa mật khẩu với bcrypt
- JWT token authentication
- Helmet.js cho HTTP headers security
- CORS configuration

## Database Schema

### User
- name: string
- email: string (unique)
- password: string (hashed)
- role: 'admin' | 'employee'
- isActive: boolean

### Attendance
- userId: ObjectId (ref: User)
- date: Date
- checkIn: AttendanceRecord
- checkOut: AttendanceRecord
- workedHours: number
- status: 'pending' | 'completed' | 'absent'
- hasDeviceAlert: boolean
- hasIpAlert: boolean
- alertMessage: string

### Notification
- userId: ObjectId (ref: User)
- type: 'check-in' | 'check-out' | 'alert'
- title: string
- message: string
- isRead: boolean
- metadata: object




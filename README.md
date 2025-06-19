# 🚀 Personal Task Management API

> **API Fellowship Session 2 - Main Assignment**  
> A comprehensive RESTful API for personal task management with advanced analytics and reporting capabilities.

## 📋 Table of Contents

- [Features](#-features)
- [Technology Stack](#-technology-stack)
- [Quick Start](#-quick-start)
- [API Documentation](#-api-documentation)
- [Environment Setup](#-environment-setup)
- [Usage Examples](#-usage-examples)
- [Database Schema](#-database-schema)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Contributing](#-contributing)

## ✨ Features

### Core Functionality
- ✅ **Complete CRUD Operations** - Create, read, update, and delete tasks, users, and categories
- 🔍 **Advanced Filtering & Search** - Filter by status, priority, category, assignee, and search terms
- 📄 **Pagination & Sorting** - Efficient data handling with customizable pagination and sorting
- 🏷️ **Task Categorization** - Organize tasks with color-coded categories and icons
- ⏰ **Due Date Management** - Track deadlines and identify overdue tasks
- 🎯 **Priority System** - High, medium, and low priority task management

### Analytics & Reporting
- 📊 **Dashboard Analytics** - Comprehensive overview of task statistics and performance
- 📈 **User Performance Tracking** - Individual user productivity metrics and trends
- 📉 **Task Trends Analysis** - Historical data analysis and productivity insights
- 📋 **Export Capabilities** - Export analytics data in JSON/CSV formats
- 🔄 **Real-time Statistics** - Live updates on task completion rates and efficiency

### Security & Performance
- 🔒 **Input Validation** - Comprehensive request validation using express-validator
- 🛡️ **Security Headers** - Enhanced security with Helmet.js
- ⚡ **Rate Limiting** - Protection against API abuse
- 🗜️ **Response Compression** - Optimized data transfer with gzip compression
- 🚀 **MongoDB Aggregations** - High-performance database queries

## 🛠 Technology Stack

### Backend
- **Node.js** - JavaScript runtime environment
- **Express.js** - Web application framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB object modeling

### Dependencies
- **express-validator** - Request validation
- **helmet** - Security middleware
- **cors** - Cross-origin resource sharing
- **compression** - Response compression
- **morgan** - HTTP request logger
- **express-rate-limit** - Rate limiting middleware
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT authentication
- **dotenv** - Environment variable management

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local installation or MongoDB Atlas)
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd api-fellowship-session2
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start MongoDB** (if running locally)
   ```bash
   mongod
   ```

5. **Run the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

6. **Verify installation**
   ```bash
   curl http://localhost:5000/health
   ```

## 📚 API Documentation

### Base URL
```
http://localhost:5000/api/v1
```

### Authentication
Most endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Available Endpoints

#### 📋 Tasks
- `GET /tasks` - Get all tasks with filtering and pagination
- `GET /tasks/:id` - Get single task by ID
- `POST /tasks` - Create new task
- `PUT /tasks/:id` - Update existing task
- `DELETE /tasks/:id` - Delete task
- `PATCH /tasks/:id/status` - Update task status

#### 👥 Users
- `GET /users` - Get all users
- `GET /users/:id` - Get single user
- `POST /users/register` - Register new user
- `POST /users/login` - User login
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Soft delete user
- `GET /users/:id/profile` - Get user profile with stats

#### 🏷️ Categories
- `GET /categories` - Get all categories
- `GET /categories/:id` - Get single category
- `POST /categories` - Create new category
- `PUT /categories/:id` - Update category
- `DELETE /categories/:id` - Delete category
- `PATCH /categories/:id/toggle` - Toggle category status
- `GET /categories/:id/tasks` - Get tasks in category

#### 📊 Analytics
- `GET /analytics/dashboard` - Dashboard overview
- `GET /analytics/tasks` - Task analytics
- `GET /analytics/users/:id` - User performance analytics
- `GET /analytics/reports/export` - Export analytics data

### Query Parameters

#### Pagination
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)

#### Filtering
- `status` - Filter by status (pending, in-progress, completed, cancelled)
- `priority` - Filter by priority (low, medium, high)
- `category` - Filter by category ID
- `assignedTo` - Filter by assigned user ID
- `search` - Search in title and description
- `overdue` - Filter overdue tasks (true/false)

#### Sorting
- `sortBy` - Field to sort by (default: createdAt)
- `sortOrder` - Sort direction (asc, desc)

## 🔧 Environment Setup

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/task-management

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

## 💡 Usage Examples

### Creating a User
```bash
curl -X POST http://localhost:5000/api/v1/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "securePassword123",
    "role": "user"
  }'
```

### Creating a Category
```bash
curl -X POST http://localhost:5000/api/v1/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "name": "Work",
    "description": "Work-related tasks",
    "color": "#3498db",
    "icon": "briefcase",
    "createdBy": "<user-id>"
  }'
```

### Creating a Task
```bash
curl -X POST http://localhost:5000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "title": "Complete API Documentation",
    "description": "Write comprehensive API documentation",
    "priority": "high",
    "status": "pending",
    "dueDate": "2024-01-15T09:00:00.000Z",
    "estimatedHours": 4,
    "category": "<category-id>",
    "assignedTo": "<user-id>"
  }'
```

### Getting Analytics Dashboard
```bash
curl -X GET "http://localhost:5000/api/v1/analytics/dashboard?timeframe=30d" \
  -H "Authorization: Bearer <your-jwt-token>"
```

## 🗄️ Database Schema

### User Schema
```javascript
{
  name: String (required),
  email: String (required, unique),
  password: String (required, hashed),
  role: String (enum: user, admin, manager),
  avatar: String (URL),
  department: String,
  phoneNumber: String,
  isActive: Boolean (default: true),
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Task Schema
```javascript
{
  title: String (required),
  description: String,
  status: String (enum: pending, in-progress, completed, cancelled),
  priority: String (enum: low, medium, high),
  dueDate: Date,
  estimatedHours: Number,
  actualHours: Number,
  category: ObjectId (ref: Category),
  assignedTo: ObjectId (ref: User),
  tags: [String],
  attachments: [String],
  createdBy: ObjectId (ref: User),
  createdAt: Date,
  updatedAt: Date
}
```

### Category Schema
```javascript
{
  name: String (required, unique),
  description: String,
  color: String (hex color),
  icon: String,
  isActive: Boolean (default: true),
  createdBy: ObjectId (ref: User),
  createdAt: Date,
  updatedAt: Date
}
```

## 🧪 Testing

### Manual Testing
1. **Health Check**
   ```bash
   curl http://localhost:5000/health
   ```

2. **API Documentation**
   ```bash
   curl http://localhost:5000/api/docs
   ```

3. **Test Complete Workflow**
   - Register a user
   - Login to get JWT token
   - Create a category
   - Create a task
   - View analytics dashboard

### Sample Test Data
Use the following test data to populate your database:

```bash
# Create test user
curl -X POST http://localhost:5000/api/v1/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "testPassword123"
  }'

# Login to get token
curl -X POST http://localhost:5000/api/v1/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testPassword123"
  }'
```

## 🚀 Deployment

### Local Deployment
```bash
npm start
```

### Docker Deployment
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

### Environment Variables for Production
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/task-management
JWT_SECRET=your-production-jwt-secret
ALLOWED_ORIGINS=https://yourdomain.com
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is part of the API Fellowship Session 2 assignment.

## 🙏 Acknowledgments

- **API Fellowship Program** - For providing the learning opportunity
- **Node.js & Express.js** - For the robust backend framework
- **MongoDB** - For the flexible NoSQL database solution

## 📞 Support

For support and questions:
- Create an issue in the repository
- Contact the API Fellowship community

---

**Happy Task Managing! 🎯** 
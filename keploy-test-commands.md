# Keploy API Testing Commands

This file contains sample cURL commands for testing the Personal Task Management API with Keploy.

## Prerequisites
1. Start your server: `npm start` or `npm run dev`
2. Ensure MongoDB is running
3. Server should be accessible at `http://localhost:5000`

## Health Check
```bash
curl -X GET "http://localhost:5000/health" \
  -H "Content-Type: application/json"
```

## User Management

### Register New User
```bash
curl -X POST "http://localhost:5000/api/v1/users/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john.doe@example.com",
    "password": "securepassword123",
    "role": "user",
    "department": "Engineering"
  }'
```

### User Login
```bash
curl -X POST "http://localhost:5000/api/v1/users/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "securepassword123"
  }'
```

### Get All Users
```bash
curl -X GET "http://localhost:5000/api/v1/users?page=1&limit=10" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get User by ID
```bash
curl -X GET "http://localhost:5000/api/v1/users/USER_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Category Management

### Create Category
```bash
curl -X POST "http://localhost:5000/api/v1/categories" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Development",
    "description": "Software development tasks",
    "color": "#3498db",
    "icon": "code"
  }'
```

### Get All Categories
```bash
curl -X GET "http://localhost:5000/api/v1/categories" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Task Management

### Create Task
```bash
curl -X POST "http://localhost:5000/api/v1/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "Implement API Documentation",
    "description": "Create comprehensive OpenAPI documentation for the task management API",
    "priority": "high",
    "status": "pending",
    "category": "CATEGORY_ID",
    "assignedTo": "USER_ID",
    "dueDate": "2024-07-15T10:00:00.000Z",
    "estimatedHours": 8,
    "tags": ["documentation", "api", "swagger"]
  }'
```

### Get All Tasks
```bash
curl -X GET "http://localhost:5000/api/v1/tasks?page=1&limit=10&status=pending&priority=high" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get Task by ID
```bash
curl -X GET "http://localhost:5000/api/v1/tasks/TASK_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Update Task
```bash
curl -X PUT "http://localhost:5000/api/v1/tasks/TASK_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "Implement API Documentation - Updated",
    "status": "in-progress",
    "actualHours": 4
  }'
```

### Delete Task
```bash
curl -X DELETE "http://localhost:5000/api/v1/tasks/TASK_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Habit Management

### Create Habit
```bash
curl -X POST "http://localhost:5000/api/v1/habits" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Morning Exercise",
    "description": "30 minutes of morning workout",
    "frequency": "daily",
    "target": 30,
    "unit": "minutes",
    "user": "USER_ID"
  }'
```

### Get All Habits
```bash
curl -X GET "http://localhost:5000/api/v1/habits" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Gamification

### Get User Gamification Data
```bash
curl -X GET "http://localhost:5000/api/v1/gamification/USER_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## AI Recommendations

### Get AI Task Recommendations
```bash
curl -X GET "http://localhost:5000/api/v1/ai/recommendations/USER_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Error Scenarios to Test

### Invalid Login
```bash
curl -X POST "http://localhost:5000/api/v1/users/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "wrong@example.com",
    "password": "wrongpassword"
  }'
```

### Create Task with Missing Required Fields
```bash
curl -X POST "http://localhost:5000/api/v1/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "Incomplete Task"
  }'
```

### Access Protected Route without Token
```bash
curl -X GET "http://localhost:5000/api/v1/tasks" \
  -H "Content-Type: application/json"
```

### Get Non-existent Resource
```bash
curl -X GET "http://localhost:5000/api/v1/tasks/507f1f77bcf86cd799439011" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Testing Workflow

1. **Start with Health Check** to ensure API is running
2. **Register a new user** to get valid credentials
3. **Login** to get JWT token for authenticated requests
4. **Create categories** before creating tasks
5. **Create, read, update, delete tasks** to test CRUD operations
6. **Test error scenarios** to ensure proper error handling
7. **Test gamification and AI features** for advanced functionality

## Notes for Keploy Testing

- Replace `YOUR_JWT_TOKEN` with actual JWT token from login response
- Replace `USER_ID`, `TASK_ID`, `CATEGORY_ID` with actual IDs from API responses
- Ensure MongoDB is running and accessible
- Test both success and error scenarios for comprehensive coverage
- Use different parameter combinations for thorough testing 
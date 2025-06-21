# 🚀 AI-Powered Task Management API

> **Built by Anurag Dey (@anuragcode-16) for Keploy API Fellowship Session 2**  
> An intelligent, gamified task management system with AI recommendations, habit tracking, and advanced analytics.

[![GitHub Profile](https://img.shields.io/badge/GitHub-anuragcode--16-blue?logo=github)](https://github.com/anuragcode-16)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.0+-green?logo=mongodb)](https://mongodb.com/)
[![Express.js](https://img.shields.io/badge/Express.js-4.18+-lightgrey?logo=express)](https://expressjs.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🌟 Unique Features That Set This API Apart

### 🤖 AI-Powered Recommendations 
- **Smart Task Suggestions**: AI analyzes your productivity patterns and suggests optimal tasks
- **Time-Based Intelligence**: Recommendations based on your most productive hours
- **Pattern Recognition**: Learns from your completion patterns to suggest similar tasks
- **Streak Optimization**: AI helps maintain and extend your productivity streaks

### 🎮 Gamification System
- **XP & Leveling**: Earn experience points for every completed task and habit
- **Achievement System**: Unlock badges and achievements for various milestones
- **Streak Tracking**: Monitor daily task completion and habit streaks
- **Leaderboards**: Compare your progress with other users
- **Rarity System**: Collect common, rare, epic, and legendary badges

### 📊 Advanced Habit Tracking
- **Smart Streaks**: Automatic streak calculation with longest streak records
- **Category-Based Habits**: Organize habits by health, productivity, learning, etc.
- **Difficulty Scaling**: Different XP rewards based on habit difficulty
- **Completion Analytics**: Detailed statistics and completion rates
- **Progress Visualization**: Track your habit completion patterns

### 🔔 Intelligent Automation
- **Automated Daily Tasks**: Cron jobs for daily gamification updates
- **Smart Reminders**: AI-powered recommendation generation
- **Progress Tracking**: Automatic XP and achievement calculations

## 📋 Table of Contents

- [🚀 Quick Start](#-quick-start)
- [🛠 Technology Stack](#-technology-stack)
- [📚 API Documentation](#-api-documentation)
- [🤖 AI Features](#-ai-features)
- [🎮 Gamification](#-gamification)
- [📊 Habit Tracking](#-habit-tracking)
- [💡 Usage Examples](#-usage-examples)
- [🔧 Environment Setup](#-environment-setup)
- [🧪 Testing](#-testing)
- [🚀 Deployment](#-deployment)

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local installation or MongoDB Atlas)
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/anuragcode-16/ai-powered-task-management-api.git
   cd ai-powered-task-management-api
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

## 🛠 Technology Stack

### Backend Core
- **Node.js 18+** - JavaScript runtime environment
- **Express.js 4.18+** - Web application framework
- **MongoDB 6.0+** - NoSQL database with advanced aggregations
- **Mongoose** - ODM with custom methods and virtuals

### AI & Intelligence
- **Custom AI Engine** - Pattern recognition algorithms
- **Node-Cron** - Automated scheduling and background tasks
- **Statistical Analysis** - Advanced data processing
- **Predictive Modeling** - User behavior prediction

### Performance & Security
- **Helmet.js** - Advanced security headers
- **Rate Limiting** - Intelligent API protection
- **Compression** - Response optimization
- **Input Validation** - Comprehensive request sanitization
- **JWT Authentication** - Secure token-based auth

## 📚 API Documentation

### Base URL
```
http://localhost:5000/api/v1
```

### 🎯 Core Endpoints

#### 📋 Tasks
- `GET /tasks` - Get all tasks with advanced filtering and AI insights
- `GET /tasks/:id` - Get single task with recommendations
- `POST /tasks` - Create task (automatically awards XP)
- `PUT /tasks/:id` - Update task with gamification tracking
- `DELETE /tasks/:id` - Delete task
- `PATCH /tasks/:id/status` - Update status (updates streaks)

#### 👥 Users
- `GET /users` - Get all users with gamification stats
- `POST /users/register` - Register user (creates gamification profile)
- `POST /users/login` - User login (updates login streak)
- `GET /users/:id/profile` - Get comprehensive user profile

#### 🤖 AI Recommendations
- `GET /ai/recommendations/:userId` - Get personalized task recommendations
  - Time-based suggestions
  - Pattern recognition recommendations
  - Streak optimization suggestions
  - Category-based recommendations

#### 🎮 Gamification
- `GET /gamification/:userId` - Get user's gamification profile
- `POST /gamification/:userId/experience` - Add experience points
- `GET /gamification/leaderboard/all` - Get global leaderboard
- `GET /gamification/achievements/all` - Get all achievements
- `POST /gamification/:userId/streak/:type` - Update streaks

#### 📊 Habits
- `GET /habits` - Get all habits with analytics
- `POST /habits` - Create habit (awards XP for creation)
- `POST /habits/:id/complete` - Complete habit (XP + streak update)
- `GET /habits/:id/stats` - Get detailed habit statistics

## 🤖 AI Features

### Smart Recommendation Engine

The AI analyzes user patterns and provides intelligent suggestions:

```javascript
// Example AI Response
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "type": "time-based",
        "title": "Morning Focus Session",
        "reason": "Most productive hours for deep work",
        "priority": "high",
        "estimatedTime": 120
      },
      {
        "type": "streak",
        "title": "Keep Your Streak Going!",
        "reason": "You have a 7-day task completion streak",
        "priority": "high",
        "xpBonus": 50
      }
    ],
    "generatedAt": "2024-01-15T09:00:00.000Z",
    "aiVersion": "1.0.0"
  }
}
```

### Pattern Recognition
- **Productivity Patterns**: Identifies your most productive hours
- **Completion Analysis**: Analyzes task completion times and success rates
- **Category Intelligence**: Suggests tasks based on your expertise areas
- **Difficulty Optimization**: Recommends appropriate challenge levels

## 🎮 Gamification

### Experience Points System
- **Task Completion**: 10-50 XP based on priority and difficulty
- **Habit Completion**: 5-20 XP based on habit difficulty
- **Streak Bonuses**: Additional XP for maintaining streaks
- **Achievement Unlocks**: Bonus XP for milestone achievements

### Level Progression
```javascript
// Gamification Profile Example
{
  "level": 15,
  "experience": {
    "total": 2547,
    "current": 247,
    "toNextLevel": 400
  },
  "rank": "Advanced",
  "levelProgress": 62,
  "achievements": 12,
  "badges": [
    {
      "name": "Week Warrior",
      "rarity": "epic",
      "earnedAt": "2024-01-10T00:00:00.000Z"
    }
  ]
}
```

### Achievement Categories
- **Tasks**: First Task, Task Master, Lightning Fast
- **Habits**: Habit Starter, Streak Keeper, Lifestyle Changer
- **Streaks**: Week Warrior, Month Master, Year Legend
- **Social**: Team Player, Mentor, Community Leader
- **Time**: Early Bird, Night Owl, Time Master
- **Special**: Perfect Week, Comeback King, Overachiever

## 📊 Habit Tracking

### Smart Habit System

```javascript
// Habit Creation Example
{
  "title": "Daily Code Review",
  "category": "productivity",
  "frequency": "daily",
  "targetCount": 1,
  "unit": "session",
  "difficulty": "medium",
  "rewards": {
    "points": 10
  }
}
```

### Habit Categories
- **Health**: Exercise, nutrition, wellness
- **Productivity**: Learning, skill development
- **Fitness**: Workouts, sports activities
- **Mindfulness**: Meditation, reflection
- **Learning**: Study sessions, reading
- **Social**: Networking, relationships

### Advanced Analytics
```javascript
// Habit Statistics
{
  "totalCompletions": 45,
  "currentStreak": 12,
  "longestStreak": 23,
  "completionRate": 87,
  "totalPointsEarned": 450,
  "weeklyAverage": 6.2
}
```

## 💡 Usage Examples

### 1. Register User & Get Gamification Profile
```bash
# Register user
curl -X POST http://localhost:5000/api/v1/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Anurag Dey",
    "email": "anurag@example.com",
    "password": "securepass123"
  }'

# Get gamification profile (auto-created)
curl http://localhost:5000/api/v1/gamification/USER_ID
```

### 2. Create Task with XP Rewards
```bash
curl -X POST http://localhost:5000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Build AI Recommendation Engine",
    "description": "Implement machine learning for task suggestions",
    "priority": "high",
    "dueDate": "2024-01-25T18:00:00.000Z",
    "estimatedHours": 8,
    "assignedTo": "USER_ID",
    "category": "CATEGORY_ID"
  }'
```

### 3. Create and Complete Habit
```bash
# Create habit
curl -X POST http://localhost:5000/api/v1/habits \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Morning Coding Session",
    "category": "productivity",
    "targetCount": 1,
    "unit": "session",
    "difficulty": "medium",
    "user": "USER_ID"
  }'

# Complete habit (earns XP and updates streak)
curl -X POST http://localhost:5000/api/v1/habits/HABIT_ID/complete \
  -H "Content-Type: application/json" \
  -d '{"count": 1}'
```

### 4. Get AI Recommendations
```bash
curl http://localhost:5000/api/v1/ai/recommendations/USER_ID
```

### 5. Check Leaderboard
```bash
curl http://localhost:5000/api/v1/gamification/leaderboard/all?limit=10
```

## 🔧 Environment Setup

Create a `.env` file:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/ai-task-management

# Security
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# Features
AI_RECOMMENDATIONS_ENABLED=true
GAMIFICATION_ENABLED=true
DAILY_INSIGHTS_ENABLED=true

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000
```

## 🧪 Testing

### Health Check
```bash
curl http://localhost:5000/health
```

### Feature Testing
```bash
# Test AI recommendations
curl http://localhost:5000/api/v1/ai/recommendations/USER_ID

# Test gamification
curl http://localhost:5000/api/v1/gamification/USER_ID

# Test habit completion
curl -X POST http://localhost:5000/api/v1/habits/HABIT_ID/complete \
  -H "Content-Type: application/json" \
  -d '{"count": 1}'
```

## 🚀 Deployment

### Production Environment
```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ai-task-management
JWT_SECRET=production-secret-key
ALLOWED_ORIGINS=https://your-domain.com
```

### Deployment Platforms
- **Railway** - Recommended for easy MongoDB integration
- **Heroku** - Classic platform with MongoDB Atlas
- **DigitalOcean** - App Platform deployment
- **Vercel** - Serverless deployment option

## 🎯 What Makes This API Unique

### 1. **Artificial Intelligence**
- Custom recommendation engine
- Pattern recognition algorithms
- Predictive productivity analytics

### 2. **Gamification**
- Complete XP/level system
- Achievement unlocking
- Streak tracking across multiple categories

### 3. **Habit Formation**
- Scientific approach to habit building
- Comprehensive progress tracking
- Difficulty-based reward system

### 4. **Advanced Analytics**
- Real-time productivity insights
- Historical trend analysis
- Performance optimization suggestions

### 5. **Automation**
- Scheduled background tasks
- Automatic XP calculations
- Smart notification system

## 👨‍💻 About the Developer

**Anurag Dey (@anuragcode-16)**
- 🔭 Currently working on innovative backend solutions
- 🌱 Learning advanced Node.js, Python, and AI/ML
- 💬 Ask me about API development, databases, and system architecture
- 📫 Connect: [GitHub Profile](https://github.com/anuragcode-16)

## 🏆 Achievements Unlocked
- ✅ Built comprehensive REST API with 25+ endpoints
- ✅ Implemented AI recommendation system
- ✅ Created full gamification system with XP/levels
- ✅ Developed habit tracking with streak analytics
- ✅ Added automated background processing
- ✅ Integrated advanced security and validation

---

**Built with ❤️ by Anurag Dey for the Keploy API Fellowship Program**

*Ready to revolutionize productivity management? Experience the future of task management with AI-powered insights and gamified engagement!* 🚀 
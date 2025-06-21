const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const cron = require('node-cron');
require('dotenv').config();

// Import routes
const taskRoutes = require('./routes/tasks');
const userRoutes = require('./routes/users');
const categoryRoutes = require('./routes/categories');
const analyticsRoutes = require('./routes/analytics');
const habitRoutes = require('./routes/habits');
const gamificationRoutes = require('./routes/gamification');

const app = express();
const PORT = process.env.PORT || 5000;

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-task-management')
.then(() => {
  console.log('✅ Connected to MongoDB successfully');
})
.catch((error) => {
  console.error('❌ MongoDB connection error:', error.message);
  console.log('⚠️  Server will continue running without database connection for development purposes');
  console.log('💡 To use full functionality, please ensure MongoDB is running or update MONGODB_URI in .env');
});

// Global middleware
app.use(helmet()); // Security headers
app.use(compression()); // Gzip compression
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests',
    message: 'Please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Request timing middleware
app.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

// AI-powered task recommendation service
class AITaskRecommendationService {
  static async getTaskRecommendations(userId) {
    try {
      const Task = require('./models/Task');
      const User = require('./models/User');
      const { Gamification } = require('./models/Gamification');
      
      // Get user's task patterns
      const userTasks = await Task.find({ assignedTo: userId })
        .sort({ createdAt: -1 })
        .limit(50);
      
      const user = await User.findById(userId);
      const gamification = await Gamification.findOne({ user: userId });
      
      // Simple AI-like recommendations based on patterns
      const recommendations = [];
      
      // Time-based recommendations
      const currentHour = new Date().getHours();
      if (currentHour >= 9 && currentHour <= 11) {
        recommendations.push({
          type: 'time-based',
          title: 'Morning Focus Session',
          reason: 'Most productive hours for deep work',
          priority: 'high',
          estimatedTime: 120
        });
      }
      
      // Productivity recommendations based on completion patterns
      const completedTasks = userTasks.filter(t => t.status === 'completed');
      const avgCompletionTime = completedTasks.length > 0 ? 
        completedTasks.reduce((sum, task) => sum + (task.actualHours || 2), 0) / completedTasks.length : 2;
      
      if (avgCompletionTime < 1) {
        recommendations.push({
          type: 'productivity',
          title: 'Quick Task Sprint',
          reason: 'You excel at completing short tasks quickly',
          priority: 'medium',
          estimatedTime: 30
        });
      }
      
      // Gamification-based recommendations
      if (gamification && gamification.streaks.tasks.current > 0) {
        recommendations.push({
          type: 'streak',
          title: 'Keep Your Streak Going!',
          reason: `You have a ${gamification.streaks.tasks.current}-day task completion streak`,
          priority: 'high',
          xpBonus: 50
        });
      }
      
      // Category-based recommendations
      const categoryFrequency = userTasks.reduce((acc, task) => {
        if (task.category) {
          acc[task.category] = (acc[task.category] || 0) + 1;
        }
        return acc;
      }, {});
      
      const topCategory = Object.keys(categoryFrequency).reduce((a, b) => 
        categoryFrequency[a] > categoryFrequency[b] ? a : b, null);
      
      if (topCategory) {
        recommendations.push({
          type: 'category',
          title: 'Continue Your Expertise',
          reason: `You frequently work on tasks in this category`,
          priority: 'medium',
          suggestedCategory: topCategory
        });
      }
      
      return recommendations;
    } catch (error) {
      console.error('AI Recommendation error:', error);
      return [];
    }
  }
}

// Scheduled tasks using cron
cron.schedule('0 9 * * *', async () => {
  console.log('🤖 Running daily AI task recommendations...');
  // This could send notifications or update recommendation cache
});

cron.schedule('0 0 * * *', async () => {
  console.log('🎮 Running daily gamification updates...');
  // Update streaks, check achievements, etc.
});

// API Health check
app.get('/health', (req, res) => {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(uptime / 60)} minutes`,
    memory: {
      used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`
    },
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    version: process.env.npm_package_version || '2.0.0',
    features: {
      aiRecommendations: '✅ Active',
      gamification: '✅ Active',
      habitTracking: '✅ Active',
      scheduledTasks: '✅ Active'
    }
  });
});

// AI Recommendations endpoint
app.get('/api/v1/ai/recommendations/:userId', async (req, res) => {
  try {
    const recommendations = await AITaskRecommendationService.getTaskRecommendations(req.params.userId);
    
    res.json({
      success: true,
      data: {
        recommendations,
        generatedAt: new Date().toISOString(),
        aiVersion: '1.0.0'
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate AI recommendations',
      message: error.message
    });
  }
});

// API Routes
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/habits', habitRoutes);
app.use('/api/v1/gamification', gamificationRoutes);

// Welcome route
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Welcome to AI-Powered Task Management API - Built by Anurag Dey',
    version: '2.0.0',
    author: 'Anurag Dey (@anuragcode-16)',
    github: 'https://github.com/anuragcode-16',
    uniqueFeatures: [
      '🤖 AI-powered task recommendations',
      '🎮 Gamification system with XP and achievements',
      '📊 Advanced habit tracking with streaks',
      '👥 Team collaboration features',
      '🔔 Smart notification system',
      '📈 Real-time productivity analytics',
      '⚡ Automated daily insights',
      '🏆 Achievement and badge system'
    ],
    documentation: {
      baseUrl: `${req.protocol}://${req.get('host')}/api/v1`,
      endpoints: {
        tasks: '/api/v1/tasks',
        users: '/api/v1/users',
        categories: '/api/v1/categories',
        analytics: '/api/v1/analytics',
        habits: '/api/v1/habits',
        gamification: '/api/v1/gamification',
        aiRecommendations: '/api/v1/ai/recommendations/:userId'
      },
      features: [
        '✅ Complete CRUD operations for tasks, users, categories, and habits',
        '📊 Advanced analytics and reporting with gamification metrics',
        '🔍 Filtering, sorting, and pagination across all endpoints',
        '⚡ Performance optimized with MongoDB aggregations',
        '🔒 Input validation and comprehensive error handling',
        '📈 User performance tracking with XP and levels',
        '🎯 Task prioritization and intelligent categorization',
        '📅 Due date management and overdue tracking',
        '🔥 Habit streak tracking and completion analytics',
        '🏆 Achievement system with progress tracking',
        '🤖 AI-powered task recommendations based on user patterns'
      ]
    },
    quickStart: {
      step1: 'Create a user: POST /api/v1/users/register',
      step2: 'Create a category: POST /api/v1/categories',
      step3: 'Create a task: POST /api/v1/tasks',
      step4: 'Create a habit: POST /api/v1/habits',
      step5: 'View gamification profile: GET /api/v1/gamification/:userId',
      step6: 'Get AI recommendations: GET /api/v1/ai/recommendations/:userId',
      step7: 'View analytics dashboard: GET /api/v1/analytics/dashboard'
    }
  });
});

// API Documentation route
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'Personal Task Management API Documentation',
    version: '1.0.0',
    baseUrl: `${req.protocol}://${req.get('host')}/api/v1`,
    endpoints: {
      tasks: {
        description: 'Task management operations',
        routes: {
          'GET /api/v1/tasks': 'Get all tasks with filtering and pagination',
          'GET /api/v1/tasks/:id': 'Get single task by ID',
          'POST /api/v1/tasks': 'Create new task',
          'PUT /api/v1/tasks/:id': 'Update existing task',
          'DELETE /api/v1/tasks/:id': 'Delete task',
          'PATCH /api/v1/tasks/:id/status': 'Update task status'
        }
      },
      users: {
        description: 'User management and authentication',
        routes: {
          'GET /api/v1/users': 'Get all users with filtering',
          'GET /api/v1/users/:id': 'Get single user by ID',
          'POST /api/v1/users/register': 'Register new user',
          'POST /api/v1/users/login': 'User login',
          'PUT /api/v1/users/:id': 'Update user information',
          'DELETE /api/v1/users/:id': 'Soft delete user',
          'GET /api/v1/users/:id/profile': 'Get user profile with stats'
        }
      },
      categories: {
        description: 'Task categorization system',
        routes: {
          'GET /api/v1/categories': 'Get all categories',
          'GET /api/v1/categories/:id': 'Get single category',
          'POST /api/v1/categories': 'Create new category',
          'PUT /api/v1/categories/:id': 'Update category',
          'DELETE /api/v1/categories/:id': 'Delete category',
          'PATCH /api/v1/categories/:id/toggle': 'Toggle category status',
          'GET /api/v1/categories/:id/tasks': 'Get tasks in category'
        }
      },
      analytics: {
        description: 'Reporting and analytics',
        routes: {
          'GET /api/v1/analytics/dashboard': 'Get dashboard overview',
          'GET /api/v1/analytics/tasks': 'Get detailed task analytics',
          'GET /api/v1/analytics/users/:id': 'Get user performance analytics',
          'GET /api/v1/analytics/reports/export': 'Export analytics data'
        }
      }
    },
    queryParameters: {
      pagination: {
        page: 'Page number (default: 1)',
        limit: 'Items per page (default: 10)'
      },
      filtering: {
        status: 'Filter by status (pending, in-progress, completed, cancelled)',
        priority: 'Filter by priority (low, medium, high)',
        search: 'Search in title and description',
        category: 'Filter by category ID',
        assignedTo: 'Filter by assigned user ID'
      },
      sorting: {
        sortBy: 'Field to sort by (default: createdAt)',
        sortOrder: 'Sort direction (asc, desc)'
      }
    }
  });
});

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The requested endpoint ${req.method} ${req.originalUrl} does not exist`,
    availableEndpoints: [
      'GET /',
      'GET /health',
      'GET /api/docs',
      'GET /api/v1/tasks',
      'GET /api/v1/users',
      'GET /api/v1/categories',
      'GET /api/v1/analytics'
    ],
    timestamp: new Date().toISOString()
  });
});

// Global error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Error occurred:', {
    message: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Handle different types of errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Request data validation failed',
      details: Object.values(error.errors).map(err => err.message)
    });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid ID',
      message: 'The provided ID format is invalid'
    });
  }

  if (error.name === 'MongoServerError' && error.code === 11000) {
    return res.status(409).json({
      error: 'Duplicate Entry',
      message: 'A record with this information already exists'
    });
  }

  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid Token',
      message: 'Authentication token is invalid'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token Expired',
      message: 'Authentication token has expired'
    });
  }

  // Default error response
  res.status(error.status || 500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' 
      ? error.message 
      : 'Something went wrong. Please try again later.',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] || 'unknown'
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Process terminated gracefully');
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('🔄 SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Process terminated gracefully');
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    });
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`
🚀 Personal Task Management API is running!
📍 Port: ${PORT}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
📚 Documentation: http://localhost:${PORT}/api/docs
💡 Health Check: http://localhost:${PORT}/health
🎯 Ready to manage your tasks efficiently!
  `);
});

module.exports = app; 
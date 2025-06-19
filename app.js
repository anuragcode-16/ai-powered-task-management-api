const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

// Import routes
const taskRoutes = require('./routes/tasks');
const userRoutes = require('./routes/users');
const categoryRoutes = require('./routes/categories');
const analyticsRoutes = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 5000;

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/task-management')
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
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API Routes
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/analytics', analyticsRoutes);

// Welcome route
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Welcome to Personal Task Management API',
    version: '1.0.0',
    author: 'API Fellowship Session 2',
    documentation: {
      baseUrl: `${req.protocol}://${req.get('host')}/api/v1`,
      endpoints: {
        tasks: '/api/v1/tasks',
        users: '/api/v1/users',
        categories: '/api/v1/categories',
        analytics: '/api/v1/analytics'
      },
      features: [
        '✅ Complete CRUD operations for tasks, users, and categories',
        '📊 Advanced analytics and reporting',
        '🔍 Filtering, sorting, and pagination',
        '⚡ Performance optimized with MongoDB aggregations',
        '🔒 Input validation and error handling',
        '📈 User performance tracking',
        '🎯 Task prioritization and categorization',
        '📅 Due date management and overdue tracking'
      ]
    },
    quickStart: {
      step1: 'Create a user: POST /api/v1/users/register',
      step2: 'Create a category: POST /api/v1/categories',
      step3: 'Create a task: POST /api/v1/tasks',
      step4: 'View analytics: GET /api/v1/analytics/dashboard'
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
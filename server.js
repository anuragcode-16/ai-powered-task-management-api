const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

// Import routes
const taskRoutes = require('./routes/tasks');
const userRoutes = require('./routes/users');
const categoryRoutes = require('./routes/categories');
const analyticsRoutes = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/task-management-db', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ Connected to MongoDB successfully!');
})
.catch((error) => {
  console.error('❌ MongoDB connection error:', error);
  process.exit(1);
});

// Routes
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/analytics', analyticsRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Welcome to AI-Powered Task Management API - Built by Anurag Dey',
    version: '2.0.0',
    author: 'Anurag Dey (@anuragcode-16)',
    github: 'https://github.com/anuragcode-16',
    uniqueFeatures: [
      '🤖 AI-powered task recommendations',
      '🎮 Gamification system with XP and achievements',
      '📊 Advanced habit tracking',
      '👥 Team collaboration features',
      '🔔 Smart notification system',
      '📈 Real-time productivity analytics'
    ],
    endpoints: {
      tasks: '/api/v1/tasks',
      users: '/api/v1/users',
      categories: '/api/v1/categories',
      analytics: '/api/v1/analytics',
      habits: '/api/v1/habits',
      gamification: '/api/v1/gamification',
      collaboration: '/api/v1/collaboration'
    },
    documentation: 'Check README.md for detailed API documentation'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The endpoint ${req.originalUrl} does not exist`,
    availableEndpoints: [
      '/api/v1/tasks',
      '/api/v1/users', 
      '/api/v1/categories',
      '/api/v1/analytics'
    ]
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('❌ Error:', error);
  res.status(error.status || 500).json({
    error: error.message || 'Internal Server Error',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Task Management API server is running on port ${PORT}`);
  console.log(`📖 API Documentation: http://localhost:${PORT}/`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
}); 
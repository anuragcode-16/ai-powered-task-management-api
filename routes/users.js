const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// Validation middleware
const validateUser = [
  body('name').trim().isLength({ min: 1, max: 50 }).withMessage('Name must be 1-50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['user', 'admin', 'manager']).withMessage('Invalid role'),
  body('phoneNumber').optional().isMobilePhone().withMessage('Invalid phone number format')
];

const validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
];

// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Helper function to generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'fallback-secret', { expiresIn: '7d' });
};

// GET /api/v1/users - Get all users with filtering
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      role,
      department,
      isActive,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    if (role) filter.role = role;
    if (department) filter.department = department;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get users (exclude password)
    const users = await User.find(filter)
      .select('-password')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalUsers = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalUsers / parseInt(limit));

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalUsers,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch users',
      message: error.message
    });
  }
});

// GET /api/v1/users/:id - Get single user by ID
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: `No user found with ID: ${req.params.id}`
      });
    }

    res.json({
      success: true,
      data: user
    });

  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'Invalid user ID format',
        message: 'The provided ID is not a valid MongoDB ObjectId'
      });
    }
    res.status(500).json({
      error: 'Failed to fetch user',
      message: error.message
    });
  }
});

// POST /api/v1/users/register - Register new user
router.post('/register', validateUser, handleValidationErrors, async (req, res) => {
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'A user with this email already exists'
      });
    }

    // Create new user
    const user = new User(req.body);
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: userResponse,
        token
      }
    });

  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: Object.values(error.errors).map(err => err.message)
      });
    }
    res.status(500).json({
      error: 'Failed to register user',
      message: error.message
    });
  }
});

// POST /api/v1/users/login - User login
router.post('/login', validateLogin, handleValidationErrors, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user and include password for comparison
    const user = await User.findOne({ email, isActive: true }).select('+password');
    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Update last login
    await user.updateLastLogin();

    // Generate token
    const token = generateToken(user._id);

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        token
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Login failed',
      message: error.message
    });
  }
});

// PUT /api/v1/users/:id - Update user
router.put('/:id', async (req, res) => {
  try {
    const { password, ...updateData } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: `No user found with ID: ${req.params.id}`
      });
    }

    // Check if email is being updated and if it's already taken
    if (updateData.email && updateData.email !== user.email) {
      const existingUser = await User.findOne({ email: updateData.email });
      if (existingUser) {
        return res.status(409).json({
          error: 'Email already exists',
          message: 'A user with this email already exists'
        });
      }
    }

    // Update user data
    Object.assign(user, updateData);

    // Update password if provided
    if (password) {
      user.password = password;
    }

    await user.save();

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      success: true,
      message: 'User updated successfully',
      data: userResponse
    });

  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'Invalid user ID format',
        message: 'The provided ID is not a valid MongoDB ObjectId'
      });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: Object.values(error.errors).map(err => err.message)
      });
    }
    res.status(500).json({
      error: 'Failed to update user',
      message: error.message
    });
  }
});

// DELETE /api/v1/users/:id - Delete user (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: `No user found with ID: ${req.params.id}`
      });
    }

    // Soft delete by setting isActive to false
    user.isActive = false;
    await user.save();

    res.json({
      success: true,
      message: 'User deactivated successfully',
      data: {
        deactivatedUser: {
          id: user._id,
          name: user.name,
          email: user.email
        }
      }
    });

  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'Invalid user ID format',
        message: 'The provided ID is not a valid MongoDB ObjectId'
      });
    }
    res.status(500).json({
      error: 'Failed to deactivate user',
      message: error.message
    });
  }
});

// GET /api/v1/users/:id/profile - Get user profile with additional info
router.get('/:id/profile', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: `No user found with ID: ${req.params.id}`
      });
    }

    // Get user's task statistics
    const Task = require('../models/Task');
    const taskStats = await Task.aggregate([
      { $match: { assignedTo: user._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = {
      totalTasks: 0,
      completed: 0,
      inProgress: 0,
      pending: 0,
      cancelled: 0
    };

    taskStats.forEach(stat => {
      stats.totalTasks += stat.count;
      stats[stat._id.replace('-', '')] = stat.count;
    });

    res.json({
      success: true,
      data: {
        user,
        taskStatistics: stats
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch user profile',
      message: error.message
    });
  }
});

module.exports = router; 
const express = require('express');
const { body, validationResult } = require('express-validator');
const Task = require('../models/Task');
const User = require('../models/User');
const Category = require('../models/Category');

const router = express.Router();

// Validation middleware
const validateTask = [
  body('title').trim().isLength({ min: 1, max: 100 }).withMessage('Title must be 1-100 characters'),
  body('description').optional().isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
  body('status').optional().isIn(['pending', 'in-progress', 'completed', 'cancelled']).withMessage('Invalid status'),
  body('dueDate').isISO8601().withMessage('Invalid due date format'),
  body('estimatedHours').optional().isFloat({ min: 0.5, max: 40 }).withMessage('Estimated hours must be 0.5-40'),
  body('actualHours').optional().isFloat({ min: 0 }).withMessage('Actual hours cannot be negative')
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

// GET /api/v1/tasks - Get all tasks with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      priority,
      category,
      assignedTo,
      overdue,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (overdue === 'true') {
      filter.dueDate = { $lt: new Date() };
      filter.status = { $ne: 'completed' };
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get tasks with population
    const tasks = await Task.find(filter)
      .populate('assignedTo', 'name email avatar')
      .populate('category', 'name color icon')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalTasks = await Task.countDocuments(filter);
    const totalPages = Math.ceil(totalTasks / parseInt(limit));

    res.json({
      success: true,
      data: {
        tasks,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalTasks,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch tasks',
      message: error.message
    });
  }
});

// GET /api/v1/tasks/:id - Get single task by ID
router.get('/:id', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'name email avatar department')
      .populate('category', 'name color icon description');

    if (!task) {
      return res.status(404).json({
        error: 'Task not found',
        message: `No task found with ID: ${req.params.id}`
      });
    }

    res.json({
      success: true,
      data: task
    });

  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'Invalid task ID format',
        message: 'The provided ID is not a valid MongoDB ObjectId'
      });
    }
    res.status(500).json({
      error: 'Failed to fetch task',
      message: error.message
    });
  }
});

// POST /api/v1/tasks - Create new task
router.post('/', validateTask, handleValidationErrors, async (req, res) => {
  try {
    // Verify that assignedTo user exists
    const userExists = await User.findById(req.body.assignedTo);
    if (!userExists) {
      return res.status(400).json({
        error: 'Invalid user assignment',
        message: 'The specified user does not exist'
      });
    }

    // Verify that category exists
    const categoryExists = await Category.findById(req.body.category);
    if (!categoryExists) {
      return res.status(400).json({
        error: 'Invalid category',
        message: 'The specified category does not exist'
      });
    }

    const task = new Task(req.body);
    await task.save();

    // Populate the created task
    await task.populate('assignedTo', 'name email avatar');
    await task.populate('category', 'name color icon');

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: task
    });

  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: Object.values(error.errors).map(err => err.message)
      });
    }
    res.status(500).json({
      error: 'Failed to create task',
      message: error.message
    });
  }
});

// PUT /api/v1/tasks/:id - Update task
router.put('/:id', validateTask, handleValidationErrors, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({
        error: 'Task not found',
        message: `No task found with ID: ${req.params.id}`
      });
    }

    // Verify user and category if they're being updated
    if (req.body.assignedTo) {
      const userExists = await User.findById(req.body.assignedTo);
      if (!userExists) {
        return res.status(400).json({
          error: 'Invalid user assignment',
          message: 'The specified user does not exist'
        });
      }
    }

    if (req.body.category) {
      const categoryExists = await Category.findById(req.body.category);
      if (!categoryExists) {
        return res.status(400).json({
          error: 'Invalid category',
          message: 'The specified category does not exist'
        });
      }
    }

    // Update the task
    Object.assign(task, req.body);
    await task.save();

    // Populate the updated task
    await task.populate('assignedTo', 'name email avatar');
    await task.populate('category', 'name color icon');

    res.json({
      success: true,
      message: 'Task updated successfully',
      data: task
    });

  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'Invalid task ID format',
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
      error: 'Failed to update task',
      message: error.message
    });
  }
});

// DELETE /api/v1/tasks/:id - Delete task
router.delete('/:id', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({
        error: 'Task not found',
        message: `No task found with ID: ${req.params.id}`
      });
    }

    await Task.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Task deleted successfully',
      data: {
        deletedTask: {
          id: task._id,
          title: task.title
        }
      }
    });

  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'Invalid task ID format',
        message: 'The provided ID is not a valid MongoDB ObjectId'
      });
    }
    res.status(500).json({
      error: 'Failed to delete task',
      message: error.message
    });
  }
});

// PATCH /api/v1/tasks/:id/status - Update task status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['pending', 'in-progress', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        message: 'Status must be one of: pending, in-progress, completed, cancelled'
      });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({
        error: 'Task not found',
        message: `No task found with ID: ${req.params.id}`
      });
    }

    task.status = status;
    await task.save();

    res.json({
      success: true,
      message: `Task status updated to ${status}`,
      data: {
        id: task._id,
        title: task.title,
        status: task.status,
        completedAt: task.completedAt
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to update task status',
      message: error.message
    });
  }
});

module.exports = router; 
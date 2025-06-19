const express = require('express');
const { body, validationResult } = require('express-validator');
const Category = require('../models/Category');

const router = express.Router();

// Validation middleware
const validateCategory = [
  body('name').trim().isLength({ min: 1, max: 50 }).withMessage('Name must be 1-50 characters'),
  body('description').optional().isLength({ max: 200 }).withMessage('Description cannot exceed 200 characters'),
  body('color').optional().matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).withMessage('Invalid hex color format'),
  body('icon').optional().trim().isLength({ min: 1, max: 30 }).withMessage('Icon must be 1-30 characters')
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

// GET /api/v1/categories - Get all categories with filtering
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      isActive,
      createdBy,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      includeTasks = false
    } = req.query;

    // Build filter object
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (createdBy) filter.createdBy = createdBy;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get categories with optional task count
    let query = Category.find(filter)
      .populate('createdBy', 'name email')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    if (includeTasks === 'true') {
      query = query.populate('taskCount');
    }

    const categories = await query;

    // Get total count for pagination
    const totalCategories = await Category.countDocuments(filter);
    const totalPages = Math.ceil(totalCategories / parseInt(limit));

    res.json({
      success: true,
      data: {
        categories,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCategories,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch categories',
      message: error.message
    });
  }
});

// GET /api/v1/categories/:id - Get single category by ID
router.get('/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
      .populate('createdBy', 'name email avatar')
      .populate('taskCount');

    if (!category) {
      return res.status(404).json({
        error: 'Category not found',
        message: `No category found with ID: ${req.params.id}`
      });
    }

    // Get tasks in this category for additional details
    const Task = require('../models/Task');
    const taskStats = await Task.aggregate([
      { $match: { category: category._id } },
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
        category,
        taskStatistics: stats
      }
    });

  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'Invalid category ID format',
        message: 'The provided ID is not a valid MongoDB ObjectId'
      });
    }
    res.status(500).json({
      error: 'Failed to fetch category',
      message: error.message
    });
  }
});

// POST /api/v1/categories - Create new category
router.post('/', validateCategory, handleValidationErrors, async (req, res) => {
  try {
    // Check if category name already exists
    const existingCategory = await Category.findOne({ 
      name: { $regex: new RegExp(`^${req.body.name}$`, 'i') }
    });
    
    if (existingCategory) {
      return res.status(409).json({
        error: 'Category already exists',
        message: 'A category with this name already exists'
      });
    }

    const category = new Category(req.body);
    await category.save();

    // Populate the created category
    await category.populate('createdBy', 'name email avatar');

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category
    });

  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: Object.values(error.errors).map(err => err.message)
      });
    }
    res.status(500).json({
      error: 'Failed to create category',
      message: error.message
    });
  }
});

// PUT /api/v1/categories/:id - Update category
router.put('/:id', validateCategory, handleValidationErrors, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({
        error: 'Category not found',
        message: `No category found with ID: ${req.params.id}`
      });
    }

    // Check if name is being updated and if it's already taken
    if (req.body.name && req.body.name.toLowerCase() !== category.name.toLowerCase()) {
      const existingCategory = await Category.findOne({ 
        name: { $regex: new RegExp(`^${req.body.name}$`, 'i') },
        _id: { $ne: req.params.id }
      });
      
      if (existingCategory) {
        return res.status(409).json({
          error: 'Category name already exists',
          message: 'A category with this name already exists'
        });
      }
    }

    // Update the category
    Object.assign(category, req.body);
    await category.save();

    // Populate the updated category
    await category.populate('createdBy', 'name email avatar');

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: category
    });

  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'Invalid category ID format',
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
      error: 'Failed to update category',
      message: error.message
    });
  }
});

// DELETE /api/v1/categories/:id - Delete category
router.delete('/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({
        error: 'Category not found',
        message: `No category found with ID: ${req.params.id}`
      });
    }

    // Check if category has tasks assigned
    const Task = require('../models/Task');
    const tasksCount = await Task.countDocuments({ category: req.params.id });
    
    if (tasksCount > 0) {
      return res.status(409).json({
        error: 'Cannot delete category',
        message: `Category has ${tasksCount} task(s) assigned. Please reassign or delete the tasks first.`,
        tasksCount
      });
    }

    await Category.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Category deleted successfully',
      data: {
        deletedCategory: {
          id: category._id,
          name: category.name
        }
      }
    });

  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'Invalid category ID format',
        message: 'The provided ID is not a valid MongoDB ObjectId'
      });
    }
    res.status(500).json({
      error: 'Failed to delete category',
      message: error.message
    });
  }
});

// PATCH /api/v1/categories/:id/toggle - Toggle category active status
router.patch('/:id/toggle', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({
        error: 'Category not found',
        message: `No category found with ID: ${req.params.id}`
      });
    }

    category.isActive = !category.isActive;
    await category.save();

    res.json({
      success: true,
      message: `Category ${category.isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        id: category._id,
        name: category.name,
        isActive: category.isActive
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to toggle category status',
      message: error.message
    });
  }
});

// GET /api/v1/categories/:id/tasks - Get all tasks in a category
router.get('/:id/tasks', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      priority,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Check if category exists
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({
        error: 'Category not found',
        message: `No category found with ID: ${req.params.id}`
      });
    }

    // Build filter object
    const filter = { category: req.params.id };
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get tasks
    const Task = require('../models/Task');
    const tasks = await Task.find(filter)
      .populate('assignedTo', 'name email avatar')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const totalTasks = await Task.countDocuments(filter);
    const totalPages = Math.ceil(totalTasks / parseInt(limit));

    res.json({
      success: true,
      data: {
        category: {
          id: category._id,
          name: category.name,
          color: category.color,
          icon: category.icon
        },
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
      error: 'Failed to fetch category tasks',
      message: error.message
    });
  }
});

module.exports = router; 
const express = require('express');
const { body, validationResult } = require('express-validator');
const Habit = require('../models/Habit');
const { Gamification } = require('../models/Gamification');

const router = express.Router();

// Validation middleware
const validateHabit = [
  body('title').trim().isLength({ min: 1, max: 100 }).withMessage('Title must be 1-100 characters'),
  body('description').optional().isLength({ max: 300 }).withMessage('Description cannot exceed 300 characters'),
  body('category').optional().isIn(['health', 'productivity', 'learning', 'fitness', 'mindfulness', 'social', 'other']).withMessage('Invalid category'),
  body('frequency').optional().isIn(['daily', 'weekly', 'monthly']).withMessage('Invalid frequency'),
  body('targetCount').isInt({ min: 1 }).withMessage('Target count must be at least 1'),
  body('unit').trim().isLength({ min: 1, max: 50 }).withMessage('Unit must be 1-50 characters'),
  body('difficulty').optional().isIn(['easy', 'medium', 'hard']).withMessage('Invalid difficulty')
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

// GET /api/v1/habits - Get all habits with filtering
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      frequency,
      difficulty,
      isActive,
      user,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    if (category) filter.category = category;
    if (frequency) filter.frequency = frequency;
    if (difficulty) filter.difficulty = difficulty;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (user) filter.user = user;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get habits with population
    const habits = await Habit.find(filter)
      .populate('user', 'name email avatar')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalHabits = await Habit.countDocuments(filter);
    const totalPages = Math.ceil(totalHabits / parseInt(limit));

    res.json({
      success: true,
      data: {
        habits,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalHabits,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch habits',
      message: error.message
    });
  }
});

// GET /api/v1/habits/:id - Get single habit by ID
router.get('/:id', async (req, res) => {
  try {
    const habit = await Habit.findById(req.params.id)
      .populate('user', 'name email avatar');

    if (!habit) {
      return res.status(404).json({
        error: 'Habit not found',
        message: `No habit found with ID: ${req.params.id}`
      });
    }

    res.json({
      success: true,
      data: habit
    });

  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'Invalid habit ID format',
        message: 'The provided ID is not a valid MongoDB ObjectId'
      });
    }
    res.status(500).json({
      error: 'Failed to fetch habit',
      message: error.message
    });
  }
});

// POST /api/v1/habits - Create new habit
router.post('/', validateHabit, handleValidationErrors, async (req, res) => {
  try {
    // Set points based on difficulty
    const difficultyPoints = {
      easy: 5,
      medium: 10,
      hard: 20
    };
    
    const habitData = {
      ...req.body,
      rewards: {
        points: difficultyPoints[req.body.difficulty || 'medium']
      }
    };

    const habit = new Habit(habitData);
    await habit.save();

    // Populate the created habit
    await habit.populate('user', 'name email avatar');

    // Award XP for creating a habit
    try {
      const gamification = await Gamification.findOne({ user: habit.user });
      if (gamification) {
        await gamification.addExperience(10, 'habit_creation');
      }
    } catch (gamificationError) {
      console.log('Gamification update failed:', gamificationError.message);
    }

    res.status(201).json({
      success: true,
      message: 'Habit created successfully',
      data: habit
    });

  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: Object.values(error.errors).map(err => err.message)
      });
    }
    res.status(500).json({
      error: 'Failed to create habit',
      message: error.message
    });
  }
});

// PUT /api/v1/habits/:id - Update habit
router.put('/:id', validateHabit, handleValidationErrors, async (req, res) => {
  try {
    const habit = await Habit.findById(req.params.id);
    if (!habit) {
      return res.status(404).json({
        error: 'Habit not found',
        message: `No habit found with ID: ${req.params.id}`
      });
    }

    // Update habit
    Object.assign(habit, req.body);
    await habit.save();

    // Populate the updated habit
    await habit.populate('user', 'name email avatar');

    res.json({
      success: true,
      message: 'Habit updated successfully',
      data: habit
    });

  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: Object.values(error.errors).map(err => err.message)
      });
    }
    res.status(500).json({
      error: 'Failed to update habit',
      message: error.message
    });
  }
});

// DELETE /api/v1/habits/:id - Delete habit
router.delete('/:id', async (req, res) => {
  try {
    const habit = await Habit.findById(req.params.id);
    if (!habit) {
      return res.status(404).json({
        error: 'Habit not found',
        message: `No habit found with ID: ${req.params.id}`
      });
    }

    await Habit.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Habit deleted successfully'
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete habit',
      message: error.message
    });
  }
});

// POST /api/v1/habits/:id/complete - Mark habit as completed
router.post('/:id/complete', async (req, res) => {
  try {
    const { count = 1, notes = '' } = req.body;
    
    const habit = await Habit.findById(req.params.id);
    if (!habit) {
      return res.status(404).json({
        error: 'Habit not found',
        message: `No habit found with ID: ${req.params.id}`
      });
    }

    // Complete the habit
    await habit.complete(count, notes);
    await habit.populate('user', 'name email avatar');

    // Award XP and update gamification
    try {
      const gamification = await Gamification.findOne({ user: habit.user });
      if (gamification) {
        await gamification.addExperience(habit.rewards.points, 'habit_completion');
        await gamification.updateStreak('habits', true);
        gamification.statistics.habitsCompleted += 1;
        await gamification.save();
      }
    } catch (gamificationError) {
      console.log('Gamification update failed:', gamificationError.message);
    }

    res.json({
      success: true,
      message: 'Habit completed successfully',
      data: {
        habit,
        streak: habit.streak,
        pointsEarned: habit.rewards.points
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to complete habit',
      message: error.message
    });
  }
});

// GET /api/v1/habits/:id/stats - Get habit statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const habit = await Habit.findById(req.params.id);
    if (!habit) {
      return res.status(404).json({
        error: 'Habit not found',
        message: `No habit found with ID: ${req.params.id}`
      });
    }

    // Calculate statistics
    const now = new Date();
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const weeklyCompletions = habit.completions.filter(c => c.date >= thisWeek);
    const monthlyCompletions = habit.completions.filter(c => c.date >= thisMonth);

    const stats = {
      totalCompletions: habit.completions.length,
      weeklyCompletions: weeklyCompletions.length,
      monthlyCompletions: monthlyCompletions.length,
      currentStreak: habit.streak.current,
      longestStreak: habit.streak.longest,
      completionRate: habit.completionRate,
      totalPointsEarned: habit.totalPointsEarned,
      averageDaily: habit.completions.length > 0 ? 
        Math.round((habit.completions.length / Math.max(1, Math.floor((now - habit.createdAt) / (1000 * 60 * 60 * 24)))) * 100) / 100 : 0
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch habit statistics',
      message: error.message
    });
  }
});

// GET /api/v1/habits/user/:userId - Get habits for specific user
router.get('/user/:userId', async (req, res) => {
  try {
    const { category, isActive } = req.query;
    
    const filter = { user: req.params.userId };
    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const habits = await Habit.find(filter)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: habits
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch user habits',
      message: error.message
    });
  }
});

module.exports = router; 
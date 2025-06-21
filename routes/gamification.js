const express = require('express');
const { Achievement, Gamification } = require('../models/Gamification');
const User = require('../models/User');

const router = express.Router();

// GET /api/v1/gamification/:userId - Get user's gamification profile
router.get('/:userId', async (req, res) => {
  try {
    let gamification = await Gamification.findOne({ user: req.params.userId })
      .populate('user', 'name email avatar')
      .populate('achievements.achievement');

    // Create gamification profile if it doesn't exist
    if (!gamification) {
      gamification = await Gamification.createForUser(req.params.userId);
      await gamification.populate('user', 'name email avatar');
    }

    res.json({
      success: true,
      data: gamification
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch gamification profile',
      message: error.message
    });
  }
});

// POST /api/v1/gamification/:userId/experience - Add experience points
router.post('/:userId/experience', async (req, res) => {
  try {
    const { points, source = 'manual' } = req.body;

    if (!points || points <= 0) {
      return res.status(400).json({
        error: 'Invalid points',
        message: 'Points must be a positive number'
      });
    }

    let gamification = await Gamification.findOne({ user: req.params.userId });
    if (!gamification) {
      gamification = await Gamification.createForUser(req.params.userId);
    }

    const oldLevel = gamification.level;
    await gamification.addExperience(points, source);
    
    const leveledUp = gamification.level > oldLevel;
    
    res.json({
      success: true,
      message: leveledUp ? 'Experience added and level up!' : 'Experience added successfully',
      data: {
        pointsAdded: points,
        totalExperience: gamification.experience.total,
        currentLevel: gamification.level,
        leveledUp,
        levelsGained: gamification.level - oldLevel
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to add experience',
      message: error.message
    });
  }
});

// GET /api/v1/gamification/leaderboard - Get leaderboard
router.get('/leaderboard/all', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      sortBy = 'experience.total',
      period = 'all' 
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build sort options
    const sortOptions = {};
    if (sortBy === 'level') {
      sortOptions.level = -1;
      sortOptions['experience.total'] = -1;
    } else if (sortBy === 'achievements') {
      sortOptions['achievements'] = -1;
    } else {
      sortOptions['experience.total'] = -1;
    }

    const leaderboard = await Gamification.find()
      .populate('user', 'name email avatar')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    // Add rank to each entry
    const rankedLeaderboard = leaderboard.map((entry, index) => ({
      ...entry.toObject(),
      rank: skip + index + 1
    }));

    const totalUsers = await Gamification.countDocuments();

    res.json({
      success: true,
      data: {
        leaderboard: rankedLeaderboard,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalUsers / parseInt(limit)),
          totalUsers,
          hasNext: skip + parseInt(limit) < totalUsers,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch leaderboard',
      message: error.message
    });
  }
});

// GET /api/v1/gamification/achievements - Get all available achievements
router.get('/achievements/all', async (req, res) => {
  try {
    const { category, includeSecret = false } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (!includeSecret || includeSecret === 'false') {
      filter.isSecret = { $ne: true };
    }

    const achievements = await Achievement.find(filter)
      .sort({ category: 1, points: 1 });

    // Group by category
    const groupedAchievements = achievements.reduce((acc, achievement) => {
      if (!acc[achievement.category]) {
        acc[achievement.category] = [];
      }
      acc[achievement.category].push(achievement);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        achievements,
        groupedAchievements,
        totalAchievements: achievements.length
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch achievements',
      message: error.message
    });
  }
});

// POST /api/v1/gamification/achievements - Create new achievement (Admin only)
router.post('/achievements', async (req, res) => {
  try {
    const achievement = new Achievement(req.body);
    await achievement.save();

    res.status(201).json({
      success: true,
      message: 'Achievement created successfully',
      data: achievement
    });

  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: Object.values(error.errors).map(err => err.message)
      });
    }
    res.status(500).json({
      error: 'Failed to create achievement',
      message: error.message
    });
  }
});

// POST /api/v1/gamification/:userId/achievements/:achievementId - Unlock achievement for user
router.post('/:userId/achievements/:achievementId', async (req, res) => {
  try {
    const { progress = 100 } = req.body;

    let gamification = await Gamification.findOne({ user: req.params.userId });
    if (!gamification) {
      gamification = await Gamification.createForUser(req.params.userId);
    }

    const achievement = await Achievement.findById(req.params.achievementId);
    if (!achievement) {
      return res.status(404).json({
        error: 'Achievement not found',
        message: `No achievement found with ID: ${req.params.achievementId}`
      });
    }

    await gamification.unlockAchievement(req.params.achievementId, progress);
    
    // Award XP for the achievement
    await gamification.addExperience(achievement.points, 'achievement_unlock');

    res.json({
      success: true,
      message: 'Achievement unlocked successfully',
      data: {
        achievement,
        pointsAwarded: achievement.points
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to unlock achievement',
      message: error.message
    });
  }
});

// GET /api/v1/gamification/:userId/progress/:achievementId - Get achievement progress
router.get('/:userId/progress/:achievementId', async (req, res) => {
  try {
    const gamification = await Gamification.findOne({ user: req.params.userId });
    if (!gamification) {
      return res.status(404).json({
        error: 'Gamification profile not found',
        message: 'User has no gamification profile'
      });
    }

    const userAchievement = gamification.achievements.find(
      ach => ach.achievement.toString() === req.params.achievementId
    );

    const achievement = await Achievement.findById(req.params.achievementId);
    if (!achievement) {
      return res.status(404).json({
        error: 'Achievement not found',
        message: `No achievement found with ID: ${req.params.achievementId}`
      });
    }

    res.json({
      success: true,
      data: {
        achievement,
        progress: userAchievement ? userAchievement.progress : 0,
        unlocked: !!userAchievement,
        unlockedAt: userAchievement ? userAchievement.unlockedAt : null
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch achievement progress',
      message: error.message
    });
  }
});

// GET /api/v1/gamification/:userId/stats - Get detailed user statistics
router.get('/:userId/stats', async (req, res) => {
  try {
    const gamification = await Gamification.findOne({ user: req.params.userId })
      .populate('user', 'name email avatar createdAt');

    if (!gamification) {
      return res.status(404).json({
        error: 'Gamification profile not found',
        message: 'User has no gamification profile'
      });
    }

    // Calculate additional stats
    const accountAge = Math.floor((new Date() - new Date(gamification.user.createdAt)) / (1000 * 60 * 60 * 24));
    const avgXpPerDay = accountAge > 0 ? Math.round(gamification.experience.total / accountAge) : 0;

    const stats = {
      level: gamification.level,
      experience: gamification.experience,
      rank: gamification.rank,
      levelProgress: gamification.levelProgress,
      totalAchievements: gamification.totalAchievements,
      badges: gamification.badges.length,
      streaks: gamification.streaks,
      statistics: gamification.statistics,
      accountAge,
      avgXpPerDay,
      recentBadges: gamification.badges.slice(-5).reverse(),
      nextLevelXp: gamification.experience.toNextLevel - gamification.experience.current
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch user statistics',
      message: error.message
    });
  }
});

// POST /api/v1/gamification/:userId/streak/:type - Update user streak
router.post('/:userId/streak/:type', async (req, res) => {
  try {
    const { increment = true } = req.body;
    const streakType = req.params.type;

    let gamification = await Gamification.findOne({ user: req.params.userId });
    if (!gamification) {
      gamification = await Gamification.createForUser(req.params.userId);
    }

    if (!['tasks', 'habits', 'login'].includes(streakType)) {
      return res.status(400).json({
        error: 'Invalid streak type',
        message: 'Streak type must be one of: tasks, habits, login'
      });
    }

    await gamification.updateStreak(streakType, increment);

    res.json({
      success: true,
      message: `${streakType} streak updated successfully`,
      data: {
        streak: gamification.streaks[streakType]
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to update streak',
      message: error.message
    });
  }
});

module.exports = router; 
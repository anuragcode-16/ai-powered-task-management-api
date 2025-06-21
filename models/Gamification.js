const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    default: '🏆'
  },
  points: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    enum: ['tasks', 'habits', 'streak', 'social', 'time', 'special'],
    required: true
  },
  requirements: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  isSecret: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const userAchievementSchema = new mongoose.Schema({
  achievement: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Achievement',
    required: true
  },
  unlockedAt: {
    type: Date,
    default: Date.now
  },
  progress: {
    type: Number,
    default: 100
  }
});

const gamificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  level: {
    type: Number,
    default: 1,
    min: 1
  },
  experience: {
    total: {
      type: Number,
      default: 0
    },
    current: {
      type: Number,
      default: 0
    },
    toNextLevel: {
      type: Number,
      default: 100
    }
  },
  achievements: [userAchievementSchema],
  badges: [{
    name: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    icon: {
      type: String,
      default: '🎖️'
    },
    rarity: {
      type: String,
      enum: ['common', 'rare', 'epic', 'legendary'],
      default: 'common'
    },
    earnedAt: {
      type: Date,
      default: Date.now
    }
  }],
  streaks: {
    tasks: {
      current: {
        type: Number,
        default: 0
      },
      longest: {
        type: Number,
        default: 0
      }
    },
    habits: {
      current: {
        type: Number,
        default: 0
      },
      longest: {
        type: Number,
        default: 0
      }
    },
    login: {
      current: {
        type: Number,
        default: 0
      },
      longest: {
        type: Number,
        default: 0
      },
      lastLogin: {
        type: Date
      }
    }
  },
  statistics: {
    tasksCompleted: {
      type: Number,
      default: 0
    },
    habitsCompleted: {
      type: Number,
      default: 0
    },
    totalTimeSpent: {
      type: Number,
      default: 0
    },
    collaborations: {
      type: Number,
      default: 0
    },
    helpedOthers: {
      type: Number,
      default: 0
    }
  },
  preferences: {
    showProgress: {
      type: Boolean,
      default: true
    },
    notifications: {
      levelUp: {
        type: Boolean,
        default: true
      },
      achievements: {
        type: Boolean,
        default: true
      },
      streaks: {
        type: Boolean,
        default: true
      }
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for current level progress percentage
gamificationSchema.virtual('levelProgress').get(function() {
  return Math.round((this.experience.current / this.experience.toNextLevel) * 100);
});

// Virtual for total achievements count
gamificationSchema.virtual('totalAchievements').get(function() {
  return this.achievements.length;
});

// Virtual for user rank (simplified)
gamificationSchema.virtual('rank').get(function() {
  if (this.level >= 50) return 'Master';
  if (this.level >= 30) return 'Expert';
  if (this.level >= 20) return 'Advanced';
  if (this.level >= 10) return 'Intermediate';
  return 'Beginner';
});

// Index for better performance
gamificationSchema.index({ user: 1 });
gamificationSchema.index({ level: -1 });
gamificationSchema.index({ 'experience.total': -1 });

// Method to add experience
gamificationSchema.methods.addExperience = function(points, source = 'general') {
  this.experience.total += points;
  this.experience.current += points;
  
  // Check for level up
  while (this.experience.current >= this.experience.toNextLevel) {
    this.experience.current -= this.experience.toNextLevel;
    this.level += 1;
    
    // Increase XP requirement for next level (exponential growth)
    this.experience.toNextLevel = Math.floor(100 * Math.pow(1.2, this.level - 1));
    
    // Award level-up badge
    this.badges.push({
      name: `Level ${this.level}`,
      description: `Reached level ${this.level}!`,
      icon: '🆙',
      rarity: this.level % 10 === 0 ? 'epic' : 'common'
    });
  }
  
  return this.save();
};

// Method to unlock achievement
gamificationSchema.methods.unlockAchievement = function(achievementId, progress = 100) {
  // Check if already unlocked
  const existing = this.achievements.find(
    ach => ach.achievement.toString() === achievementId.toString()
  );
  
  if (!existing) {
    this.achievements.push({
      achievement: achievementId,
      progress: progress
    });
    return this.save();
  }
  
  return Promise.resolve(this);
};

// Method to update streak
gamificationSchema.methods.updateStreak = function(type, increment = true) {
  if (!this.streaks[type]) return;
  
  if (increment) {
    this.streaks[type].current += 1;
    if (this.streaks[type].current > this.streaks[type].longest) {
      this.streaks[type].longest = this.streaks[type].current;
    }
  } else {
    this.streaks[type].current = 0;
  }
  
  // Award streak badges
  if (increment && this.streaks[type].current % 7 === 0) {
    this.badges.push({
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Streak`,
      description: `${this.streaks[type].current} day ${type} streak!`,
      icon: '🔥',
      rarity: this.streaks[type].current >= 30 ? 'legendary' : 
              this.streaks[type].current >= 14 ? 'epic' : 'rare'
    });
  }
  
  return this.save();
};

// Static method to create initial gamification profile
gamificationSchema.statics.createForUser = function(userId) {
  return this.create({
    user: userId,
    level: 1,
    experience: {
      total: 0,
      current: 0,
      toNextLevel: 100
    }
  });
};

const Achievement = mongoose.model('Achievement', achievementSchema);
const Gamification = mongoose.model('Gamification', gamificationSchema);

module.exports = { Achievement, Gamification }; 
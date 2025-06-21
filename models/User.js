const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'manager'],
    default: 'user'
  },
  avatar: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    maxlength: [200, 'Bio cannot exceed 200 characters']
  },
  skills: [{
    type: String,
    trim: true
  }],
  department: {
    type: String,
    trim: true
  },
  phoneNumber: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark'],
      default: 'light'
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      },
      gamification: {
        type: Boolean,
        default: true
      }
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    gamification: {
      showProgress: {
        type: Boolean,
        default: true
      },
      showLeaderboard: {
        type: Boolean,
        default: true
      }
    }
  },
  // AI-related fields
  aiPreferences: {
    enableRecommendations: {
      type: Boolean,
      default: true
    },
    preferredWorkingHours: {
      start: {
        type: Number,
        default: 9 // 9 AM
      },
      end: {
        type: Number,
        default: 17 // 5 PM
      }
    },
    productivityStyle: {
      type: String,
      enum: ['morning-person', 'night-owl', 'flexible'],
      default: 'flexible'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for user's full profile
userSchema.virtual('profile').get(function() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    avatar: this.avatar,
    bio: this.bio,
    skills: this.skills,
    department: this.department
  };
});

// Index for better performance
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ email: 1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash password if it has been modified
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Post-save middleware to create gamification profile
userSchema.post('save', async function(doc, next) {
  // Only create gamification profile for new users
  if (doc.isNew) {
    try {
      const { Gamification } = require('./Gamification');
      await Gamification.createForUser(doc._id);
      console.log(`✅ Gamification profile created for user: ${doc.name}`);
    } catch (error) {
      console.error('❌ Failed to create gamification profile:', error);
      // Don't fail user creation if gamification fails
    }
  }
  next();
});

// Method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to update last login and login streak
userSchema.methods.updateLastLogin = async function() {
  this.lastLogin = new Date();
  await this.save({ validateBeforeSave: false });
  
  // Update login streak in gamification
  try {
    const { Gamification } = require('./Gamification');
    const gamification = await Gamification.findOne({ user: this._id });
    if (gamification) {
      await gamification.updateStreak('login', true);
    }
  } catch (error) {
    console.error('Failed to update login streak:', error);
  }
  
  return this;
};

// Method to get AI preferences
userSchema.methods.getAIPreferences = function() {
  return {
    enableRecommendations: this.aiPreferences.enableRecommendations,
    preferredWorkingHours: this.aiPreferences.preferredWorkingHours,
    productivityStyle: this.aiPreferences.productivityStyle,
    timezone: this.preferences.timezone
  };
};

// Static method to get users for leaderboard
userSchema.statics.getLeaderboardUsers = async function(limit = 10) {
  const { Gamification } = require('./Gamification');
  
  const leaderboard = await Gamification.find()
    .populate('user', 'name avatar email')
    .sort({ 'experience.total': -1 })
    .limit(limit);
  
  return leaderboard;
};

module.exports = mongoose.model('User', userSchema); 
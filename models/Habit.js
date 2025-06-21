const mongoose = require('mongoose');

const habitSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Habit title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [300, 'Description cannot exceed 300 characters']
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  category: {
    type: String,
    enum: ['health', 'productivity', 'learning', 'fitness', 'mindfulness', 'social', 'other'],
    default: 'other'
  },
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    default: 'daily'
  },
  targetCount: {
    type: Number,
    required: [true, 'Target count is required'],
    min: [1, 'Target count must be at least 1']
  },
  unit: {
    type: String,
    required: [true, 'Unit is required'],
    trim: true,
    maxlength: [50, 'Unit cannot exceed 50 characters']
  },
  streak: {
    current: {
      type: Number,
      default: 0
    },
    longest: {
      type: Number,
      default: 0
    },
    lastCompletedDate: {
      type: Date
    }
  },
  completions: [{
    date: {
      type: Date,
      required: true
    },
    count: {
      type: Number,
      required: true,
      min: 0
    },
    notes: {
      type: String,
      maxlength: [200, 'Notes cannot exceed 200 characters']
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  rewards: {
    points: {
      type: Number,
      default: 10
    },
    badges: [{
      name: String,
      description: String,
      earnedAt: {
        type: Date,
        default: Date.now
      }
    }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for completion rate
habitSchema.virtual('completionRate').get(function() {
  if (this.completions.length === 0) return 0;
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentCompletions = this.completions.filter(
    completion => completion.date >= thirtyDaysAgo
  );
  
  return Math.round((recentCompletions.length / 30) * 100);
});

// Virtual for total points earned
habitSchema.virtual('totalPointsEarned').get(function() {
  return this.completions.length * this.rewards.points;
});

// Index for better performance
habitSchema.index({ user: 1, isActive: 1 });
habitSchema.index({ category: 1 });
habitSchema.index({ 'completions.date': -1 });

// Method to complete habit
habitSchema.methods.complete = function(count = 1, notes = '') {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Check if already completed today
  const todayCompletion = this.completions.find(
    completion => completion.date.toDateString() === today.toDateString()
  );
  
  if (todayCompletion) {
    todayCompletion.count += count;
    todayCompletion.notes = notes;
  } else {
    this.completions.push({
      date: today,
      count: count,
      notes: notes
    });
  }
  
  // Update streak
  this.updateStreak();
  
  return this.save();
};

// Method to update streak
habitSchema.methods.updateStreak = function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const hasCompletionToday = this.completions.some(
    completion => completion.date.toDateString() === today.toDateString()
  );
  
  const hasCompletionYesterday = this.completions.some(
    completion => completion.date.toDateString() === yesterday.toDateString()
  );
  
  if (hasCompletionToday) {
    if (hasCompletionYesterday || this.streak.current === 0) {
      this.streak.current += 1;
      this.streak.lastCompletedDate = today;
      
      if (this.streak.current > this.streak.longest) {
        this.streak.longest = this.streak.current;
      }
    }
  } else if (!hasCompletionYesterday && this.streak.current > 0) {
    this.streak.current = 0;
  }
};

module.exports = mongoose.model('Habit', habitSchema); 
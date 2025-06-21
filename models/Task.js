const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Task must be assigned to a user']
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  estimatedHours: {
    type: Number,
    min: [0.5, 'Estimated hours must be at least 0.5'],
    max: [40, 'Estimated hours cannot exceed 40']
  },
  actualHours: {
    type: Number,
    min: [0, 'Actual hours cannot be negative'],
    default: 0
  },
  tags: [{
    type: String,
    trim: true
  }],
  attachments: [{
    filename: String,
    url: String,
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],
  completedAt: {
    type: Date
  },
  isArchived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for calculating if task is overdue
taskSchema.virtual('isOverdue').get(function() {
  return this.dueDate < new Date() && this.status !== 'completed';
});

// Virtual for calculating progress percentage
taskSchema.virtual('progressPercentage').get(function() {
  if (this.status === 'completed') return 100;
  if (this.status === 'in-progress') return 50;
  if (this.status === 'pending') return 0;
  return 0;
});

// Index for better query performance
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ priority: 1 });
taskSchema.index({ category: 1 });

// Pre-save middleware
taskSchema.pre('save', function(next) {
  // Set completedAt when status changes to completed
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  // Clear completedAt if status changes from completed
  if (this.isModified('status') && this.status !== 'completed') {
    this.completedAt = undefined;
  }
  
  next();
});

// Post-save middleware for gamification
taskSchema.post('save', async function(doc, next) {
  // Award XP when task is completed
  if (doc.isModified('status') && doc.status === 'completed') {
    try {
      const { Gamification } = require('./Gamification');
      const gamification = await Gamification.findOne({ user: doc.assignedTo });
      
      if (gamification) {
        // Calculate XP based on priority and estimated hours
        let xp = 10; // Base XP
        
        // Priority multiplier
        const priorityMultiplier = {
          'low': 1,
          'medium': 1.5,
          'high': 2,
          'urgent': 3
        };
        
        xp *= priorityMultiplier[doc.priority] || 1;
        
        // Hours multiplier (more XP for longer tasks)
        if (doc.estimatedHours) {
          xp += doc.estimatedHours * 2;
        }
        
        // Round to nearest integer
        xp = Math.round(xp);
        
        await gamification.addExperience(xp, 'task_completion');
        await gamification.updateStreak('tasks', true);
        gamification.statistics.tasksCompleted += 1;
        await gamification.save();
        
        console.log(`✅ Awarded ${xp} XP for task completion: ${doc.title}`);
      }
    } catch (error) {
      console.error('❌ Failed to update gamification for task completion:', error);
    }
  }
  
  next();
});

module.exports = mongoose.model('Task', taskSchema); 
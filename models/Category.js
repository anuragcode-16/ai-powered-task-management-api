const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    unique: true,
    maxlength: [50, 'Category name cannot exceed 50 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [200, 'Description cannot exceed 200 characters']
  },
  color: {
    type: String,
    trim: true,
    match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Please provide a valid hex color'],
    default: '#3498db'
  },
  icon: {
    type: String,
    trim: true,
    default: 'folder'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator is required']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for counting tasks in this category
categorySchema.virtual('taskCount', {
  ref: 'Task',
  localField: '_id',
  foreignField: 'category',
  count: true
});

// Index for better performance
categorySchema.index({ isActive: 1 });
categorySchema.index({ createdBy: 1 });

module.exports = mongoose.model('Category', categorySchema); 
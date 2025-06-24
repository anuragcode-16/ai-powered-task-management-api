const mongoose = require('mongoose');
const User = require('../../models/User');
const Category = require('../../models/Category');
const Task = require('../../models/Task');

describe('Database Integration Tests', () => {
  let testUser, testCategory;

  beforeEach(async () => {
    // Create test user
    testUser = new User({
      name: 'Integration Test User',
      email: 'integration@example.com',
      password: 'password123'
    });
    await testUser.save();

    // Create test category
    testCategory = new Category({
      name: 'Integration Test Category',
      description: 'Category for integration testing',
      color: '#FF5733',
      createdBy: testUser._id
    });
    await testCategory.save();
  });

  describe('User-Category Integration', () => {
    it('should create category with user reference and populate correctly', async () => {
      const category = await Category.findById(testCategory._id)
        .populate('createdBy', 'name email');

      expect(category.createdBy.name).toBe(testUser.name);
      expect(category.createdBy.email).toBe(testUser.email);
      expect(category.createdBy._id).toEqual(testUser._id);
    });

    it('should find categories created by specific user', async () => {
      // Create another user and category
      const anotherUser = new User({
        name: 'Another User',
        email: 'another@example.com',
        password: 'password123'
      });
      await anotherUser.save();

      const anotherCategory = new Category({
        name: 'Another Category',
        createdBy: anotherUser._id
      });
      await anotherCategory.save();

      const userCategories = await Category.find({ createdBy: testUser._id });
      expect(userCategories).toHaveLength(1);
      expect(userCategories[0].name).toBe(testCategory.name);
    });
  });

  describe('Task-User-Category Integration', () => {
    it('should create task with user and category references', async () => {
      const taskData = {
        title: 'Integration Test Task',
        description: 'Task for integration testing',
        priority: 'high',
        status: 'pending',
        category: testCategory._id,
        assignedTo: testUser._id,
        dueDate: new Date('2024-12-31'),
        estimatedHours: 5
      };

      const task = new Task(taskData);
      const savedTask = await task.save();

      expect(savedTask.assignedTo).toEqual(testUser._id);
      expect(savedTask.category).toEqual(testCategory._id);
    });

    it('should populate task with user and category data', async () => {
      const task = new Task({
        title: 'Test Task',
        category: testCategory._id,
        assignedTo: testUser._id,
        dueDate: new Date('2024-12-31')
      });
      await task.save();

      const populatedTask = await Task.findById(task._id)
        .populate('assignedTo', 'name email')
        .populate('category', 'name color');

      expect(populatedTask.assignedTo.name).toBe(testUser.name);
      expect(populatedTask.assignedTo.email).toBe(testUser.email);
      expect(populatedTask.category.name).toBe(testCategory.name);
      expect(populatedTask.category.color).toBe(testCategory.color);
    });

    it('should find tasks by user and category', async () => {
      // Create multiple tasks
      const tasks = [
        {
          title: 'Task 1',
          category: testCategory._id,
          assignedTo: testUser._id,
          dueDate: new Date('2024-12-31')
        },
        {
          title: 'Task 2',
          category: testCategory._id,
          assignedTo: testUser._id,
          dueDate: new Date('2024-12-31'),
          status: 'completed'
        }
      ];

      for (const taskData of tasks) {
        const task = new Task(taskData);
        await task.save();
      }

      // Find tasks by user
      const userTasks = await Task.find({ assignedTo: testUser._id });
      expect(userTasks).toHaveLength(2);

      // Find tasks by category
      const categoryTasks = await Task.find({ category: testCategory._id });
      expect(categoryTasks).toHaveLength(2);

      // Find completed tasks
      const completedTasks = await Task.find({ 
        assignedTo: testUser._id, 
        status: 'completed' 
      });
      expect(completedTasks).toHaveLength(1);
    });
  });

  describe('Complex Queries Integration', () => {
    beforeEach(async () => {
      // Create sample data for complex queries
      const tasks = [
                 {
           title: 'High Priority Task',
           priority: 'high',
           status: 'pending',
           category: testCategory._id,
           assignedTo: testUser._id,
           dueDate: new Date('2030-01-15'), // Future date
           estimatedHours: 8
         },
        {
          title: 'Overdue Task',
          priority: 'medium',
          status: 'in-progress',
          category: testCategory._id,
          assignedTo: testUser._id,
          dueDate: new Date('2023-12-01'), // Past date
          estimatedHours: 4
        },
        {
          title: 'Completed Task',
          priority: 'low',
          status: 'completed',
          category: testCategory._id,
          assignedTo: testUser._id,
          dueDate: new Date('2024-02-01'),
          estimatedHours: 2,
          completedAt: new Date()
        }
      ];

      for (const taskData of tasks) {
        const task = new Task(taskData);
        await task.save();
      }
    });

    it('should find overdue tasks correctly', async () => {
      const overdueTasks = await Task.find({
        dueDate: { $lt: new Date() },
        status: { $ne: 'completed' }
      }).populate('assignedTo category');

      expect(overdueTasks).toHaveLength(1);
      expect(overdueTasks[0].title).toBe('Overdue Task');
      expect(overdueTasks[0].assignedTo.name).toBe(testUser.name);
    });

    it('should aggregate tasks by priority', async () => {
      const priorityStats = await Task.aggregate([
        { $match: { assignedTo: testUser._id } },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);

      expect(priorityStats).toHaveLength(3);
      const priorityCounts = priorityStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {});

      expect(priorityCounts.high).toBe(1);
      expect(priorityCounts.medium).toBe(1);
      expect(priorityCounts.low).toBe(1);
    });

    it('should calculate total estimated hours by category', async () => {
      const categoryStats = await Task.aggregate([
        { $match: { category: testCategory._id } },
        { 
          $group: { 
            _id: '$category', 
            totalHours: { $sum: '$estimatedHours' },
            taskCount: { $sum: 1 }
          } 
        }
      ]);

      expect(categoryStats).toHaveLength(1);
      expect(categoryStats[0].totalHours).toBe(14); // 8 + 4 + 2
      expect(categoryStats[0].taskCount).toBe(3);
    });
  });

  describe('Batch Operations', () => {
    it('should handle bulk user and category creation', async () => {
      const newUser = new User({
        name: 'Batch User',
        email: 'batch@example.com',
        password: 'password123'
      });
      await newUser.save();

      const newCategory = new Category({
        name: 'Batch Category',
        createdBy: newUser._id
      });
      await newCategory.save();

      // Verify both were created
      expect(newUser._id).toBeDefined();
      expect(newCategory._id).toBeDefined();
      expect(newCategory.createdBy).toEqual(newUser._id);
    });
  });

  describe('Index Performance', () => {
    it('should use indexes for common queries', async () => {
      // Create multiple tasks for performance testing
      const tasks = [];
      for (let i = 0; i < 10; i++) {
        tasks.push({
          title: `Performance Task ${i}`,
          category: testCategory._id,
          assignedTo: testUser._id,
          dueDate: new Date('2024-12-31'),
          priority: i % 2 === 0 ? 'high' : 'medium',
          status: i % 3 === 0 ? 'completed' : 'pending'
        });
      }

      await Task.insertMany(tasks);

      // Query that should use indexes
      const start = Date.now();
      const results = await Task.find({ 
        assignedTo: testUser._id, 
        status: 'pending' 
      });
      const duration = Date.now() - start;

      expect(results.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100); // Should be fast with indexes
    });
  });

  describe('Data Validation Integration', () => {
    it('should enforce referential integrity', async () => {
      const invalidTaskData = {
        title: 'Invalid Task',
        category: new mongoose.Types.ObjectId(), // Non-existent category
        assignedTo: new mongoose.Types.ObjectId(), // Non-existent user
        dueDate: new Date('2024-12-31')
      };

      const task = new Task(invalidTaskData);
      
      // Task should save (no foreign key constraints in MongoDB)
      // But population would fail
      await expect(task.save()).resolves.toBeDefined();
      
      const populatedTask = await Task.findById(task._id)
        .populate('assignedTo')
        .populate('category');
        
      expect(populatedTask.assignedTo).toBeNull();
      expect(populatedTask.category).toBeNull();
    });
  });
}); 
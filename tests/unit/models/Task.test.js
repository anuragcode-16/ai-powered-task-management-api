const mongoose = require('mongoose');
const Task = require('../../../models/Task');
const User = require('../../../models/User');
const Category = require('../../../models/Category');

describe('Task Model Unit Tests', () => {
  let testUser, testCategory;

  beforeEach(async () => {
    // Create test user
    testUser = new User({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
    });
    await testUser.save();

    // Create test category
    testCategory = new Category({
      name: 'Test Category',
      description: 'Test category for tasks',
      color: '#FF5733',
      icon: 'test-icon',
      createdBy: testUser._id
    });
    await testCategory.save();
  });

  describe('Task Creation', () => {
    it('should create a valid task with required fields', async () => {
      const taskData = {
        title: 'Test Task',
        description: 'This is a test task',
        priority: 'high',
        status: 'pending',
        category: testCategory._id,
        assignedTo: testUser._id,
        dueDate: new Date('2024-12-31'),
        estimatedHours: 5
      };

      const task = new Task(taskData);
      const savedTask = await task.save();

      expect(savedTask._id).toBeDefined();
      expect(savedTask.title).toBe(taskData.title);
      expect(savedTask.description).toBe(taskData.description);
      expect(savedTask.priority).toBe(taskData.priority);
      expect(savedTask.status).toBe(taskData.status);
      expect(savedTask.estimatedHours).toBe(taskData.estimatedHours);
      expect(savedTask.createdAt).toBeDefined();
      expect(savedTask.updatedAt).toBeDefined();
    });

    it('should fail to create task without required fields', async () => {
      const task = new Task({});
      let error;

      try {
        await task.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.name).toBe('ValidationError');
      expect(error.errors.title).toBeDefined();
      expect(error.errors.category).toBeDefined();
      expect(error.errors.assignedTo).toBeDefined();
      expect(error.errors.dueDate).toBeDefined();
    });

    it('should set default values correctly', async () => {
      const task = new Task({
        title: 'Test Task',
        category: testCategory._id,
        assignedTo: testUser._id,
        dueDate: new Date('2024-12-31')
      });

      await task.save();

      expect(task.priority).toBe('medium');
      expect(task.status).toBe('pending');
      expect(task.actualHours).toBe(0);
      expect(task.isArchived).toBe(false);
    });
  });

  describe('Task Validation', () => {
    it('should validate title length constraints', async () => {
      const longTitle = 'a'.repeat(101);
      const task = new Task({
        title: longTitle,
        category: testCategory._id,
        assignedTo: testUser._id,
        dueDate: new Date('2024-12-31')
      });

      let error;
      try {
        await task.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.title.message).toContain('100 characters');
    });

    it('should validate priority enum values', async () => {
      const task = new Task({
        title: 'Test Task',
        priority: 'invalid-priority',
        category: testCategory._id,
        assignedTo: testUser._id,
        dueDate: new Date('2024-12-31')
      });

      let error;
      try {
        await task.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.priority).toBeDefined();
    });

    it('should validate status enum values', async () => {
      const task = new Task({
        title: 'Test Task',
        status: 'invalid-status',
        category: testCategory._id,
        assignedTo: testUser._id,
        dueDate: new Date('2024-12-31')
      });

      let error;
      try {
        await task.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.status).toBeDefined();
    });

    it('should validate estimated hours range', async () => {
      const task = new Task({
        title: 'Test Task',
        category: testCategory._id,
        assignedTo: testUser._id,
        dueDate: new Date('2024-12-31'),
        estimatedHours: 50 // Exceeds max of 40
      });

      let error;
      try {
        await task.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.estimatedHours).toBeDefined();
    });
  });

  describe('Task Virtuals', () => {
    it('should calculate isOverdue virtual correctly for overdue tasks', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const task = new Task({
        title: 'Overdue Task',
        category: testCategory._id,
        assignedTo: testUser._id,
        dueDate: pastDate,
        status: 'pending'
      });

      await task.save();
      expect(task.isOverdue).toBe(true);
    });

    it('should calculate isOverdue virtual correctly for completed tasks', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const task = new Task({
        title: 'Completed Task',
        category: testCategory._id,
        assignedTo: testUser._id,
        dueDate: pastDate,
        status: 'completed'
      });

      await task.save();
      expect(task.isOverdue).toBe(false);
    });

    it('should calculate progressPercentage virtual correctly', async () => {
      const tasks = [
        { status: 'completed', expectedProgress: 100 },
        { status: 'in-progress', expectedProgress: 50 },
        { status: 'pending', expectedProgress: 0 }
      ];

      for (const taskData of tasks) {
        const task = new Task({
          title: `${taskData.status} Task`,
          category: testCategory._id,
          assignedTo: testUser._id,
          dueDate: new Date('2024-12-31'),
          status: taskData.status
        });

        await task.save();
        expect(task.progressPercentage).toBe(taskData.expectedProgress);
      }
    });
  });

  describe('Task Middleware', () => {
    it('should set completedAt when status changes to completed', async () => {
      const task = new Task({
        title: 'Test Task',
        category: testCategory._id,
        assignedTo: testUser._id,
        dueDate: new Date('2024-12-31'),
        status: 'pending'
      });

      await task.save();
      expect(task.completedAt).toBeUndefined();

      task.status = 'completed';
      await task.save();
      expect(task.completedAt).toBeDefined();
      expect(task.completedAt).toBeInstanceOf(Date);
    });

    it('should clear completedAt when status changes from completed', async () => {
      const task = new Task({
        title: 'Test Task',
        category: testCategory._id,
        assignedTo: testUser._id,
        dueDate: new Date('2024-12-31'),
        status: 'completed',
        completedAt: new Date()
      });

      await task.save();
      expect(task.completedAt).toBeDefined();

      task.status = 'in-progress';
      await task.save();
      expect(task.completedAt).toBeUndefined();
    });
  });

  describe('Task Indexes', () => {
    it('should have proper indexes for performance', () => {
      const indexes = Task.schema.indexes();
      const indexFields = indexes.map(index => Object.keys(index[0]));
      
      expect(indexFields).toContainEqual(['assignedTo', 'status']);
      expect(indexFields).toContainEqual(['dueDate']);
      expect(indexFields).toContainEqual(['priority']);
      expect(indexFields).toContainEqual(['category']);
    });
  });

  describe('Task Population', () => {
    it('should populate assignedTo and category fields correctly', async () => {
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
  });
}); 
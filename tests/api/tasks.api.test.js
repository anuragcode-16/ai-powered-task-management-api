const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const User = require('../../models/User');
const Category = require('../../models/Category');
const Task = require('../../models/Task');

// Create test app
const app = express();
app.use(express.json());

// Import routes
const taskRoutes = require('../../routes/tasks');
app.use('/api/v1/tasks', taskRoutes);

describe('Tasks API Tests', () => {
  let testUser, testCategory, authToken;

  beforeEach(async () => {
    // Create test user
    testUser = new User({
      name: 'API Test User',
      email: 'apitest@example.com',
      password: 'password123'
    });
    await testUser.save();

    // Create test category
    testCategory = new Category({
      name: 'API Test Category',
      description: 'Category for API testing',
      color: '#FF5733',
      createdBy: testUser._id
    });
    await testCategory.save();
  });

  describe('GET /api/v1/tasks', () => {
    beforeEach(async () => {
      // Create sample tasks
      const tasks = [
        {
          title: 'Task 1',
          description: 'First test task',
          priority: 'high',
          status: 'pending',
          category: testCategory._id,
          assignedTo: testUser._id,
          dueDate: new Date('2024-12-31'),
          estimatedHours: 5
        },
        {
          title: 'Task 2',
          description: 'Second test task',
          priority: 'medium',
          status: 'completed',
          category: testCategory._id,
          assignedTo: testUser._id,
          dueDate: new Date('2024-11-30'),
          estimatedHours: 3
        }
      ];

      for (const taskData of tasks) {
        const task = new Task(taskData);
        await task.save();
      }
    });

    it('should get all tasks with default pagination', async () => {
      const response = await request(app)
        .get('/api/v1/tasks')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tasks).toHaveLength(2);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.currentPage).toBe(1);
      expect(response.body.data.pagination.totalTasks).toBe(2);
    });

    it('should filter tasks by status', async () => {
      const response = await request(app)
        .get('/api/v1/tasks?status=completed')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tasks).toHaveLength(1);
      expect(response.body.data.tasks[0].status).toBe('completed');
    });

    it('should filter tasks by priority', async () => {
      const response = await request(app)
        .get('/api/v1/tasks?priority=high')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tasks).toHaveLength(1);
      expect(response.body.data.tasks[0].priority).toBe('high');
    });

    it('should search tasks by title', async () => {
      const response = await request(app)
        .get('/api/v1/tasks?search=Task 1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tasks).toHaveLength(1);
      expect(response.body.data.tasks[0].title).toBe('Task 1');
    });

    it('should handle pagination correctly', async () => {
      const response = await request(app)
        .get('/api/v1/tasks?page=1&limit=1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tasks).toHaveLength(1);
      expect(response.body.data.pagination.currentPage).toBe(1);
      expect(response.body.data.pagination.totalPages).toBe(2);
      expect(response.body.data.pagination.hasNext).toBe(true);
    });

    it('should sort tasks correctly', async () => {
      const response = await request(app)
        .get('/api/v1/tasks?sortBy=priority&sortOrder=asc')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tasks).toHaveLength(2);
      // Should be sorted by priority ascending (high comes after medium alphabetically)
    });
  });

  describe('GET /api/v1/tasks/:id', () => {
    let testTask;

    beforeEach(async () => {
      testTask = new Task({
        title: 'Single Task Test',
        description: 'Task for single retrieval test',
        category: testCategory._id,
        assignedTo: testUser._id,
        dueDate: new Date('2024-12-31')
      });
      await testTask.save();
    });

    it('should get single task by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/tasks/${testTask._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(testTask._id.toString());
      expect(response.body.data.title).toBe(testTask.title);
      expect(response.body.data.assignedTo).toBeDefined();
      expect(response.body.data.category).toBeDefined();
    });

    it('should return 404 for non-existent task', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/v1/tasks/${nonExistentId}`)
        .expect(404);

      expect(response.body.error).toBe('Task not found');
    });

    it('should return 400 for invalid task ID format', async () => {
      const response = await request(app)
        .get('/api/v1/tasks/invalid-id')
        .expect(400);

      expect(response.body.error).toBe('Invalid task ID format');
    });
  });

  describe('POST /api/v1/tasks', () => {
    it('should create a new task with valid data', async () => {
      const taskData = {
        title: 'New Test Task',
        description: 'This is a new test task',
        priority: 'high',
        status: 'pending',
        category: testCategory._id.toString(),
        assignedTo: testUser._id.toString(),
        dueDate: '2024-12-31T00:00:00.000Z',
        estimatedHours: 5
      };

      const response = await request(app)
        .post('/api/v1/tasks')
        .send(taskData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Task created successfully');
      expect(response.body.data.title).toBe(taskData.title);
      expect(response.body.data.priority).toBe(taskData.priority);
      expect(response.body.data.estimatedHours).toBe(taskData.estimatedHours);
    });

    it('should fail to create task without required fields', async () => {
      const response = await request(app)
        .post('/api/v1/tasks')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
    });

    it('should fail to create task with invalid priority', async () => {
      const taskData = {
        title: 'Invalid Task',
        priority: 'invalid-priority',
        category: testCategory._id.toString(),
        assignedTo: testUser._id.toString(),
        dueDate: '2024-12-31T00:00:00.000Z'
      };

      const response = await request(app)
        .post('/api/v1/tasks')
        .send(taskData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should fail to create task with non-existent user', async () => {
      const nonExistentUserId = new mongoose.Types.ObjectId();
      const taskData = {
        title: 'Test Task',
        category: testCategory._id.toString(),
        assignedTo: nonExistentUserId.toString(),
        dueDate: '2024-12-31T00:00:00.000Z'
      };

      const response = await request(app)
        .post('/api/v1/tasks')
        .send(taskData)
        .expect(400);

      expect(response.body.error).toBe('Invalid user assignment');
    });

    it('should fail to create task with non-existent category', async () => {
      const nonExistentCategoryId = new mongoose.Types.ObjectId();
      const taskData = {
        title: 'Test Task',
        category: nonExistentCategoryId.toString(),
        assignedTo: testUser._id.toString(),
        dueDate: '2024-12-31T00:00:00.000Z'
      };

      const response = await request(app)
        .post('/api/v1/tasks')
        .send(taskData)
        .expect(400);

      expect(response.body.error).toBe('Invalid category');
    });
  });

  describe('PUT /api/v1/tasks/:id', () => {
    let testTask;

    beforeEach(async () => {
      testTask = new Task({
        title: 'Update Test Task',
        description: 'Task for update testing',
        priority: 'medium',
        status: 'pending',
        category: testCategory._id,
        assignedTo: testUser._id,
        dueDate: new Date('2024-12-31'),
        estimatedHours: 3
      });
      await testTask.save();
    });

    it('should update task with valid data', async () => {
      const updateData = {
        title: 'Updated Task Title',
        priority: 'high',
        status: 'in-progress',
        estimatedHours: 5,
        category: testCategory._id.toString(),
        assignedTo: testUser._id.toString(),
        dueDate: '2024-12-31T00:00:00.000Z'
      };

      const response = await request(app)
        .put(`/api/v1/tasks/${testTask._id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Task updated successfully');
      expect(response.body.data.title).toBe(updateData.title);
      expect(response.body.data.priority).toBe(updateData.priority);
      expect(response.body.data.status).toBe(updateData.status);
    });

    it('should return 404 for non-existent task update', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const updateData = {
        title: 'Updated Title',
        category: testCategory._id.toString(),
        assignedTo: testUser._id.toString(),
        dueDate: '2024-12-31T00:00:00.000Z'
      };

      const response = await request(app)
        .put(`/api/v1/tasks/${nonExistentId}`)
        .send(updateData)
        .expect(404);

      expect(response.body.error).toBe('Task not found');
    });

    it('should fail to update with invalid data', async () => {
      const updateData = {
        title: 'a'.repeat(101), // Exceeds max length
        category: testCategory._id.toString(),
        assignedTo: testUser._id.toString(),
        dueDate: '2024-12-31T00:00:00.000Z'
      };

      const response = await request(app)
        .put(`/api/v1/tasks/${testTask._id}`)
        .send(updateData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('DELETE /api/v1/tasks/:id', () => {
    let testTask;

    beforeEach(async () => {
      testTask = new Task({
        title: 'Delete Test Task',
        category: testCategory._id,
        assignedTo: testUser._id,
        dueDate: new Date('2024-12-31')
      });
      await testTask.save();
    });

    it('should delete existing task', async () => {
      const response = await request(app)
        .delete(`/api/v1/tasks/${testTask._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Task deleted successfully');

      // Verify task is deleted
      const deletedTask = await Task.findById(testTask._id);
      expect(deletedTask).toBeNull();
    });

    it('should return 404 for non-existent task deletion', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .delete(`/api/v1/tasks/${nonExistentId}`)
        .expect(404);

      expect(response.body.error).toBe('Task not found');
    });

    it('should return 400 for invalid task ID format', async () => {
      const response = await request(app)
        .delete('/api/v1/tasks/invalid-id')
        .expect(400);

      expect(response.body.error).toBe('Invalid task ID format');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle large dataset pagination', async () => {
      // Create 25 tasks
      const tasks = [];
      for (let i = 1; i <= 25; i++) {
        tasks.push({
          title: `Bulk Task ${i}`,
          category: testCategory._id,
          assignedTo: testUser._id,
          dueDate: new Date('2024-12-31')
        });
      }
      await Task.insertMany(tasks);

      const response = await request(app)
        .get('/api/v1/tasks?page=2&limit=10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tasks).toHaveLength(10);
      expect(response.body.data.pagination.currentPage).toBe(2);
      expect(response.body.data.pagination.totalPages).toBe(3);
    });

    it('should handle empty search results', async () => {
      const response = await request(app)
        .get('/api/v1/tasks?search=nonexistent')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tasks).toHaveLength(0);
    });

    it('should handle malformed JSON in POST request', async () => {
      const response = await request(app)
        .post('/api/v1/tasks')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);
    });
  });
}); 
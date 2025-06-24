const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const User = require('../../models/User');

// Create test app
const app = express();
app.use(express.json());

// Import routes
const userRoutes = require('../../routes/users');
app.use('/api/v1/users', userRoutes);

describe('Users API Tests', () => {
  describe('GET /api/v1/users', () => {
    beforeEach(async () => {
      // Create sample users
      const users = [
        {
          name: 'John Doe',
          email: 'john@example.com',
          password: 'password123',
          role: 'user',
          department: 'Engineering'
        },
        {
          name: 'Jane Smith',
          email: 'jane@example.com',
          password: 'password123',
          role: 'admin',
          department: 'Management'
        },
        {
          name: 'Bob Wilson',
          email: 'bob@example.com',
          password: 'password123',
          role: 'user',
          department: 'Engineering',
          isActive: false
        }
      ];

      for (const userData of users) {
        const user = new User(userData);
        await user.save();
      }
    });

    it('should get all users with default pagination', async () => {
      const response = await request(app)
        .get('/api/v1/users')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toHaveLength(3);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.currentPage).toBe(1);
      expect(response.body.data.pagination.totalUsers).toBe(3);
      
      // Check that passwords are not included
      response.body.data.users.forEach(user => {
        expect(user.password).toBeUndefined();
      });
    });

    it('should filter users by role', async () => {
      const response = await request(app)
        .get('/api/v1/users?role=admin')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toHaveLength(1);
      expect(response.body.data.users[0].role).toBe('admin');
      expect(response.body.data.users[0].name).toBe('Jane Smith');
    });

    it('should filter users by department', async () => {
      const response = await request(app)
        .get('/api/v1/users?department=Engineering')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toHaveLength(2);
      response.body.data.users.forEach(user => {
        expect(user.department).toBe('Engineering');
      });
    });

    it('should filter users by active status', async () => {
      const response = await request(app)
        .get('/api/v1/users?isActive=false')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toHaveLength(1);
      expect(response.body.data.users[0].isActive).toBe(false);
      expect(response.body.data.users[0].name).toBe('Bob Wilson');
    });

    it('should search users by name', async () => {
      const response = await request(app)
        .get('/api/v1/users?search=John')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toHaveLength(1);
      expect(response.body.data.users[0].name).toBe('John Doe');
    });

    it('should handle pagination correctly', async () => {
      const response = await request(app)
        .get('/api/v1/users?page=1&limit=2')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toHaveLength(2);
      expect(response.body.data.pagination.currentPage).toBe(1);
      expect(response.body.data.pagination.totalPages).toBe(2);
      expect(response.body.data.pagination.hasNext).toBe(true);
    });
  });

  describe('GET /api/v1/users/:id', () => {
    let testUser;

    beforeEach(async () => {
      testUser = new User({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        role: 'user',
        bio: 'Test user bio'
      });
      await testUser.save();
    });

    it('should get single user by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/users/${testUser._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(testUser._id.toString());
      expect(response.body.data.name).toBe(testUser.name);
      expect(response.body.data.email).toBe(testUser.email);
      expect(response.body.data.bio).toBe(testUser.bio);
      expect(response.body.data.password).toBeUndefined(); // Password should not be included
    });

    it('should return 404 for non-existent user', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/v1/users/${nonExistentId}`)
        .expect(404);

      expect(response.body.error).toBe('User not found');
    });

    it('should return 400 for invalid user ID format', async () => {
      const response = await request(app)
        .get('/api/v1/users/invalid-id')
        .expect(400);

      expect(response.body.error).toBe('Invalid user ID format');
    });
  });

  describe('POST /api/v1/users/register', () => {
    it('should register a new user with valid data', async () => {
      const userData = {
        name: 'New User',
        email: 'newuser@example.com',
        password: 'password123',
        role: 'user',
        bio: 'New user bio'
      };

      const response = await request(app)
        .post('/api/v1/users/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.data.user.name).toBe(userData.name);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.password).toBeUndefined(); // Password should not be in response
      expect(response.body.data.token).toBeDefined(); // Should include JWT token
    });

    it('should fail to register user without required fields', async () => {
      const response = await request(app)
        .post('/api/v1/users/register')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
    });

    it('should fail to register user with invalid email', async () => {
      const userData = {
        name: 'Invalid User',
        email: 'invalid-email',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/v1/users/register')
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should fail to register user with short password', async () => {
      const userData = {
        name: 'Invalid User',
        email: 'invalid@example.com',
        password: '123' // Too short
      };

      const response = await request(app)
        .post('/api/v1/users/register')
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should fail to register user with duplicate email', async () => {
      const userData = {
        name: 'Duplicate User',
        email: 'duplicate@example.com',
        password: 'password123'
      };

      // Create first user
      await request(app)
        .post('/api/v1/users/register')
        .send(userData)
        .expect(201);

      // Try to create second user with same email
      const response = await request(app)
        .post('/api/v1/users/register')
        .send(userData)
        .expect(409);

      expect(response.body.error).toBe('User already exists');
    });

    it('should normalize email to lowercase', async () => {
      const userData = {
        name: 'Test User',
        email: 'TEST@EXAMPLE.COM',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/v1/users/register')
        .send(userData)
        .expect(201);

      expect(response.body.data.user.email).toBe('test@example.com');
    });
  });

  describe('POST /api/v1/users/login', () => {
    let testUser;

    beforeEach(async () => {
      testUser = new User({
        name: 'Login Test User',
        email: 'login@example.com',
        password: 'password123',
        isActive: true
      });
      await testUser.save();
    });

    it('should login user with valid credentials', async () => {
      const loginData = {
        email: 'login@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/v1/users/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.data.user.email).toBe(loginData.email);
      expect(response.body.data.user.password).toBeUndefined();
      expect(response.body.data.token).toBeDefined();
    });

    it('should fail login with invalid email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/v1/users/login')
        .send(loginData)
        .expect(401);

      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should fail login with invalid password', async () => {
      const loginData = {
        email: 'login@example.com',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/v1/users/login')
        .send(loginData)
        .expect(401);

      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should fail login with inactive user', async () => {
      // Create inactive user
      const inactiveUser = new User({
        name: 'Inactive User',
        email: 'inactive@example.com',
        password: 'password123',
        isActive: false
      });
      await inactiveUser.save();

      const loginData = {
        email: 'inactive@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/v1/users/login')
        .send(loginData)
        .expect(401);

      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should fail login without required fields', async () => {
      const response = await request(app)
        .post('/api/v1/users/login')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should handle case-insensitive email login', async () => {
      const loginData = {
        email: 'LOGIN@EXAMPLE.COM', // Uppercase
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/v1/users/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed JSON in POST request', async () => {
      const response = await request(app)
        .post('/api/v1/users/register')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);
    });

    it('should handle empty search results', async () => {
      const response = await request(app)
        .get('/api/v1/users?search=nonexistentuser')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toHaveLength(0);
    });

    it('should handle large dataset pagination', async () => {
      // Create 25 users
      const users = [];
      for (let i = 1; i <= 25; i++) {
        users.push({
          name: `Bulk User ${i}`,
          email: `bulk${i}@example.com`,
          password: 'password123'
        });
      }
      await User.insertMany(users);

      const response = await request(app)
        .get('/api/v1/users?page=2&limit=10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toHaveLength(10);
      expect(response.body.data.pagination.currentPage).toBe(2);
      expect(response.body.data.pagination.totalPages).toBe(3);
    });
  });
}); 
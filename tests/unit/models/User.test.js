const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../../../models/User');

describe('User Model Unit Tests', () => {
  describe('User Creation', () => {
    it('should create a valid user with required fields', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        password: 'password123',
        role: 'user',
        bio: 'Test user bio',
        skills: ['JavaScript', 'Node.js'],
        department: 'Engineering'
      };

      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser._id).toBeDefined();
      expect(savedUser.name).toBe(userData.name);
      expect(savedUser.email).toBe(userData.email);
      expect(savedUser.role).toBe(userData.role);
      expect(savedUser.bio).toBe(userData.bio);
      expect(savedUser.skills).toEqual(userData.skills);
      expect(savedUser.department).toBe(userData.department);
      expect(savedUser.createdAt).toBeDefined();
      expect(savedUser.updatedAt).toBeDefined();
    });

    it('should fail to create user without required fields', async () => {
      const user = new User({});
      let error;

      try {
        await user.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.name).toBe('ValidationError');
      expect(error.errors.name).toBeDefined();
      expect(error.errors.email).toBeDefined();
      expect(error.errors.password).toBeDefined();
    });

    it('should set default values correctly', async () => {
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      });

      await user.save();

      expect(user.role).toBe('user');
      expect(user.isActive).toBe(true);
      expect(user.preferences.theme).toBe('light');
      expect(user.preferences.notifications.email).toBe(true);
      expect(user.preferences.notifications.push).toBe(true);
      expect(user.aiPreferences.enableRecommendations).toBe(true);
      expect(user.aiPreferences.preferredWorkingHours.start).toBe(9);
      expect(user.aiPreferences.preferredWorkingHours.end).toBe(17);
    });
  });

  describe('User Validation', () => {
    it('should validate name length constraints', async () => {
      const longName = 'a'.repeat(51);
      const user = new User({
        name: longName,
        email: 'test@example.com',
        password: 'password123'
      });

      let error;
      try {
        await user.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.name.message).toContain('50 characters');
    });

    it('should validate email format', async () => {
      const user = new User({
        name: 'Test User',
        email: 'invalid-email',
        password: 'password123'
      });

      let error;
      try {
        await user.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.email).toBeDefined();
    });

    it('should validate password length', async () => {
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        password: '123' // Too short
      });

      let error;
      try {
        await user.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.password.message).toContain('6 characters');
    });

    it('should validate role enum values', async () => {
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        role: 'invalid-role'
      });

      let error;
      try {
        await user.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.role).toBeDefined();
    });

    it('should enforce unique email constraint', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      };

      const user1 = new User(userData);
      await user1.save();

      const user2 = new User(userData);
      let error;

      try {
        await user2.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.code).toBe(11000); // MongoDB duplicate key error
    });
  });

  describe('Password Hashing', () => {
    it('should hash password before saving', async () => {
      const password = 'password123';
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        password: password
      });

      await user.save();

      expect(user.password).not.toBe(password);
      expect(user.password).toMatch(/^\$2[ayb]\$.{56}$/); // bcrypt hash pattern
    });

    it('should not hash password if not modified', async () => {
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      });

      await user.save();
      const originalHash = user.password;

      user.name = 'Updated Name';
      await user.save();

      expect(user.password).toBe(originalHash);
    });
  });

  describe('User Methods', () => {
    it('should compare password correctly', async () => {
      const password = 'password123';
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        password: password
      });

      await user.save();

      const isMatch = await user.comparePassword(password);
      const isNotMatch = await user.comparePassword('wrongpassword');

      expect(isMatch).toBe(true);
      expect(isNotMatch).toBe(false);
    });

    it('should update last login correctly', async () => {
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      });

      await user.save();
      expect(user.lastLogin).toBeUndefined();

      await user.updateLastLogin();

      expect(user.lastLogin).toBeDefined();
      expect(user.lastLogin).toBeInstanceOf(Date);
    });

    it('should get AI preferences correctly', async () => {
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        aiPreferences: {
          enableRecommendations: false,
          preferredWorkingHours: {
            start: 10,
            end: 18
          },
          productivityStyle: 'night-owl'
        },
        preferences: {
          timezone: 'America/New_York'
        }
      });

      await user.save();
      const aiPrefs = user.getAIPreferences();

      expect(aiPrefs.enableRecommendations).toBe(false);
      expect(aiPrefs.preferredWorkingHours.start).toBe(10);
      expect(aiPrefs.preferredWorkingHours.end).toBe(18);
      expect(aiPrefs.productivityStyle).toBe('night-owl');
      expect(aiPrefs.timezone).toBe('America/New_York');
    });
  });

  describe('User Virtuals', () => {
    it('should return profile virtual correctly', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        password: 'password123',
        role: 'admin',
        avatar: 'avatar-url',
        bio: 'Test bio',
        skills: ['JavaScript', 'Python'],
        department: 'Engineering'
      };

      const user = new User(userData);
      await user.save();

      const profile = user.profile;

      expect(profile.id).toEqual(user._id);
      expect(profile.name).toBe(userData.name);
      expect(profile.email).toBe(userData.email);
      expect(profile.role).toBe(userData.role);
      expect(profile.avatar).toBe(userData.avatar);
      expect(profile.bio).toBe(userData.bio);
      expect(profile.skills).toEqual(userData.skills);
      expect(profile.department).toBe(userData.department);
      expect(profile.password).toBeUndefined(); // Password should not be in profile
    });
  });

  describe('User Indexes', () => {
    it('should have proper indexes for performance', () => {
      const indexes = User.schema.indexes();
      const indexFields = indexes.map(index => Object.keys(index[0]));
      
      expect(indexFields).toContainEqual(['role']);
      expect(indexFields).toContainEqual(['isActive']);
      expect(indexFields).toContainEqual(['email']);
    });
  });

  describe('User Password Selection', () => {
    it('should exclude password by default in queries', async () => {
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      });

      await user.save();

      const foundUser = await User.findById(user._id);
      expect(foundUser.password).toBeUndefined();
    });

    it('should include password when explicitly selected', async () => {
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      });

      await user.save();

      const foundUser = await User.findById(user._id).select('+password');
      expect(foundUser.password).toBeDefined();
    });
  });

  describe('User Preferences', () => {
    it('should handle nested preferences correctly', async () => {
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        preferences: {
          theme: 'dark',
          notifications: {
            email: false,
            push: true,
            gamification: false
          },
          timezone: 'Europe/London'
        }
      });

      await user.save();

      expect(user.preferences.theme).toBe('dark');
      expect(user.preferences.notifications.email).toBe(false);
      expect(user.preferences.notifications.push).toBe(true);
      expect(user.preferences.notifications.gamification).toBe(false);
      expect(user.preferences.timezone).toBe('Europe/London');
    });
  });
}); 
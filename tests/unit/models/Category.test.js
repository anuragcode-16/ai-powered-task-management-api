const mongoose = require('mongoose');
const Category = require('../../../models/Category');
const User = require('../../../models/User');

describe('Category Model Unit Tests', () => {
  let testUser;

  beforeEach(async () => {
    // Create test user for category creation
    testUser = new User({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
    });
    await testUser.save();
  });

  describe('Category Creation', () => {
    it('should create a valid category with required fields', async () => {
      const categoryData = {
        name: 'Work Tasks',
        description: 'Tasks related to work projects',
        color: '#FF5733',
        icon: 'briefcase',
        createdBy: testUser._id
      };

      const category = new Category(categoryData);
      const savedCategory = await category.save();

      expect(savedCategory._id).toBeDefined();
      expect(savedCategory.name).toBe(categoryData.name);
      expect(savedCategory.description).toBe(categoryData.description);
      expect(savedCategory.color).toBe(categoryData.color);
      expect(savedCategory.icon).toBe(categoryData.icon);
      expect(savedCategory.createdBy).toEqual(testUser._id);
      expect(savedCategory.createdAt).toBeDefined();
      expect(savedCategory.updatedAt).toBeDefined();
    });

    it('should fail to create category without required fields', async () => {
      const category = new Category({});
      let error;

      try {
        await category.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.name).toBe('ValidationError');
      expect(error.errors.name).toBeDefined();
      expect(error.errors.createdBy).toBeDefined();
    });

    it('should set default values correctly', async () => {
      const category = new Category({
        name: 'Test Category',
        createdBy: testUser._id
      });

      await category.save();

      expect(category.color).toBe('#3498db');
      expect(category.icon).toBe('folder');
      expect(category.isActive).toBe(true);
    });
  });

  describe('Category Validation', () => {
    it('should validate name length constraints', async () => {
      const longName = 'a'.repeat(51);
      const category = new Category({
        name: longName,
        createdBy: testUser._id
      });

      let error;
      try {
        await category.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.name.message).toContain('50 characters');
    });

    it('should validate description length constraints', async () => {
      const longDescription = 'a'.repeat(201);
      const category = new Category({
        name: 'Test Category',
        description: longDescription,
        createdBy: testUser._id
      });

      let error;
      try {
        await category.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.description.message).toContain('200 characters');
    });

    it('should validate color hex format', async () => {
      const category = new Category({
        name: 'Test Category',
        color: 'invalid-color',
        createdBy: testUser._id
      });

      let error;
      try {
        await category.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.color.message).toContain('valid hex color');
    });

    it('should accept valid hex color formats', async () => {
      const validColors = ['#FF5733', '#f53', '#123ABC'];

      for (const color of validColors) {
        const category = new Category({
          name: `Test Category ${color}`,
          color: color,
          createdBy: testUser._id
        });

        const savedCategory = await category.save();
        expect(savedCategory.color).toBe(color);
      }
    });

    it('should enforce unique category names', async () => {
      const categoryData = {
        name: 'Unique Category',
        createdBy: testUser._id
      };

      const category1 = new Category(categoryData);
      await category1.save();

      const category2 = new Category(categoryData);
      let error;

      try {
        await category2.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.code).toBe(11000); // MongoDB duplicate key error
    });
  });

  describe('Category Trimming', () => {
    it('should trim name and description fields', async () => {
      const category = new Category({
        name: '  Work Tasks  ',
        description: '  Work related tasks  ',
        createdBy: testUser._id
      });

      await category.save();

      expect(category.name).toBe('Work Tasks');
      expect(category.description).toBe('Work related tasks');
    });

    it('should trim color and icon fields', async () => {
      const category = new Category({
        name: 'Test Category',
        color: '  #FF5733  ',
        icon: '  briefcase  ',
        createdBy: testUser._id
      });

      await category.save();

      expect(category.color).toBe('#FF5733');
      expect(category.icon).toBe('briefcase');
    });
  });

  describe('Category Virtuals', () => {
    it('should define taskCount virtual', async () => {
      const category = new Category({
        name: 'Test Category',
        createdBy: testUser._id
      });

      await category.save();

      // The virtual should be defined (actual counting would require populated tasks)
      expect(category.schema.virtuals.taskCount).toBeDefined();
    });
  });

  describe('Category Indexes', () => {
    it('should have proper indexes for performance', () => {
      const indexes = Category.schema.indexes();
      const indexFields = indexes.map(index => Object.keys(index[0]));
      
      expect(indexFields).toContainEqual(['isActive']);
      expect(indexFields).toContainEqual(['createdBy']);
    });
  });

  describe('Category Population', () => {
    it('should populate createdBy field correctly', async () => {
      const category = new Category({
        name: 'Test Category',
        createdBy: testUser._id
      });

      await category.save();
      
      const populatedCategory = await Category.findById(category._id)
        .populate('createdBy', 'name email');

      expect(populatedCategory.createdBy.name).toBe(testUser.name);
      expect(populatedCategory.createdBy.email).toBe(testUser.email);
    });
  });

  describe('Category Query Methods', () => {
    it('should filter active categories correctly', async () => {
      // Create active category
      const activeCategory = new Category({
        name: 'Active Category',
        createdBy: testUser._id,
        isActive: true
      });
      await activeCategory.save();

      // Create inactive category
      const inactiveCategory = new Category({
        name: 'Inactive Category',
        createdBy: testUser._id,
        isActive: false
      });
      await inactiveCategory.save();

      const activeCategories = await Category.find({ isActive: true });
      const inactiveCategories = await Category.find({ isActive: false });

      expect(activeCategories).toHaveLength(1);
      expect(activeCategories[0].name).toBe('Active Category');
      expect(inactiveCategories).toHaveLength(1);
      expect(inactiveCategories[0].name).toBe('Inactive Category');
    });
  });
}); 
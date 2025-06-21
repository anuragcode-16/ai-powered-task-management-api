const mongoose = require('mongoose');
const { Achievement } = require('../models/Gamification');
require('dotenv').config();

// Default achievements to initialize
const defaultAchievements = [
  // Task achievements
  {
    name: 'First Steps',
    description: 'Complete your first task',
    icon: '🎯',
    points: 50,
    category: 'tasks',
    requirements: new Map([['tasksCompleted', 1]]),
    isSecret: false
  },
  {
    name: 'Task Master',
    description: 'Complete 50 tasks',
    icon: '🏆',
    points: 500,
    category: 'tasks',
    requirements: new Map([['tasksCompleted', 50]]),
    isSecret: false
  },
  {
    name: 'Lightning Fast',
    description: 'Complete 5 tasks in one day',
    icon: '⚡',
    points: 200,
    category: 'tasks',
    requirements: new Map([['tasksInOneDay', 5]]),
    isSecret: false
  },
  
  // Habit achievements
  {
    name: 'Habit Starter',
    description: 'Create your first habit',
    icon: '🌟',
    points: 30,
    category: 'habits',
    requirements: new Map([['habitsCreated', 1]]),
    isSecret: false
  },
  {
    name: 'Consistency King',
    description: 'Complete 100 habits',
    icon: '👑',
    points: 1000,
    category: 'habits',
    requirements: new Map([['habitsCompleted', 100]]),
    isSecret: false
  },
  
  // Streak achievements
  {
    name: 'Week Warrior',
    description: 'Maintain a 7-day task streak',
    icon: '🔥',
    points: 300,
    category: 'streak',
    requirements: new Map([['taskStreak', 7]]),
    isSecret: false
  },
  {
    name: 'Month Master',
    description: 'Maintain a 30-day task streak',
    icon: '🏔️',
    points: 1500,
    category: 'streak',
    requirements: new Map([['taskStreak', 30]]),
    isSecret: false
  },
  
  // Time achievements
  {
    name: 'Early Bird',
    description: 'Complete tasks before 8 AM (5 times)',
    icon: '🌅',
    points: 150,
    category: 'time',
    requirements: new Map([['earlyTasks', 5]]),
    isSecret: false
  },
  {
    name: 'Night Owl',
    description: 'Complete tasks after 10 PM (5 times)',
    icon: '🦉',
    points: 150,
    category: 'time',
    requirements: new Map([['lateTasks', 5]]),
    isSecret: false
  },
  
  // Special achievements
  {
    name: 'Perfect Week',
    description: 'Complete all planned tasks for a week',
    icon: '💎',
    points: 1000,
    category: 'special',
    requirements: new Map([['perfectWeeks', 1]]),
    isSecret: false
  },
  {
    name: 'AI Enthusiast',
    description: 'Use AI recommendations for 10 tasks',
    icon: '🤖',
    points: 200,
    category: 'special',
    requirements: new Map([['aiRecommendationsUsed', 10]]),
    isSecret: true
  }
];

async function initializeAchievements() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-task-management');
    console.log('✅ Connected to MongoDB');
    
    // Clear existing achievements (optional - remove in production)
    await Achievement.deleteMany({});
    console.log('🗑️  Cleared existing achievements');
    
    // Insert default achievements
    const createdAchievements = await Achievement.insertMany(defaultAchievements);
    console.log(`✅ Created ${createdAchievements.length} achievements:`);
    
    createdAchievements.forEach(achievement => {
      console.log(`   - ${achievement.icon} ${achievement.name} (${achievement.points} XP)`);
    });
    
    console.log('\n🎉 Achievement initialization completed successfully!');
    
  } catch (error) {
    console.error('❌ Failed to initialize achievements:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the initialization
if (require.main === module) {
  initializeAchievements();
}

module.exports = { initializeAchievements, defaultAchievements }; 
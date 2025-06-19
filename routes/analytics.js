const express = require('express');
const Task = require('../models/Task');
const User = require('../models/User');
const Category = require('../models/Category');

const router = express.Router();

// GET /api/v1/analytics/dashboard - Get dashboard overview
router.get('/dashboard', async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate;
    switch (timeframe) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Parallel aggregations for better performance
    const [
      taskStats,
      statusBreakdown,
      priorityBreakdown,
      categoryBreakdown,
      userStats,
      productivityTrends,
      overdueTasks
    ] = await Promise.all([
      // Overall task statistics
      Task.aggregate([
        {
          $group: {
            _id: null,
            totalTasks: { $sum: 1 },
            completedTasks: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            overdueTasks: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $lt: ['$dueDate', now] },
                      { $ne: ['$status', 'completed'] }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            totalEstimatedHours: { $sum: '$estimatedHours' },
            totalActualHours: { $sum: '$actualHours' },
            avgEstimatedHours: { $avg: '$estimatedHours' },
            avgActualHours: { $avg: '$actualHours' }
          }
        }
      ]),

      // Task status breakdown
      Task.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            avgHours: { $avg: '$actualHours' }
          }
        }
      ]),

      // Priority breakdown
      Task.aggregate([
        {
          $group: {
            _id: '$priority',
            count: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            }
          }
        }
      ]),

      // Category breakdown
      Task.aggregate([
        {
          $lookup: {
            from: 'categories',
            localField: 'category',
            foreignField: '_id',
            as: 'categoryInfo'
          }
        },
        {
          $unwind: '$categoryInfo'
        },
        {
          $group: {
            _id: {
              id: '$categoryInfo._id',
              name: '$categoryInfo.name',
              color: '$categoryInfo.color'
            },
            taskCount: { $sum: 1 },
            completedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            totalHours: { $sum: '$actualHours' }
          }
        },
        { $sort: { taskCount: -1 } },
        { $limit: 10 }
      ]),

      // User statistics
      User.aggregate([
        {
          $lookup: {
            from: 'tasks',
            localField: '_id',
            foreignField: 'assignedTo',
            as: 'assignedTasks'
          }
        },
        {
          $project: {
            name: 1,
            email: 1,
            role: 1,
            taskCount: { $size: '$assignedTasks' },
            completedTasks: {
              $size: {
                $filter: {
                  input: '$assignedTasks',
                  cond: { $eq: ['$$this.status', 'completed'] }
                }
              }
            },
            totalHours: {
              $sum: '$assignedTasks.actualHours'
            }
          }
        },
        { $sort: { taskCount: -1 } },
        { $limit: 10 }
      ]),

      // Productivity trends (last 30 days)
      Task.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            tasksCreated: { $sum: 1 },
            tasksCompleted: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            hoursLogged: { $sum: '$actualHours' }
          }
        },
        {
          $sort: {
            '_id.year': 1,
            '_id.month': 1,
            '_id.day': 1
          }
        }
      ]),

      // Overdue tasks summary
      Task.aggregate([
        {
          $match: {
            dueDate: { $lt: now },
            status: { $ne: 'completed' }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'assignedTo',
            foreignField: '_id',
            as: 'assigneeInfo'
          }
        },
        {
          $lookup: {
            from: 'categories',
            localField: 'category',
            foreignField: '_id',
            as: 'categoryInfo'
          }
        },
        {
          $project: {
            title: 1,
            priority: 1,
            dueDate: 1,
            status: 1,
            assignee: { $arrayElemAt: ['$assigneeInfo.name', 0] },
            category: { $arrayElemAt: ['$categoryInfo.name', 0] },
            daysOverdue: {
              $divide: [
                { $subtract: [now, '$dueDate'] },
                1000 * 60 * 60 * 24
              ]
            }
          }
        },
        { $sort: { daysOverdue: -1 } },
        { $limit: 10 }
      ])
    ]);

    // Calculate completion rate and efficiency metrics
    const totalTasks = taskStats[0]?.totalTasks || 0;
    const completedTasks = taskStats[0]?.completedTasks || 0;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    const totalEstimated = taskStats[0]?.totalEstimatedHours || 0;
    const totalActual = taskStats[0]?.totalActualHours || 0;
    const efficiencyRate = totalEstimated > 0 ? (totalEstimated / totalActual) * 100 : 0;

    res.json({
      success: true,
      data: {
        overview: {
          totalTasks,
          completedTasks,
          completionRate: Math.round(completionRate * 100) / 100,
          overdueTasks: taskStats[0]?.overdueTasks || 0,
          efficiencyRate: Math.round(efficiencyRate * 100) / 100,
          totalHoursLogged: totalActual,
          avgTaskDuration: taskStats[0]?.avgActualHours || 0
        },
        breakdown: {
          status: statusBreakdown,
          priority: priorityBreakdown,
          categories: categoryBreakdown
        },
        topPerformers: userStats,
        trends: productivityTrends,
        overdueHighlights: overdueTasks,
        timeframe,
        generatedAt: new Date()
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate dashboard analytics',
      message: error.message
    });
  }
});

// GET /api/v1/analytics/tasks - Detailed task analytics
router.get('/tasks', async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      groupBy = 'day',
      status,
      priority,
      category,
      assignedTo 
    } = req.query;

    // Build match conditions
    const matchConditions = {};
    if (startDate) matchConditions.createdAt = { $gte: new Date(startDate) };
    if (endDate) {
      if (matchConditions.createdAt) {
        matchConditions.createdAt.$lte = new Date(endDate);
      } else {
        matchConditions.createdAt = { $lte: new Date(endDate) };
      }
    }
    if (status) matchConditions.status = status;
    if (priority) matchConditions.priority = priority;
    if (category) matchConditions.category = category;
    if (assignedTo) matchConditions.assignedTo = assignedTo;

    // Group by configuration
    let groupId;
    switch (groupBy) {
      case 'hour':
        groupId = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
          hour: { $hour: '$createdAt' }
        };
        break;
      case 'day':
        groupId = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
        break;
      case 'week':
        groupId = {
          year: { $year: '$createdAt' },
          week: { $week: '$createdAt' }
        };
        break;
      case 'month':
        groupId = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        };
        break;
      default:
        groupId = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
    }

    const analytics = await Task.aggregate([
      { $match: matchConditions },
      {
        $group: {
          _id: groupId,
          totalTasks: { $sum: 1 },
          completedTasks: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          inProgressTasks: {
            $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] }
          },
          pendingTasks: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          cancelledTasks: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          highPriorityTasks: {
            $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] }
          },
          mediumPriorityTasks: {
            $sum: { $cond: [{ $eq: ['$priority', 'medium'] }, 1, 0] }
          },
          lowPriorityTasks: {
            $sum: { $cond: [{ $eq: ['$priority', 'low'] }, 1, 0] }
          },
          totalEstimatedHours: { $sum: '$estimatedHours' },
          totalActualHours: { $sum: '$actualHours' },
          avgEstimatedHours: { $avg: '$estimatedHours' },
          avgActualHours: { $avg: '$actualHours' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        analytics,
        filters: { startDate, endDate, groupBy, status, priority, category, assignedTo },
        summary: {
          totalRecords: analytics.length,
          totalTasks: analytics.reduce((sum, item) => sum + item.totalTasks, 0),
          totalCompleted: analytics.reduce((sum, item) => sum + item.completedTasks, 0),
          totalHours: analytics.reduce((sum, item) => sum + item.totalActualHours, 0)
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate task analytics',
      message: error.message
    });
  }
});

// GET /api/v1/analytics/users/:id - User performance analytics
router.get('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const { timeframe = '30d' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate;
    switch (timeframe) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Check if user exists
    const user = await User.findById(userId).select('name email role');
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: `No user found with ID: ${userId}`
      });
    }

    const [userStats, taskBreakdown, productivityTrend, recentActivity] = await Promise.all([
      // Overall user statistics
      Task.aggregate([
        { $match: { assignedTo: user._id } },
        {
          $group: {
            _id: null,
            totalAssigned: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            inProgress: {
              $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] }
            },
            pending: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
            },
            overdue: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $lt: ['$dueDate', now] },
                      { $ne: ['$status', 'completed'] }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            totalHours: { $sum: '$actualHours' },
            avgHours: { $avg: '$actualHours' },
            totalEstimated: { $sum: '$estimatedHours' },
            avgEstimated: { $avg: '$estimatedHours' }
          }
        }
      ]),

      // Task breakdown by priority and category
      Task.aggregate([
        { $match: { assignedTo: user._id } },
        {
          $lookup: {
            from: 'categories',
            localField: 'category',
            foreignField: '_id',
            as: 'categoryInfo'
          }
        },
        {
          $group: {
            _id: {
              priority: '$priority',
              category: { $arrayElemAt: ['$categoryInfo.name', 0] }
            },
            count: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            hoursSpent: { $sum: '$actualHours' }
          }
        }
      ]),

      // Productivity trend over time
      Task.aggregate([
        {
          $match: {
            assignedTo: user._id,
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            tasksAssigned: { $sum: 1 },
            tasksCompleted: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            hoursLogged: { $sum: '$actualHours' }
          }
        },
        { $sort: { '_id': 1 } }
      ]),

      // Recent activity
      Task.find({ assignedTo: user._id })
        .sort({ updatedAt: -1 })
        .limit(10)
        .populate('category', 'name color')
        .select('title status priority dueDate actualHours updatedAt')
    ]);

    const stats = userStats[0] || {};
    const completionRate = stats.totalAssigned > 0 
      ? (stats.completed / stats.totalAssigned) * 100 
      : 0;
    
    const efficiencyRate = stats.totalEstimated > 0 
      ? (stats.totalEstimated / stats.totalHours) * 100 
      : 0;

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        performance: {
          totalAssigned: stats.totalAssigned || 0,
          completed: stats.completed || 0,
          inProgress: stats.inProgress || 0,
          pending: stats.pending || 0,
          overdue: stats.overdue || 0,
          completionRate: Math.round(completionRate * 100) / 100,
          totalHours: stats.totalHours || 0,
          avgHoursPerTask: stats.avgHours || 0,
          efficiencyRate: Math.round(efficiencyRate * 100) / 100
        },
        breakdown: taskBreakdown,
        trends: productivityTrend,
        recentActivity,
        timeframe,
        generatedAt: new Date()
      }
    });

  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'Invalid user ID format',
        message: 'The provided ID is not a valid MongoDB ObjectId'
      });
    }
    res.status(500).json({
      error: 'Failed to generate user analytics',
      message: error.message
    });
  }
});

// GET /api/v1/analytics/reports/export - Export analytics data
router.get('/reports/export', async (req, res) => {
  try {
    const { 
      format = 'json',
      reportType = 'dashboard',
      startDate,
      endDate,
      includeCharts = false
    } = req.query;

    let reportData;

    switch (reportType) {
      case 'dashboard':
        // Reuse dashboard logic
        const dashboardUrl = `/api/v1/analytics/dashboard`;
        reportData = await fetch(dashboardUrl).then(r => r.json());
        break;
      
      case 'tasks':
        const tasksUrl = `/api/v1/analytics/tasks?startDate=${startDate}&endDate=${endDate}`;
        reportData = await fetch(tasksUrl).then(r => r.json());
        break;
      
      default:
        return res.status(400).json({
          error: 'Invalid report type',
          message: 'Supported types: dashboard, tasks'
        });
    }

    // Set appropriate headers based on format
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${reportType}-report-${new Date().toISOString().split('T')[0]}.csv"`);
      
      // Convert to CSV (simplified)
      const csvData = JSON.stringify(reportData.data);
      res.send(csvData);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${reportType}-report-${new Date().toISOString().split('T')[0]}.json"`);
      
      res.json({
        success: true,
        reportType,
        exportedAt: new Date(),
        data: reportData.data
      });
    }

  } catch (error) {
    res.status(500).json({
      error: 'Failed to export report',
      message: error.message
    });
  }
});

module.exports = router; 
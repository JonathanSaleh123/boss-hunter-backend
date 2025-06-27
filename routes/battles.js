import express from 'express';
import Battle from '../models/Battle.js';
import User from '../models/User.js';

const router = express.Router();

// Create a new battle record
router.post('/battles', async (req, res) => {
  try {
    const { battleData } = req.body;

    if (!battleData) {
      return res.status(400).json({ error: 'Battle data is required' });
    }

    const battle = new Battle(battleData);
    await battle.save();

    res.json({ battle: battle.toObject() });
  } catch (error) {
    console.error('Error creating battle:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get battle by ID
router.get('/battles/:battleId', async (req, res) => {
  try {
    const { battleId } = req.params;
    const battle = await Battle.findById(battleId);
    
    if (!battle) {
      return res.status(404).json({ error: 'Battle not found' });
    }

    res.json({ battle: battle.toObject() });
  } catch (error) {
    console.error('Error fetching battle:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recent battles (global)
router.get('/battles', async (req, res) => {
  try {
    const { page = 1, limit = 10, outcome } = req.query;
    
    let query = {};
    if (outcome) {
      query.outcome = outcome;
    }

    const battles = await Battle.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Battle.countDocuments(query);

    res.json({
      battles,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching battles:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get battle statistics
router.get('/battles/stats/global', async (req, res) => {
  try {
    const totalBattles = await Battle.countDocuments();
    const victories = await Battle.countDocuments({ outcome: 'victory' });
    const defeats = await Battle.countDocuments({ outcome: 'defeat' });
    const draws = await Battle.countDocuments({ outcome: 'draw' });

    // Get average battle duration
    const avgDuration = await Battle.aggregate([
      { $group: { _id: null, avgDuration: { $avg: '$duration' } } }
    ]);

    // Get most common boss
    const bossStats = await Battle.aggregate([
      { $group: { _id: '$bossName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    const stats = {
      totalBattles,
      victories,
      defeats,
      draws,
      winRate: totalBattles > 0 ? (victories / totalBattles * 100).toFixed(1) : 0,
      avgDuration: avgDuration.length > 0 ? Math.round(avgDuration[0].avgDuration) : 0,
      topBosses: bossStats
    };

    res.json({ stats });
  } catch (error) {
    console.error('Error fetching battle stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get leaderboard
router.get('/battles/leaderboard', async (req, res) => {
  try {
    const { timeframe = 'all' } = req.query;
    
    let dateFilter = {};
    if (timeframe === 'week') {
      dateFilter = { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } };
    } else if (timeframe === 'month') {
      dateFilter = { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } };
    }

    const leaderboard = await Battle.aggregate([
      { $match: dateFilter },
      { $unwind: '$participants' },
      { $group: {
        _id: '$participants.playerEmail',
        totalBattles: { $sum: 1 },
        victories: { $sum: { $cond: [{ $eq: ['$outcome', 'victory'] }, 1, 0] } },
        totalDamageDealt: { $sum: '$participants.damageDealt' },
        totalDamageTaken: { $sum: '$participants.damageTaken' }
      }},
      { $addFields: {
        winRate: { $multiply: [{ $divide: ['$victories', '$totalBattles'] }, 100] }
      }},
      { $sort: { winRate: -1, totalBattles: -1 } },
      { $limit: 10 }
    ]);

    res.json({ leaderboard });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 
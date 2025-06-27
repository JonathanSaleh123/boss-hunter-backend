import express from 'express';
import User from '../models/User.js';
import Character from '../models/Character.js';
import Battle from '../models/Battle.js';

const router = express.Router();

// Create or update user (called after Auth0 login)
router.post('/users', async (req, res) => {
  try {
    const { email, name, image, auth0Id } = req.body;

    if (!email || !name || !auth0Id) {
      return res.status(400).json({ error: 'Email, name, and auth0Id are required' });
    }

    // First, try to find user by auth0Id
    let user = await User.findOne({ auth0Id });

    if (user) {
      // Update existing user
      user.email = email;
      user.name = name;
      user.image = image;
      user.lastLogin = new Date();
      await user.save();
    } else {
      // If not found by auth0Id, check if user exists by email
      user = await User.findOne({ email });
      
      if (user) {
        // User exists with this email but different auth0Id
        // Update the auth0Id to link the accounts
        user.auth0Id = auth0Id;
        user.name = name;
        user.image = image;
        user.lastLogin = new Date();
        await user.save();
      } else {
        // Create new user
        try {
          user = new User({
            email,
            name,
            image,
            auth0Id
          });
          await user.save();
        } catch (saveError) {
          // Handle duplicate key error
          if (saveError.code === 11000) {
            // Duplicate email, try to find and update the existing user
            user = await User.findOne({ email });
            if (user) {
              user.auth0Id = auth0Id;
              user.name = name;
              user.image = image;
              user.lastLogin = new Date();
              await user.save();
            } else {
              throw saveError;
            }
          } else {
            throw saveError;
          }
        }
      }
    }

    res.json({ user: user.toObject() });
  } catch (error) {
    console.error('Error creating/updating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by auth0Id
router.get('/users/:auth0Id', async (req, res) => {
  try {
    const { auth0Id } = req.params;
    const user = await User.findOne({ auth0Id }).populate('characters');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: user.toObject() });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's characters
router.get('/users/:auth0Id/characters', async (req, res) => {
  try {
    const { auth0Id } = req.params;
    const user = await User.findOne({ auth0Id }).populate('characters');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ characters: user.characters });
  } catch (error) {
    console.error('Error fetching user characters:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's battle history
router.get('/users/:auth0Id/battles', async (req, res) => {
  try {
    const { auth0Id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const user = await User.findOne({ auth0Id });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const battles = await Battle.find({
      'participants.playerEmail': user.email
    })
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .exec();

    const total = await Battle.countDocuments({
      'participants.playerEmail': user.email
    });

    res.json({
      battles,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching user battles:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user statistics
router.get('/users/:auth0Id/stats', async (req, res) => {
  try {
    const { auth0Id } = req.params;
    const user = await User.findOne({ auth0Id });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const battles = await Battle.find({
      'participants.playerEmail': user.email
    });

    const stats = {
      totalBattles: battles.length,
      victories: battles.filter(b => b.outcome === 'victory').length,
      defeats: battles.filter(b => b.outcome === 'defeat').length,
      draws: battles.filter(b => b.outcome === 'draw').length,
      totalCharacters: user.characters.length,
      winRate: battles.length > 0 ? 
        (battles.filter(b => b.outcome === 'victory').length / battles.length * 100).toFixed(1) : 0
    };

    res.json({ stats });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 
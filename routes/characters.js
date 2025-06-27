import express from 'express';
import Character from '../models/Character.js';
import User from '../models/User.js';

const router = express.Router();

// Create a new character
router.post('/characters', async (req, res) => {
  try {
    const { characterData, auth0Id } = req.body;

    if (!characterData || !auth0Id) {
      return res.status(400).json({ error: 'Character data and auth0Id are required' });
    }

    // Find the user
    const user = await User.findOne({ auth0Id });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create the character
    const character = new Character({
      ...characterData,
      owner: user._id
    });

    await character.save();

    // Add character to user's characters array
    user.characters.push(character._id);
    await user.save();

    res.json({ character: character.toObject() });
  } catch (error) {
    console.error('Error creating character:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get character by ID
router.get('/characters/:characterId', async (req, res) => {
  try {
    const { characterId } = req.params;
    const character = await Character.findById(characterId).populate('owner', 'email name');
    
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    res.json({ character: character.toObject() });
  } catch (error) {
    console.error('Error fetching character:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update character
router.put('/characters/:characterId', async (req, res) => {
  try {
    const { characterId } = req.params;
    const { characterData, auth0Id } = req.body;

    if (!characterData || !auth0Id) {
      return res.status(400).json({ error: 'Character data and auth0Id are required' });
    }

    // Find the user
    const user = await User.findOne({ auth0Id });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find and update the character
    const character = await Character.findOneAndUpdate(
      { _id: characterId, owner: user._id },
      { ...characterData, lastUsed: new Date() },
      { new: true }
    );

    if (!character) {
      return res.status(404).json({ error: 'Character not found or not owned by user' });
    }

    res.json({ character: character.toObject() });
  } catch (error) {
    console.error('Error updating character:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete character
router.delete('/characters/:characterId', async (req, res) => {
  try {
    const { characterId } = req.params;
    const { auth0Id } = req.body;

    if (!auth0Id) {
      return res.status(400).json({ error: 'Auth0Id is required' });
    }

    // Find the user
    const user = await User.findOne({ auth0Id });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find and delete the character
    const character = await Character.findOneAndDelete({
      _id: characterId,
      owner: user._id
    });

    if (!character) {
      return res.status(404).json({ error: 'Character not found or not owned by user' });
    }

    // Remove character from user's characters array
    user.characters = user.characters.filter(id => id.toString() !== characterId);
    await user.save();

    res.json({ message: 'Character deleted successfully' });
  } catch (error) {
    console.error('Error deleting character:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all characters for a user
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

export default router; 
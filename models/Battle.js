import mongoose from 'mongoose';

const battleParticipantSchema = new mongoose.Schema({
  characterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  },
  characterName: {
    type: String,
    required: true
  },
  playerEmail: {
    type: String,
    required: true
  },
  finalHealth: {
    type: Number,
    required: true
  },
  survived: {
    type: Boolean,
    required: true
  },
  damageDealt: {
    type: Number,
    default: 0
  },
  damageTaken: {
    type: Number,
    default: 0
  }
});

const battleSchema = new mongoose.Schema({
  participants: [battleParticipantSchema],
  bossName: {
    type: String,
    required: true
  },
  bossHealth: {
    type: Number,
    required: true
  },
  outcome: {
    type: String,
    enum: ['victory', 'defeat', 'draw'],
    required: true
  },
  duration: {
    type: Number, // in seconds
    required: true
  },
  turnCount: {
    type: Number,
    required: true
  },
  battleLog: [{
    turn: Number,
    action: String,
    damage: Number,
    target: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient queries
battleSchema.index({ 'participants.playerEmail': 1, createdAt: -1 });
battleSchema.index({ outcome: 1, createdAt: -1 });

export default mongoose.model('Battle', battleSchema); 
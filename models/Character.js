import mongoose from 'mongoose';

const abilitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['Passive', 'Buff', 'Attack', 'Debuff'],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  cooldown: {
    type: Number,
    default: null
  }
});

const baseStatsSchema = new mongoose.Schema({
  general: {
    max_health: { type: Number, required: true },
    speed: { type: Number, required: true },
    attack: { type: Number, required: true },
    defense: { type: Number, required: true }
  },
  advanced: {
    luck: { type: Number, required: true },
    intelligence: { type: Number, required: true },
    agility: { type: Number, required: true },
    endurance: { type: Number, required: true }
  },
  total_stat_points: { type: Number, required: true }
});

const gameStatsSchema = new mongoose.Schema({
  base_stats: baseStatsSchema,
  abilities: [abilitySchema],
  statusEffects: [String]
});

const backgroundInfoSchema = new mongoose.Schema({
  backstory: { type: String, required: true },
  personality: { type: String, required: true },
  voice: { type: String, required: true },
  alignment: { type: String, required: true }
});

const characterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String
  },
  background_info: backgroundInfoSchema,
  game_stats: gameStatsSchema,
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUsed: {
    type: Date,
    default: Date.now
  }
});

// Update lastUsed on save
characterSchema.pre('save', function(next) {
  this.lastUsed = new Date();
  next();
});

export default mongoose.model('Character', characterSchema); 
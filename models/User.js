import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true
  },
  image: {
    type: String
  },
  auth0Id: {
    type: String,
    required: true,
    unique: true
  },
  characters: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Character'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
});

// Update lastLogin on save
userSchema.pre('save', function(next) {
  this.lastLogin = new Date();
  next();
});

export default mongoose.model('User', userSchema); 
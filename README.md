# Boss Hunter Backend

A real-time server for the AI Boss Battle Arena with MongoDB integration for user data, character storage, and battle history.

## Features

- **Real-time Game Server**: Socket.IO-based multiplayer arena battles
- **MongoDB Integration**: Store user data, characters, and battle history
- **REST API**: Complete API for user management, character creation, and battle tracking
- **AI Integration**: Letta AI for character generation and game mechanics
- **Battle Recording**: Automatic recording of all battles with detailed statistics

## Prerequisites

- Node.js 18+ 
- MongoDB database (local or cloud)
- Letta AI API key
- Environment variables configured

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the backend directory:
```env
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/boss-hunter
# or for MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/boss-hunter

# Letta AI Configuration
LETTA_API_KEY=your-letta-api-key
LETTA_AGENT_ID=your-character-creator-agent-id
LETTA_BOSS_AGENT_ID=your-boss-agent-id
LETTA_IMAGE_AGENT_ID=your-image-generator-agent-id

# Server Configuration
PORT=3001
```

3. Start the server:
```bash
npm start
```

## API Endpoints

### User Management

- `POST /api/users` - Create or update user
- `GET /api/users/:auth0Id` - Get user by Auth0 ID
- `GET /api/users/:auth0Id/characters` - Get user's characters
- `GET /api/users/:auth0Id/battles` - Get user's battle history
- `GET /api/users/:auth0Id/stats` - Get user statistics

### Character Management

- `POST /api/characters` - Create new character
- `GET /api/characters/:characterId` - Get character by ID
- `PUT /api/characters/:characterId` - Update character
- `DELETE /api/characters/:characterId` - Delete character

### Battle Management

- `POST /api/battles` - Create battle record
- `GET /api/battles` - Get recent battles
- `GET /api/battles/:battleId` - Get battle by ID
- `GET /api/battles/stats/global` - Get global battle statistics
- `GET /api/battles/leaderboard` - Get leaderboard

## Database Schema

### User Collection
```javascript
{
  _id: ObjectId,
  email: String,
  name: String,
  image: String,
  auth0Id: String,
  characters: [ObjectId],
  createdAt: Date,
  lastLogin: Date
}
```

### Character Collection
```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  imageUrl: String,
  background_info: {
    backstory: String,
    personality: String,
    voice: String,
    alignment: String
  },
  game_stats: {
    base_stats: {
      general: {
        max_health: Number,
        speed: Number,
        attack: Number,
        defense: Number
      },
      advanced: {
        luck: Number,
        intelligence: Number,
        agility: Number,
        endurance: Number
      },
      total_stat_points: Number
    },
    abilities: [{
      name: String,
      type: String,
      description: String,
      cooldown: Number
    }],
    statusEffects: [String]
  },
  owner: ObjectId,
  createdAt: Date,
  lastUsed: Date
}
```

### Battle Collection
```javascript
{
  _id: ObjectId,
  participants: [{
    characterId: ObjectId,
    characterName: String,
    playerEmail: String,
    finalHealth: Number,
    survived: Boolean,
    damageDealt: Number,
    damageTaken: Number
  }],
  bossName: String,
  bossHealth: Number,
  outcome: String,
  duration: Number,
  turnCount: Number,
  battleLog: [{
    turn: Number,
    action: String,
    damage: Number,
    target: String,
    timestamp: Date
  }],
  createdAt: Date
}
```

## Socket.IO Events

### Client to Server
- `join_room` - Join the arena with a character
- `start_game` - Start a new battle
- `submit_action` - Submit player action
- `send_message` - Send chat message

### Server to Client
- `initial_state` - Initial game state
- `player_joined` - New player joined
- `player_left` - Player disconnected
- `update_game_state` - Updated game state
- `game_state_change` - Game state change
- `new_message` - New chat message
- `full_reset` - Game reset

## Battle Recording

The server automatically records all battles with:
- Participant information and outcomes
- Battle duration and turn count
- Complete battle log
- Damage dealt and taken statistics

## Development

### Running in Development Mode
```bash
npm run dev
```

### Database Migrations
The database will be automatically created with the correct schemas when the server starts.

### Testing
```bash
# Test the API endpoints
curl http://localhost:3001/api/battles/stats/global
```

## Deployment

1. Set up MongoDB Atlas or a MongoDB instance
2. Configure environment variables
3. Deploy to your preferred hosting platform
4. Update the frontend API URL to point to your deployed backend

## Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Check your MONGODB_URI
   - Ensure MongoDB is running
   - Verify network connectivity

2. **Letta AI Errors**
   - Verify your API key is correct
   - Check agent IDs are valid
   - Ensure you have sufficient credits

3. **Socket.IO Connection Issues**
   - Check CORS configuration
   - Verify frontend is connecting to correct port
   - Check firewall settings

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License. 
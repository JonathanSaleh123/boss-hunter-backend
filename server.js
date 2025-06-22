import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

// --- Server Setup ---
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for simplicity. In production, restrict this to your frontend's URL.
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// --- Game State Management ---
let players = [];
// Updated Boss object to conform to the required JSON structure
let boss = {
  name: 'Ancient Shadow Drake',
  description: 'A primordial beast of shadow and fury, awakened from a slumber of eons.',
  background_info: {
    backstory: 'This ancient drake was sealed away in an era long past. Its reawakening threatens to plunge the world into eternal twilight.',
    personality: 'Territorial & Destructive',
    voice: 'Deafening Roar',
    alignment: 'Chaotic Evil'
  },
  game_stats: {
    base_stats: {
      general: {
        max_health: 3500,
        speed: 120,
        attack: 250,
        defense: 180
      },
      advanced: {
        luck: 10,
        intelligence: 80,
        agility: 50,
        endurance: 300
      },
      total_stat_points: 500 // This is a placeholder as boss stats are higher
    },
    abilities: ["Shadow Breath", "Tail Swipe", "Wing Buffet", "Oblivion Curse"]
  },
  // --- UI and Gameplay specific state ---
  health: 3500,
  maxHealth: 3500,
  image: 'https://picsum.photos/400/400?random=10',
  isEnraged: false,
  phase: 1
};


// --- Socket.IO Connection Handling ---
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Event for a player joining the room with their character data
  socket.on('join_room', (character) => {
    console.log(`Character '${character.name}' joined the room.`);

    // Create a new player state from the character data, preserving the structure
    const newPlayer = {
      ...character, // Spread the incoming character object to keep its structure
      id: socket.id, // Use socket ID as the unique player ID
      health: character.game_stats.base_stats.general.max_health, // Current health for gameplay
      maxHealth: character.game_stats.base_stats.general.max_health, // Max health for UI
      class: character.background_info.personality, // Using personality as class for example
      image: `https://picsum.photos/200/300?random=${players.length + 1}`, // Assign a random image
      isAlive: true
    };

    players.push(newPlayer);

    // Send the current game state to the newly connected player
    socket.emit('initial_state', { players, boss });

    // Broadcast the updated player list to everyone else
    socket.broadcast.emit('player_joined', newPlayer);
  });

  // Event for a player sending a message
  socket.on('send_message', (message) => {
    const player = players.find(p => p.id === socket.id);
    if (!player) return;

    const newMsg = {
        id: Date.now(),
        player: player.name,
        message,
        type: 'action', // Default type for player messages
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
    };
    
    // Broadcast the new message to everyone in the room
    io.emit('new_message', newMsg);
  });

  // Event for when a player disconnects
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    const disconnectedPlayer = players.find(p => p.id === socket.id);
    players = players.filter(p => p.id !== socket.id);
    // Broadcast that a player has left
    if(disconnectedPlayer) {
        io.emit('player_left', disconnectedPlayer.id);
    }
  });
});

/*
// --- Game Loop Simulation (Temporarily Disabled) ---
setInterval(() => {
    if (players.length === 0) return; // Don't run the loop if no one is connected

    let stateChanged = false;
    let battleLog = [];

    // Simulate boss attacking a random player
    if (Math.random() > 0.6) {
        const randomPlayer = players[Math.floor(Math.random() * players.length)];
        if (randomPlayer.isAlive) {
            const damage = Math.floor(Math.random() * 15) + 5;
            randomPlayer.health = Math.max(0, randomPlayer.health - damage);
            if (randomPlayer.health === 0) randomPlayer.isAlive = false;
            stateChanged = true;
            battleLog.push({ id: Date.now() + Math.random(), player: 'System', message: `${randomPlayer.name} takes ${damage} shadow damage!`, type: 'damage' });
        }
    }

    // Simulate players attacking the boss
    if (Math.random() > 0.5) {
        const damage = Math.floor(Math.random() * 120) + 50;
        boss.health = Math.max(0, boss.health - damage);
        boss.isEnraged = boss.health < boss.maxHealth * 0.3;
        boss.phase = boss.health < boss.maxHealth * 0.5 ? 2 : 1;
        stateChanged = true;
        battleLog.push({ id: Date.now() + Math.random(), player: 'System', message: `The party deals ${damage} damage to the Shadow Drake!`, type: 'damage' });
    }

    // If any state has changed, broadcast the new state to all clients
    if (stateChanged) {
        io.emit('update_game_state', { players, boss });
    }

    // Send any new battle log messages
    if(battleLog.length > 0) {
        battleLog.forEach(log => {
             const newMsg = {
                ...log,
                timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
            };
            io.emit('new_message', newMsg);
        })
    }
}, 4000); // Run the game loop every 4 seconds
*/

// --- Start Server ---
server.listen(PORT, () => {
  console.log(`Boss Battle server running on http://localhost:${PORT}`);
});
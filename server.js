import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { processPlayerTurn, processBossTurn } from './ai-provider.js';


const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;
let players = [];

// Store the initial boss state to make resetting easier
// Store the initial boss state to make resetting easier
const initialBossState = {
  name: 'Ancient Shadow Drake',
  description: 'A primordial beast of shadow and fury, awakened from a slumber of eons.',
  imageUrl:'https://oaidalleapiprodscus.blob.core.windows.net/private/org-wjzyvmRjFIezvYsgRjuutE6i/user-hrHYhNiVUGGPGrx0EvJQka6T/img-5WBoy9QLzSHmXlbjtTLRBi1P.png?st=2025-06-22T20%3A15%3A33Z&se=2025-06-22T22%3A15%3A33Z&sp=r&sv=2024-08-04&sr=b&rscd=inline&rsct=image/png&skoid=8b33a531-2df9-46a3-bc02-d4b1430a422c&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2025-06-22T10%3A36%3A23Z&ske=2025-06-23T10%3A36%3A23Z&sks=b&skv=2024-08-04&sig=IGZanYRMK6qm6qKnu5vKoDhJ6zY%2BQIXkV%2Bjk67DlMy4%3D',
  background_info: {
    backstory: 'This ancient drake was sealed away in an era long past. Its reawakening threatens to plunge the world into eternal twilight.',
    personality: 'Territorial & Destructive',
    voice: 'Deafening Roar',
    alignment: 'Chaotic Evil'
  },
  game_stats: {
    base_stats: {
      general: { max_health: 3500, speed: 120, attack: 100, defense: 80 },
      advanced: { luck: 10, intelligence: 80, agility: 50, endurance: 100 },
      total_stat_points: 500
    },
    // Updated abilities to match the detailed Ability interface
    abilities: [
        {
            name: "Umbral Shroud",
            type: "Passive",
            description: "Cloaked in shadows, the drake has a 20% chance to evade incoming attacks.",
            cooldown: null
        },
        {
            name: "Shadow Breath",
            type: "Attack",
            description: "Breathes a cone of pure shadow, dealing heavy damage to a single target.",
            cooldown: 2
        },
        {
            name: "Tail Swipe",
            type: "Attack",
            description: "A massive sweep of its tail, dealing moderate damage to all opponents.",
            cooldown: 3
        },
        {
            name: "Oblivion Curse",
            type: "Debuff",
            description: "Curses a target, reducing their defense by 30% for 3 turns.",
            cooldown: 4
        }
    ],
    // Added a status effects array
    statusEffects: [
        "Primordial Armor",
        "Immune to Fear",
        "Shadow Aura"
    ]
  },
  health: 3500,
  maxHealth: 3500,
  isEnraged: false,
  phase: 1
};

// The 'boss' object will now be a mutable copy
let boss = { ...initialBossState };

let gameState = 'IDLE'; 
let turnTimer = null;
let turnActions = new Map();
const TURN_TIME = 60;

// --- Utility & Game Management Functions ---

const broadcastMessage = (message, type = 'system') => {
    const newMsg = {
      id: Date.now() + Math.random(),
      player: 'Game Master',
      message,
      type,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
    };
    io.emit('new_message', newMsg);
};

const broadcastGameState = () => {
    io.emit('update_game_state', { players, boss });
};

/**
 * NEW: A centralized function to reset the entire game state.
 */
const resetGame = () => {
    console.log("GAME RESET: All players have left or were defeated. Resetting the boss.");
    
    // Reset boss to its initial state
    boss = { ...initialBossState };
    // Clear all players
    players = [];

    // Stop any active game loops
    if (turnTimer) clearInterval(turnTimer);
    gameState = 'IDLE';
    turnActions.clear();
    
    // Notify all connected clients of the reset
    broadcastGameState(); // This will show the fully healed boss and empty player list
    io.emit('game_state_change', { state: 'IDLE', timer: 0 });
    io.emit('full_reset'); // Custom event for clients to handle full UI reset
};


const checkAllPlayersActed = () => {
    const livingPlayers = players.filter(p => p.isAlive);
    if (livingPlayers.length > 0 && turnActions.size >= livingPlayers.length) {
        clearInterval(turnTimer);
        broadcastMessage('All players have acted! The Game Master is calculating the result...', 'system');
        startPlayerAttackPhase();
    }
};

// --- Game Loop Phases ---

async function startPlayerAttackPhase() {
  if (gameState !== 'WAITING_FOR_ACTIONS') return;
  gameState = 'PLAYERS_ATTACKING';
  io.emit('game_state_change', { state: gameState, timer: 0 });

  try {
    const { narrative, updatedBossState } = await processPlayerTurn(boss, players, turnActions);
    broadcastMessage(narrative.trim(), 'attack');
    boss = { ...boss, ...updatedBossState };
    broadcastGameState();
  } catch (error) {
    console.error("Error processing player turn via Letta service:", error);
    broadcastMessage("A mystical force interfered! The players' attack was partially shielded.", 'damage');
    broadcastGameState();
  }

  // Check if boss was defeated
  if (boss.health <= 0) {
      broadcastMessage("With a final, earth-shattering roar, the Ancient Shadow Drake has been vanquished! Victory!", 'system');
      setTimeout(resetGame, 10000); // Reset the game after 10 seconds
      return;
  }
  
  setTimeout(startBossAttackPhase, 3000);
}

async function startBossAttackPhase() {
  gameState = 'BOSS_ATTACKING';
  io.emit('game_state_change', { state: gameState, timer: 0 });
  
  const livingPlayers = players.filter(p => p.isAlive);
  // MODIFIED: If all players are defeated, reset the game.
  if (livingPlayers.length === 0) {
      broadcastMessage("The Shadow Drake roars in victory over the fallen heroes. The world is plunged into twilight...", 'boss');
      setTimeout(resetGame, 10000); // Reset the game after 10 seconds
      return;
  }

  try {
    const { narrative, updatedPlayers } = await processBossTurn(boss, players);
    broadcastMessage(narrative.trim(), 'boss');

    updatedPlayers.forEach(updatedInfo => {
        const playerIndex = players.findIndex(p => p.id === updatedInfo.id);
        if (playerIndex !== -1) {
            players[playerIndex] = { ...players[playerIndex], ...updatedInfo };
            if (players[playerIndex].health <= 0) {
                players[playerIndex].health = 0;
                players[playerIndex].isAlive = false;
                broadcastMessage(`${players[playerIndex].name} has fallen in battle!`, 'damage');
            }
        }
    });

    broadcastGameState();

  } catch (error) {
    console.error("Error processing boss turn via Letta service:", error);
    broadcastMessage("The Shadow Drake seems confused and lashes out randomly!", 'boss');
    const target = livingPlayers[Math.floor(Math.random() * livingPlayers.length)];
    const damage = Math.floor(Math.random() * 25) + 20;
    target.health = Math.max(0, target.health - damage);
    if (target.health === 0) target.isAlive = false;
    broadcastMessage(`${boss.name} strikes ${target.name} for ${damage} damage!`, 'damage');
    broadcastGameState();
  }

  setTimeout(startWaitingPhase, 3000);
}

function startWaitingPhase() {
    if (players.length === 0) {
        resetGame(); // If the game somehow tries to start a turn with no one, just reset.
        return;
    }
  
    gameState = 'WAITING_FOR_ACTIONS';
    turnActions.clear(); 
    
    let timeLeft = TURN_TIME;
    io.emit('game_state_change', { state: gameState, timer: timeLeft });
    broadcastMessage(`Waiting for actions... You have ${timeLeft} seconds to decide.`, 'system');
  
    if (turnTimer) clearInterval(turnTimer);
    
    turnTimer = setInterval(() => {
      timeLeft--;
      io.emit('game_state_change', { state: gameState, timer: timeLeft });
      if (timeLeft <= 0) {
        clearInterval(turnTimer);
        broadcastMessage('Time is up! Processing actions...', 'system');
        startPlayerAttackPhase();
      }
    }, 1000);
  }
  
// --- Socket.IO Connection Handling ---
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
  
    socket.on('join_room', (character) => {
      const newPlayer = {
        ...character,
        id: socket.id,
        health: character.game_stats.base_stats.general.max_health,
        maxHealth: character.game_stats.base_stats.general.max_health,
        class: character.background_info.personality,
        isAlive: true
      };
      players.push(newPlayer);
  
      socket.emit('initial_state', { players, boss });
      socket.emit('game_state_change', { state: gameState, timer: 0 });
      socket.broadcast.emit('player_joined', newPlayer);
    });
    
    socket.on('start_game', () => {
        if(gameState === 'IDLE' && players.length > 0) {
            console.log(`Game started by ${socket.id}`);
            broadcastMessage('The battle begins!', 'system');
            startWaitingPhase();
        }
    });
  
    socket.on('submit_action', (message) => {
        const player = players.find(p => p.id === socket.id);
        if (!player || gameState !== 'WAITING_FOR_ACTIONS' || turnActions.has(socket.id)) return;
  
        turnActions.set(player.id, message);
        broadcastMessage(`${player.name} has locked in their action.`, 'action');
        checkAllPlayersActed();
    });
  
    socket.on('send_message', (message) => {
      const player = players.find(p => p.id === socket.id);
      if (!player) return;
      
      if(gameState === 'WAITING_FOR_ACTIONS' && !turnActions.has(socket.id)) {
          turnActions.set(socket.id, message);
          broadcastMessage(`${player.name} has locked in their action: ${message}`, 'action');
          checkAllPlayersActed();
      }
    });
  
    socket.on('disconnect', () => {
      console.log(`Player disconnected: ${socket.id}`);
      const playerIndex = players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        io.emit('player_left', players[playerIndex].id);
        players.splice(playerIndex, 1);
  
        // MODIFIED: If the last player leaves, reset the game state.
        if (players.length === 0) {
            resetGame();
        } else {
            // If a game is in progress, check if the disconnected player's action was the last one needed
            if (gameState === 'WAITING_FOR_ACTIONS') {
                checkAllPlayersActed();
            }
        }
      }
    });
  });
  
server.listen(PORT, () => {
    console.log(`Boss Battle server running on http://localhost:${PORT}`);
});
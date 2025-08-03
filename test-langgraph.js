/**
 * Test script for LangGraph AI provider
 * Run this to test the new AI workflow before integrating into the main game
 */

import 'dotenv/config';
import { processPlayerTurn, processBossTurn, getAgentContexts } from './langgraph-ai.js';

// Mock data for testing
const mockBoss = {
  name: "Ancient Shadow Drake",
  description: "A terrible ancient dragon",
  imageUrl: "https://example.com/dragon.jpg",
  background_info: {
    backstory: "Ancient dragon of shadow",
    personality: "Malevolent and intelligent",
    voice: "Deep and menacing",
    alignment: "Chaotic Evil"
  },
  game_stats: {
    base_stats: {
      general: {
        max_health: 1000,
        speed: 50,
        attack: 120,
        defense: 80
      }
    },
    abilities: [
      {
        name: "Shadow Breath",
        type: "AOE",
        description: "Breathes dark energy",
        cooldown: 3,
        base_damage: 80
      },
      {
        name: "Tail Sweep",
        type: "Physical",
        description: "Sweeps with massive tail",
        cooldown: 1,
        base_damage: 60
      }
    ],
    statusEffects: []
  },
  health: 1000,
  maxHealth: 1000,
  isEnraged: false,
  phase: 1
};

const mockPlayers = [
  {
    id: "player1",
    name: "Thor the Brave",
    isAlive: true,
    game_stats: {
      base_stats: {
        general: {
          max_health: 200,
          speed: 70,
          attack: 90,
          defense: 60,
          agility: 30,
          intelligence: 40,
          luck: 25,
          endurance: 50
        }
      }
    },
    abilities: [
      {
        name: "Lightning Strike",
        base_damage: 70,
        type: "Electric"
      },
      {
        name: "Thunder Hammer",
        base_damage: 85,
        type: "Physical"
      }
    ],
    health: 200
  },
  {
    id: "player2", 
    name: "Luna the Swift",
    isAlive: true,
    game_stats: {
      base_stats: {
        general: {
          max_health: 180,
          speed: 95,
          attack: 75,
          defense: 45,
          agility: 60,
          intelligence: 70,
          luck: 40,
          endurance: 35
        }
      }
    },
    abilities: [
      {
        name: "Shadow Dash",
        base_damage: 60,
        type: "Shadow"
      },
      {
        name: "Arcane Missile",
        base_damage: 75,
        type: "Magic"
      }
    ],
    health: 180
  }
];

const mockTurnActions = new Map([
  ["player1", "I channel the power of thunder and lightning, raising my enchanted hammer high above my head before bringing it down with tremendous force!"],
  ["player2", "I weave through the shadows and launch a barrage of magical missiles aimed at the dragon's weak spots!"]
]);

async function testLangGraphProvider() {
  console.log("🧪 Testing LangGraph AI Provider");
  console.log("==================================\n");

  try {
    // Test 1: Player Turn Processing
    console.log("📋 Test 1: Processing Player Turn");
    console.log("Players:", mockPlayers.map(p => p.name).join(", "));
    console.log("Actions:", Array.from(mockTurnActions.entries()));
    console.log("\n⏳ Processing...\n");

    const playerResult = await processPlayerTurn(mockBoss, mockPlayers, mockTurnActions);
    
    console.log("✅ Player Turn Results:");
    console.log("Narrative:", playerResult.narrative);
    console.log("Boss Health Before:", mockBoss.health);
    console.log("Boss Health After:", playerResult.updatedBossState.health);
    console.log("\n" + "=".repeat(50) + "\n");

    // Update boss for next test
    const updatedBoss = { ...mockBoss, ...playerResult.updatedBossState };

    // Test 2: Boss Turn Processing  
    console.log("📋 Test 2: Processing Boss Turn");
    console.log("Boss current health:", updatedBoss.health);
    console.log("Living players:", mockPlayers.filter(p => p.isAlive).map(p => p.name));
    console.log("\n⏳ Processing...\n");

    const bossResult = await processBossTurn(updatedBoss, mockPlayers);
    
    console.log("✅ Boss Turn Results:");
    console.log("Narrative:", bossResult.narrative);
    console.log("Player Health Updates:");
    bossResult.updatedPlayers.forEach(player => {
      const originalPlayer = mockPlayers.find(p => p.id === player.id);
      console.log(`  ${originalPlayer.name}: ${originalPlayer.health} → ${player.health}`);
    });

    console.log("\n" + "=".repeat(50) + "\n");

    // Test 3: Context Information
    console.log("📋 Test 3: Agent Context Information");
    const contexts = getAgentContexts();
    console.log("Game Master Context:", {
      turnCount: contexts.gameMaster.turnCount,
      persona: contexts.gameMaster.persona
    });
    console.log("Boss Context:", {
      turnCount: contexts.boss.turnCount,
      persona: contexts.boss.persona
    });

    console.log("\n🎉 All tests completed successfully!");
    console.log("The LangGraph AI provider is ready for integration!");

  } catch (error) {
    console.error("❌ Test failed:", error);
    console.error("Stack trace:", error.stack);
    process.exit(1);
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testLangGraphProvider();
} 
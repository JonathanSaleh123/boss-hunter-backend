import 'dotenv/config';
import { ChatGroq } from '@langchain/groq';
import { StateGraph, END } from '@langchain/langgraph';
import { MessagesAnnotation } from '@langchain/langgraph';
import { ToolMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { gameTools } from './game-tools.js';

// --- GROQ CLIENT INITIALIZATION ---
const model = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "llama3-8b-8192",
  temperature: 0.7,
});

// --- AGENT PERSONAS ---
const GAME_MASTER_PERSONA = {
  name: "Game Master",
  role: "Impartial battle narrator and calculator",
  personality: `You are a skilled Game Master who oversees epic battles with fairness and dramatic flair. 
  You approach each turn methodically:
  1. Analyze each player's action and match it to their available abilities
  2. Use your calculation tools to determine precise outcomes
  3. Weave the results into engaging narratives that capture the excitement of battle
  
  You are meticulous about game mechanics but creative in storytelling. You never make up numbers - you always use your tools to calculate accurate damage, dodges, and critical hits.`,
  
  systemPrompt: `You are the Game Master for an epic boss battle. Your role is to process player actions with mechanical precision while creating engaging narratives.

MANDATORY PROCESS for each player action:
1. Identify which ability the player is using from their available abilities
2. Use check_dodge_success tool to see if the boss dodges
3. If hit, use calculate_critical_hit tool to check for crits
4. Use calculate_attack_damage tool for base damage calculation
5. Apply critical multiplier if applicable
6. Track total damage dealt to boss

After processing all players, use process_player_turn_results tool with:
- Complete narrative describing each player's action and outcome
- Updated boss state with new health and any status changes

Be dramatic but accurate. Never guess at numbers - always use your tools.`
};

const BOSS_PERSONA = {
  name: "Ancient Shadow Drake",
  role: "Malevolent ancient dragon",
  personality: `You are an ancient, intelligent dragon awakened from centuries of slumber. You speak with archaic grandeur and terrible wisdom. 
  
  Your actions in battle reflect your draconic nature:
  - Choose abilities strategically based on the situation
  - Target the most threatening or vulnerable opponents
  - Your attacks grow more vicious when enraged
  - You revel in the fear and desperation of mortals
  
  You use calculation tools to determine the precise outcome of your devastating attacks, then describe them with draconic majesty.`,
  
  systemPrompt: `You are the Ancient Shadow Drake, a terrible and intelligent dragon boss. You must choose your actions strategically and execute them with precise calculations.

YOUR PROCESS each turn:
1. Analyze the current battle state (your health, enrage status, living enemies)
2. Choose an ability from your available abilities based on strategy
3. Select target(s) from living players
4. For each target:
   - Use check_dodge_success to see if they evade your attack
   - If hit, use calculate_critical_hit for potential devastating blows
   - Use calculate_attack_damage for precise damage calculation
   - Apply critical multiplier if applicable
5. Create dramatic narrative of your assault
6. Use process_boss_turn_results with your narrative and array of updated player health

Speak as the dragon - ancient, proud, and terrifying. Your attacks should reflect your current state (more vicious when enraged).`
};

// --- CONTEXT MANAGEMENT ---
class AgentContext {
  constructor(persona) {
    this.id = uuidv4();
    this.persona = persona;
    this.conversationHistory = [];
    this.gameState = {};
    this.turnCount = 0;
    this.abilityHistory = [];
  }

  addToHistory(role, content, toolCalls = null, toolResults = null) {
    this.conversationHistory.push({
      role,
      content,
      toolCalls,
      toolResults,
      timestamp: new Date().toISOString(),
      turnCount: this.turnCount
    });
    
    // Keep last 20 entries to manage context window
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-20);
    }
  }

  updateGameState(gameState) {
    this.gameState = { ...gameState };
  }

  incrementTurn() {
    this.turnCount++;
  }

  getContextSummary() {
    return {
      persona: this.persona.name,
      turnCount: this.turnCount,
      recentHistory: this.conversationHistory.slice(-5),
      currentGameState: this.gameState
    };
  }
}

// --- TOOL DEFINITIONS FOR LANGGRAPH ---
const createGameTools = () => {
  return [
    tool(
      ({ targetAgility }) => {
        const result = gameTools.checkDodgeSuccess(targetAgility);
        return { dodged: result };
      },
      {
        name: "check_dodge_success",
        description: "Determines if a target successfully dodges an attack based on agility",
        schema: z.object({
          targetAgility: z.number().describe("The target's agility stat")
        })
      }
    ),
    
    tool(
      ({ attackerIntelligence, attackerLuck, targetCritResistance }) => {
        const result = gameTools.calculateCriticalHit(attackerIntelligence, attackerLuck, targetCritResistance);
        return result;
      },
      {
        name: "calculate_critical_hit",
        description: "Calculates if a critical hit occurs and its damage multiplier",
        schema: z.object({
          attackerIntelligence: z.number().describe("The attacker's intelligence stat"),
          attackerLuck: z.number().describe("The attacker's luck stat"),
          targetCritResistance: z.number().describe("The target's critical resistance stat")
        })
      }
    ),
    
    tool(
      ({ baseAbilityDamage, attackerAttack, targetDefense }) => {
        const damage = gameTools.calculateAttackDamage(baseAbilityDamage, attackerAttack, targetDefense);
        return { damage };
      },
      {
        name: "calculate_attack_damage",
        description: "Calculates the final damage of an attack using game formulas",
        schema: z.object({
          baseAbilityDamage: z.number().describe("The base damage of the ability being used"),
          attackerAttack: z.number().describe("The attacker's attack stat"),
          targetDefense: z.number().describe("The target's defense stat")
        })
      }
    ),
    
    tool(
      ({ narrative, updatedBossState }) => {
        return gameTools.processPlayerTurnResults(narrative, updatedBossState);
      },
      {
        name: "process_player_turn_results",
        description: "Finalizes player turn processing with narrative and updated boss state",
        schema: z.object({
          narrative: z.string().describe("Complete narrative describing the turn's events"),
          updatedBossState: z.record(z.any()).describe("The boss object with updated health and status")
        })
      }
    ),
    
    tool(
      ({ narrative, updatedPlayers }) => {
        return gameTools.processBossTurnResults(narrative, updatedPlayers);
      },
      {
        name: "process_boss_turn_results",
        description: "Finalizes boss turn processing with narrative and updated player states",
        schema: z.object({
          narrative: z.string().describe("Complete narrative describing the boss's attack"),
          updatedPlayers: z.array(z.record(z.any())).describe("Array of players with updated health values")
        })
      }
    )
  ];
};

// --- LANGGRAPH WORKFLOW DEFINITION ---
const createBattleWorkflow = (persona, tools) => {
  const workflow = new StateGraph(MessagesAnnotation)
    .addNode("agent", async (state) => {
      const modelWithTools = model.bindTools(tools);
      const response = await modelWithTools.invoke([
        { role: "system", content: persona.systemPrompt },
        ...state.messages
      ]);
      return { messages: [response] };
    })
    .addNode("tools", async (state) => {
      const lastMessage = state.messages[state.messages.length - 1];
      if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
        return { messages: [] };
      }
      
      const toolMessages = [];
      for (const toolCall of lastMessage.tool_calls) {
        const tool = tools.find(t => t.name === toolCall.name);
        if (tool) {
          try {
            const result = await tool.invoke(toolCall.args);
            toolMessages.push(
              new ToolMessage({
                content: JSON.stringify(result),
                tool_call_id: toolCall.id,
              })
            );
          } catch (error) {
            toolMessages.push(
              new ToolMessage({
                content: `Error: ${error.message}`,
                tool_call_id: toolCall.id,
              })
            );
          }
        }
      }
      return { messages: toolMessages };
    })
    .addEdge("agent", "tools")
    .addConditionalEdges("tools", (state) => {
      const lastMessage = state.messages[state.messages.length - 1];
      const hasProcessingTool = state.messages.some(msg => 
        msg.tool_call_id && (
          msg.content.includes('process_player_turn_results') ||
          msg.content.includes('process_boss_turn_results')
        )
      );
      return hasProcessingTool ? END : "agent";
    })
    .setEntryPoint("agent");
    
  return workflow.compile();
};

// --- AGENT INSTANCES ---
const gameMasterContext = new AgentContext(GAME_MASTER_PERSONA);
const bossContext = new AgentContext(BOSS_PERSONA);
const tools = createGameTools();
const gameMasterWorkflow = createBattleWorkflow(GAME_MASTER_PERSONA, tools);
const bossWorkflow = createBattleWorkflow(BOSS_PERSONA, tools);

// --- MAIN PROCESSING FUNCTIONS ---

/**
 * Processes player turn using LangGraph Game Master agent
 */
export async function processPlayerTurn(boss, players, turnActions) {
  try {
    gameMasterContext.incrementTurn();
    gameMasterContext.updateGameState({ boss, players });

    const playerActionsText = Array.from(turnActions.entries()).map(([playerId, action]) => {
      const player = players.find(p => p.id === playerId);
      const playerAbilities = player.abilities || [];
      return `
### Player: ${player.name}
- Action Description: "${action}"
- Player's Available Abilities: ${JSON.stringify(playerAbilities)}
- Player Stats: ${JSON.stringify(player.game_stats.base_stats.general)}
      `;
    }).join('');

    const prompt = `
The players have launched their attack! As the Game Master, you must process each action with precision and create an engaging narrative.

**Current Encounter State:**
- Boss State: ${JSON.stringify(boss, null, 2)}
- Player Actions This Turn: ${playerActionsText}

Follow your systematic process for each player action, then provide the final results using the process_player_turn_results tool.
    `;

    const result = await gameMasterWorkflow.invoke({
      messages: [{ role: "user", content: prompt }]
    });

    // Extract the final result from tool messages
    const processingToolMessage = result.messages.find(msg => 
      msg.tool_call_id && msg.content.includes('narrative')
    );

    if (processingToolMessage) {
      const parsedResult = JSON.parse(processingToolMessage.content);
      gameMasterContext.addToHistory("assistant", "Processed player turn", null, parsedResult);
      return parsedResult;
    }

    throw new Error("Game Master agent failed to provide proper results");

  } catch (error) {
    console.error("Error in LangGraph processPlayerTurn:", error);
    throw error;
  }
}

/**
 * Processes boss turn using LangGraph Boss agent
 */
export async function processBossTurn(boss, players) {
  try {
    bossContext.incrementTurn();
    bossContext.updateGameState({ boss, players });

    const livingPlayers = players.filter(p => p.isAlive);
    const bossAbilities = boss.game_stats.abilities || [];

    const prompt = `
It is my turn to act! I will unleash my fury upon these mortals.

**My Current State:**
${JSON.stringify(boss, null, 2)}
(I am ${boss.isEnraged ? 'ENRAGED' : 'not enraged'})

**My Available Abilities:**
${JSON.stringify(bossAbilities, null, 2)}

**The Mortals Before Me (Potential Targets):**
${JSON.stringify(livingPlayers, null, 2)}

Choose your action strategically and execute it with draconic precision!
    `;

    const result = await bossWorkflow.invoke({
      messages: [{ role: "user", content: prompt }]
    });

    // Extract the final result from tool messages
    const processingToolMessage = result.messages.find(msg => 
      msg.tool_call_id && msg.content.includes('narrative')
    );

    if (processingToolMessage) {
      const parsedResult = JSON.parse(processingToolMessage.content);
      bossContext.addToHistory("assistant", "Processed boss turn", null, parsedResult);
      return parsedResult;
    }

    throw new Error("Boss agent failed to provide proper results");

  } catch (error) {
    console.error("Error in LangGraph processBossTurn:", error);
    throw error;
  }
}

// --- CONTEXT EXPORT FOR DEBUGGING ---
export const getAgentContexts = () => ({
  gameMaster: gameMasterContext.getContextSummary(),
  boss: bossContext.getContextSummary()
}); 
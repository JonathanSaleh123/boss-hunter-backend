import 'dotenv/config';
import { LettaClient } from '@letta-ai/letta-client';

const lettaClient = new LettaClient({ token: process.env.LETTA_API_KEY });
const bossAgentId = process.env.LETTA_BOSS_AGENT_ID;
const gameMasterAgentId = process.env.LETTA_AGENT_ID;

/**
 * A helper function to safely parse the toolReturn field, which may be a string or an object.
 * @param {any} toolReturn - The toolReturn value from the message.
 * @returns {object | null} - The parsed JSON object or null if invalid.
 */
function getParsedToolReturn(toolReturn) {
  if (!toolReturn) return null;
  if (typeof toolReturn === 'object') {
    return toolReturn; // It's already an object
  }
  if (typeof toolReturn === 'string') {
    try {
      return JSON.parse(toolReturn); // It's a string, so parse it
    } catch (e) {
      console.error("Failed to parse toolReturn string:", e);
      return null;
    }
  }
  return null;
}

/**
 * Sends player actions and stats to the Game Master agent to determine the outcome using calculation tools.
 * @param {object} boss - The current state of the boss.
 * @param {Array<object>} players - The list of all player objects. Each player must have an 'abilities' array.
 * @param {Map<string, string>} turnActions - A map of player IDs to their action description string.
 * @returns {Promise<{narrative: string, updatedBossState: object}>} - The narrative and the new boss state.
 */
export async function processPlayerTurn(boss, players, turnActions) {
  if (!gameMasterAgentId) throw new Error("LETTA_AGENT_ID environment variable is not set.");

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
    The players have launched their attack! As the Game Master, you must first determine which abilities were used, then calculate the outcome for each action using your tools, and finally provide a summary.

    **Current Encounter State:**
    - Boss State: ${JSON.stringify(boss, null, 2)}
    - Player Actions This Turn: ${playerActionsText}

    **YOUR TASK (Follow these steps for EACH player's action):**
    1.  **Identify the Ability Used:** First, look at the player's "Action Description" and their "Available Abilities" list. Deduce which single ability from the list best matches the player's intent. Use this chosen ability for all subsequent calculations.
    2.  **Check for Dodge:** Use the \`check_dodge_success\` tool with the boss's agility and player's agility. If the boss dodges, note it down and move to the next player.
    3.  **Calculate Critical Hit:** If the attack hits, use the \`calculate_critical_hit\` tool with the player's intelligence/luck and the boss's crit resistance.
    4.  **Calculate Final Damage:** Use the \`calculate_attack_damage\` tool with the identified ability's base damage, the player's attack stat, and the boss's defense stat.
    5.  **Apply Critical Damage:** If the hit was critical, multiply the final damage by the critical hit multiplier from step 3.
    6.  **Sum Total Damage:** Keep a running total of all damage dealt to the boss this turn.

    **FINAL OUTPUT (After processing all players):**
    1.  **Update Boss State:** Calculate the boss's new health, and determine if its phase or enrage status has changed based on the total damage.
    2.  **Write Narrative:** Formulate a dramatic, turn-by-turn narrative describing each player's assault, which ability they used, and its outcome (hit, miss, crit, damage).
    3.  **Add Summary Section:** At the end of the narrative, after two newlines, add a summary for each player:
        Character Name
        Damage Done: [Total damage they dealt]
        Effects Given: [Any effects applied, e.g., "Critical Hit!", "Attack was dodged"]
    4.  **Return Results:** Call the \`process_player_turn_results\` tool with the complete narrative (including the summary) and the final, updated boss state.
  `;

  const response = await lettaClient.agents.messages.create(gameMasterAgentId, {
    messages: [{ role: "user", content: prompt }]
  });
  
  // Find the message for the specific tool we're waiting for.
  const toolReturnMsg = response.messages.find(msg => msg.messageType === "tool_return_message" && msg.name === "process_player_turn_results");
  
  const parsedToolReturn = getParsedToolReturn(toolReturnMsg?.toolReturn);

  if (!parsedToolReturn?.updatedBossState) {
    console.error("Agent Response Log:", JSON.stringify(response.messages, null, 2));
    throw new Error("Game Master agent failed to call the 'process_player_turn_results' tool correctly.");
  }

  return parsedToolReturn;
}

/**
 * Asks the Boss agent to decide and execute its turn using calculation tools.
 * @param {object} boss - The current state of the boss.
 * @param {Array<object>} players - The list of all player objects.
 * @returns {Promise<{narrative: string, updatedPlayers: Array<object>}>} - The narrative and an array of player objects with updated stats.
 */
export async function processBossTurn(boss, players) {
  if (!bossAgentId) throw new Error("LETTA_BOSS_AGENT_ID environment variable is not set.");

  const livingPlayers = players.filter(p => p.isAlive);

  const prompt = `
    It is my turn to act! I will unleash my fury upon these mortals.

    **My Current State:**
    ${JSON.stringify(boss, null, 2)}
    (I am ${boss.isEnraged ? 'ENRAGED' : 'not enraged'}. This should influence my choice of action and damage.)

    **The Mortals Before Me (Potential Targets):**
    ${JSON.stringify(livingPlayers, null, 2)}

    **MY TASK:**
    1.  **Choose My Action:** As the Ancient Shadow Drake, I will choose a devastating action from my abilities.
    2.  **Select Target(s):** I will select one or more players to attack.
    3.  **Calculate Outcome (For each target):** I must use the provided tools to determine the result of my attack.
        - Use \`check_dodge_success\` to see if the mortal evades me.
        - If I hit, use \`calculate_attack_damage\` to determine the damage. (My 'attack' stat is in my state above).
        - I can also use \`calculate_critical_hit\` to see if I land a crushing blow.
    4.  **Narrate My Attack:** I will describe my magnificent and terrifying assault and its outcome (hit, miss, crit, damage).
    5.  **Add Summary Section:** At the end of my narration, after two newlines, I will add a summary for each mortal I targeted:
        Character Name
        Damage Done: [Damage I dealt]
        Effects Given: ["Dodged my attack!", "Crushed by a Critical Hit!", etc.]
    6.  **Return the Aftermath:** I will call the \`process_boss_turn_results\` tool. I must provide my full narrative (including the summary) and a JSON array of all mortals I harmed, including their "id" and their new "health".
  `;

  const response = await lettaClient.agents.messages.create(bossAgentId, {
    messages: [{ role: "user", content: prompt }]
  });

  // Find the message for the specific tool we're waiting for.
  const toolReturnMsg = response.messages.find(msg => msg.messageType === "tool_return_message" && msg.name === "process_boss_turn_results");
  
  // FIXED: Use the helper function to handle both string and object cases.
  const parsedToolReturn = getParsedToolReturn(toolReturnMsg?.toolReturn);

  // Now check the parsed object for the property we expect.
  if (!parsedToolReturn?.updatedPlayers) {
    console.error("Agent Response Log:", JSON.stringify(response.messages, null, 2));
    throw new Error("Boss agent failed to call the 'process_boss_turn_results' tool correctly.");
  }

  return parsedToolReturn;
} 
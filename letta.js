import 'dotenv/config';
import { LettaClient } from '@letta-ai/letta-client';

const lettaClient = new LettaClient({ token: process.env.LETTA_API_KEY });
const bossAgentId = process.env.LETTA_BOSS_AGENT_ID;
const gameMasterAgentId = process.env.LETTA_AGENT_ID;

/**
 * Sends player actions and full character stats to the Letta agent to determine the outcome.
 * @param {object} boss - The current state of the boss.
 * @param {Array<object>} players - The list of all player objects, including their stats.
 * @param {Map<string, string>} turnActions - A map of player IDs to their submitted actions.
 * @returns {Promise<{narrative: string, updatedBossState: object}>} - The narrative of the turn and the new boss state.
 */
export async function processPlayerTurn(boss, players, turnActions) {
  if (!gameMasterAgentId) throw new Error("LETTA_AGENT_ID environment variable is not set.");

  // NEW: We now pass the full player objects for the agent to use their stats.
  const playerActionsText = Array.from(turnActions.entries()).map(([playerId, action]) => {
      const player = players.find(p => p.id === playerId);
      return `- Player ${player.name} (Attack: ${player.game_stats.base_stats.general.attack}) attacks: "${action}"`;
  }).join('\n');
  
  const prompt = `
    The players have launched their attack! As the Game Master, calculate the outcome.

    CURRENT BOSS STATE:
    ${JSON.stringify(boss, null, 2)}

    CURRENT PLAYERS:
    ${JSON.stringify(players.filter(p => p.isAlive), null, 2)}

    PLAYER ACTIONS THIS TURN:
    ${playerActionsText}

    YOUR TASK:
    1.  Use your knowledge of realistic effects and dramatic storytelling to calculate the total damage dealt by the players or the effects of their actions. The damage should be influenced by each player's stats (e.g., their 'attack' value) as well as their abiltiies.
    2.  Update the boss's health, phase (changes at 50% max health), and enrage status (changes at 30% max health).
    3.  Formulate a dramatic, narrative response describing the combined assault.
    4.  Return the updated boss state as a single JSON object.
    
    Format your output with '---JSON_SEPARATOR---' between the narrative and the JSON object.
  `;

  const response = await lettaClient.agents.messages.create(gameMasterAgentId, { messages: [{ role: "user", content: prompt }] });
  const agentMessage = response.messages.find(msg => msg.messageType === "assistant_message");
  if (!agentMessage || !agentMessage.content) throw new Error("Agent did not return a valid message.");
  
  const [narrative, bossJsonString] = agentMessage.content.split('---JSON_SEPARATOR---');
  if (!narrative || !bossJsonString) throw new Error("Agent response was not formatted correctly.");

  return { narrative, updatedBossState: JSON.parse(bossJsonString) };
}


/**
 * Asks the Letta agent to decide and execute the boss's turn.
 * @param {object} boss - The current state of the boss.
 * @param {Array<object>} players - The list of all player objects.
 * @returns {Promise<{narrative: string, updatedPlayers: Array<object>}>} - The narrative and an array of player objects with updated stats.
 */
export async function processBossTurn(boss, players) {
  // MODIFIED: This function now uses the new boss agent ID.
  if (!bossAgentId) throw new Error("LETTA_BOSS_AGENT_ID environment variable is not set.");

  const livingPlayers = players.filter(p => p.isAlive);

  const prompt = `
    It is my turn to act! The puny mortals challenge me.

    MY CURRENT STATE:
    ${JSON.stringify(boss, null, 2)}
    (I am ${boss.isEnraged ? 'ENRAGED' : 'not enraged'}. This should influence my choice of action.)

    THE MORTALS BEFORE ME (POTENTIAL TARGETS):
    ${JSON.stringify(livingPlayers, null, 2)}

    MY TASK:
    1.  As the Ancient Shadow Drake, I must choose an action from my abilities or description.
    2.  I will select one or more targets to unleash my fury upon.
    3.  I will determine the damage I inflict, channelling my rage into the calculation.
    4.  I will narrate my own devastating attack, telling as well How Much Damage I caused.
    5.  I will return a JSON array of the mortals I have harmed, including their "id" and new "health".

    Example JSON output for hitting two mortals:
    [
      { "id": "some_player_id_1", "health": 120 },
      { "id": "some_player_id_2", "health": 115 }
    ]

    My response MUST be formatted with '---JSON_SEPARATOR---' between my narrative and the JSON array.
  `;

  // MODIFIED: Calling the boss agent instead of the game master agent.
  const response = await lettaClient.agents.messages.create(bossAgentId, { messages: [{ role: "user", content: prompt }] });
  const agentMessage = response.messages.find(msg => msg.messageType === "assistant_message");
  if (!agentMessage || !agentMessage.content) throw new Error("Boss agent did not return a valid turn message.");

  const [narrative, playersJsonString] = agentMessage.content.split('---JSON_SEPARATOR---');
  if (!narrative || !playersJsonString) throw new Error("Boss agent response was not formatted correctly.");

  return { narrative, updatedPlayers: JSON.parse(playersJsonString) };
}
import 'dotenv/config';
import { LettaClient } from '@letta-ai/letta-client';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
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

// /**
//  * Sends player actions and stats to the Game Master agent to determine the outcome using calculation tools.
//  * @param {object} boss - The current state of the boss.
//  * @param {Array<object>} players - The list of all player objects. Each player must have an 'abilities' array.
//  * @param {Map<string, string>} turnActions - A map of player IDs to their action description string.
//  * @returns {Promise<{narrative: string, updatedBossState: object}>} - The narrative and the new boss state.
//  */
// export async function processPlayerTurn(boss, players, turnActions) {
//   if (!gameMasterAgentId) throw new Error("LETTA_AGENT_ID environment variable is not set.");

//   const playerActionsText = Array.from(turnActions.entries()).map(([playerId, action]) => {
//       const player = players.find(p => p.id === playerId);
//       const playerAbilities = player.abilities || [];
//       return `
// ### Player: ${player.name}
// - Action Description: "${action}"
// - Player's Available Abilities: ${JSON.stringify(playerAbilities)}
// - Player Stats: ${JSON.stringify(player.game_stats.base_stats.general)}
//       `;
//   }).join('');

//   const prompt = `
//     The players have launched their attack! As the Game Master, you must first determine which abilities were used, then calculate the outcome for each action using your tools, and finally provide a summary.

//     **Current Encounter State:**
//     - Boss State: ${JSON.stringify(boss, null, 2)}
//     - Player Actions This Turn: ${playerActionsText}

//     **YOUR TASK (Follow these steps for EACH player's action):**
//     1.  **Identify the Ability Used:** First, look at the player's "Action Description" and their "Available Abilities" list. Deduce which single ability from the list best matches the player's intent. Use this chosen ability for all subsequent calculations.
//     2.  **Check for Dodge:** Use the \`check_dodge_success\` tool with the boss's agility and player's agility. If the boss dodges, note it down and move to the next player.
//     3.  **Calculate Critical Hit:** If the attack hits, use the \`calculate_critical_hit\` tool with the player's intelligence/luck and the boss's crit resistance.
//     4.  **Calculate Final Damage:** Use the \`calculate_attack_damage\` tool with the identified ability's base damage, the player's attack stat, and the boss's defense stat.
//     5.  **Apply Critical Damage:** If the hit was critical, multiply the final damage by the critical hit multiplier from step 3.
//     6.  **Sum Total Damage:** Keep a running total of all damage dealt to the boss this turn.

//     **FINAL OUTPUT (After processing all players):**
//     1.  **Update Boss State:** Calculate the boss's new health, and determine if its phase or enrage status has changed based on the total damage.
//     2.  **Write Narrative:** Formulate a dramatic, turn-by-turn narrative describing each player's assault, which ability they used, and its outcome (hit, miss, crit, damage).
//     3.  **Add Summary Section:** At the end of the narrative, after two newlines, add a summary for each player:
//         Character Name
//         Damage Done: [Total damage they dealt]
//         Effects Given: [Any effects applied, e.g., "Critical Hit!", "Attack was dodged"]
//     4.  **Return Results:** Call the \`process_player_turn_results\` tool with the complete narrative (including the summary) and the final, updated boss state.
//   `;

//   const response = await lettaClient.agents.messages.create(gameMasterAgentId, {
//     messages: [{ role: "user", content: prompt }]
//   });
  
//   // Find the message for the specific tool we're waiting for.
//   const toolReturnMsg = response.messages.find(msg => msg.messageType === "tool_return_message" && msg.name === "process_player_turn_results");
  
//   const parsedToolReturn = getParsedToolReturn(toolReturnMsg?.toolReturn);

//   if (!parsedToolReturn?.updatedBossState) {
//     console.error("Agent Response Log:", JSON.stringify(response.messages, null, 2));
//     throw new Error("Game Master agent failed to call the 'process_player_turn_results' tool correctly.");
//   }

//   return parsedToolReturn;
// }

// /**
//  * Asks the Boss agent to decide and execute its turn using calculation tools.
//  * @param {object} boss - The current state of the boss.
//  * @param {Array<object>} players - The list of all player objects.
//  * @returns {Promise<{narrative: string, updatedPlayers: Array<object>}>} - The narrative and an array of player objects with updated stats.
//  */
// export async function processBossTurn(boss, players) {
//   if (!bossAgentId) throw new Error("LETTA_BOSS_AGENT_ID environment variable is not set.");

//   const livingPlayers = players.filter(p => p.isAlive);

//   const prompt = `
//     It is my turn to act! I will unleash my fury upon these mortals.

//     **My Current State:**
//     ${JSON.stringify(boss, null, 2)}
//     (I am ${boss.isEnraged ? 'ENRAGED' : 'not enraged'}. This should influence my choice of action and damage.)

//     **The Mortals Before Me (Potential Targets):**
//     ${JSON.stringify(livingPlayers, null, 2)}

//     **MY TASK:**
//     1.  **Choose My Action:** As the Ancient Shadow Drake, I will choose a devastating action from my abilities.
//     2.  **Select Target(s):** I will select one or more players to attack.
//     3.  **Calculate Outcome (For each target):** I must use the provided tools to determine the result of my attack.
//         - Use \`check_dodge_success\` to see if the mortal evades me.
//         - If I hit, use \`calculate_attack_damage\` to determine the damage. (My 'attack' stat is in my state above).
//         - I can also use \`calculate_critical_hit\` to see if I land a crushing blow.
//     4.  **Narrate My Attack:** I will describe my magnificent and terrifying assault and its outcome (hit, miss, crit, damage).
//     5.  **Add Summary Section:** At the end of my narration, after two newlines, I will add a summary for each mortal I targeted:
//         Character Name
//         Damage Done: [Damage I dealt]
//         Effects Given: ["Dodged my attack!", "Crushed by a Critical Hit!", etc.]
//     6.  **Return the Aftermath:** I will call the \`process_boss_turn_results\` tool. I must provide my full narrative (including the summary) and a JSON array of all mortals I harmed, including their "id" and their new "health".
//   `;

//   const response = await lettaClient.agents.messages.create(bossAgentId, {
//     messages: [{ role: "user", content: prompt }]
//   });

//   // Find the message for the specific tool we're waiting for.
//   const toolReturnMsg = response.messages.find(msg => msg.messageType === "tool_return_message" && msg.name === "process_boss_turn_results");
  
//   // FIXED: Use the helper function to handle both string and object cases.
//   const parsedToolReturn = getParsedToolReturn(toolReturnMsg?.toolReturn);

//   // Now check the parsed object for the property we expect.
//   if (!parsedToolReturn?.updatedPlayers) {
//     console.error("Agent Response Log:", JSON.stringify(response.messages, null, 2));
//     throw new Error("Boss agent failed to call the 'process_boss_turn_results' tool correctly.");
//   }

//   return parsedToolReturn;
// }



/**
 * Sends player actions and stats to the Groq API to determine the outcome.
 * @param {object} boss - The current state of the boss.
 * @param {Array<object>} players - The list of all player objects. Each player must have an 'abilities' array.
 * @param {Map<string, string>} turnActions - A map of player IDs to their action description string.
 * @returns {Promise<{narrative: string, updatedBossState: object}>} - The narrative and the new boss state.
 */
export async function processPlayerTurn(boss, players, turnActions) {
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

  // SIMPLIFIED PROMPT: Focuses on narrative and state changes, removing hard calculations.
  const prompt = `
    You are the Game Master. The players have launched their attack! Your task is to narrate the outcome and determine the new state of the boss.

    **Current Encounter State:**
    - Boss State: ${JSON.stringify(boss, null, 2)}
    - Player Actions This Turn: ${playerActionsText}

    **YOUR TASK:**
    1.  Based on the players' actions and stats, describe what happens in a dramatic and engaging narrative.
    2.  Decide how much damage the boss takes. Be creative but fair.
    3.  Update the boss's health. You can also update its 'phase' or 'isEnraged' status if it feels appropriate for the story.
    4.  At the end of your narrative, create a summary for each player detailing the damage they dealt and any notable effects.

    **OUTPUT FORMAT RULES (VERY IMPORTANT):**
    1.  First, provide the full narrative and the summary section.
    2.  Then, on a new line, you MUST include the exact separator: ---JSON_SEPARATOR---
    3.  Finally, on a new line, provide the final JSON object of the updated boss state.
    4.  **DO NOT** add any extra notes, comments, or text after the final JSON object.

    **EXACT EXAMPLE OF EXPECTED OUTPUT FORMAT:**
    [Your narrative and summary here]

    ---JSON_SEPARATOR---
    {
      "name": "Ancient Shadow Drake",
      "description": "A primordial beast of shadow and fury, awakened from a slumber of eons.",
      "imageUrl": "https://oaidalleapiprodscus.blob.core.windows.net/private/org-wjzyvmRjFIezvYsgRjuutE6i/user-hrHYhNiVUGGPGrx0EvJQka6T/img-0UXwWkrcWTbfTc7PuRDmysAw.png?st=2025-06-22T18%3A42%3A50Z&se=2025-06-22T20%3A42%3A50Z&sp=r&sv=2024-08-04&sr=b&rscd=inline&rsct=image/png&skoid=8b33a531-2df9-46a3-bc02-d4b1430a422c&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2025-06-22T05%3A56%3A16Z&ske=2025-06-23T05%3A56%3A16Z&sks=b&skv=2024-08-04&sig=aOLc1sYp1qsY0XziGwv4dfDKuj//zUlMthoNe/ctCFI%3D",
      "background_info": {
        "backstory": "This ancient drake was sealed away in an era long past. Its reawakening threatens to plunge the world into eternal twilight.",
        "personality": "Territorial & Destructive",
        "voice": "Deafening Roar",
        "alignment": "Chaotic Evil"
      },
      "game_stats": {
        "base_stats": {
          "general": { "max_health": 3500, "speed": 120, "attack": 100, "defense": 80 },
          "advanced": { "luck": 10, "intelligence": 80, "agility": 50, "endurance": 100 },
          "total_stat_points": 500
        },
        "abilities": [
          {
            "name": "Umbral Shroud",
            "type": "Passive",
            "description": "Cloaked in shadows, the drake has a 20% chance to evade incoming attacks.",
            "cooldown": null
          },
          {
            "name": "Shadow Breath",
            "type": "Attack",
            "description": "Breathes a cone of pure shadow, dealing heavy damage to a single target.",
            "cooldown": 2
          },
          {
            "name": "Tail Swipe",
            "type": "Attack",
            "description": "A massive sweep of its tail, dealing moderate damage to all opponents.",
            "cooldown": 3
          },
          {
            "name": "Oblivion Curse",
            "type": "Debuff",
            "description": "Curses a target, reducing their defense by 30% for 3 turns.",
            "cooldown": 4
          }
        ],
        "statusEffects": [
          "Primordial Armor",
          "Immune to Fear",
          "Shadow Aura"
        ]
      },
      "health": 3465,
      "maxHealth": 3500,
      "isEnraged": false,
      "phase": 1
    }
  `;

  const chatCompletion = await groq.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "llama3-8b-8192",
  });

  const agentMessageContent = chatCompletion.choices[0]?.message?.content;
  if (!agentMessageContent) throw new Error("Groq API did not return a valid message.");

  // Look for the JSON separator first, then fall back to finding the JSON block
  let separatorIndex = agentMessageContent.indexOf('---JSON_SEPARATOR---');
  let narrative, bossJsonString;
  
  if (separatorIndex !== -1) {
    // Found the exact separator
    narrative = agentMessageContent.substring(0, separatorIndex).trim();
    bossJsonString = agentMessageContent.substring(separatorIndex + '---JSON_SEPARATOR---'.length).trim();
  } else {
    // Fall back to finding the JSON block by looking for the opening brace after the last ---
    const lastSeparatorIndex = agentMessageContent.lastIndexOf('---');
    if (lastSeparatorIndex === -1) {
      console.error("Groq response did not contain any separator. Full response:", agentMessageContent);
      throw new Error("Groq API response was not formatted correctly.");
    }
    
    // Find the JSON starting after the last ---
    const afterLastSeparator = agentMessageContent.substring(lastSeparatorIndex + 3);
    const jsonStartIndex = afterLastSeparator.indexOf('{');
    
    if (jsonStartIndex === -1) {
      console.error("Could not find JSON block after separator. Full response:", agentMessageContent);
      throw new Error("Groq API response was not formatted correctly.");
    }
    
    narrative = agentMessageContent.substring(0, lastSeparatorIndex).trim();
    
    // Extract JSON more carefully by finding the complete JSON object
    const jsonStart = lastSeparatorIndex + 3 + jsonStartIndex;
    let braceCount = 0;
    let jsonEnd = jsonStart;
    
    for (let i = jsonStart; i < agentMessageContent.length; i++) {
      const char = agentMessageContent[i];
      if (char === '{') braceCount++;
      else if (char === '}') braceCount--;
      
      if (braceCount === 0) {
        jsonEnd = i + 1;
        break;
      }
    }
    
    bossJsonString = agentMessageContent.substring(jsonStart, jsonEnd).trim();
  }
  
  if (!narrative || !bossJsonString) {
    console.error("Failed to extract narrative or JSON. Full response:", agentMessageContent);
    throw new Error("Groq API response was not formatted correctly.");
  }
  
  try {
    return { narrative, updatedBossState: JSON.parse(bossJsonString) };
  } catch (parseError) {
    console.error("Failed to parse boss JSON:", bossJsonString);
    console.error("Parse error:", parseError);
    throw new Error("Groq API response contained invalid JSON.");
  }
}

/**
 * Asks the Groq API to decide and execute the boss's turn.
 * @param {object} boss - The current state of the boss.
 * @param {Array<object>} players - The list of all player objects.
 * @returns {Promise<{narrative: string, updatedPlayers: Array<object>}>} - The narrative and an array of player objects with updated stats.
 */
export async function processBossTurn(boss, players) {
  const livingPlayers = players.filter(p => p.isAlive);
  const bossAbilities = boss.abilities || [];

  // This prompt asks the AI to choose an action, narrate it, and provide the results
  // in a structured format for easy parsing.
  const prompt = `
    You are the boss, the Ancient Shadow Drake. It is your turn to act.

    **Your Current State:**
    ${JSON.stringify(boss, null, 2)}
    (You are ${boss.isEnraged ? 'ENRAGED' : 'not enraged'}. This should influence your choice of action.)
    
    **Your Available Abilities:**
    ${JSON.stringify(bossAbilities, null, 2)}

    **The Mortals Before You (Potential Targets):**
    ${JSON.stringify(livingPlayers, null, 2)}
    
    **YOUR TASK:**
    1.  **Choose Action & Target(s):** Choose ONE devastating action from your "Available Abilities" list and select one or more players to attack.
    2.  **Narrate Your Attack:** Describe your magnificent and terrifying assault. Tell the players how much damage you dealt.
    3.  **Decide the Damage:** Determine the new health for each player you hit. Be powerful, but fair.
    4.  **Add the Summary Section:** At the end of your narration, add a summary detailing the outcome for each player targeted.

    **OUTPUT FORMAT RULES (VERY IMPORTANT):**
    1.  First, provide the full narrative and the summary section.
    2.  Then, on a new line, you MUST include the exact separator: ---JSON_SEPARATOR---
    3.  Finally, on a new line, provide the final JSON array of the mortals you harmed, including their "id" and their new "health".
    4.  **DO NOT** add any extra notes, comments, or text after the final JSON array.

    **EXACT EXAMPLE OF EXPECTED OUTPUT FORMAT:**
    [Your narrative and summary here]

    ---JSON_SEPARATOR---
    [
      {
        "id": "player1",
        "health": 150
      },
      {
        "id": "player2",
        "health": 200
      }
    ]
  `;

  const chatCompletion = await groq.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "llama3-8b-8192",
  });

  const agentMessageContent = chatCompletion.choices[0]?.message?.content;
  if (!agentMessageContent) {
    throw new Error("Groq API did not return a valid turn message.");
  }
  
  // --- Start of Simplified and More Robust Parsing Logic ---

  const separator = '---JSON_SEPARATOR---';
  const separatorIndex = agentMessageContent.indexOf(separator);

  // Ensure the separator exists in the response.
  if (separatorIndex === -1) {
    console.error("Groq response did not contain the required '---JSON_SEPARATOR---'. Full response:", agentMessageContent);
    throw new Error("Groq API response was not formatted correctly.");
  }

  // 1. Split the response into two parts based on the separator.
  const narrative = agentMessageContent.substring(0, separatorIndex).trim();
  const dataPart = agentMessageContent.substring(separatorIndex + separator.length);

  // 2. Use a regular expression to find the JSON array within the data part.
  // This isolates the array, ignoring any extra text before or after it.
  const jsonMatch = dataPart.match(/\[\s*\{[\s\S]*?\}\s*\]/);

  if (!jsonMatch) {
    console.error("Could not find a valid JSON array after the separator. Full response:", agentMessageContent);
    throw new Error("Groq API response did not contain a valid JSON array.");
  }

  const playersJsonString = jsonMatch[0];

  // 3. Parse the clean JSON string.
  try {
    return { 
      narrative, 
      updatedPlayers: JSON.parse(playersJsonString)
    };
  } catch (parseError) {
    console.error("Failed to parse the extracted players JSON:", playersJsonString);
    console.error("Parse error:", parseError);
    throw new Error("Groq API response contained invalid JSON.");
  }
  
  // --- End of Simplified and More Robust Parsing Logic ---
}
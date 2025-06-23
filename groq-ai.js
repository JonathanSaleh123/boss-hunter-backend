import 'dotenv/config';
import Groq from 'groq-sdk';
import { z, ZodError } from 'zod';

// --- GROQ CLIENT INITIALIZATION ---
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });


// --- ZOD DATA SCHEMAS ---
export const UpdatedPlayerSchema = z.object({
  id: z.string().min(1, "Player ID cannot be empty."),
  health: z.number().int("Health must be an integer."),
});
export const UpdatedPlayersArraySchema = z.array(UpdatedPlayerSchema);

const BossGeneralStatsSchema = z.object({
    max_health: z.number().int(),
    speed: z.number(),
    attack: z.number(),
    defense: z.number(),
});
const BossAbilitySchema = z.object({
    name: z.string(),
    type: z.string(),
    description: z.string(),
    cooldown: z.number().nullable(),
});
export const BossStateSchema = z.object({
  name: z.string(),
  description: z.string(),
  imageUrl: z.string().url("Image URL must be a valid URL."),
  background_info: z.object({ backstory: z.string(), personality: z.string(), voice: z.string(), alignment: z.string() }),
  game_stats: z.object({
    base_stats: z.object({ general: BossGeneralStatsSchema, advanced: z.any(), total_stat_points: z.any() }),
    abilities: z.array(BossAbilitySchema),
    statusEffects: z.array(z.string()),
  }),
  health: z.number().int("Health must be an integer."),
  maxHealth: z.number().int(),
  isEnraged: z.boolean(),
  phase: z.number().int(),
});

// --- NEW ZOD OUTPUT SCHEMAS ---
export const PlayerTurnOutputSchema = z.object({
  narrative: z.string().min(1, "Narrative cannot be empty."),
  updatedBossState: BossStateSchema,
});
export const BossTurnOutputSchema = z.object({
  narrative: z.string().min(1, "Narrative cannot be empty."),
  updatedPlayers: UpdatedPlayersArraySchema,
});


// --- REFACTORED CORE GAME FUNCTIONS ---

/**
 * Sends player actions to the Groq API and validates the single returned JSON object.
 * @returns {Promise<z.infer<typeof PlayerTurnOutputSchema>>} - A validated object with the narrative and new boss state.
 */
export async function processPlayerTurn(boss, players, turnActions) {
  const playerActionsText = Array.from(turnActions.entries()).map(([playerId, action]) => {
      const player = players.find(p => p.id === playerId);
      return `
### Player: ${player.name}
- Action Description: "${action}"
- Player Stats: ${JSON.stringify(player.game_stats.base_stats.general)}
      `;
  }).join('');

  // UPDATED PROMPT: Asks for a single JSON object.
  const prompt = `
    You are the Game Master. Based on the players' actions, determine the outcome.

    **Current Encounter State:**
    - Boss State: ${JSON.stringify(boss, null, 2)}
    - Player Actions This Turn: ${playerActionsText}

    **YOUR TASK:**
    1.  Narrate the outcome of the players' actions in a dramatic and engaging way.
    2.  Determine the new state of the boss (health, phase, etc.).
    3.  Create a summary for each player detailing the damage they dealt. Include this in the narrative.

    **OUTPUT FORMAT RULES (VERY IMPORTANT):**
    You MUST respond with a single, valid JSON object and nothing else. Do not add any text or markdown before or after the JSON.
    The JSON object MUST have the following structure:
    {
      "narrative": "Your full, dramatic narrative and player summary goes here.",
      "updatedBossState": { ... the complete, updated boss JSON object ... }
    }
  `;

  const chatCompletion = await groq.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "llama3-8b-8192",
    // Instruct the model to output JSON
    response_format: { type: "json_object" }, 
  });

  const agentMessageContent = chatCompletion.choices[0]?.message?.content;
  if (!agentMessageContent) throw new Error("Groq API did not return a valid message.");

  try {
    // SIMPLIFIED PARSING: Parse the entire response as JSON and validate it.
    const parsedJson = JSON.parse(agentMessageContent);
    const validatedOutput = PlayerTurnOutputSchema.parse(parsedJson);
    return validatedOutput;
  } catch (error) {
    if (error instanceof ZodError) {
      console.error("Zod validation failed for Player Turn Output:", error.issues);
      throw new Error("Groq API returned a JSON object with an invalid schema.");
    } else if (error instanceof SyntaxError) {
      console.error("Failed to parse Player Turn JSON. Raw string:", agentMessageContent);
      throw new Error("Groq API response was not valid JSON.");
    } else {
      console.error("An unexpected error occurred during parsing:", error);
      throw error;
    }
  }
}

/**
 * Asks the Groq API for the boss's turn and validates the single returned JSON object.
 * This version uses a "hardened" prompt with a system message to improve JSON reliability.
 * @returns {Promise<z.infer<typeof BossTurnOutputSchema>>} - A validated object with the narrative and updated player stats.
 */
export async function processBossTurn(boss, players) {
  const livingPlayers = players.filter(p => p.isAlive);
  const bossAbilities = boss.game_stats.abilities || [];

  // HARDENED PROMPT: More explicit instructions to ensure valid JSON.
  const prompt = `
    You are the boss, the Ancient Shadow Drake. It's your turn to act.

    **Your Current State:**
    ${JSON.stringify(boss, null, 2)}
    
    **Your Available Abilities:**
    ${JSON.stringify(bossAbilities, null, 2)}

    **Your Targets:**
    ${JSON.stringify(livingPlayers, null, 2)}
    
    **YOUR TASK:**
    1.  Choose one action and one or more targets.
    2.  Narrate your devastating attack.
    3.  Determine the new health for each player you hit and create a summary. Include this in the narrative.

    **OUTPUT FORMAT RULES (VERY IMPORTANT):**
    - You MUST respond with a single, valid JSON object and nothing else.
    - DO NOT add any text, notes, or markdown before or after the JSON object.
    - CRITICAL RULE: The final JSON object must be syntactically perfect. Pay close attention to commas. There must be NO TRAILING COMMAS after the last element in an array or the last property in an object.

    **EXAMPLE OF PERFECT OUTPUT:**
    {
      "narrative": "My tail sweeps across the battlefield, striking fear and solid earth. Thor and Po are both hit by the massive impact.",
      "updatedPlayers": [
        { "id": "player_id_1", "health": 150 },
        { "id": "player_id_2", "health": 145 }
      ]
    }
  `;

  const chatCompletion = await groq.chat.completions.create({
    // UPDATED: Added a system role message for higher-level instruction.
    messages: [
      {
        role: "system",
        content: "You are an expert Game Master AI. You must follow all output format rules precisely and respond ONLY with perfectly valid JSON."
      },
      { 
        role: "user", 
        content: prompt 
      }
    ],
    model: "llama3-8b-8192",
    response_format: { type: "json_object" },
  });

  const agentMessageContent = chatCompletion.choices[0]?.message?.content;
  if (!agentMessageContent) {
    throw new Error("Groq API did not return a valid message.");
  }
  
  try {
    const parsedJson = JSON.parse(agentMessageContent);
    const validatedOutput = BossTurnOutputSchema.parse(parsedJson);
    return validatedOutput;
  } catch (error) {
    if (error instanceof ZodError) {
      console.error("Zod validation failed for Boss Turn Output:", error.issues);
      throw new Error("Groq API returned a JSON object with an invalid schema.");
    } else if (error instanceof SyntaxError) {
      console.error("Failed to parse Boss Turn JSON. Raw string:", agentMessageContent);
      throw new Error("Groq API response was not valid JSON.");
    } else {
      console.error("An unexpected error occurred during parsing:", error);
      throw error;
    }
  }
}
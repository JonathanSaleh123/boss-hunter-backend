/**
 * Game Mechanics Tools for LangGraph AI Agents
 * Converted from Python implementation for use with battle processing
 */

/**
 * Determines the turn order for a list of players based on their 'speed' stat.
 * @param {Array<Object>} players - Array of player objects with nested game_stats
 * @returns {Array<Object>} Players sorted in descending order of speed
 */
export function calculateTurnOrder(players) {
  try {
    return [...players].sort((a, b) => {
      const speedA = a?.game_stats?.base_stats?.general?.speed || 0;
      const speedB = b?.game_stats?.base_stats?.general?.speed || 0;
      return speedB - speedA; // Descending order
    });
  } catch (error) {
    console.error("Failed to calculate turn order:", error);
    return players;
  }
}

/**
 * Applies a creativity bonus or debuff to damage based on ability usage history.
 * First-time use gets 25% bonus, subsequent uses get 15% stacking debuff.
 * @param {number} baseDamage - The initial damage of the ability
 * @param {string} abilityName - The name of the ability being used
 * @param {Array<string>} abilityHistory - List of ability names used previously
 * @returns {number} Modified damage after applying creativity modifier
 */
export function applyCreativityModifier(baseDamage, abilityName, abilityHistory) {
  const timesUsed = abilityHistory.filter(name => name === abilityName).length;
  
  let modifier;
  if (timesUsed === 0) {
    // First-time use bonus
    modifier = 1.25;
  } else {
    // Debuff for repeated use, max 75% reduction (minimum 25% damage)
    modifier = Math.max(0.25, 1.0 - (0.15 * timesUsed));
  }
  
  return baseDamage * modifier;
}

/**
 * Calculates the final damage of an attack.
 * Formula: Base Ability Damage + (Attacker's Attack * 1.5) - (Target's Defense * 0.8)
 * @param {number} baseAbilityDamage - The base damage of the ability
 * @param {number} attackerAttack - The attacker's attack stat
 * @param {number} targetDefense - The target's defense stat
 * @returns {number} Final calculated damage (minimum 1)
 */
export function calculateAttackDamage(baseAbilityDamage, attackerAttack, targetDefense) {
  const damage = baseAbilityDamage + (attackerAttack * 1.5) - (targetDefense * 0.8);
  return Math.max(1.0, Math.round(damage));
}

/**
 * Determines if a target successfully dodges an attack based on their agility.
 * Dodge chance is 0.5% per point of agility, capped at 40%.
 * @param {number} targetAgility - The target's agility stat
 * @returns {boolean} True if dodge is successful
 */
export function checkDodgeSuccess(targetAgility) {
  const dodgeChance = Math.min(0.40, targetAgility * 0.005); // Cap at 40%
  return Math.random() < dodgeChance;
}

/**
 * Calculates if a critical hit occurs and its damage multiplier.
 * @param {number} attackerIntelligence - The attacker's intelligence stat
 * @param {number} attackerLuck - The attacker's luck stat
 * @param {number} targetCritResistance - The target's crit resistance stat
 * @returns {{isCritical: boolean, multiplier: number}} Critical hit result
 */
export function calculateCriticalHit(attackerIntelligence, attackerLuck, targetCritResistance) {
  const critChance = attackerLuck * 0.003;
  const isCritical = Math.random() < critChance;
  
  if (!isCritical) {
    return { isCritical: false, multiplier: 1.0 };
  }
  
  // Calculate multiplier
  const baseMultiplier = 1.5; // 150% damage
  const intelligenceBonus = attackerIntelligence * 0.015; // 1.5% per int point
  const resistancePenalty = targetCritResistance * 0.01; // 1% reduction per resistance
  
  const finalMultiplier = baseMultiplier + intelligenceBonus - resistancePenalty;
  
  // Ensure minimum 110% if crit occurs
  return { isCritical: true, multiplier: Math.max(1.1, finalMultiplier) };
}

/**
 * Checks if a target resists a debuff based on their endurance.
 * Resistance chance is 1.2% per point of endurance.
 * @param {number} targetEndurance - The target's endurance stat
 * @returns {boolean} True if debuff is resisted
 */
export function checkDebuffResistance(targetEndurance) {
  const resistChance = targetEndurance * 0.012;
  return Math.random() < resistChance;
}

/**
 * Determines the base probability of applying a status condition based on luck.
 * @param {number} attackerLuck - The attacker's luck stat
 * @returns {number} Probability (0.0 to 1.0) of status condition being applied
 */
export function calculateStatusChance(attackerLuck) {
  // Cap max chance at 85%
  return Math.min(0.85, attackerLuck * 0.0075);
}

/**
 * Process player turn results - formats the final output for the game system
 * @param {string} narrative - The complete battle narrative
 * @param {Object} updatedBossState - The updated boss state after player actions
 * @returns {Object} Formatted result object
 */
export function processPlayerTurnResults(narrative, updatedBossState) {
  return {
    narrative: narrative.trim(),
    updatedBossState
  };
}

/**
 * Process boss turn results - formats the final output for the game system
 * @param {string} narrative - The complete boss attack narrative
 * @param {Array<Object>} updatedPlayers - Array of players with updated health
 * @returns {Object} Formatted result object
 */
export function processBossTurnResults(narrative, updatedPlayers) {
  return {
    narrative: narrative.trim(),
    updatedPlayers
  };
}

// Export all tools for LangGraph
export const gameTools = {
  calculateTurnOrder,
  applyCreativityModifier,
  calculateAttackDamage,
  checkDodgeSuccess,
  calculateCriticalHit,
  checkDebuffResistance,
  calculateStatusChance,
  processPlayerTurnResults,
  processBossTurnResults
}; 
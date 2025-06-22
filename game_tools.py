# file: register_game_mechanics.py
from letta_client import Letta
import os
import random

# --- Client Initialization ---
# Ensure your LETTA_API_KEY is set in your environment variables.
# For self-hosted, you would use: Letta(base_url="http://localhost:8283")
try:
    client = Letta(token=os.getenv("LETTA_API_KEY"))
    print("Letta client initialized successfully.")
except Exception as e:
    print(f"Failed to initialize Letta client. Ensure LETTA_API_KEY is set. Error: {e}")
    exit()

# --- Game Mechanics Tool Functions ---

def calculate_turn_order(players: list[dict]) -> list[dict]:
    """
    Determines the turn order for a list of players based on their 'speed' stat.

    Args:
        players (list[dict]): A list of player objects. Each object must have a 'game_stats.base_stats.general.speed' path.
                              Example: [{"id": "p1", "name": "Arion", "game_stats": {"base_stats": {"general": {"speed": 85}}}}]

    Returns:
        list[dict]: The list of players, sorted in descending order of their speed.
    """
    try:
        # Sorts players by speed. The lambda function safely navigates the nested dictionary.
        sorted_players = sorted(
            players,
            key=lambda p: p.get('game_stats', {}).get('base_stats', {}).get('general', {}).get('speed', 0),
            reverse=True
        )
        return sorted_players
    except (TypeError, KeyError) as e:
        return {"error": f"Failed to calculate turn order. Invalid player data structure: {e}"}


def apply_creativity_modifier(base_damage: float, ability_name: str, ability_history: list[str]) -> float:
    """
    Applies a creativity bonus or debuff to damage based on ability usage history.
    - First-time use of an ability in the history gets a 25% damage bonus.
    - Every subsequent use reduces effectiveness by 15%, stacking.

    Args:
        base_damage (float): The initial damage of the ability.
        ability_name (str): The name of the ability being used.
        ability_history (list[str]): A list of ability names used previously in the encounter.

    Returns:
        float: The modified damage after applying the creativity bonus or debuff.
    """
    times_used = ability_history.count(ability_name)
    if times_used == 0:
        # First-time use bonus
        modifier = 1.25
    else:
        # Debuff for repeated use. 1.0 base - 15% for each previous use.
        # Max debuff caps at 75% reduction (damage won't go below 25% of base).
        modifier = max(0.25, 1.0 - (0.15 * times_used))

    return base_damage * modifier


def calculate_attack_damage(base_ability_damage: float, attacker_attack: int, target_defense: int) -> float:
    """
    Calculates the final damage of an attack.
    Formula: Base Ability Damage + (Attacker's Attack * 1.5) - (Target's Defense * 0.8).
    Ensures a minimum of 1 damage is always dealt.

    Args:
        base_ability_damage (float): The base damage of the ability being used.
        attacker_attack (int): The 'attack' stat of the attacker.
        target_defense (int): The 'defense' stat of the target.

    Returns:
        float: The final calculated damage, rounded to the nearest integer. Guaranteed to be at least 1.
    """
    # Using multipliers to scale the impact of attack and defense stats
    damage = base_ability_damage + (attacker_attack * 1.5) - (target_defense * 0.8)
    # Ensure all attacks deal at least 1 damage, even against highly defensive targets.
    return max(1.0, round(damage))


def check_dodge_success(target_agility: int) -> bool:
    """
    Determines if a target successfully dodges an attack based on their agility.
    The dodge chance is 0.5% per point of agility, capped at a maximum of 40%.

    Args:
        target_agility (int): The 'agility' stat of the target.

    Returns:
        bool: True if the dodge is successful, False otherwise.
    """
    dodge_chance = min(0.40, target_agility * 0.005)  # Cap at 40%
    return random.random() < dodge_chance


def calculate_critical_hit(attacker_intelligence: int, attacker_luck: int, target_crit_resistance: int) -> tuple[bool, float]:
    """
    Calculates if a critical hit occurs and its damage multiplier.
    - Critical Chance: (attacker_luck * 0.3)%
    - Critical Damage Multiplier: Base 150% + (attacker_intelligence * 1.5)%
    - Target's critical resistance reduces the final multiplier.

    Args:
        attacker_intelligence (int): The attacker's 'intelligence' stat.
        attacker_luck (int): The attacker's 'luck' stat.
        target_crit_resistance (int): The target's 'crit_resistance' stat, which reduces the final multiplier.

    Returns:
        tuple[bool, float]: A tuple containing:
                            - bool: True if the hit was critical, False otherwise.
                            - float: The damage multiplier (e.g., 1.75 for a 175% damage crit, or 1.0 for a non-crit).
    """
    crit_chance = (attacker_luck * 0.003)
    is_critical = random.random() < crit_chance

    if not is_critical:
        return (False, 1.0)

    # Calculate the multiplier
    base_multiplier = 1.5  # Starts at 150% damage
    intelligence_bonus = attacker_intelligence * 0.015  # 1.5% bonus per int point
    resistance_penalty = target_crit_resistance * 0.01 # 1% reduction per resistance point
    
    final_multiplier = base_multiplier + intelligence_bonus - resistance_penalty
    
    # Ensure crit multiplier is at least 110% if a crit occurs
    return (True, max(1.1, final_multiplier))


def check_debuff_resistance(target_endurance: int) -> bool:
    """
    Checks if a target resists a debuff or status condition based on their endurance.
    Resistance chance is 1.2% per point of endurance.

    Args:
        target_endurance (int): The 'endurance' stat of the target.

    Returns:
        bool: True if the debuff is resisted, False otherwise.
    """
    resist_chance = target_endurance * 0.012
    return random.random() < resist_chance


def calculate_status_chance(attacker_luck: int) -> float:
    """
    Determines the base probability of applying a status condition based on luck.
    The chance is 0.75% per point of luck.

    Args:
        attacker_luck (int): The 'luck' stat of the attacker.

    Returns:
        float: The probability (0.0 to 1.0) of the status condition being applied.
    """
    # Caps the max chance at 85% to prevent guaranteed status effects
    return min(0.85, attacker_luck * 0.0075)

# --- Tool Registration ---

# A list of all the functions we want to turn into Letta tools
functions_to_register = [
    calculate_turn_order,
    apply_creativity_modifier,
    calculate_attack_damage,
    check_dodge_success,
    calculate_critical_hit,
    check_debuff_resistance,
    calculate_status_chance,
]

def register_tools():
    """Iterates through the functions and registers each as a tool in Letta."""
    print("Starting tool registration...")
    created_tool_names = []
    for func in functions_to_register:
        try:
            tool = client.tools.create(source_code=func)
            print(f"Successfully created or updated tool: '{tool.name}'")
            created_tool_names.append(tool.name)
        except Exception as e:
            print(f"Error creating tool for function '{func.__name__}': {e}")
    
    return created_tool_names

def add_tools_to_agent(tool_names: list[str]):
    """Adds the list of created tools to the Game Master agent."""
    game_master_agent_id = os.getenv("LETTA_AGENT_ID")
    if not game_master_agent_id:
        print("\nLETTA_AGENT_ID not found in environment. Skipping agent update.")
        print("Please add these tools to your agent manually via the ADE or another script:")
        print(", ".join(tool_names))
        return

    print(f"\nAdding {len(tool_names)} tools to agent '{game_master_agent_id}'...")
    try:
        client.agents.update(
            agent_id=game_master_agent_id,
            tools_to_add=tool_names
        )
        print("Successfully added all new tools to the Game Master agent.")
    except Exception as e:
        print(f"Failed to update agent '{game_master_agent_id}'. Error: {e}")


if __name__ == "__main__":
    newly_created_tools = register_tools()
    if newly_created_tools:
        add_tools_to_agent(newly_created_tools)
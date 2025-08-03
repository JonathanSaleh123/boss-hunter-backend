# LangGraph AI Provider Documentation

## Overview

This implementation replaces Letta with a custom LangGraph + Groq workflow that provides:

- **Dedicated Agent Personas**: Game Master and Boss agents with distinct personalities and roles
- **Context Management**: Each agent maintains conversation history and game state
- **Precise Game Tools**: JavaScript implementation of battle calculation tools
- **Workflow Orchestration**: LangGraph manages tool calling and response flow

## Architecture

### Key Components

1. **`game-tools.js`** - JavaScript versions of the Python game mechanics
2. **`langgraph-ai.js`** - Main LangGraph implementation with agents and workflows  
3. **`ai-provider.js`** - Updated provider switcher (now supports 'langgraph')
4. **`test-langgraph.js`** - Test script for validation

### Agent Personas

#### Game Master Agent
- **Role**: Impartial battle narrator and calculator
- **Personality**: Methodical, dramatic, precise with game mechanics
- **Process**: Analyzes player actions → matches to abilities → calculates outcomes → creates narrative

#### Boss Agent (Ancient Shadow Drake)
- **Role**: Malevolent ancient dragon
- **Personality**: Intelligent, strategic, speaks with archaic grandeur
- **Process**: Analyzes battle state → chooses strategic action → calculates damage → narrates attack

### Context Management

Each agent maintains:
- Conversation history (last 20 entries)
- Current game state (boss, players)
- Turn counter
- Ability usage tracking

## Usage

### Environment Setup

Set the AI provider in your environment:
```bash
export AI_PROVIDER=langgraph
export GROQ_API_KEY=your_groq_api_key_here
```

### Testing

Run the test script to validate functionality:
```bash
node test-langgraph.js
```

### Integration

The LangGraph provider implements the same interface as Letta and Groq:

```javascript
import { processPlayerTurn, processBossTurn } from './ai-provider.js';

// Process player actions
const result = await processPlayerTurn(boss, players, turnActions);
// Returns: { narrative, updatedBossState }

// Process boss turn  
const bossResult = await processBossTurn(boss, players);
// Returns: { narrative, updatedPlayers }
```

### Debug Information

Access agent context for debugging:
```javascript
import { getProviderDebugInfo } from './ai-provider.js';
const debugInfo = getProviderDebugInfo();
```

## Game Tools Available

The agents have access to these calculation tools:

- `check_dodge_success(targetAgility)` - Dodge chance calculation
- `calculate_critical_hit(intelligence, luck, critResistance)` - Critical hit logic
- `calculate_attack_damage(baseDamage, attack, defense)` - Damage calculation
- `process_player_turn_results(narrative, updatedBossState)` - Final player turn output
- `process_boss_turn_results(narrative, updatedPlayers)` - Final boss turn output

## Benefits over Basic Groq

1. **Tool Access**: Agents can perform actual calculations vs guessing
2. **Context Continuity**: Maintains conversation history and game state
3. **Workflow Control**: LangGraph ensures proper tool calling sequence
4. **Persona Consistency**: Agents maintain character throughout battle
5. **Error Handling**: Robust error handling and fallbacks

## Benefits over Letta

1. **No External Dependencies**: Self-contained solution
2. **Customizable Workflows**: Full control over agent behavior
3. **Cost Efficiency**: Direct Groq API usage (no Letta subscription needed)
4. **Simpler Deployment**: No separate Letta service required

## Workflow Process

### Player Turn Flow
1. Game Master receives player actions
2. Matches actions to player abilities
3. For each player:
   - Check if boss dodges
   - Calculate critical hit chance
   - Calculate base damage
   - Apply critical multiplier
4. Sum total damage
5. Update boss state
6. Generate dramatic narrative
7. Return results via `process_player_turn_results`

### Boss Turn Flow
1. Boss agent analyzes current state
2. Chooses strategic ability from available options
3. Selects target(s) from living players
4. For each target:
   - Check if player dodges
   - Calculate critical hit
   - Calculate damage
   - Apply multipliers
5. Generate draconic narrative
6. Return results via `process_boss_turn_results`

## Switching Between Providers

You can easily switch between AI providers by changing the environment variable:

- `AI_PROVIDER=letta` - Use Letta agents (requires Letta setup)
- `AI_PROVIDER=groq` - Use basic Groq (simple prompts, no tools)
- `AI_PROVIDER=langgraph` - Use LangGraph + Groq (recommended)

The game server will automatically use the specified provider without code changes.

## Troubleshooting

### Common Issues

1. **Missing GROQ_API_KEY**: Ensure your Groq API key is set in environment
2. **Tool Call Failures**: Check that game tools are properly imported
3. **Context Window Limits**: Agents automatically manage context to stay within limits
4. **Network Timeouts**: Groq API calls include reasonable timeouts

### Debug Mode

Enable detailed logging by setting:
```bash
export DEBUG=langgraph:*
```

This will log agent workflows, tool calls, and state transitions. 
// AI Provider Configuration
// This file allows you to easily switch between Letta, Groq, and LangGraph AI providers

// Import all providers
import * as lettaProvider from './letta.js';
import * as groqProvider from './groq-ai.js';
import * as langgraphProvider from './langgraph-ai.js';

// Configuration - change this to switch between providers
const AI_PROVIDER = process.env.AI_PROVIDER || 'letta';

// Export the appropriate provider based on configuration
let activeProvider;
let providerName;

switch (AI_PROVIDER.toLowerCase()) {
  case 'letta':
    console.log('Using Letta AI provider');
    activeProvider = lettaProvider;
    providerName = 'letta';
    break;
    
  case 'groq':
    console.log('Using basic Groq AI provider');
    activeProvider = groqProvider;
    providerName = 'groq';
    break;
    
  case 'langgraph':
    console.log('Using LangGraph + Groq AI provider');
    activeProvider = langgraphProvider;
    providerName = 'langgraph';
    break;
    
  default:
    console.log(`Unknown AI provider '${AI_PROVIDER}', defaulting to Letta`);
    activeProvider = lettaProvider;
    providerName = 'letta';
    break;
}

// Export the functions from the active provider
export const processPlayerTurn = activeProvider.processPlayerTurn;
export const processBossTurn = activeProvider.processBossTurn;

// Export provider info for debugging
export const getActiveProvider = () => providerName;

// Export provider-specific debug functions if available
export const getProviderDebugInfo = () => {
  if (providerName === 'langgraph' && activeProvider.getAgentContexts) {
    return activeProvider.getAgentContexts();
  }
  return { provider: providerName, debugInfo: 'Not available for this provider' };
};

// Export all providers for direct access if needed
export { lettaProvider, groqProvider, langgraphProvider }; 
// AI Provider Configuration
// This file allows you to easily switch between Letta and Groq AI providers

// Import both providers
import * as lettaProvider from './letta.js';
import * as groqProvider from './groq-ai.js';

// Configuration - change this to switch between providers
const USE_LETTA = process.env.AI_PROVIDER === 'letta' || !process.env.AI_PROVIDER;
const USE_GROQ = process.env.AI_PROVIDER === 'groq';

// Export the appropriate provider based on configuration
let activeProvider;

if (USE_LETTA) {
  console.log('Using Letta AI provider');
  activeProvider = lettaProvider;
} else if (USE_GROQ) {
  console.log('Using Groq AI provider');
  activeProvider = groqProvider;
} else {
  console.log('No AI provider specified, defaulting to Letta');
  activeProvider = lettaProvider;
}

// Export the functions from the active provider
export const processPlayerTurn = activeProvider.processPlayerTurn;
export const processBossTurn = activeProvider.processBossTurn;

// Export provider info for debugging
export const getActiveProvider = () => {
  return USE_LETTA ? 'letta' : 'groq';
};

// Export both providers for direct access if needed
export { lettaProvider, groqProvider }; 
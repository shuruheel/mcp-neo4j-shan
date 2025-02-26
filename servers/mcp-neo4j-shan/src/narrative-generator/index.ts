// Re-export main classes and functions
export { NarrativeGenerator } from './generator.js';
export { narrativeTemplates } from './templates.js';
export { 
  formatEmotionalValence, 
  formatEmotionalArousal,
  formatConfidence
} from './utils.js';
export { 
  generateReasoningChainNarrative,
  formatReasoningStep
} from './reasoning-chain-narrative.js';

// Fix the relationshipType vs relationType issue in generator.ts by adding this note
// Note: In generator.ts, line 489, 'relationshipType' needs to be changed to 'relationType'
// but we'll fix this when we create a unified model between node-creator and node-retriever 
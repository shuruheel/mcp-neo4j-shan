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
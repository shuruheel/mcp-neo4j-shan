import { formatConfidence } from './utils.js';
import type { NarrativeOptions } from './options.js';

/**
 * Generates a narrative for a reasoning chain and its steps
 * @param chain - The reasoning chain object
 * @param steps - Array of reasoning step objects
 * @param options - Narrative generation options
 * @returns Formatted narrative text for the reasoning chain
 */
export function generateReasoningChainNarrative(
  chain: any, 
  steps: any[], 
  options: NarrativeOptions = {}
): string {
  if (!chain) {
    return 'No reasoning chain found.';
  }

  const { format = 'detailed', audience = 'general', detailLevel = 'medium' } = options;
  
  // Sort steps by their step number
  const sortedSteps = [...steps].sort((a, b) => 
    (a.properties.stepNumber || 0) - (b.properties.stepNumber || 0)
  );
  
  let narrative = '';
  
  // Chain header
  narrative += `# ${chain.properties.name}\n\n`;
  
  // Chain description with methodology
  const methodology = chain.properties.methodology || 'unspecified';
  narrative += `**${chain.properties.description}**\n\n`;
  narrative += `This reasoning follows a ${methodology} approach`;
  
  if (chain.properties.domain) {
    narrative += ` in the domain of ${chain.properties.domain}`;
  }
  narrative += '.\n\n';
  
  // Source thought if available
  if (chain.properties.sourceThought) {
    narrative += `*Based on the thought: "${chain.properties.sourceThought}"*\n\n`;
  }
  
  // Different formats based on options
  if (format === 'educational' || audience === 'student') {
    narrative += `## Understanding ${methodology.charAt(0).toUpperCase() + methodology.slice(1)} Reasoning\n\n`;
    
    switch (methodology) {
      case 'deductive':
        narrative += `*Deductive reasoning* moves from general principles to specific conclusions. It starts with premises assumed to be true and derives logical consequences that must be true if the premises are true. The conclusion is certain if the premises are true.\n\n`;
        break;
      case 'inductive':
        narrative += `*Inductive reasoning* moves from specific observations to broader generalizations. It involves identifying patterns and making probable conclusions based on limited evidence. These conclusions are probable rather than certain.\n\n`;
        break;
      case 'abductive':
        narrative += `*Abductive reasoning* starts with an observation and seeks the simplest, most likely explanation. It's often described as "inference to the best explanation" and is commonly used in diagnosis and hypothesis formation.\n\n`;
        break;
      case 'analogical':
        narrative += `*Analogical reasoning* draws parallels between similar situations or systems. It transfers knowledge from a familiar domain to an unfamiliar one based on similarities between them.\n\n`;
        break;
      case 'mixed':
        narrative += `*Mixed reasoning* combines multiple approaches (deductive, inductive, abductive, and/or analogical) to develop a more robust argument or explanation.\n\n`;
        break;
    }
  }
  
  // Steps section
  narrative += `## Reasoning Process\n\n`;
  
  // Group steps by type for easier comprehension
  const stepsByType: Record<string, any[]> = {};
  for (const step of sortedSteps) {
    const type = step.properties.stepType || 'unspecified';
    if (!stepsByType[type]) {
      stepsByType[type] = [];
    }
    stepsByType[type].push(step);
  }
  
  // First show the linear progression of steps
  narrative += `### Step-by-Step Progression\n\n`;
  
  if (sortedSteps.length === 0) {
    narrative += `*No steps have been defined for this reasoning chain yet.*\n\n`;
  } else {
    for (const step of sortedSteps) {
      narrative += formatReasoningStep(step, options);
    }
  }
  
  // If detail level is high, show additional step analyses
  if (detailLevel === 'high') {
    // Show premises
    if (stepsByType['premise'] && stepsByType['premise'].length > 0) {
      narrative += `\n### Starting Premises\n\n`;
      for (const step of stepsByType['premise']) {
        narrative += `- ${step.properties.content} (confidence: ${formatConfidence(step.properties.confidence)})\n`;
      }
      narrative += '\n';
    }
    
    // Show evidence
    if (stepsByType['evidence'] && stepsByType['evidence'].length > 0) {
      narrative += `### Supporting Evidence\n\n`;
      for (const step of stepsByType['evidence']) {
        narrative += `- ${step.properties.content}`;
        if (step.properties.evidenceType) {
          narrative += ` (${step.properties.evidenceType})`;
        }
        narrative += '\n';
      }
      narrative += '\n';
    }
    
    // Show counterarguments and rebuttals as pairs when possible
    const counterarguments = stepsByType['counterargument'] || [];
    const rebuttals = stepsByType['rebuttal'] || [];
    
    if (counterarguments.length > 0) {
      narrative += `### Counterarguments and Responses\n\n`;
      
      for (const counter of counterarguments) {
        narrative += `**Counterargument**: ${counter.properties.content}\n`;
        
        // Find matching rebuttal if any
        const matchingRebuttal = rebuttals.find(r => 
          r.properties.counterToStep === counter.properties.name ||
          r.properties.previousSteps?.includes(counter.properties.name)
        );
        
        if (matchingRebuttal) {
          narrative += `**Response**: ${matchingRebuttal.properties.content}\n\n`;
        } else {
          narrative += '\n';
        }
      }
    }
  }
  
  // Conclusion
  narrative += `## Conclusion\n\n`;
  narrative += `**${chain.properties.conclusion}**\n\n`;
  
  // Confidence assessment
  narrative += `*Confidence level: ${formatConfidence(chain.properties.confidenceScore)}*\n\n`;
  
  // If available, mention alternatives considered
  if (chain.properties.alternativeConclusionsConsidered && 
      chain.properties.alternativeConclusionsConsidered.length > 0) {
    narrative += `### Alternative Conclusions Considered\n\n`;
    for (const alt of chain.properties.alternativeConclusionsConsidered) {
      narrative += `- ${alt}\n`;
    }
    narrative += '\n';
  }
  
  return narrative;
}

/**
 * Formats a single reasoning step for display
 * @param step - The reasoning step object
 * @param options - Narrative options
 * @param includeLineBreak - Whether to include a line break at the end
 * @returns Formatted text for the reasoning step
 */
export function formatReasoningStep(step: any, options: NarrativeOptions, includeLineBreak = true): string {
  const properties = step.properties;
  const stepNumber = properties.stepNumber || '?';
  const confidenceStr = formatConfidence(properties.confidence);
  
  let result = `**Step ${stepNumber}** (${properties.stepType || 'unspecified'}`;
  
  if (properties.evidenceType) {
    result += `, based on ${properties.evidenceType}`;
  }
  
  result += `, confidence: ${confidenceStr}): ${properties.content}`;
  
  // Add assumptions if available and detail level is medium or high
  if (properties.assumptions && 
      properties.assumptions.length > 0 && 
      options.detailLevel !== 'low') {
    result += `\n   *Assumptions: ${properties.assumptions.join(', ')}*`;
  }
  
  if (includeLineBreak) {
    result += '\n\n';
  }
  
  return result;
} 
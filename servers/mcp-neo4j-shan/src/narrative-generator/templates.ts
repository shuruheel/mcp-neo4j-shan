/**
 * Structure representing a narrative template
 */
export interface NarrativeTemplate {
  id: string;
  name: string;
  description: string;
  applicableNodeTypes: string[];
  template: string;
}

/**
 * Collection of narrative templates for different node types
 */
export const narrativeTemplates: NarrativeTemplate[] = [
  {
    id: 'entity-biography',
    name: 'Entity Biography',
    description: 'Template for describing entities and their contributions',
    applicableNodeTypes: ['Entity'],
    template: `{{name}} is {{a_an}} {{entityType}}{{#if description}} described as {{description}}{{/if}}{{#if biography}}. {{biography}}{{/if}}{{#if keyContributions}}. {{#each keyContributions}} {{this}}{{#unless @last}},{{/unless}}{{/each}}{{/if}}`
  },
  {
    id: 'concept-explanation',
    name: 'Concept Explanation',
    description: 'Template for explaining concepts with examples and relations',
    applicableNodeTypes: ['Concept'],
    template: `{{name}} is a concept{{#if definition}} defined as: {{definition}}{{/if}}{{#if domain}} in the domain of {{domain}}{{/if}}. {{#if description}}{{description}}{{/if}}`
  },
  {
    id: 'event-description',
    name: 'Event Description',
    description: 'Template for describing events with timeline and participants',
    applicableNodeTypes: ['Event'],
    template: `{{name}} was an event{{#if startDate}} that started on {{startDate}}{{/if}}{{#if endDate}} and ended on {{endDate}}{{/if}}{{#if location}} in {{location}}{{/if}}. {{#if description}}{{description}}{{/if}}{{#if participants}} It involved {{#each participants}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}{{/if}}{{#if outcome}}. The outcome was: {{outcome}}{{/if}}`
  },
  {
    id: 'scientific-insight',
    name: 'Scientific Insight',
    description: 'Template for presenting scientific insights with evidence',
    applicableNodeTypes: ['ScientificInsight'],
    template: `{{name}} is a scientific insight{{#if hypothesis}} positing that {{hypothesis}}{{/if}}{{#if field}} in the field of {{field}}{{/if}}. {{#if evidence}}The evidence includes: {{#each evidence}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}{{/if}}{{#if methodology}}. The methodology involved {{methodology}}{{/if}}{{#if confidence}}. The confidence level for this insight is {{confidence}}{{/if}}`
  },
  {
    id: 'law-explanation',
    name: 'Law Explanation',
    description: 'Template for explaining laws and their applications',
    applicableNodeTypes: ['Law'],
    template: `{{name}} is {{a_an}} law{{#if statement}} that states: {{statement}}{{/if}}{{#if domain}} in the domain of {{domain}}{{/if}}. {{#if conditions}}It applies under the following conditions: {{#each conditions}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}{{/if}}{{#if exceptions}} with exceptions for: {{#each exceptions}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}{{/if}}`
  },
  {
    id: 'thought-presentation',
    name: 'Thought Presentation',
    description: 'Template for presenting thoughts and analyses',
    applicableNodeTypes: ['Thought'],
    template: `{{#if title}}{{title}}: {{/if}}{{thoughtContent}}{{#if implications}} The implications include: {{#each implications}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}{{/if}}{{#if thoughtConfidenceScore}} (confidence level: {{thoughtConfidenceScore}}){{/if}}`
  },
  {
    id: 'reasoning-chain',
    name: 'Reasoning Chain',
    description: 'Template for presenting reasoning chains and their steps',
    applicableNodeTypes: ['ReasoningChain'],
    template: `{{name}} is a reasoning chain that {{description}}. It follows {{a_an}} {{methodology}} approach{{#if domain}} in the domain of {{domain}}{{/if}} and concludes that: {{conclusion}}. The overall confidence in this reasoning is {{confidenceScore}}.`
  },
  {
    id: 'reasoning-step',
    name: 'Reasoning Step',
    description: 'Template for presenting individual reasoning steps',
    applicableNodeTypes: ['ReasoningStep'],
    template: `Step {{stepNumber}}: {{content}} ({{stepType}}{{#if evidenceType}}, based on {{evidenceType}}{{/if}}, confidence: {{confidence}}){{#if assumptions}}. Assumptions: {{#each assumptions}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}{{/if}}`
  }
]; 
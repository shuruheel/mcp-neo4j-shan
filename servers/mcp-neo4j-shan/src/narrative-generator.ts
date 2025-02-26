import { Entity as BaseEntity, Relation as BaseRelation } from '@neo4j/graphrag-memory';

/**
 * Extended Entity interface with additional properties used in narrative generation
 */
export interface Entity extends BaseEntity {
  description?: string;
  biography?: string;
  keyContributions?: string[];
  emotionalValence?: number;
  emotionalArousal?: number;
  // Additional properties for specific entity types
  definition?: string;
  domain?: string;
  examples?: string[];
  startDate?: string;
  endDate?: string;
  location?: string;
  participants?: string[];
  outcome?: string;
  hypothesis?: string;
  evidence?: string[];
  methodology?: string;
  confidence?: number;
  field?: string;
  statement?: string;
  conditions?: string[];
  exceptions?: string[];
  title?: string;
  thoughtContent?: string;
  implications?: string[];
  thoughtConfidenceScore?: number;
}

/**
 * Extended Relation interface with additional properties used in narrative generation
 */
export interface Relation extends BaseRelation {
  context?: string;
  confidenceScore?: number;
  weight?: number;
  sources?: string[];
}

/**
 * Interface for knowledge graph data used in narrative generation
 */
export interface KnowledgeGraph {
  entities: Entity[];
  relations: Relation[];
}

/**
 * Options for narrative generation
 */
export interface NarrativeOptions {
  format?: 'concise' | 'detailed' | 'educational' | 'storytelling';
  audience?: 'general' | 'expert' | 'student';
  includeEmotionalDimensions?: boolean;
  highlightUncertainty?: boolean;
  focusEntity?: string;
  maxLength?: number;
  detailLevel?: 'low' | 'medium' | 'high';
  includeIntroduction?: boolean;
  includeSummary?: boolean;
}

/**
 * Structure representing a narrative template
 */
interface NarrativeTemplate {
  id: string;
  name: string;
  description: string;
  applicableNodeTypes: string[];
  template: string;
}

/**
 * Structure representing connections to be described in a narrative
 */
interface ConnectionDescription {
  sourceNode: Entity;
  targetNode: Entity;
  relation: Relation;
  pathDescription?: string;
}

/**
 * Class responsible for generating dynamic narratives from knowledge graph data
 */
export class NarrativeGenerator {
  private templates: NarrativeTemplate[] = [
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

  /**
   * Generates a narrative from knowledge graph data
   * 
   * @param graph The knowledge graph data to use
   * @param options Options for narrative generation
   * @returns A generated narrative string
   */
  public generateNarrative(graph: KnowledgeGraph, options: NarrativeOptions = {}): string {
    if (!graph || !graph.entities || graph.entities.length === 0) {
      return "No knowledge graph data available to generate a narrative.";
    }

    // Set default options
    const defaultOptions: NarrativeOptions = {
      format: 'detailed',
      audience: 'general',
      includeEmotionalDimensions: true,
      highlightUncertainty: true,
      maxLength: 2000
    };

    const finalOptions = { ...defaultOptions, ...options };
    
    // Start constructing the narrative
    let narrative = this.generateIntroduction(graph, finalOptions);
    
    // Add entity descriptions
    narrative += this.generateEntityDescriptions(graph, finalOptions);
    
    // Add relationship descriptions
    narrative += this.generateRelationshipDescriptions(graph, finalOptions);
    
    // Add conclusion
    narrative += this.generateConclusion(graph, finalOptions);
    
    // Ensure we don't exceed the maximum length
    if (finalOptions.maxLength && narrative.length > finalOptions.maxLength) {
      narrative = narrative.substring(0, finalOptions.maxLength - 3) + "...";
    }
    
    return narrative;
  }

  /**
   * Creates an introduction paragraph for the narrative
   */
  private generateIntroduction(graph: KnowledgeGraph, options: NarrativeOptions): string {
    const { entities, relations } = graph;
    
    // If focusing on a specific entity, create an introduction centered on it
    if (options.focusEntity) {
      const focusEntityObj = entities.find(e => e.name === options.focusEntity);
      if (focusEntityObj) {
        return this.generateFocusedIntroduction(focusEntityObj, graph, options);
      }
    }
    
    // General introduction
    const nodeTypes = this.getUniqueNodeTypes(entities);
    const nodeTypeCounts = this.countNodeTypes(entities);
    
    let intro = "This narrative describes ";
    
    if (nodeTypes.length === 1) {
      intro += `${nodeTypeCounts[nodeTypes[0]]} ${nodeTypes[0].toLowerCase()}${nodeTypeCounts[nodeTypes[0]] !== 1 ? 's' : ''}`;
    } else {
      intro += "a knowledge network containing ";
      intro += nodeTypes.map(type => 
        `${nodeTypeCounts[type]} ${type.toLowerCase()}${nodeTypeCounts[type] !== 1 ? 's' : ''}`
      ).join(", ");
    }
    
    intro += ` connected by ${relations.length} relationship${relations.length !== 1 ? 's' : ''}. `;
    
    // Add information about the most connected entities
    const mostConnected = this.findMostConnectedEntities(graph, 3);
    if (mostConnected.length > 0) {
      intro += "Key elements include ";
      intro += mostConnected.map(e => e.name).join(", ");
      intro += ". ";
    }
    
    return intro;
  }

  /**
   * Creates an introduction focused on a specific entity
   */
  private generateFocusedIntroduction(entity: Entity, graph: KnowledgeGraph, options: NarrativeOptions): string {
    // Find direct relationships to this entity
    const directRelations = graph.relations.filter(r => 
      r.from === entity.name || r.to === entity.name
    );
    
    let intro = `This narrative centers on ${entity.name}, `;
    
    // Add entity type and description if available
    if (entity.entityType) {
      intro += `a ${entity.entityType.toLowerCase()}`;
    }
    
    if (entity.description) {
      intro += ` described as ${entity.description}`;
    }
    
    intro += `. `;
    
    // Mention the number of connections
    if (directRelations.length > 0) {
      intro += `${entity.name} has ${directRelations.length} connection${directRelations.length !== 1 ? 's' : ''} `;
      
      // Group connections by type
      const connectionsByType = this.groupRelationsByType(directRelations);
      const connectionTypes = Object.keys(connectionsByType);
      
      if (connectionTypes.length > 0) {
        intro += `including ${connectionTypes.map(type => 
          `${connectionsByType[type].length} ${type.toLowerCase()} relationship${connectionsByType[type].length !== 1 ? 's' : ''}`
        ).join(", ")}`;
      }
      
      intro += `. `;
    }
    
    return intro;
  }

  /**
   * Generates descriptions for all entities in the graph
   */
  private generateEntityDescriptions(graph: KnowledgeGraph, options: NarrativeOptions): string {
    const { entities } = graph;
    let descriptions = "\n\n";
    
    // If there's a focus entity, describe it first and in more detail
    if (options.focusEntity) {
      const focusEntity = entities.find(e => e.name === options.focusEntity);
      if (focusEntity) {
        descriptions += this.describeEntity(focusEntity, graph, options, true) + "\n\n";
        
        // Then describe other entities that are directly connected to the focus entity
        const connectedEntities = this.findConnectedEntities(focusEntity.name, graph);
        for (const entity of connectedEntities) {
          if (entity.name !== focusEntity.name) {
            descriptions += this.describeEntity(entity, graph, options) + "\n\n";
          }
        }
        
        return descriptions;
      }
    }
    
    // If no focus entity or it wasn't found, describe all entities
    // Group entities by type for better narrative flow
    const entitiesByType = this.groupEntitiesByType(entities);
    
    for (const type of Object.keys(entitiesByType)) {
      if (entitiesByType[type].length > 0) {
        descriptions += `\n${type}s:\n`;
        for (const entity of entitiesByType[type]) {
          descriptions += this.describeEntity(entity, graph, options) + "\n\n";
        }
      }
    }
    
    return descriptions;
  }

  /**
   * Generates descriptions for the relationships in the graph
   */
  private generateRelationshipDescriptions(graph: KnowledgeGraph, options: NarrativeOptions): string {
    const { entities, relations } = graph;
    
    if (relations.length === 0) {
      return "";
    }
    
    let descriptions = "\nRelationships:\n";
    
    // If there's a focus entity, describe relationships related to it
    if (options.focusEntity) {
      const focusRelations = relations.filter(r => 
        r.from === options.focusEntity || r.to === options.focusEntity
      );
      
      if (focusRelations.length > 0) {
        descriptions += `\nConnections involving ${options.focusEntity}:\n`;
        for (const relation of focusRelations) {
          descriptions += this.describeRelationship(relation, entities) + "\n";
        }
      }
      
      return descriptions;
    }
    
    // Otherwise, group relationships by type
    const relationsByType = this.groupRelationsByType(relations);
    
    for (const type of Object.keys(relationsByType)) {
      if (relationsByType[type].length > 0) {
        descriptions += `\n${type} relationships:\n`;
        for (const relation of relationsByType[type]) {
          descriptions += this.describeRelationship(relation, entities) + "\n";
        }
      }
    }
    
    return descriptions;
  }

  /**
   * Generates a conclusion for the narrative
   */
  private generateConclusion(graph: KnowledgeGraph, options: NarrativeOptions): string {
    // Find central themes or patterns in the knowledge graph
    const nodeTypes = this.getUniqueNodeTypes(graph.entities);
    const relationTypes = [...new Set(graph.relations.map(r => r.relationType))];
    
    let conclusion = "\n\nSummary:\n";
    
    conclusion += `This knowledge network contains information across ${nodeTypes.length} different types of nodes `;
    conclusion += `and ${relationTypes.length} types of relationships. `;
    
    // If there's a focus entity, summarize its importance
    if (options.focusEntity) {
      const focusEntity = graph.entities.find(e => e.name === options.focusEntity);
      if (focusEntity) {
        const directRelations = graph.relations.filter(r => 
          r.from === focusEntity.name || r.to === focusEntity.name
        );
        
        if (directRelations.length > 0) {
          conclusion += `${focusEntity.name} plays a central role with ${directRelations.length} connections. `;
          
          // Identify key relationships
          const significantRelations = directRelations
            .filter(r => r.weight && r.weight > 0.7)
            .slice(0, 3);
          
          if (significantRelations.length > 0) {
            conclusion += `Key relationships include `;
            conclusion += significantRelations.map(r => {
              const otherNode = r.from === focusEntity.name ? r.to : r.from;
              return `${r.relationType} with ${otherNode}`;
            }).join(", ");
            conclusion += `. `;
          }
        }
      }
    }
    
    return conclusion;
  }

  /**
   * Describes a single entity based on its type
   */
  private describeEntity(entity: Entity, graph: KnowledgeGraph, options: NarrativeOptions, detailed = false): string {
    const template = this.getTemplateForEntity(entity);
    if (!template) {
      return `${entity.name} (${entity.entityType || 'Unknown type'})`;
    }
    
    // Create a simple template processor
    let description = template.template;
    
    // Replace variables with actual values from the entity
    for (const key in entity) {
      if (typeof entity[key] === 'string' || typeof entity[key] === 'number') {
        const regex = new RegExp(`{{${key}}}`, 'g');
        description = description.replace(regex, entity[key].toString());
      } else if (Array.isArray(entity[key])) {
        // Handle arrays by joining them
        const regex = new RegExp(`{{#each ${key}}}(.*?){{/each}}`, 'g');
        const matches = description.match(regex);
        
        if (matches) {
          for (const match of matches) {
            const itemTemplate = match.replace(`{{#each ${key}}}`, '').replace('{{/each}}', '');
            const renderedItems = entity[key].map((item: any) => {
              let itemDesc = itemTemplate;
              // Simple replacement of {{this}} with the array item
              itemDesc = itemDesc.replace(/{{this}}/g, item);
              // Handle conditionals like {{#unless @last}}
              if (entity[key].indexOf(item) === entity[key].length - 1) {
                itemDesc = itemDesc.replace(/{{#unless @last}}.*?{{\/unless}}/g, '');
              } else {
                itemDesc = itemDesc.replace(/{{#unless @last}}/g, '').replace(/{{\/unless}}/g, '');
              }
              return itemDesc;
            }).join('');
            
            description = description.replace(match, renderedItems);
          }
        }
      }
    }
    
    // Handle conditional blocks (very simplified)
    const conditionalRegex = /{{#if (\w+)}}(.*?){{\/if}}/g;
    description = description.replace(conditionalRegex, (match, condition, content) => {
      if (entity[condition]) {
        return content;
      }
      return '';
    });
    
    // Handle article helper {{a_an}}
    description = description.replace(/{{a_an}}/g, () => {
      const nextWord = entity.entityType?.toLowerCase() || '';
      return /^[aeiou]/.test(nextWord) ? 'an' : 'a';
    });
    
    // Clean up any remaining template variables
    description = description.replace(/{{.*?}}/g, '');
    
    // Add emotional dimensions if requested and available
    if (options.includeEmotionalDimensions && detailed) {
      if (entity.emotionalValence !== undefined || entity.emotionalArousal !== undefined) {
        description += "\n\nEmotional dimensions: ";
        
        if (entity.emotionalValence !== undefined) {
          const valence = entity.emotionalValence as number;
          description += `valence: ${this.formatEmotionalValence(valence)}`;
        }
        
        if (entity.emotionalArousal !== undefined) {
          const arousal = entity.emotionalArousal as number;
          if (entity.emotionalValence !== undefined) {
            description += ", ";
          }
          description += `arousal: ${this.formatEmotionalArousal(arousal)}`;
        }
      }
    }
    
    return description;
  }

  /**
   * Describes a relationship between entities
   */
  private describeRelationship(relation: Relation, entities: Entity[]): string {
    // Find the source and target entities
    const sourceEntity = entities.find(e => e.name === relation.from);
    const targetEntity = entities.find(e => e.name === relation.to);
    
    let description = `${relation.from} ${relation.relationType} ${relation.to}`;
    
    // Add context if available
    if (relation.context) {
      description += `: ${relation.context}`;
    }
    
    // Add confidence score if available
    if (relation.confidenceScore !== undefined) {
      description += ` (confidence: ${relation.confidenceScore.toFixed(2)})`;
    }
    
    // Add weight if available
    if (relation.weight !== undefined) {
      description += ` [strength: ${relation.weight.toFixed(2)}]`;
    }
    
    return description;
  }

  /**
   * Finds the template that best matches an entity
   */
  private getTemplateForEntity(entity: Entity): NarrativeTemplate | null {
    if (!entity.entityType) {
      return null;
    }
    
    const template = this.templates.find(t => 
      t.applicableNodeTypes.includes(entity.entityType as string)
    );
    
    return template || null;
  }

  /**
   * Returns unique node types from the entities
   */
  private getUniqueNodeTypes(entities: Entity[]): string[] {
    return [...new Set(entities.map(e => e.entityType as string).filter(Boolean))];
  }

  /**
   * Counts entities by node type
   */
  private countNodeTypes(entities: Entity[]): Record<string, number> {
    const counts: Record<string, number> = {};
    
    for (const entity of entities) {
      if (entity.entityType) {
        counts[entity.entityType] = (counts[entity.entityType] || 0) + 1;
      }
    }
    
    return counts;
  }

  /**
   * Groups entities by their type
   */
  private groupEntitiesByType(entities: Entity[]): Record<string, Entity[]> {
    const groups: Record<string, Entity[]> = {};
    
    for (const entity of entities) {
      if (entity.entityType) {
        if (!groups[entity.entityType]) {
          groups[entity.entityType] = [];
        }
        groups[entity.entityType].push(entity);
      }
    }
    
    return groups;
  }

  /**
   * Groups relations by their type
   */
  private groupRelationsByType(relations: Relation[]): Record<string, Relation[]> {
    const groups: Record<string, Relation[]> = {};
    
    for (const relation of relations) {
      if (!groups[relation.relationType]) {
        groups[relation.relationType] = [];
      }
      groups[relation.relationType].push(relation);
    }
    
    return groups;
  }

  /**
   * Finds the most connected entities in the graph
   */
  private findMostConnectedEntities(graph: KnowledgeGraph, limit: number): Entity[] {
    const { entities, relations } = graph;
    const connectionCounts: Record<string, number> = {};
    
    // Count connections for each entity
    for (const relation of relations) {
      connectionCounts[relation.from] = (connectionCounts[relation.from] || 0) + 1;
      connectionCounts[relation.to] = (connectionCounts[relation.to] || 0) + 1;
    }
    
    // Sort entities by connection count
    const sorted = [...entities].sort((a, b) => 
      (connectionCounts[b.name] || 0) - (connectionCounts[a.name] || 0)
    );
    
    return sorted.slice(0, limit);
  }

  /**
   * Finds entities directly connected to a given entity
   */
  private findConnectedEntities(entityName: string, graph: KnowledgeGraph): Entity[] {
    const { entities, relations } = graph;
    const connectedNames = new Set<string>();
    
    // Find all entity names connected to the given entity
    for (const relation of relations) {
      if (relation.from === entityName) {
        connectedNames.add(relation.to);
      } else if (relation.to === entityName) {
        connectedNames.add(relation.from);
      }
    }
    
    // Always include the starting entity
    connectedNames.add(entityName);
    
    // Return the entities with these names
    return entities.filter(e => connectedNames.has(e.name));
  }

  /**
   * Formats emotional valence for display
   */
  private formatEmotionalValence(valence: number): string {
    if (valence > 0.5) return "very positive";
    if (valence > 0) return "positive";
    if (valence < -0.5) return "very negative";
    if (valence < 0) return "negative";
    return "neutral";
  }

  /**
   * Formats emotional arousal for display
   */
  private formatEmotionalArousal(arousal: number): string {
    if (arousal > 2) return "very intense";
    if (arousal > 1) return "intense";
    if (arousal > 0.5) return "moderate";
    return "calm";
  }

  /**
   * Generates a narrative specifically for a reasoning chain and its steps
   * 
   * @param chain The reasoning chain object
   * @param steps The array of reasoning steps
   * @param options Options for narrative generation
   * @returns A generated narrative string describing the reasoning chain
   */
  public static generateReasoningChainNarrative(
    chain: any, 
    steps: any[], 
    options: NarrativeOptions = {}
  ): string {
    // Set default options
    const defaultOptions: NarrativeOptions = {
      format: 'detailed',
      audience: 'general',
      includeEmotionalDimensions: false,
      highlightUncertainty: true,
      maxLength: 5000,
      detailLevel: 'high',
      includeIntroduction: true,
      includeSummary: true
    };

    const finalOptions = { ...defaultOptions, ...options };
    
    let narrative = '';
    
    // Add introduction if requested
    if (finalOptions.includeIntroduction) {
      narrative += `# ${chain.name}\n\n`;
      narrative += `## Overview\n`;
      narrative += `This reasoning chain explores ${chain.description}. `;
      narrative += `It follows a ${chain.methodology} methodology`;
      
      if (chain.domain) {
        narrative += ` in the domain of ${chain.domain}`;
      }
      
      narrative += ` and arrives at the conclusion: "${chain.conclusion}". `;
      narrative += `The overall confidence in this reasoning is ${NarrativeGenerator.formatConfidence(chain.confidenceScore)}.\n\n`;
      
      if (chain.sourceThought) {
        narrative += `This reasoning chain is associated with the thought: "${chain.sourceThought}".\n\n`;
      }
      
      if (chain.alternativeConclusionsConsidered && chain.alternativeConclusionsConsidered.length > 0) {
        narrative += `## Alternative Conclusions Considered\n`;
        chain.alternativeConclusionsConsidered.forEach((alt: string, i: number) => {
          narrative += `${i+1}. ${alt}\n`;
        });
        narrative += '\n';
      }
    }
    
    // Add reasoning steps
    narrative += `## Reasoning Process\n\n`;
    
    // Group steps by type for better organization
    const premiseSteps = steps.filter(s => s.stepType === 'premise');
    const evidenceSteps = steps.filter(s => s.stepType === 'evidence');
    const inferenceSteps = steps.filter(s => s.stepType === 'inference');
    const counterargumentSteps = steps.filter(s => s.stepType === 'counterargument');
    const rebuttalSteps = steps.filter(s => s.stepType === 'rebuttal');
    const conclusionSteps = steps.filter(s => s.stepType === 'conclusion');
    
    // Add premises
    if (premiseSteps.length > 0) {
      narrative += `### Premises\n`;
      premiseSteps.forEach(step => {
        narrative += NarrativeGenerator.formatReasoningStep(step, finalOptions);
      });
      narrative += '\n';
    }
    
    // Add evidence
    if (evidenceSteps.length > 0) {
      narrative += `### Evidence\n`;
      evidenceSteps.forEach(step => {
        narrative += NarrativeGenerator.formatReasoningStep(step, finalOptions);
      });
      narrative += '\n';
    }
    
    // Add inferences
    if (inferenceSteps.length > 0) {
      narrative += `### Inferences\n`;
      inferenceSteps.forEach(step => {
        narrative += NarrativeGenerator.formatReasoningStep(step, finalOptions);
      });
      narrative += '\n';
    }
    
    // Add counterarguments and rebuttals together
    if (counterargumentSteps.length > 0 || rebuttalSteps.length > 0) {
      narrative += `### Counterarguments and Rebuttals\n`;
      
      // Pair counterarguments with their rebuttals when possible
      counterargumentSteps.forEach(counter => {
        narrative += NarrativeGenerator.formatReasoningStep(counter, finalOptions);
        
        // Find rebuttals that reference this counterargument
        const relatedRebuttals = rebuttalSteps.filter(reb => 
          reb.previousSteps && reb.previousSteps.includes(counter.name)
        );
        
        if (relatedRebuttals.length > 0) {
          relatedRebuttals.forEach(rebuttal => {
            narrative += `   └─ Rebuttal: ${NarrativeGenerator.formatReasoningStep(rebuttal, finalOptions, false)}`;
          });
        }
      });
      
      // Add orphaned rebuttals (those not connected to a specific counterargument)
      const orphanedRebuttals = rebuttalSteps.filter(reb => 
        !counterargumentSteps.some(counter => 
          reb.previousSteps && reb.previousSteps.includes(counter.name)
        )
      );
      
      if (orphanedRebuttals.length > 0) {
        orphanedRebuttals.forEach(rebuttal => {
          narrative += NarrativeGenerator.formatReasoningStep(rebuttal, finalOptions);
        });
      }
      
      narrative += '\n';
    }
    
    // Add conclusion
    if (conclusionSteps.length > 0) {
      narrative += `### Conclusion\n`;
      conclusionSteps.forEach(step => {
        narrative += NarrativeGenerator.formatReasoningStep(step, finalOptions);
      });
      narrative += '\n';
    }
    
    // Add summary if requested
    if (finalOptions.includeSummary) {
      narrative += `## Summary\n`;
      narrative += `This ${chain.methodology} reasoning chain`;
      
      if (premiseSteps.length > 0) {
        narrative += ` begins with ${premiseSteps.length} premise${premiseSteps.length !== 1 ? 's' : ''}`;
      }
      
      if (evidenceSteps.length > 0) {
        narrative += `, incorporates ${evidenceSteps.length} piece${evidenceSteps.length !== 1 ? 's' : ''} of evidence`;
      }
      
      if (inferenceSteps.length > 0) {
        narrative += `, makes ${inferenceSteps.length} inference${inferenceSteps.length !== 1 ? 's' : ''}`;
      }
      
      if (counterargumentSteps.length > 0) {
        narrative += `, addresses ${counterargumentSteps.length} counterargument${counterargumentSteps.length !== 1 ? 's' : ''}`;
      }
      
      narrative += `, and concludes that "${chain.conclusion}" with ${NarrativeGenerator.formatConfidence(chain.confidenceScore)} confidence.\n`;
    }
    
    // Ensure we don't exceed the maximum length
    if (finalOptions.maxLength && narrative.length > finalOptions.maxLength) {
      narrative = narrative.substring(0, finalOptions.maxLength - 3) + "...";
    }
    
    return narrative;
  }

  // Helper functions for reasoning chain narrative generation
  private static formatReasoningStep(step: any, options: NarrativeOptions, includeLineBreak = true): string {
    let result = '';
    
    if (step.stepNumber) {
      result += `**Step ${step.stepNumber}**: `;
    }
    
    result += `${step.content}`;
    
    if (options.detailLevel === 'high') {
      result += ` _(${step.stepType}`;
      
      if (step.evidenceType) {
        result += `, ${step.evidenceType}`;
      }
      
      result += `, confidence: ${NarrativeGenerator.formatConfidence(step.confidence)})_`;
      
      if (step.supportingReferences && step.supportingReferences.length > 0) {
        result += `\n   References: ${step.supportingReferences.join(', ')}`;
      }
      
      if (step.assumptions && step.assumptions.length > 0) {
        result += `\n   Assumptions: ${step.assumptions.join(', ')}`;
      }
      
      if (step.counterarguments && step.counterarguments.length > 0) {
        result += `\n   Potential counterarguments: ${step.counterarguments.join(', ')}`;
      }
    }
    
    if (includeLineBreak) {
      result += '\n';
    }
    
    return result;
  }

  private static formatConfidence(score: number): string {
    if (score >= 0.9) return 'very high';
    if (score >= 0.7) return 'high';
    if (score >= 0.5) return 'moderate';
    if (score >= 0.3) return 'low';
    return 'very low';
  }
} 
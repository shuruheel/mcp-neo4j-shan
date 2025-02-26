import { KnowledgeGraph, Entity, Relation } from '../types/index.js';
import type { NarrativeOptions } from './options.js';
import { narrativeTemplates } from './templates.js';
import type { NarrativeTemplate } from './templates.js';
import { 
  formatEmotionalValence, 
  formatEmotionalArousal,
  getUniqueNodeTypes,
  countNodeTypes,
  groupEntitiesByType,
  groupRelationsByType
} from './utils.js';
import type { ConnectionDescription } from './utils.js';

/**
 * Class responsible for generating dynamic narratives from knowledge graph data
 */
export class NarrativeGenerator {
  private templates = narrativeTemplates;

  /**
   * Generates a complete narrative from the knowledge graph
   * @param graph - Knowledge graph data
   * @param options - Narrative generation options
   * @returns Formatted narrative text
   */
  public generateNarrative(graph: KnowledgeGraph, options: NarrativeOptions = {}): string {
    const { 
      includeIntroduction = true, 
      includeSummary = true,
      focusEntity
    } = options;
    
    let narrative = '';
    
    // Add introduction if requested
    if (includeIntroduction) {
      if (focusEntity) {
        const entity = graph.entities.find(e => e.name === focusEntity);
        if (entity) {
          narrative += this.generateFocusedIntroduction(entity, graph, options);
        } else {
          narrative += this.generateIntroduction(graph, options);
        }
      } else {
        narrative += this.generateIntroduction(graph, options);
      }
    }
    
    // Generate entity descriptions
    narrative += this.generateEntityDescriptions(graph, options);
    
    // Generate relationship descriptions
    narrative += this.generateRelationshipDescriptions(graph, options);
    
    // Add conclusion/summary if requested
    if (includeSummary) {
      narrative += this.generateConclusion(graph, options);
    }
    
    return narrative;
  }
  
  /**
   * Generates an introduction to the knowledge graph
   * @param graph - Knowledge graph data
   * @param options - Narrative generation options
   * @returns Introduction text
   */
  private generateIntroduction(graph: KnowledgeGraph, options: NarrativeOptions): string {
    const nodeCounts = countNodeTypes(graph.entities);
    const nodeTypes = getUniqueNodeTypes(graph.entities);
    
    let introduction = '## Overview\n\n';
    
    if (graph.entities.length === 0) {
      return introduction + 'The knowledge graph is currently empty.\n\n';
    }
    
    introduction += `This knowledge graph contains ${graph.entities.length} nodes`;
    
    if (nodeTypes.length > 0) {
      introduction += ` of ${nodeTypes.length} different types (${nodeTypes.join(', ')})`;
    }
    
    introduction += ` and ${graph.relations.length} relationships.\n\n`;
    
    // Add type distribution
    introduction += 'Node type distribution:\n';
    for (const [type, count] of Object.entries(nodeCounts)) {
      introduction += `- ${type}: ${count} nodes\n`;
    }
    
    introduction += '\n';
    
    // Find the most connected entities
    const connectedEntities = this.findMostConnectedEntities(graph, 3);
    if (connectedEntities.length > 0) {
      introduction += 'Most central nodes in the knowledge graph:\n';
      for (const entity of connectedEntities) {
        introduction += `- ${entity.name}\n`;
      }
      introduction += '\n';
    }
    
    return introduction;
  }
  
  /**
   * Generates an introduction focused on a specific entity
   * @param entity - The focus entity
   * @param graph - Knowledge graph data
   * @param options - Narrative generation options
   * @returns Focused introduction text
   */
  private generateFocusedIntroduction(entity: Entity, graph: KnowledgeGraph, options: NarrativeOptions): string {
    let introduction = `## Focus on: ${entity.name}\n\n`;
    
    // Add entity description
    introduction += this.describeEntity(entity, graph, options, true);
    
    // Find connected entities
    const connectedEntities = this.findConnectedEntities(entity.name, graph);
    
    if (connectedEntities.length > 0) {
      introduction += `\n### Connected to ${entity.name}:\n\n`;
      for (const connected of connectedEntities.slice(0, 5)) {
        introduction += `- ${connected.name}\n`;
      }
      
      if (connectedEntities.length > 5) {
        introduction += `- ... and ${connectedEntities.length - 5} more\n`;
      }
      
      introduction += '\n';
    }
    
    return introduction;
  }
  
  /**
   * Generates descriptions for all entities in the graph
   * @param graph - Knowledge graph data
   * @param options - Narrative generation options
   * @returns Entity descriptions text
   */
  private generateEntityDescriptions(graph: KnowledgeGraph, options: NarrativeOptions): string {
    const { detailLevel = 'medium', focusEntity } = options;
    
    if (graph.entities.length === 0) {
      return '';
    }
    
    let descriptions = '## Entities\n\n';
    
    // Group entities by type
    const entitiesByType = groupEntitiesByType(graph.entities);
    
    // If there's a focus entity, prioritize its type
    if (focusEntity) {
      const focusEntityObj = graph.entities.find(e => e.name === focusEntity);
      if (focusEntityObj && focusEntityObj.entityType) {
        const focusType = focusEntityObj.entityType;
        const typeEntities = entitiesByType[focusType] || [];
        
        if (typeEntities.length > 0) {
          descriptions += `### ${focusType}s\n\n`;
          for (const entity of typeEntities) {
            if (entity.name === focusEntity) {
              // Skip the focus entity as it's already described in the introduction
              continue;
            }
            descriptions += this.describeEntity(entity, graph, options);
          }
        }
      }
    }
    
    // Describe other entities by type
    for (const [type, entities] of Object.entries(entitiesByType)) {
      // Skip the focus entity type if already processed
      if (focusEntity) {
        const focusEntityObj = graph.entities.find(e => e.name === focusEntity);
        if (focusEntityObj && focusEntityObj.entityType === type) {
          continue;
        }
      }
      
      if (entities.length > 0) {
        descriptions += `### ${type}s\n\n`;
        
        // For concise narratives or many entities, limit the descriptions
        const entitiesToDescribe = detailLevel === 'low' && entities.length > 5 
          ? entities.slice(0, 5) 
          : entities;
          
        for (const entity of entitiesToDescribe) {
          descriptions += this.describeEntity(entity, graph, options);
        }
        
        if (entities.length > 5 && detailLevel === 'low') {
          descriptions += `*... and ${entities.length - 5} more ${type}s*\n\n`;
        }
      }
    }
    
    return descriptions;
  }
  
  /**
   * Generates descriptions for relationships in the graph
   * @param graph - Knowledge graph data
   * @param options - Narrative generation options
   * @returns Relationship descriptions text
   */
  private generateRelationshipDescriptions(graph: KnowledgeGraph, options: NarrativeOptions): string {
    const { detailLevel = 'medium', focusEntity } = options;
    
    if (graph.relations.length === 0) {
      return '';
    }
    
    let descriptions = '## Relationships\n\n';
    
    // Group relations by type
    const relationsByType = groupRelationsByType(graph.relations);
    
    // If there's a focus entity, prioritize its relationships
    if (focusEntity) {
      const focusRelations = graph.relations.filter(
        r => r.from === focusEntity || r.to === focusEntity
      );
      
      if (focusRelations.length > 0) {
        descriptions += `### Relationships involving ${focusEntity}\n\n`;
        
        for (const relation of focusRelations) {
          descriptions += this.describeRelationship(relation, graph.entities);
        }
      }
    }
    
    // Describe other relationships by type
    for (const [type, relations] of Object.entries(relationsByType)) {
      // Skip relationships already described for focus entity
      let relationsToDescribe = relations;
      if (focusEntity) {
        relationsToDescribe = relations.filter(
          r => r.from !== focusEntity && r.to !== focusEntity
        );
      }
      
      if (relationsToDescribe.length > 0) {
        descriptions += `### ${type} Relationships\n\n`;
        
        // For concise narratives or many relationships, limit the descriptions
        const toDescribe = detailLevel === 'low' && relationsToDescribe.length > 5 
          ? relationsToDescribe.slice(0, 5) 
          : relationsToDescribe;
          
        for (const relation of toDescribe) {
          descriptions += this.describeRelationship(relation, graph.entities);
        }
        
        if (relationsToDescribe.length > 5 && detailLevel === 'low') {
          descriptions += `*... and ${relationsToDescribe.length - 5} more ${type} relationships*\n\n`;
        }
      }
    }
    
    return descriptions;
  }
  
  /**
   * Generates a conclusion or summary for the narrative
   * @param graph - Knowledge graph data
   * @param options - Narrative generation options
   * @returns Conclusion text
   */
  private generateConclusion(graph: KnowledgeGraph, options: NarrativeOptions): string {
    const { focusEntity } = options;
    
    let conclusion = '## Summary\n\n';
    
    if (graph.entities.length === 0) {
      return conclusion + 'No knowledge has been stored in the graph yet.\n\n';
    }
    
    if (focusEntity) {
      const focusEntityObj = graph.entities.find(e => e.name === focusEntity);
      if (focusEntityObj) {
        const connectedEntities = this.findConnectedEntities(focusEntity, graph);
        
        conclusion += `The knowledge graph contains information about ${focusEntity}`;
        
        if (connectedEntities.length > 0) {
          conclusion += ` and its connections to ${connectedEntities.length} other nodes`;
          
          if (connectedEntities.length <= 3) {
            conclusion += ` (${connectedEntities.map(e => e.name).join(', ')})`;
          }
        }
        
        conclusion += '.\n\n';
        
        // Add entity-specific summary based on its type
        if (focusEntityObj.entityType) {
          switch (focusEntityObj.entityType) {
            case 'Entity':
              conclusion += `As an Entity, ${focusEntity} has been documented with its properties and relationships to other nodes in the knowledge graph.\n\n`;
              break;
            case 'Event':
              conclusion += `As an Event, ${focusEntity} has been documented with temporal information, participants, and outcomes.\n\n`;
              break;
            case 'Concept':
              conclusion += `As a Concept, ${focusEntity} has been defined and connected to related concepts and examples in the knowledge graph.\n\n`;
              break;
            case 'ScientificInsight':
              conclusion += `As a Scientific Insight, ${focusEntity} has been recorded with its hypothesis, evidence, and confidence level.\n\n`;
              break;
            case 'Law':
              conclusion += `As a Law, ${focusEntity} has been documented with its statement, conditions, and exceptions.\n\n`;
              break;
            case 'Thought':
              conclusion += `As a Thought, ${focusEntity} has been captured with its content, implications, and connections to supporting evidence.\n\n`;
              break;
          }
        }
      }
    } else {
      // General summary for the entire graph
      const nodeTypes = getUniqueNodeTypes(graph.entities);
      const nodeCounts = countNodeTypes(graph.entities);
      
      conclusion += `The knowledge graph contains ${graph.entities.length} nodes of ${nodeTypes.length} types and ${graph.relations.length} relationships. `;
      
      // Highlight the dominant node types
      const dominantTypes = Object.entries(nodeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([type, count]) => `${type}s (${count})`);
        
      if (dominantTypes.length > 0) {
        conclusion += `The most common node types are ${dominantTypes.join(' and ')}.\n\n`;
      }
    }
    
    conclusion += 'This narrative was generated to represent the current state of the knowledge graph.\n\n';
    
    return conclusion;
  }
  
  /**
   * Generates a description for a single entity
   * @param entity - Entity to describe
   * @param graph - Knowledge graph data
   * @param options - Narrative generation options
   * @param detailed - Whether to generate a detailed description
   * @returns Entity description text
   */
  private describeEntity(entity: Entity, graph: KnowledgeGraph, options: NarrativeOptions, detailed = false): string {
    const { includeEmotionalDimensions = false } = options;
    
    // Get the appropriate template for this entity type
    const template = this.getTemplateForEntity(entity);
    let description = '';
    
    if (detailed) {
      description += `### ${entity.name}\n\n`;
    } else {
      description += `#### ${entity.name}\n\n`;
    }
    
    // Add basic description based on entity type
    if (template) {
      // In the future, implement actual template rendering here
      // For now, just use some basic conditionals
      
      switch (entity.entityType) {
        case 'Entity':
          description += `${entity.name} is an entity`;
          if (entity.description) {
            description += ` described as ${entity.description}`;
          }
          if (entity.biography) {
            description += `. ${entity.biography}`;
          }
          break;
          
        case 'Event':
          description += `${entity.name} was an event`;
          if (entity.startDate) {
            description += ` that started on ${entity.startDate}`;
          }
          if (entity.endDate) {
            description += ` and ended on ${entity.endDate}`;
          }
          if (entity.location) {
            description += ` in ${entity.location}`;
          }
          if (entity.description) {
            description += `. ${entity.description}`;
          }
          break;
          
        case 'Concept':
          description += `${entity.name} is a concept`;
          if (entity.definition) {
            description += ` defined as: ${entity.definition}`;
          }
          if (entity.domain) {
            description += ` in the domain of ${entity.domain}`;
          }
          break;
          
        case 'ScientificInsight':
          description += `${entity.name} is a scientific insight`;
          if (entity.hypothesis) {
            description += ` positing that ${entity.hypothesis}`;
          }
          if (entity.field) {
            description += ` in the field of ${entity.field}`;
          }
          break;
          
        case 'Law':
          description += `${entity.name} is a law`;
          if (entity.statement) {
            description += ` that states: ${entity.statement}`;
          }
          break;
          
        case 'Thought':
          if (entity.title) {
            description += `${entity.title}: `;
          }
          description += entity.thoughtContent || '';
          break;
          
        default:
          description += `${entity.name} (${entity.entityType})`;
          if (entity.description) {
            description += `: ${entity.description}`;
          }
      }
    } else {
      description += `${entity.name}`;
      if (entity.description) {
        description += `: ${entity.description}`;
      }
    }
    
    description += '\n';
    
    // Add emotional dimensions if requested
    if (includeEmotionalDimensions) {
      if (entity.emotionalValence !== undefined) {
        const valenceStr = formatEmotionalValence(entity.emotionalValence);
        if (valenceStr) {
          description += `*Emotional valence: ${valenceStr}*\n`;
        }
      }
      
      if (entity.emotionalArousal !== undefined) {
        const arousalStr = formatEmotionalArousal(entity.emotionalArousal);
        if (arousalStr) {
          description += `*Emotional arousal: ${arousalStr}*\n`;
        }
      }
    }
    
    description += '\n';
    return description;
  }
  
  /**
   * Generates a description for a single relationship
   * @param relation - Relationship to describe
   * @param entities - List of all entities in the graph
   * @returns Relationship description text
   */
  private describeRelationship(relation: Relation, entities: Entity[]): string {
    const fromEntity = entities.find(e => e.name === relation.from);
    const toEntity = entities.find(e => e.name === relation.to);
    
    let description = '';
    
    if (fromEntity && toEntity) {
      description += `- **${fromEntity.name}** → **${toEntity.name}**`;
      description += ` (${relation.relationType || 'related to'})`;
      
      if (relation.weight !== undefined) {
        description += ` [weight: ${relation.weight.toFixed(2)}]`;
      }
      
      if (relation.context) {
        description += `\n  *${relation.context}*`;
      }
      
      description += '\n\n';
    }
    
    return description;
  }
  
  /**
   * Gets the appropriate template for an entity
   * @param entity - Entity to get template for
   * @returns Matching template or null if none found
   */
  private getTemplateForEntity(entity: Entity): NarrativeTemplate | null {
    if (!entity.entityType) {
      return null;
    }
    
    return this.templates.find(t => 
      t.applicableNodeTypes.includes(entity.entityType as string)
    ) || null;
  }
  
  /**
   * Finds the most connected entities in the graph
   * @param graph - Knowledge graph data
   * @param limit - Maximum number of entities to return
   * @returns Array of the most connected entities
   */
  private findMostConnectedEntities(graph: KnowledgeGraph, limit: number): Entity[] {
    // Count connections for each entity
    const connectionCounts = new Map<string, number>();
    
    for (const relation of graph.relations) {
      connectionCounts.set(
        relation.from, 
        (connectionCounts.get(relation.from) || 0) + 1
      );
      connectionCounts.set(
        relation.to, 
        (connectionCounts.get(relation.to) || 0) + 1
      );
    }
    
    // Sort entities by connection count
    return graph.entities
      .sort((a, b) => {
        const countA = connectionCounts.get(a.name) || 0;
        const countB = connectionCounts.get(b.name) || 0;
        return countB - countA;
      })
      .slice(0, limit);
  }
  
  /**
   * Finds entities connected to a specific entity
   * @param entityName - Name of the entity to find connections for
   * @param graph - Knowledge graph data
   * @returns Array of connected entities
   */
  private findConnectedEntities(entityName: string, graph: KnowledgeGraph): Entity[] {
    const connectedNames = new Set<string>();
    
    // Find all relations involving the entity
    for (const relation of graph.relations) {
      if (relation.from === entityName) {
        connectedNames.add(relation.to);
      } else if (relation.to === entityName) {
        connectedNames.add(relation.from);
      }
    }
    
    // Get the actual entity objects
    return graph.entities.filter(e => connectedNames.has(e.name));
  }
} 
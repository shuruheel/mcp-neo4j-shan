import { Entity } from '../types/index.js';

/**
 * Structure representing connections to be described in a narrative
 */
export interface ConnectionDescription {
  sourceNode: Entity;
  targetNode: Entity;
  relation: any;
  pathDescription?: string;
}

/**
 * Formats the emotional valence value into a descriptive string
 * @param valence - A number between -1.0 and 1.0
 * @returns A descriptive string of the emotional valence
 */
export function formatEmotionalValence(valence: number): string {
  if (valence === undefined || valence === null) return '';
  
  if (valence < -0.7) return 'strongly negative';
  if (valence < -0.3) return 'negative';
  if (valence < 0.0) return 'slightly negative';
  if (valence < 0.3) return 'neutral';
  if (valence < 0.7) return 'positive';
  return 'strongly positive';
}

/**
 * Formats the emotional arousal value into a descriptive string
 * @param arousal - A number between 0.0 and 3.0
 * @returns A descriptive string of the emotional arousal
 */
export function formatEmotionalArousal(arousal: number): string {
  if (arousal === undefined || arousal === null) return '';
  
  if (arousal < 0.5) return 'very calm';
  if (arousal < 1.0) return 'calm';
  if (arousal < 1.5) return 'moderate';
  if (arousal < 2.0) return 'arousing';
  if (arousal < 2.5) return 'highly arousing';
  return 'extremely arousing';
}

/**
 * Formats a confidence score into a descriptive string
 * @param score - A number between 0.0 and 1.0
 * @returns A descriptive string of the confidence level
 */
export function formatConfidence(score: number): string {
  if (score === undefined || score === null) return '';
  
  if (score < 0.2) return 'very low';
  if (score < 0.4) return 'low';
  if (score < 0.6) return 'moderate';
  if (score < 0.8) return 'high';
  return 'very high';
}

/**
 * Gets unique node types from a list of entities
 * @param entities - List of entity objects
 * @returns Array of unique node types
 */
export function getUniqueNodeTypes(entities: Entity[]): string[] {
  const types = new Set<string>();
  
  for (const entity of entities) {
    if (entity.entityType) {
      types.add(entity.entityType);
    }
  }
  
  return Array.from(types);
}

/**
 * Counts the number of each node type
 * @param entities - List of entity objects
 * @returns Object with node types as keys and counts as values
 */
export function countNodeTypes(entities: Entity[]): Record<string, number> {
  const counts: Record<string, number> = {};
  
  for (const entity of entities) {
    const type = entity.entityType || 'Unknown';
    counts[type] = (counts[type] || 0) + 1;
  }
  
  return counts;
}

/**
 * Groups entities by their type
 * @param entities - List of entity objects
 * @returns Object with node types as keys and arrays of entities as values
 */
export function groupEntitiesByType(entities: Entity[]): Record<string, Entity[]> {
  const grouped: Record<string, Entity[]> = {};
  
  for (const entity of entities) {
    const type = entity.entityType || 'Unknown';
    if (!grouped[type]) {
      grouped[type] = [];
    }
    grouped[type].push(entity);
  }
  
  return grouped;
}

/**
 * Groups relations by their type
 * @param relations - List of relation objects
 * @returns Object with relation types as keys and arrays of relations as values
 */
export function groupRelationsByType(relations: any[]): Record<string, any[]> {
  const grouped: Record<string, any[]> = {};
  
  for (const relation of relations) {
    const type = relation.relationType || 'Unknown';
    if (!grouped[type]) {
      grouped[type] = [];
    }
    grouped[type].push(relation);
  }
  
  return grouped;
} 
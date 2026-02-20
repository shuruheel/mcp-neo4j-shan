import type Database from 'better-sqlite3';
import type { ValidationResult } from '../types/index.js';

const PROVENANCE_REQUIRED_TYPES = new Set([
  'Thought',
  'Proposition',
  'EmotionalEvent',
  'ReasoningChain',
  'ReasoningStep',
]);

/**
 * Check that a node has at least one DERIVED_FROM edge to a Source node.
 */
export function validateProvenance(
  db: Database.Database,
  nodeName: string
): ValidationResult {
  const issues: string[] = [];

  const node = db
    .prepare('SELECT name, node_type, confidence FROM nodes WHERE name = ?')
    .get(nodeName) as { name: string; node_type: string; confidence: number | null } | undefined;

  if (!node) {
    return { valid: false, issues: [`Node "${nodeName}" not found`] };
  }

  // Provenance check
  if (PROVENANCE_REQUIRED_TYPES.has(node.node_type)) {
    const sourceEdge = db
      .prepare(
        `SELECT 1 FROM edges e
         JOIN nodes n ON n.name = e.to_node AND n.node_type = 'Source'
         WHERE e.from_node = ? AND e.relation_type = 'DERIVED_FROM'
         LIMIT 1`
      )
      .get(nodeName);

    if (!sourceEdge) {
      issues.push(
        `${node.node_type} "${nodeName}" has no DERIVED_FROM edge to a Source node`
      );
    }
  }

  // Confidence gating
  if (node.confidence !== null && node.confidence < 0.5) {
    issues.push(
      `Confidence ${node.confidence} is below threshold (0.5) — node marked as candidate`
    );
  }

  return { valid: issues.length === 0, issues };
}

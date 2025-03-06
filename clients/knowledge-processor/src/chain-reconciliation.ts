import { Logger } from 'winston';
import crypto from 'crypto';
import { ReasoningChain, ReasoningChainFragment, ReasoningStep, ChainCompleteness } from './types.js';

/**
 * Chain reconciliation manager to handle reasoning chains that span multiple chunks
 */
export class ChainReconciliationManager {
  private pendingChains: Map<string, ReasoningChainFragment[]> = new Map();
  private logger: Logger;
  
  /**
   * Create a new chain reconciliation manager
   * @param logger - Winston logger instance
   */
  constructor(logger: Logger) {
    this.logger = logger;
  }
  
  /**
   * Add a chain fragment to the pending chains collection
   * @param docId - Document ID (typically the file path)
   * @param fragment - Chain fragment to add
   */
  addChainFragment(docId: string, fragment: ReasoningChainFragment): void {
    // Calculate a hash for the fragment if not already set
    if (!fragment.hash) {
      fragment.hash = this.calculateFragmentHash(fragment);
    }
    
    // Get existing fragments for this document
    const fragments = this.pendingChains.get(docId) || [];
    
    // Check for duplicates using the hash
    const isDuplicate = fragments.some(f => f.hash === fragment.hash);
    if (isDuplicate) {
      this.logger.debug(`Skipping duplicate chain fragment: ${fragment.chainName}`);
      return;
    }
    
    // Add the fragment
    fragments.push(fragment);
    this.pendingChains.set(docId, fragments);
    
    this.logger.debug(`Added chain fragment ${fragment.chainName} for document ${docId}`);
  }
  
  /**
   * Reconcile chain fragments into complete chains
   * @param docId - Document ID
   * @returns Array of complete reasoning chains
   */
  reconcileChains(docId: string): ReasoningChain[] {
    const fragments = this.pendingChains.get(docId) || [];
    if (fragments.length === 0) {
      this.logger.info(`No chain fragments found for document ${docId}`);
      return [];
    }
    
    this.logger.info(`Reconciling ${fragments.length} chain fragments for document ${docId}`);
    
    // Group related fragments
    const fragmentGroups = this.findRelatedFragments(fragments);
    
    // Merge each group into a complete chain
    const completeChains: ReasoningChain[] = [];
    
    for (const group of fragmentGroups) {
      // Skip singleton groups that are not complete
      if (group.length === 1 && group[0].completeness !== 'complete') {
        this.logger.debug(`Skipping isolated fragment ${group[0].chainName} (${group[0].completeness})`);
        continue;
      }
      
      // Process groups with potential to form a complete chain
      try {
        const chain = this.mergeFragments(group);
        completeChains.push(chain);
        this.logger.debug(`Successfully merged chain: ${chain.chainName}`);
      } catch (error) {
        this.logger.error(`Failed to merge fragments: ${(error as Error).message}`);
      }
    }
    
    // Clear the processed fragments
    this.pendingChains.delete(docId);
    
    this.logger.info(`Reconciled ${completeChains.length} complete chains from ${fragments.length} fragments`);
    return completeChains;
  }
  
  /**
   * Get all pending chain fragments for a document
   * @param docId - Document ID
   * @returns Array of chain fragments
   */
  getPendingFragments(docId: string): ReasoningChainFragment[] {
    return this.pendingChains.get(docId) || [];
  }
  
  /**
   * Find related chain fragments that should be merged
   * @param fragments - Array of chain fragments
   * @returns Array of fragment groups
   */
  private findRelatedFragments(fragments: ReasoningChainFragment[]): ReasoningChainFragment[][] {
    // Strategy 1: Group by exact chain name
    const nameGroups = new Map<string, ReasoningChainFragment[]>();
    
    fragments.forEach(fragment => {
      const name = fragment.chainName;
      const group = nameGroups.get(name) || [];
      group.push(fragment);
      nameGroups.set(name, group);
    });
    
    // Strategy 2: Look for fragments with connection clues that match other fragments
    const groups: ReasoningChainFragment[][] = [];
    
    // Start with the name groups
    nameGroups.forEach(group => {
      // Sort by chunk index to ensure correct ordering
      group.sort((a, b) => a.chunkIndex - b.chunkIndex);
      groups.push(group);
    });
    
    // TODO: Implement more sophisticated grouping based on:
    // - Semantic similarity of chain names
    // - Matching connection clues
    // - Step references across fragments
    
    return groups;
  }
  
  /**
   * Merge a group of fragments into a complete chain
   * @param fragments - Array of related fragments
   * @returns Complete reasoning chain
   */
  private mergeFragments(fragments: ReasoningChainFragment[]): ReasoningChain {
    // Start with the first fragment as a base
    const baseFragment = fragments[0];
    
    // Verify we have a valid fragment group
    if (fragments.length === 1 && baseFragment.completeness === 'complete') {
      // Single complete fragment can be returned as is
      return this.convertFragmentToChain(baseFragment);
    }
    
    // Ensure fragments are ordered by chunk index
    fragments.sort((a, b) => a.chunkIndex - b.chunkIndex);
    
    // Analyze completeness pattern
    const hasBeginning = fragments.some(f => 
      f.completeness === 'complete' || f.completeness === 'partial-beginning'
    );
    
    const hasEnd = fragments.some(f => 
      f.completeness === 'complete' || f.completeness === 'partial-end'
    );
    
    if (!hasBeginning || !hasEnd) {
      throw new Error(`Cannot merge fragments without beginning and end for chain: ${baseFragment.chainName}`);
    }
    
    // Create the merged chain
    const mergedChain: ReasoningChain = {
      chainName: baseFragment.chainName,
      description: this.selectBestDescription(fragments),
      conclusion: this.selectBestConclusion(fragments),
      confidenceScore: this.calculateAverageConfidence(fragments),
      methodology: this.selectMostFrequentMethodology(fragments),
      domain: baseFragment.domain,
      sourceThought: baseFragment.sourceThought,
      tags: this.mergeArrays(fragments.map(f => f.tags || [])),
      steps: this.mergeSteps(fragments)
    };
    
    return mergedChain;
  }
  
  /**
   * Convert a fragment to a complete chain
   * @param fragment - Fragment to convert
   * @returns Complete reasoning chain
   */
  private convertFragmentToChain(fragment: ReasoningChainFragment): ReasoningChain {
    return {
      chainName: fragment.chainName,
      description: fragment.description,
      conclusion: fragment.conclusion,
      confidenceScore: fragment.confidenceScore,
      methodology: fragment.methodology,
      domain: fragment.domain,
      sourceThought: fragment.sourceThought,
      tags: fragment.tags,
      steps: fragment.steps
    };
  }
  
  /**
   * Merge steps from multiple fragments
   * @param fragments - Array of fragments
   * @returns Array of merged steps
   */
  private mergeSteps(fragments: ReasoningChainFragment[]): ReasoningStep[] {
    // Collect all steps from all fragments
    const allSteps: ReasoningStep[] = [];
    fragments.forEach(fragment => {
      allSteps.push(...fragment.steps);
    });
    
    // Deduplicate steps by name
    const stepMap = new Map<string, ReasoningStep>();
    allSteps.forEach(step => {
      // If step already exists, keep the one with higher confidence
      if (stepMap.has(step.name)) {
        const existing = stepMap.get(step.name)!;
        if (step.confidence > existing.confidence) {
          stepMap.set(step.name, step);
        }
      } else {
        stepMap.set(step.name, step);
      }
    });
    
    // Sort steps by step number
    const mergedSteps = Array.from(stepMap.values());
    mergedSteps.sort((a, b) => a.stepNumber - b.stepNumber);
    
    // Reassign step numbers to ensure continuity
    mergedSteps.forEach((step, index) => {
      step.stepNumber = index + 1;
    });
    
    return mergedSteps;
  }
  
  /**
   * Select the best description from multiple fragments
   * @param fragments - Array of fragments
   * @returns Best description
   */
  private selectBestDescription(fragments: ReasoningChainFragment[]): string {
    // Prefer descriptions from complete fragments
    const completeFragments = fragments.filter(f => f.completeness === 'complete');
    if (completeFragments.length > 0) {
      return completeFragments[0].description;
    }
    
    // Prefer descriptions from beginning fragments
    const beginningFragments = fragments.filter(f => f.completeness === 'partial-beginning');
    if (beginningFragments.length > 0) {
      return beginningFragments[0].description;
    }
    
    // Default to the longest description
    return fragments
      .map(f => f.description)
      .reduce((longest, current) => 
        current.length > longest.length ? current : longest, 
        fragments[0].description
      );
  }
  
  /**
   * Select the best conclusion from multiple fragments
   * @param fragments - Array of fragments
   * @returns Best conclusion
   */
  private selectBestConclusion(fragments: ReasoningChainFragment[]): string {
    // Prefer conclusions from complete fragments
    const completeFragments = fragments.filter(f => f.completeness === 'complete');
    if (completeFragments.length > 0) {
      return completeFragments[0].conclusion;
    }
    
    // Prefer conclusions from end fragments
    const endFragments = fragments.filter(f => f.completeness === 'partial-end');
    if (endFragments.length > 0) {
      return endFragments[0].conclusion;
    }
    
    // Default to the longest conclusion
    return fragments
      .map(f => f.conclusion)
      .reduce((longest, current) => 
        current.length > longest.length ? current : longest, 
        fragments[0].conclusion
      );
  }
  
  /**
   * Calculate average confidence across fragments
   * @param fragments - Array of fragments
   * @returns Average confidence score
   */
  private calculateAverageConfidence(fragments: ReasoningChainFragment[]): number {
    const sum = fragments.reduce((total, fragment) => total + fragment.confidenceScore, 0);
    return sum / fragments.length;
  }
  
  /**
   * Select the most frequent methodology across fragments
   * @param fragments - Array of fragments
   * @returns Most frequent methodology
   */
  private selectMostFrequentMethodology(fragments: ReasoningChainFragment[]): ReasoningChainFragment['methodology'] {
    const counts = new Map<ReasoningChainFragment['methodology'], number>();
    
    fragments.forEach(fragment => {
      const methodology = fragment.methodology;
      const count = counts.get(methodology) || 0;
      counts.set(methodology, count + 1);
    });
    
    let mostFrequent = fragments[0].methodology;
    let highestCount = 0;
    
    counts.forEach((count, methodology) => {
      if (count > highestCount) {
        mostFrequent = methodology;
        highestCount = count;
      }
    });
    
    return mostFrequent;
  }
  
  /**
   * Merge arrays and remove duplicates
   * @param arrays - Array of arrays
   * @returns Merged array without duplicates
   */
  private mergeArrays<T>(arrays: T[][]): T[] {
    const merged = new Set<T>();
    arrays.forEach(array => {
      array.forEach(item => merged.add(item));
    });
    return Array.from(merged);
  }
  
  /**
   * Calculate a hash for a chain fragment
   * @param fragment - Chain fragment
   * @returns Hash string
   */
  private calculateFragmentHash(fragment: ReasoningChainFragment): string {
    const hashContent = `${fragment.chainName}|${fragment.conclusion}|${fragment.steps.map(s => s.name).join('|')}`;
    return crypto.createHash('md5').update(hashContent).digest('hex');
  }
} 
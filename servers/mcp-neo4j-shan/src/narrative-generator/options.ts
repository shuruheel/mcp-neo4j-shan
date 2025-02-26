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
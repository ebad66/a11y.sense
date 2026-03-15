export type WCAGPrinciple = 'Perceivable' | 'Operable' | 'Understandable' | 'Robust';

export interface VisualizerIssue {
  id: string;
  severity: 'Critical' | 'Warning' | 'Minor' | 'Pass';
  title: string;
  description: string;
  fix: string;
  element?: string;
  selector?: string;
  wcag?: string;
  principle: WCAGPrinciple;
}

export type BodyRegion = 'EyesEars' | 'Hands' | 'Brain' | 'Spine' | 'Navigation';

import { BodyRegion, VisualizerIssue, WCAGPrinciple } from './types';
import { AccessibilityIssue } from '@/lib/claude';

// Map specific meshes/bones to their logical region
export const REGION_MESHES: Record<BodyRegion, string[]> = {
  EyesEars: ['EyeLeft', 'EyeRight', 'EarLeft', 'EarRight', 'Head'], // We'll highlight parts of the head if specific eyes/ears aren't found
  Hands: ['HandLeft', 'HandRight', 'ArmLeft', 'ArmRight', 'Fingers'],
  Brain: ['Brain', 'Cranium', 'HeadTop'],
  Spine: ['Spine1', 'Spine2', 'Spine3', 'Neck', 'NervousSystem']
};

export const PRINCIPLE_TO_REGION: Record<WCAGPrinciple, BodyRegion> = {
  Perceivable: 'EyesEars',
  Operable: 'Hands',
  Understandable: 'Brain',
  Robust: 'Spine'
};

// Map WCAG guidelines out of the string if possible
export function inferPrinciple(issue: AccessibilityIssue): WCAGPrinciple {
  if (issue.wcag) {
    if (issue.wcag.startsWith('1.')) return 'Perceivable';
    if (issue.wcag.startsWith('2.')) return 'Operable';
    if (issue.wcag.startsWith('3.')) return 'Understandable';
    if (issue.wcag.startsWith('4.')) return 'Robust';
  }

  // Fallback heuristics based on title/description keywords
  const lowerText = (issue.title + ' ' + issue.description).toLowerCase();
  
  if (lowerText.match(/(alt text|contrast|color|caption|audio|font|zoom|reflow)/)) {
    return 'Perceivable';
  }
  if (lowerText.match(/(keyboard|focus|tab|click|button|link|skip|timeout|target)/)) {
    return 'Operable';
  }
  if (lowerText.match(/(language|label|instruction|error|form|predictable|parse)/)) {
    return 'Understandable';
  }
  if (lowerText.match(/(aria|role|name|value|id|html|parsing)/)) {
    return 'Robust';
  }

  // Default to Perceivable if unable to guess
  return 'Perceivable';
}

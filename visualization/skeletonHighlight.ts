import * as THREE from 'three';
import { BodyRegion } from './types';

// Converts severity into an emissive color and intensity
export function getSeverityStyle(severity: 'Critical' | 'Warning' | 'Minor' | 'Pass') {
  switch (severity) {
    case 'Critical': return { color: new THREE.Color('#ef4444'), intensity: 1.5 }; // pulsing red glow
    case 'Warning': return { color: new THREE.Color('#f59e0b'), intensity: 0.8 }; // orange glow
    case 'Minor': return { color: new THREE.Color('#fcd34d'), intensity: 0.5 }; // yellow highlight
    default: return { color: new THREE.Color('#000000'), intensity: 0 };
  }
}

// Compute the highest severity for a given region when multiple issues map to it
export function getHighestSeverity(
  issuesForRegion: { severity: string }[]
): 'Critical' | 'Warning' | 'Minor' | 'Pass' {
  if (issuesForRegion.some(i => i.severity === 'Critical')) return 'Critical';
  if (issuesForRegion.some(i => i.severity === 'Warning')) return 'Warning';
  if (issuesForRegion.some(i => i.severity === 'Minor' || i.severity === 'Pass')) return 'Minor';
  return 'Pass';
}

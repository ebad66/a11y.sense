/**
 * WCAG 2.1 Four Principles (POUR)
 * Issues are categorised under Perceivable, Operable, Understandable, Robust.
 * An issue may appear under more than one principle.
 */

export type WcagPrincipleId = 'perceivable' | 'operable' | 'understandable' | 'robust';

export interface WcagPrinciple {
  id: WcagPrincipleId;
  label: string;
  /** Short tagline shown in description areas */
  tagline: string;
  emoji: string;
  color: string;
  /** WCAG guideline range covered (e.g. "1.x") */
  guidelines: string;
  examples: string[];
  /**
   * Injected verbatim into the AI audit prompt to focus the model
   * on this principle's specific success criteria.
   */
  auditFocus: string;
}

export const WCAG_PRINCIPLES: WcagPrinciple[] = [
  {
    id: 'perceivable',
    label: 'Perceivable',
    tagline: 'Information must be presentable to users in ways they can perceive.',
    emoji: '👁️',
    color: '#6366f1',
    guidelines: '1.x',
    examples: [
      'Missing alt text on images',
      'Missing captions on video / audio',
      'Poor color contrast ratios',
      'Content conveyed only by color',
      'Text that cannot be resized',
      'Content not readable by screen readers',
    ],
    auditFocus: `You are auditing for WCAG 2.1 Principle 1 — PERCEIVABLE (guidelines 1.1–1.4).
Identify issues where information or UI components cannot be perceived by all users.

Key criteria to check:
- 1.1.1 Non-text Content: images missing meaningful alt text; decorative images not marked aria-hidden or alt=""
- 1.2.1–1.2.5: Videos without captions; audio without transcripts; live content without captions
- 1.3.1: Information conveyed only through visual formatting, position, or color; improper heading hierarchy; form fields not programmatically associated with labels; missing ARIA landmarks
- 1.3.2: Reading/navigation order that does not match visual presentation
- 1.3.3: Instructions relying solely on sensory characteristics (color, shape, location)
- 1.4.1: Color as the only visual means of conveying information
- 1.4.3: Text contrast below 4.5:1 (normal) or 3:1 (large ≥18pt/14pt bold)
- 1.4.4: Text that cannot be resized up to 200% without loss of content or functionality
- 1.4.5: Text in images where live text could be used
- 1.4.10: Content that does not reflow at 320px width (horizontal scroll)
- 1.4.11: Non-text contrast below 3:1 for UI components and graphical objects
- 1.4.12: Text spacing override breaking content (line-height, letter-spacing, word-spacing)`,
  },
  {
    id: 'operable',
    label: 'Operable',
    tagline: 'UI components and navigation must be operable.',
    emoji: '⌨️',
    color: '#f59e0b',
    guidelines: '2.x',
    examples: [
      'Keyboard navigation not possible',
      'Focus traps with no escape route',
      'No visible focus indicators',
      'Interactive elements keyboard-inaccessible',
      'No skip navigation link',
      'Time limits without user control',
    ],
    auditFocus: `You are auditing for WCAG 2.1 Principle 2 — OPERABLE (guidelines 2.1–2.5).
Identify issues where users cannot operate the interface.

Key criteria to check:
- 2.1.1: Functionality not available via keyboard alone (hover-only menus, drag-only interactions)
- 2.1.2: Keyboard traps — users cannot move focus away from a component using keyboard
- 2.1.4: Single-character key shortcuts without a way to remap or disable
- 2.2.1: Time limits that cannot be turned off, adjusted, or extended
- 2.2.2: Auto-moving, blinking, or scrolling content with no pause control
- 2.3.1: Content that flashes more than 3 times per second
- 2.4.1: No mechanism to bypass blocks of repeated content (skip nav)
- 2.4.2: Missing or non-descriptive page title
- 2.4.3: Focus order that does not follow logical reading sequence
- 2.4.4: Link purpose not determinable from link text alone ("click here", "read more")
- 2.4.6: Headings and labels not descriptive
- 2.4.7: No visible keyboard focus indicator
- 2.5.3: Visible label not included in accessible name
- 2.5.5: Touch/click target size below 44×44 CSS pixels`,
  },
  {
    id: 'understandable',
    label: 'Understandable',
    tagline: 'Information and UI operation must be understandable.',
    emoji: '💡',
    color: '#10b981',
    guidelines: '3.x',
    examples: [
      'Unclear or missing form labels',
      'Missing language attribute on page',
      'Inconsistent navigation across pages',
      'Forms without error descriptions',
      'Unexpected behavior on focus or input',
    ],
    auditFocus: `You are auditing for WCAG 2.1 Principle 3 — UNDERSTANDABLE (guidelines 3.1–3.3).
Identify issues where users cannot understand the content or how to operate the interface.

Key criteria to check:
- 3.1.1: Missing lang attribute on <html>; wrong language code
- 3.1.2: Language changes within the page not marked with lang attribute
- 3.2.1: Unexpected context change on receiving focus (e.g. auto-submit on focus)
- 3.2.2: Unexpected context change on user input (e.g. form submits automatically on field change)
- 3.2.3: Navigation mechanisms not consistent across pages
- 3.2.4: Components with same function labeled inconsistently across pages
- 3.3.1: Error identification — no indication of which field has an error; error not described in text
- 3.3.2: Labels or instructions missing for user input fields
- 3.3.3: Error suggestions — after a validation error, no suggestion for correction provided
- 3.3.4: No error prevention for legal, financial, or data-submission actions (no review step, no undo)`,
  },
  {
    id: 'robust',
    label: 'Robust',
    tagline: 'Content must work with a wide variety of assistive technologies.',
    emoji: '🔧',
    color: '#ec4899',
    guidelines: '4.x',
    examples: [
      'Invalid or missing ARIA attributes',
      'Improper semantic HTML structure',
      'Duplicate IDs',
      'Broken accessibility roles',
      'Status messages not announced',
    ],
    auditFocus: `You are auditing for WCAG 2.1 Principle 4 — ROBUST (guideline 4.1).
Identify issues where content is not robust enough to be interpreted by assistive technologies.

Key criteria to check:
- 4.1.1: Parsing errors — duplicate IDs; unclosed elements; improperly nested elements; invalid HTML that breaks AT parsing
- 4.1.2 Name, Role, Value:
    • Form inputs missing accessible name (no label, aria-label, or aria-labelledby)
    • Buttons with no accessible name (icon-only buttons with no aria-label)
    • Links with no accessible name
    • Custom interactive widgets (menus, tabs, sliders) missing required ARIA role/state/property
    • Select / combobox elements missing proper markup
    • Expandable regions not using aria-expanded
    • required fields not marked with aria-required or required attribute
- 4.1.3: Status messages (success, error, loading) not exposed via role="status", role="alert", or aria-live regions so screen readers miss them`,
  },
];

export function getWcagPrinciple(id: WcagPrincipleId): WcagPrinciple {
  const principle = WCAG_PRINCIPLES.find((p) => p.id === id);
  if (!principle) throw new Error(`Unknown WCAG principle: ${id}`);
  return principle;
}

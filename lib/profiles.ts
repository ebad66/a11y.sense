export type ProfileId = 'blind' | 'low-vision' | 'dyslexia' | 'deaf' | 'motor';

export interface Profile {
  id: ProfileId;
  label: string;
  emoji: string;
  color: string;
  description: string;
  checks: string[];
  geminiPrompt: string;
  claudeFocus: string;
}

export const PROFILES: Profile[] = [
  {
    id: 'blind',
    label: 'Blind',
    emoji: '👁️',
    color: '#6366f1',
    description: 'Screen reader & keyboard-only navigation',
    checks: [
      'Missing alt text on images',
      'Non-descriptive link text',
      'Missing form labels',
      'No skip navigation links',
      'Missing ARIA landmarks',
      'Images with no role or aria-hidden',
      'Dynamic content not announced',
    ],
    geminiPrompt:
      'Simulate what a blind person actually experiences when visiting this webpage using a screen reader (NVDA/JAWS). Blind users have zero visual perception — they hear the page as a sequence of spoken announcements. Your output must be a split-screen image. LEFT HALF: the original webpage faded to 5% opacity (almost completely invisible — the visual layout is meaningless to this user). RIGHT HALF: a dark terminal panel (#0d0d0d background) titled "SCREEN READER OUTPUT (NVDA)" in dim grey at the top, showing the exact sequence of text a screen reader would speak aloud as the user Tabs through the page. Format each announcement on its own line in white monospace font, exactly as NVDA announces it — examples: "heading level 1  Welcome to Acme Corp", "link  About Us", "button  Submit", "navigation landmark", "main landmark", "graphic  logo" (with no alt text the screen reader just says "graphic" and the filename or nothing). For every element that would be announced with missing or useless information, render that line in bright red and append what the screen reader actually says — for example: a decorative image with no alt becomes red text "graphic  IMG_4829.jpg  (no description — screen reader reads filename)", a link that says only "click here" becomes red "link  click here  (destination unknown)", an icon button with no label becomes red "button  (unlabelled — screen reader announces nothing useful)". Show approximately 15–25 announcement lines, filling the panel. Draw a blinking white cursor ▌ on the line currently being read. The overall effect: the left side is an illegible ghost of the original page, the right side is the sparse, broken, text-only reality that blind users navigate.',
    claudeFocus:
      'Focus on: missing alt text on images, empty or non-descriptive link text (e.g. "click here", "read more"), missing form labels, absence of skip-navigation links, missing ARIA landmarks (main, nav, header, footer), unlabeled icon buttons, broken heading hierarchy (skipped levels, multiple h1s), content conveyed only through colour, dynamic content not marked as live regions, and the number of interactive elements before the main content landmark.',
  },
  {
    id: 'low-vision',
    label: 'Low Vision',
    emoji: '🔍',
    color: '#f59e0b',
    description: 'Reduced contrast, magnification, color sensitivity',
    checks: [
      'Low color contrast ratios',
      'Text too small (< 16px body)',
      'No zoom support',
      'Fixed pixel layouts that break at 200% zoom',
      'Color-only information',
      'Missing focus indicators',
    ],
    geminiPrompt:
      'Simulate severe low vision on this webpage screenshot using TWO side-by-side panels inside the same image. Left panel (label it "DEGRADED VISION"): simulate macular degeneration + cataracts — (a) heavy Gaussian blur so body text is unreadable, only the largest headings are barely legible blobs; (b) greyscale then mild yellow-brown tint (cataracts cause yellowing); (c) contrast crush — raise blacks, lower whites, everything converges to flat mid-grey; (d) blown-out white oval glare in the upper-centre covering 25% of the panel (macular degeneration destroys central vision); (e) soft dark vignette around edges (glaucoma). Right panel (label it "200% ZOOM BREAKDOWN"): simulate what happens when the user zooms to 200% — take the left half of the original page and zoom it to fill the full right panel width, so content overflows, text gets cut off at the right edge, horizontal scroll appears, navigation items stack or disappear off-screen. Add a red annotation wherever text is cut off reading "TEXT CUT OFF". Add a yellow annotation wherever layout has broken reading "LAYOUT COLLAPSE". The goal: left panel shows visual degradation, right panel shows zoom-induced layout destruction. Both problems together.',
    claudeFocus:
      'Focus on: colour contrast ratios below 4.5:1 for normal text and 3:1 for large text, font sizes below 16px for body text, fixed-width or pixel-locked containers that break at 200% zoom, text that does not reflow when zoomed, content relying solely on colour to convey meaning (e.g. red = error with no icon or text), missing or invisible focus indicators, use of CSS that disables zoom (user-scalable=no in viewport meta), and absence of a high-contrast mode or theme.',
  },
  {
    id: 'dyslexia',
    label: 'Dyslexia',
    emoji: '📖',
    color: '#10b981',
    description: 'Reading difficulty, letter confusion, text density',
    checks: [
      'Serif fonts (harder to read)',
      'Justified text alignment',
      'Tight line spacing (< 1.5)',
      'Long unbroken paragraphs',
      'Small font size for body text',
      'Low contrast text',
      'All-caps text blocks',
    ],
    geminiPrompt:
      'Re-render this webpage screenshot exactly as a person with severe dyslexia perceives it. You are NOT adding annotations, labels, boxes, or educator overlays — you are distorting the text itself so the viewer feels the experience firsthand. Keep all backgrounds, colours, images, icons, and layout completely untouched. Only the rendered text changes. Apply every single one of these perceptual distortions simultaneously at maximum intensity: (1) LETTER SUBSTITUTION — swap visually similar letters throughout: every "b" becomes "d" or "p", every "d" becomes "b" or "q", every "p" becomes "q", every "n" becomes "u", every "m" becomes "w", every "6" becomes "9", every "Z" becomes "S" — apply this to at least 1 in every 3 letters across all text; (2) LETTER ROTATION — rotate random individual letters by 90, 180, or 270 degrees, and tilt others by 15–35 degrees left or right — minimum 1 in 4 letters is visibly rotated or tilted; (3) CROWDING — in every word longer than 4 letters, compress the middle letters so they visually overlap each other and the surrounding letters, creating an illegible dense cluster in the centre of the word while the first and last letters remain slightly more readable; (4) SWIMMING TEXT — make every line of text follow a sine-wave path, rising and falling by 10–20px, so no line of text is horizontal — longer paragraphs should have more aggressive curves; (5) LETTER SIZE JITTER — randomly scale individual letters up or down by 20–40% within words, so tall letters and tiny letters alternate unpredictably; (6) GHOSTING — every word has a faint ghost duplicate offset 3–5px diagonally, creating a slight double-vision shimmer on all text; (7) WORD SCRAMBLING — for short words (3–5 letters), randomly scramble the middle letters while keeping first and last letters in place ("said" becomes "siad", "from" becomes "fmro"); (8) SPACING CHAOS — randomly vary the gap between letters within words from zero (letters touching) to triple-width, making some words look fused and others spaced out unnaturally. The final image must look like the page is actively fighting the reader — every line of text should be visibly hard to parse. No boxes, no labels, no annotations. Pure perceptual chaos on the text only.',
    claudeFocus:
      'Focus on: use of serif or decorative fonts, justified text alignment (creates uneven spacing rivers), line-height below 1.5, letter-spacing below 0.12em, paragraph width exceeding 80 characters, font sizes below 16px for body text, all-caps text blocks, absence of dyslexia-friendly font options, poor text-to-background contrast, lack of sufficient paragraph spacing, and walls of dense unbroken text with no visual breathing room.',
  },
  {
    id: 'deaf',
    label: 'Deaf',
    emoji: '🔇',
    color: '#ec4899',
    description: 'No audio content, captions, transcripts',
    checks: [
      'Videos without captions',
      'Audio content without transcripts',
      'Alerts that use sound only',
      'Missing captions on embedded media',
      'No sign language alternatives',
    ],
    geminiPrompt:
      'Simulate this webpage for a deaf user. Deaf users have completely normal vision — the page should look visually identical except for specific annotations. Do NOT apply any filter, colour change, blur, or global effect to the page. Scan the screenshot carefully and apply only these targeted changes: (1) For every video player, audio player, YouTube or Vimeo embed, podcast widget, or media control with a play button: cover it with a solid black rectangle and place a large red crossed-circle with bold white text "BLOCKED — NO CAPTIONS OR TRANSCRIPT". If the media element appears to be set to autoplay (no user action needed), add an extra red label "AUTOPLAY — NO WARNING GIVEN"; (2) For any notification area, bell icon, toast/snackbar, alert banner, or form validation error that appears to be visual-only, add a small yellow label "SOUND CUE — deaf user may miss this trigger"; (3) For any dense paragraph of complex formal English (long sentences, legal language, academic text), add a subtle orange side-bar label "COMPLEX ENGLISH — may be a barrier for BSL/ASL first-language users"; (4) If audio or video elements were found, add a red banner at the top: "AUDIO/VIDEO WITHOUT CAPTIONS DETECTED". If nothing was found: add only a small green banner: "DEAF ACCESSIBLE — No audio or video barriers found". Do not add greyscale, borders, or any other global effects.',
    claudeFocus:
      'Focus on: video elements without captions or transcript links, audio elements without text alternatives, auto-playing media with no mute or pause control visible on load, alerts and notifications that rely on sound only (no visual indicator), embedded YouTube/Vimeo without closed-caption options enabled, form validation errors that are not visually displayed, complex dense English that may be a reading barrier for BSL/ASL first-language users, and absence of sign language video alternatives for critical content.',
  },
  {
    id: 'motor',
    label: 'Motor',
    emoji: '🖱️',
    color: '#ef4444',
    description: 'Keyboard navigation, large targets, no drag',
    checks: [
      'Click targets below 44×44px',
      'Drag-only interactions',
      'No keyboard trap avoidance',
      'Time-limited interactions',
      'Hover-only content',
      'Missing keyboard shortcuts',
    ],
    geminiPrompt:
      'Simulate severe motor impairment (hand tremor, limited fine motor control) on this webpage screenshot. Motor impairment does NOT affect vision — do NOT desaturate, blur, or change any colours, backgrounds, or text. Apply ALL of the following annotations on top of the unchanged page: (1) Every interactive element (links, buttons, inputs, checkboxes, selects, toggles, icon buttons) gets a thick 5px bright red border; (2) Any visibly small target (inline text links, icon-only buttons, small checkboxes, close/X buttons — anything appearing under 44x44px) gets a 75% red overlay fill and white bold text "TOO SMALL" stamped over it; (3) Any navigation menu or dropdown that appears to only be accessible by hovering (top nav bars with dropdowns, mega-menus) gets a bright orange overlay with label "HOVER ONLY — keyboard inaccessible"; (4) Any drag handle, sortable list, slider, carousel swipe area, or kanban-style card gets a purple overlay with label "DRAG REQUIRED — no keyboard alternative visible"; (5) Any sticky or fixed banner, cookie bar, chat widget, or floating button that overlaps content gets a yellow outline and label "FIXED ELEMENT — blocks content"; (6) Draw a large mouse cursor near the centre surrounded by 10 to 12 ghost trails radiating in random directions at decreasing opacity (tremor scatter); (7) Around the smallest targets draw a yellow targeting-reticle that is visibly too large to land precisely on the element; (8) Add a full-width banner at top: "MOTOR IMPAIRMENT VIEW — RED = INTERACTIVE TARGETS — ORANGE = HOVER ONLY — PURPLE = DRAG REQUIRED — YELLOW = BLOCKING ELEMENTS". Page colours, images, and text must remain completely unchanged.',
    claudeFocus:
      'Focus on: interactive elements with click targets below 44x44px, navigation menus and dropdowns that are hover-only with no keyboard equivalent, drag-and-drop interfaces without a keyboard alternative, any interface requiring double-click or long-press, session timeout warnings that do not offer time extensions (motor users type slowly), sticky or fixed UI elements that obscure content, missing visible focus indicators, absence of keyboard shortcuts for frequently used actions, forms with strict time limits on completion, and CAPTCHA types that require mouse drawing or drag interactions.',
  },
];

export function getProfile(id: ProfileId): Profile {
  const profile = PROFILES.find((p) => p.id === id);
  if (!profile) throw new Error(`Unknown profile: ${id}`);
  return profile;
}

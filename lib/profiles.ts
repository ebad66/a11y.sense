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

// These prompts generate experiential simulations, not educational diagrams.
// A neurotypical viewer should feel mild distress or frustration when looking at the output — not gain information.
// The image IS the accessibility lesson.
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
      'Discard the webpage entirely. Fill the entire canvas with pure solid black — #000000, no gradients, no website visible at all. This image is a screen reader experience, not a webpage. In the center-left of the black canvas, render a slowly-scrolling terminal readout in bright green (#00FF00) monospace Courier New font, small size, tight line spacing. Study the actual screenshot carefully and produce the screen reader announcement stream based only on what is visibly present — announce every text link, heading, button, form field, landmark, and image in the order they appear. Format each line as the screen reader would speak it: "Navigation landmark. Link: [actual link text]. Link: [actual link text]. Heading level one: [actual heading text]. Paragraph: [first words of paragraph]. Button: [button label]. Image. No description available." and so on. For every image you see in the screenshot — hero images, thumbnails, icons, decorative images — output the line "Image. No description available." and in the terminal stream draw a horizontal strikethrough line across that entry in red, indicating the image is invisible to this user. Count how many links and interactive elements appear before the first main content heading or main landmark, then highlight that count in a bright yellow (#FFD700) box in the same monospace font — it reads: "[N] TAB STOPS BEFORE MAIN CONTENT" where N is the actual count based on the screenshot. Render the stream as if mid-scroll, some lines partially above the top edge, making it feel relentless and ongoing. Below the scrolling text, at the bottom center, a single blinking green block cursor waiting. No borders, no decoration, no labels, no website elements of any kind.',
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
      'Apply a stacked sequence of destructive visual filters to this webpage screenshot. Use one single full-size image — no panels, no side-by-side, no labels, no annotations of any kind. Apply every filter simultaneously at maximum intensity: (1) CONTRAST CRUSH — reduce the contrast to near-flat grey fog. Lift the blacks to mid-grey and push the whites down to light grey so the entire image becomes a washed-out grey slab. Dark text on white background should become medium grey on slightly lighter grey — barely distinguishable. (2) HEAVY UNIFORM BLUR — apply a very strong Gaussian blur across the entire image. Body text must be completely illegible — not blurry-but-readable, completely illegible. Only the largest page headings may survive as faint dark blobs of shape, not readable words. (3) CENTRAL BLOWN-OUT GLARE — place a large oval white flare smear across the horizontal center third of the image, brightest at the absolute center fading to transparent at its edges. This simulates macular degeneration: the exact point the eye naturally focuses — dead center — is the most destroyed zone. The viewer should instinctively try to look slightly off-center to read, and still fail. (4) DARK TUNNEL VIGNETTE — apply a heavy dark vignette around all four edges so the periphery fades to near-black. The viewable zone narrows to a tight inner rectangle. (5) YELLOW-BROWN FILM — apply a warm yellow-brown colour wash over the entire image simulating cataract yellowing. Whites become cream-yellow, greys become ochre. Stack all five effects simultaneously. The final image should look like trying to read through a frosted shower door held in front of a foggy window at dusk. No text should be legible. No labels, no borders, no annotations — pure perceptual degradation only.',
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
      'Re-render this webpage screenshot with the page layout completely intact — images sharp, backgrounds crisp, buttons and UI elements pixel-perfect — but apply two simultaneous extreme perceptual distortions exclusively to all text regions: (1) MAXIMUM RADIAL MOTION BLUR ON TEXT ONLY — apply the most extreme radial motion blur possible to every region containing text. This is not a subtle effect — the blur radius must be enormous, smearing each letter outward in all directions to at least 5× the letter\'s own width. Every word must dissolve into a starburst smear of ink. Individual letters must be completely unrecognisable — not hard to read, impossible to read. Body text, nav links, captions, button labels, headings — every piece of text must be obliterated into illegible motion-blur streaks. Only the very largest hero headings may retain a ghost of their shape. Non-text elements — images, icons, button backgrounds, dividers, page backgrounds — must remain absolutely razor-sharp with zero blur. The contrast between the destroyed text and the pristine non-text elements must be jarring and obvious. Do not add any colour tint or overlay. (2) EXTREME SINE-WAVE VERTICAL DISPLACEMENT WITH PER-LETTER ROTATION — warp every single line of text along a violent sine-wave path, rising and falling by 30–40 pixels so each line curves dramatically like a rollercoaster. On top of that, rotate every individual letter randomly between 20° and 60° left or right — every letter in every word should be visibly tilted at a different angle, like they are all spinning independently. Longer paragraphs should look like text written on a violently churning ocean. The final image must look so broken that a viewer cannot read a single word anywhere on the page. No annotations, no labels, no colour changes. Text: completely destroyed. Everything else: perfect.',
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
      'Keep the entire webpage screenshot pixel-perfect and visually unchanged — deaf users have completely normal vision. Apply no blur, no colour shift, no global filter of any kind. Then apply only these targeted overlays: (1) MEDIA BLACKOUT — for every video thumbnail, embedded video player, YouTube or Vimeo embed, audio player, podcast widget, or any UI element with a play button or speaker icon: cover it completely with a solid black rectangle. In the center of each black rectangle, render a large closed-captions (CC) icon in white, with a thick red X drawn through it. The icon should be prominent and unmistakable. (2) SILENT BADGES — for every notification bell icon, alert banner, toast notification, snackbar, or any element that appears to signal updates or alerts: place a small bright yellow badge over it with bold black text reading "SILENT". (3) FLOATING SUMMARY PANEL — in the bottom-right corner of the image, render a floating panel with a dark semi-transparent background and rounded corners. Inside it: a phone-style mute icon (speaker with X) in white as the header icon, then on lines below: "• [N] videos with no captions" / "• [N] audio elements" / "• [N] sound-only alerts" — where [N] is the count of elements you actually found in this screenshot. If none were found in a category, write 0. The page should look completely normal and inviting all around it. Only the sealed black rectangles and the quiet floating counter reveal that the page is full of content the viewer cannot access.',
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
      'Keep this webpage screenshot completely visually intact underneath — colours, text, images, and layout all unchanged. Motor impairment does not affect vision. Apply only these visual overlays: (1) SMALL TARGET HIGHLIGHT BOXES — for every small interactive element on the page (icon-only buttons, small close/X buttons, inline text links, small checkboxes, small toggles, small nav items — anything that appears to be under 44x44px), draw a bright red semi-transparent highlight box over it. Inside or directly beside each box place a short red label in small bold text naming what it is — "Small button", "Icon button", "Text link", "Checkbox", "Close button" — so the viewer can see both the element and exactly how small the target is. (2) RED BORDERS — draw a thick bright red border around every interactive element on the page: all links, buttons, inputs, checkboxes, dropdowns, icon buttons. This makes the full density of interactive targets visible at once. (3) HOVER-ONLY ORANGE OVERLAY — for any element that appears to require hover to reveal content (dropdown menus, tooltip-triggered elements, hover-reveal actions), apply a semi-transparent orange fill overlay with no text label. The red highlight boxes and dense red borders communicate the problem. No cursor graphics, no crosshairs, no tremor effects. The viewer should feel the frustrating impossibility of hitting a target labelled "Small button" when their hand shakes.',
    claudeFocus:
      'Focus on: interactive elements with click targets below 44x44px, navigation menus and dropdowns that are hover-only with no keyboard equivalent, drag-and-drop interfaces without a keyboard alternative, any interface requiring double-click or long-press, session timeout warnings that do not offer time extensions (motor users type slowly), sticky or fixed UI elements that obscure content, missing visible focus indicators, absence of keyboard shortcuts for frequently used actions, forms with strict time limits on completion, and CAPTCHA types that require mouse drawing or drag interactions.',
  },
];

export function getProfile(id: ProfileId): Profile {
  const profile = PROFILES.find((p) => p.id === id);
  if (!profile) throw new Error(`Unknown profile: ${id}`);
  return profile;
}

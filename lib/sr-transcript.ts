import * as cheerio from 'cheerio';
import { JourneyRun } from './journey';

export type TranscriptViewMode = 'plain' | 'technical';

export interface TranscriptEvent {
  id: string;
  timestamp: number;
  journeyStepId: string;
  triggerAction: string;
  announced: string;
  plainEnglish: string;
  technical: string;
  source: {
    role: string;
    name: string;
    state?: string;
    landmark?: string;
    liveRegion?: string;
    selectorHint: string;
  };
  confidence: number;
}

export type ConfusionFlagType =
  | 'duplicate-labels'
  | 'context-loss-after-route-change'
  | 'focus-jump-without-explanation'
  | 'non-descriptive-control-name';

export interface ConfusionFlag {
  id: string;
  type: ConfusionFlagType;
  severity: 'medium' | 'high';
  rationale: string;
  suggestedRemediation: string;
  journeyStepId: string;
  relatedEventIds: string[];
}

export interface TranscriptExport {
  json: string;
  text: string;
}

export interface JourneyTranscript {
  runId: string;
  generatedAt: number;
  confidence: number;
  events: TranscriptEvent[];
  confusionFlags: ConfusionFlag[];
  plainEnglishSummary: string;
  technicalSummary: string;
  export: TranscriptExport;
}

interface BuildTranscriptInput {
  journeyRun: JourneyRun;
  html: string;
  finalUrl: string;
}

const NON_DESCRIPTIVE = new Set(['click here', 'here', 'button', 'link', 'more', 'learn more', 'go']);
type CheerioRoot = ReturnType<typeof cheerio.load>;

export function buildJourneyTranscript(input: BuildTranscriptInput): JourneyTranscript {
  const { journeyRun, html, finalUrl } = input;
  const $ = cheerio.load(html);
  const step = journeyRun.steps[0];
  const timestampBase = journeyRun.startedAt;

  const events: TranscriptEvent[] = [];
  let i = 0;

  const push = (event: Omit<TranscriptEvent, 'id' | 'timestamp'>) => {
    events.push({
      ...event,
      id: `evt-${++i}`,
      timestamp: timestampBase + i * 250,
    });
  };

  $('main, [role="main"], nav, [role="navigation"], header, [role="banner"], footer, [role="contentinfo"], aside, [role="complementary"]')
    .slice(0, 6)
    .each((_, el) => {
      const role = normalizeRole($, el);
      const name = nameOf($, el) || role;
      push({
        journeyStepId: step.id,
        triggerAction: 'landmark-discovery',
        announced: `${role} landmark${name !== role ? `, ${name}` : ''}`,
        plainEnglish: `Screen reader enters the ${name} area.`,
        technical: `role=${role}; name=${name}; landmark=${role}`,
        source: {
          role,
          name,
          landmark: role,
          selectorHint: selectorHint($, el),
        },
        confidence: 0.82,
      });
    });

  $('h1, h2, h3').slice(0, 8).each((_, el) => {
    const role = 'heading';
    const level = (el as { tagName?: string }).tagName?.toLowerCase()?.replace('h', '') || '?';
    const name = nameOf($, el);
    if (!name) return;
    push({
      journeyStepId: step.id,
      triggerAction: 'virtual-cursor-next-heading',
      announced: `heading level ${level}, ${name}`,
      plainEnglish: `User hears heading: ${name}.`,
      technical: `role=heading; level=${level}; name=${name}`,
      source: {
        role,
        name,
        state: `level-${level}`,
        landmark: nearestLandmark($, el),
        selectorHint: selectorHint($, el),
      },
      confidence: 0.88,
    });
  });

  $('a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="link"]')
    .slice(0, 14)
    .each((_, el) => {
      const role = normalizeRole($, el);
      const name = nameOf($, el) || '[unlabeled control]';
      const state = stateOf($, el);
      push({
        journeyStepId: step.id,
        triggerAction: 'focus-move',
        announced: `${name}, ${role}${state ? `, ${state}` : ''}`,
        plainEnglish: `Focus moves to ${name} (${role}${state ? `, ${state}` : ''}).`,
        technical: `role=${role}; name=${name}; state=${state || 'none'}; landmark=${nearestLandmark($, el) || 'none'}`,
        source: {
          role,
          name,
          state,
          landmark: nearestLandmark($, el),
          selectorHint: selectorHint($, el),
        },
        confidence: 0.86,
      });
    });

  $('[aria-live], [role="alert"], [role="status"]').slice(0, 6).each((_, el) => {
    const region = $(el).attr('aria-live') || normalizeRole($, el);
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (!text) return;
    push({
      journeyStepId: step.id,
      triggerAction: 'live-region-update',
      announced: text,
      plainEnglish: `A dynamic update is announced: ${text}`,
      technical: `live-region=${region}; announced=${text}`,
      source: {
        role: normalizeRole($, el),
        name: nameOf($, el) || '[live region]',
        liveRegion: region,
        selectorHint: selectorHint($, el),
      },
      confidence: 0.76,
    });
  });

  const confusionFlags = detectConfusionFlags($, events, step.id, finalUrl, journeyRun.steps[0]?.url || finalUrl);
  const plainEnglishSummary = summarizePlain(events, confusionFlags);
  const technicalSummary = summarizeTechnical(events, confusionFlags);

  return {
    runId: journeyRun.id,
    generatedAt: Date.now(),
    confidence: Number((events.reduce((acc, e) => acc + e.confidence, 0) / Math.max(events.length, 1)).toFixed(2)),
    events,
    confusionFlags,
    plainEnglishSummary,
    technicalSummary,
    export: {
      json: JSON.stringify({ runId: journeyRun.id, events, confusionFlags, plainEnglishSummary, technicalSummary }, null, 2),
      text: asText(events, confusionFlags, plainEnglishSummary, technicalSummary),
    },
  };
}

function detectConfusionFlags(
  $: CheerioRoot,
  events: TranscriptEvent[],
  stepId: string,
  finalUrl: string,
  stepUrl: string
): ConfusionFlag[] {
  const flags: ConfusionFlag[] = [];
  const seenNames = new Map<string, string[]>();

  for (const event of events) {
    if (event.source.role !== 'button' && event.source.role !== 'link' && event.source.role !== 'textbox') continue;
    const norm = event.source.name.toLowerCase().trim();
    if (!norm || norm === '[unlabeled control]') continue;
    const ids = seenNames.get(norm) || [];
    ids.push(event.id);
    seenNames.set(norm, ids);
  }

  for (const [name, ids] of seenNames.entries()) {
    if (ids.length >= 3) {
      flags.push({
        id: `flag-${flags.length + 1}`,
        type: 'duplicate-labels',
        severity: 'medium',
        rationale: `"${name}" is announced ${ids.length} times and may be hard to disambiguate.`,
        suggestedRemediation: 'Differentiate accessible names with context (e.g., "Edit billing address").',
        journeyStepId: stepId,
        relatedEventIds: ids,
      });
    }

    if (NON_DESCRIPTIVE.has(name)) {
      flags.push({
        id: `flag-${flags.length + 1}`,
        type: 'non-descriptive-control-name',
        severity: 'high',
        rationale: `Control label "${name}" does not communicate purpose.`,
        suggestedRemediation: 'Use action-oriented, specific accessible names.',
        journeyStepId: stepId,
        relatedEventIds: ids,
      });
    }
  }

  const hasLandmark = events.some((e) => !!e.source.landmark);
  if (!hasLandmark || normalizeUrl(finalUrl) !== normalizeUrl(stepUrl)) {
    flags.push({
      id: `flag-${flags.length + 1}`,
      type: 'context-loss-after-route-change',
      severity: 'high',
      rationale: 'Route context changed or landmark context is missing after transition.',
      suggestedRemediation: 'Move focus to a heading/main landmark and announce route change.',
      journeyStepId: stepId,
      relatedEventIds: events.slice(0, 2).map((e) => e.id),
    });
  }

  const focusEvents = events.filter((e) => e.triggerAction === 'focus-move');
  if (focusEvents.length >= 3) {
    const firstThree = focusEvents.slice(0, 3);
    const landmarks = new Set(firstThree.map((f) => f.source.landmark || 'none'));
    if (landmarks.size > 1) {
      flags.push({
        id: `flag-${flags.length + 1}`,
        type: 'focus-jump-without-explanation',
        severity: 'medium',
        rationale: 'Early focus order crosses regions abruptly with no explicit explanation.',
        suggestedRemediation: 'Stabilize focus order and announce region transitions with headings/aria-live.',
        journeyStepId: stepId,
        relatedEventIds: firstThree.map((f) => f.id),
      });
    }
  }

  $('input, textarea, select').each((_, el) => {
    const label = nameOf($, el);
    if (!label) {
      const hint = selectorHint($, el);
      const related = events.find((e) => e.source.selectorHint === hint);
      flags.push({
        id: `flag-${flags.length + 1}`,
        type: 'non-descriptive-control-name',
        severity: 'high',
        rationale: 'A form control appears unlabeled in the accessible name computation.',
        suggestedRemediation: 'Associate a <label> or aria-label/aria-labelledby to this field.',
        journeyStepId: stepId,
        relatedEventIds: related ? [related.id] : [],
      });
    }
  });

  return flags;
}

function normalizeRole($: CheerioRoot, el: cheerio.Element): string {
  const role = $(el).attr('role');
  if (role) return role;
  const tag = (el as { tagName?: string }).tagName?.toLowerCase() || '';
  if (tag === 'a') return 'link';
  if (tag === 'button') return 'button';
  if (tag === 'input' || tag === 'textarea') return 'textbox';
  if (tag === 'select') return 'combobox';
  if (/^h[1-6]$/.test(tag)) return 'heading';
  return tag || 'generic';
}

function nameOf($: CheerioRoot, el: cheerio.Element): string {
  const $el = $(el);
  const ariaLabel = $el.attr('aria-label')?.trim();
  if (ariaLabel) return ariaLabel;

  const labelledBy = $el.attr('aria-labelledby');
  if (labelledBy) {
    const joined = labelledBy
      .split(/\s+/)
      .map((id) => $(`#${id}`).text().trim())
      .filter(Boolean)
      .join(' ');
    if (joined) return joined;
  }

  const id = $el.attr('id');
  if (id) {
    const label = $(`label[for="${id}"]`).first().text().trim();
    if (label) return label;
  }

  const fallback = $el.text().replace(/\s+/g, ' ').trim();
  if (fallback) return fallback;

  const placeholder = $el.attr('placeholder')?.trim();
  if (placeholder) return placeholder;

  const alt = $el.attr('alt')?.trim();
  return alt || '';
}

function stateOf($: CheerioRoot, el: cheerio.Element): string | undefined {
  const $el = $(el);
  const states: string[] = [];
  if ($el.attr('disabled') !== undefined || $el.attr('aria-disabled') === 'true') states.push('disabled');
  if ($el.attr('aria-expanded')) states.push(`expanded=${$el.attr('aria-expanded')}`);
  if ($el.attr('aria-checked')) states.push(`checked=${$el.attr('aria-checked')}`);
  if ($el.attr('required') !== undefined || $el.attr('aria-required') === 'true') states.push('required');
  const value = $el.attr('value');
  if (value && value.length < 35) states.push(`value=${redactValue(value)}`);
  return states.length ? states.join(', ') : undefined;
}

function nearestLandmark($: CheerioRoot, el: cheerio.Element): string | undefined {
  const landmark = $(el).parents('main, nav, header, footer, aside, [role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"]').first();
  if (!landmark.length) return undefined;
  return normalizeRole($, landmark.get(0));
}

function selectorHint($: CheerioRoot, el: cheerio.Element): string {
  const $el = $(el);
  const id = $el.attr('id');
  if (id) return `#${id}`;
  const role = normalizeRole($, el);
  const name = nameOf($, el);
  return `${role}${name ? `:${name.slice(0, 35)}` : ''}`;
}

function summarizePlain(events: TranscriptEvent[], flags: ConfusionFlag[]): string {
  const lead = events.slice(0, 3).map((e) => e.plainEnglish).join(' ');
  if (!lead) return 'Not enough transcript data was captured to describe the user experience.';
  return `${lead} ${flags.length > 0 ? `The run includes ${flags.length} confusion moments likely to slow task completion.` : 'No major confusion moments were detected in this MVP simulation.'}`;
}

function summarizeTechnical(events: TranscriptEvent[], flags: ConfusionFlag[]): string {
  const live = events.filter((e) => e.triggerAction === 'live-region-update').length;
  const focus = events.filter((e) => e.triggerAction === 'focus-move').length;
  return `events=${events.length}; focusMoves=${focus}; liveRegionAnnouncements=${live}; confusionFlags=${flags.length}`;
}

function asText(events: TranscriptEvent[], flags: ConfusionFlag[], plain: string, technical: string): string {
  const lines: string[] = [];
  lines.push('Screen-reader Simulation Transcript');
  lines.push('');
  lines.push('Plain-English summary:');
  lines.push(plain);
  lines.push('');
  lines.push('Technical summary:');
  lines.push(technical);
  lines.push('');
  lines.push('Announcement timeline:');
  for (const e of events) {
    lines.push(`- [${e.journeyStepId}] ${e.announced}`);
  }
  if (flags.length) {
    lines.push('');
    lines.push('Confusion flags:');
    for (const flag of flags) {
      lines.push(`- (${flag.severity}) ${flag.type}: ${flag.rationale}`);
    }
  }
  return lines.join('\n');
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, '');
  } catch {
    return url;
  }
}

function redactValue(value: string): string {
  if (value.includes('@')) return '[redacted-email]';
  if (/\d{3,}/.test(value)) return '[redacted-number]';
  return value;
}

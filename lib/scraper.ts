import * as cheerio from 'cheerio';
import axios from 'axios';

export interface ScrapedPage {
  url: string;
  title: string;
  html: string;
  condensedHtml: string;
  images: ImageInfo[];
  links: LinkInfo[];
  forms: FormInfo[];
  headings: HeadingInfo[];
  mediaElements: MediaInfo[];
  interactiveElements: InteractiveInfo[];
  ariaLandmarks: string[];
  metaInfo: MetaInfo;
}

interface ImageInfo {
  src: string;
  alt: string | undefined;
  hasAlt: boolean;
  isDecorative: boolean;
  width?: number;
  height?: number;
}

interface LinkInfo {
  href: string;
  text: string;
  hasText: boolean;
  isGeneric: boolean;
}

interface FormInfo {
  id?: string;
  inputs: Array<{
    type: string;
    name?: string;
    id?: string;
    hasLabel: boolean;
    placeholder?: string;
    ariaLabel?: string;
  }>;
}

interface HeadingInfo {
  level: number;
  text: string;
}

interface MediaInfo {
  type: 'video' | 'audio' | 'iframe';
  src?: string;
  hasCaptions: boolean;
  hasTranscript: boolean;
  autoplay: boolean;
}

interface InteractiveInfo {
  tag: string;
  text: string;
  ariaLabel?: string;
  estimatedWidth?: number;
  estimatedHeight?: number;
  isIconOnly: boolean;
}

interface MetaInfo {
  hasViewport: boolean;
  viewportContent?: string;
  lang?: string;
  hasSkipNav: boolean;
}

const GENERIC_LINK_TEXT = [
  'click here',
  'here',
  'read more',
  'more',
  'link',
  'learn more',
  'click',
  'go',
];

/** Scrape using a pre-rendered HTML string (from Playwright). Preferred over scrapePage. */
export async function scrapeFromHtml(url: string, rawHtml: string): Promise<ScrapedPage> {
  return _parse(url, rawHtml);
}

/** Scrape by fetching the URL with axios (raw HTML only — no JS rendering). */
export async function scrapePage(url: string): Promise<ScrapedPage> {
  const response = await axios.get(url, {
    timeout: 15000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; InclusionLens/1.0; Accessibility Auditor)',
      Accept: 'text/html,application/xhtml+xml',
    },
    maxRedirects: 5,
  });
  return _parse(url, response.data);
}

async function _parse(url: string, rawHtml: string): Promise<ScrapedPage> {
  const $ = cheerio.load(rawHtml);

  // Remove script and style tags to reduce noise
  $('script, style, noscript, template').remove();

  const title = $('title').text().trim() || $('h1').first().text().trim() || url;

  // Extract images
  const images: ImageInfo[] = [];
  $('img').each((_, el) => {
    const alt = $(el).attr('alt');
    const role = $(el).attr('role');
    const ariaHidden = $(el).attr('aria-hidden');
    images.push({
      src: $(el).attr('src') || '',
      alt,
      hasAlt: alt !== undefined,
      isDecorative: role === 'presentation' || ariaHidden === 'true' || alt === '',
      width: $(el).attr('width') ? parseInt($(el).attr('width')!) : undefined,
      height: $(el).attr('height') ? parseInt($(el).attr('height')!) : undefined,
    });
  });

  // Extract links
  const links: LinkInfo[] = [];
  $('a[href]').each((_, el) => {
    const text = $(el).text().trim();
    const ariaLabel = $(el).attr('aria-label') || $(el).attr('title');
    const effectiveText = ariaLabel || text;
    links.push({
      href: $(el).attr('href') || '',
      text: effectiveText,
      hasText: effectiveText.length > 0,
      isGeneric: GENERIC_LINK_TEXT.includes(effectiveText.toLowerCase()),
    });
  });

  // Extract forms
  const forms: FormInfo[] = [];
  $('form').each((_, form) => {
    const inputs: FormInfo['inputs'] = [];
    $(form)
      .find('input, textarea, select')
      .each((_, input) => {
        const id = $(input).attr('id');
        const ariaLabel = $(input).attr('aria-label') || $(input).attr('aria-labelledby');
        const hasLabel = !!(id && $(`label[for="${id}"]`).length > 0) || !!ariaLabel;
        inputs.push({
          type: $(input).attr('type') || $(input).prop('tagName')?.toLowerCase() || 'input',
          name: $(input).attr('name'),
          id,
          hasLabel,
          placeholder: $(input).attr('placeholder'),
          ariaLabel,
        });
      });
    forms.push({ id: $(form).attr('id'), inputs });
  });

  // Extract headings
  const headings: HeadingInfo[] = [];
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tag: string = (el as any).tagName || (el as any).name || 'h1';
    headings.push({
      level: parseInt(tag.replace('h', '')),
      text: $(el).text().trim(),
    });
  });

  // Extract media elements
  const mediaElements: MediaInfo[] = [];
  $('video').each((_, el) => {
    const hasCaptions = $(el).find('track[kind="captions"], track[kind="subtitles"]').length > 0;
    mediaElements.push({
      type: 'video',
      src: $(el).attr('src') || $(el).find('source').first().attr('src'),
      hasCaptions,
      hasTranscript: false, // can't reliably detect this from HTML alone
      autoplay: $(el).attr('autoplay') !== undefined,
    });
  });
  $('audio').each((_, el) => {
    mediaElements.push({
      type: 'audio',
      src: $(el).attr('src') || $(el).find('source').first().attr('src'),
      hasCaptions: false,
      hasTranscript: false,
      autoplay: $(el).attr('autoplay') !== undefined,
    });
  });
  $('iframe').each((_, el) => {
    const src = $(el).attr('src') || '';
    mediaElements.push({
      type: 'iframe',
      src,
      hasCaptions: src.includes('youtube') || src.includes('vimeo') ? false : true,
      hasTranscript: false,
      autoplay: false,
    });
  });

  // Extract interactive elements
  const interactiveElements: InteractiveInfo[] = [];
  $('button, [role="button"], input[type="submit"], input[type="button"], a[href]').each(
    (_, el) => {
      const text = $(el).text().trim();
      const ariaLabel = $(el).attr('aria-label');
      const hasImg = $(el).find('img').length > 0;
      const hasSvg = $(el).find('svg').length > 0;
      const effectiveText = ariaLabel || text;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elemTag: string = (el as any).tagName || (el as any).name || 'button';
      interactiveElements.push({
        tag: elemTag,
        text: effectiveText,
        ariaLabel,
        isIconOnly: (!effectiveText || effectiveText.length === 0) && (hasImg || hasSvg),
      });
    }
  );

  // Check ARIA landmarks
  const ariaLandmarks: string[] = [];
  const landmarkSelectors = [
    '[role="main"]', 'main',
    '[role="navigation"]', 'nav',
    '[role="banner"]', 'header',
    '[role="contentinfo"]', 'footer',
    '[role="search"]',
    '[role="complementary"]', 'aside',
  ];
  const seenLandmarks = new Set<string>();
  landmarkSelectors.forEach((sel) => {
    if ($(sel).length > 0) {
      const normalized = sel.replace(/\[role="(.+)"\]/, '$1').replace(/[^a-z]/g, '');
      if (!seenLandmarks.has(normalized)) {
        seenLandmarks.add(normalized);
        ariaLandmarks.push(normalized);
      }
    }
  });

  // Meta info
  const viewportMeta = $('meta[name="viewport"]').attr('content');
  const hasSkipNav =
    $('a[href^="#"]:first-of-type').length > 0 ||
    $('[class*="skip"], [id*="skip"]').length > 0;

  const metaInfo: MetaInfo = {
    hasViewport: !!viewportMeta,
    viewportContent: viewportMeta,
    lang: $('html').attr('lang'),
    hasSkipNav,
  };

  // Build condensed HTML for Claude (strip to just structure + attributes)
  const condensedHtml = buildCondensedHtml(rawHtml);

  return {
    url,
    title,
    html: $.html(),
    condensedHtml,
    images,
    links,
    forms,
    headings,
    mediaElements,
    interactiveElements,
    ariaLandmarks,
    metaInfo,
  };
}

function buildCondensedHtml(rawHtml: string): string {
  const $2 = cheerio.load(rawHtml);

  // Remove heavy/noisy elements
  $2('script, style, noscript, template').remove();
  $2('svg path, svg rect, svg circle, svg polygon, svg line, svg polyline, svg ellipse').remove();

  // Keep only meaningful attributes
  const KEEP_ATTRS = new Set([
    'id', 'class', 'href', 'src', 'alt', 'type', 'name', 'role',
    'aria-label', 'aria-labelledby', 'aria-describedby', 'aria-hidden',
    'aria-expanded', 'aria-required', 'aria-invalid',
    'lang', 'for', 'tabindex', 'autocomplete', 'placeholder',
    'width', 'height', 'colspan', 'rowspan', 'scope', 'headers',
    'autoplay', 'controls', 'muted', 'loop', 'kind', 'srclang',
  ]);

  $2('*').each((_, el) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attribs = (el as any).attribs;
    if (!attribs) return;
    Object.keys(attribs).forEach((attr) => {
      if (!KEEP_ATTRS.has(attr)) {
        delete attribs[attr];
      }
    });
  });

  // Truncate to ~50k chars to stay under token limits
  const html = $2.html();
  return html.length > 50000 ? html.slice(0, 50000) + '\n<!-- [HTML truncated for analysis] -->' : html;
}

export function buildPageSummary(page: ScrapedPage): string {
  const missingAlt = page.images.filter((i) => !i.hasAlt && !i.isDecorative).length;
  const genericLinks = page.links.filter((l) => l.isGeneric).length;
  const unlabeledInputs = page.forms.flatMap((f) => f.inputs).filter((i) => !i.hasLabel).length;
  const videosNoCaptions = page.mediaElements.filter(
    (m) => m.type === 'video' && !m.hasCaptions
  ).length;

  return `
PAGE SUMMARY FOR: ${page.url}
Title: ${page.title}
Language attribute: ${page.metaInfo.lang || 'MISSING'}
Viewport meta: ${page.metaInfo.hasViewport ? page.metaInfo.viewportContent : 'MISSING'}
Skip navigation: ${page.metaInfo.hasSkipNav ? 'Present' : 'MISSING'}
ARIA landmarks present: ${page.ariaLandmarks.join(', ') || 'NONE'}

HEADING STRUCTURE:
${page.headings.map((h) => `  ${'#'.repeat(h.level)} ${h.text}`).join('\n') || '  No headings found'}

IMAGES (${page.images.length} total):
  Missing alt text: ${missingAlt}
  Decorative (correct): ${page.images.filter((i) => i.isDecorative).length}
  With meaningful alt: ${page.images.filter((i) => i.hasAlt && !i.isDecorative).length}

LINKS (${page.links.length} total):
  Generic/non-descriptive: ${genericLinks}
  Without any text: ${page.links.filter((l) => !l.hasText).length}

FORMS:
  Total inputs: ${page.forms.flatMap((f) => f.inputs).length}
  Unlabeled inputs: ${unlabeledInputs}

MEDIA:
  Videos: ${page.mediaElements.filter((m) => m.type === 'video').length} (${videosNoCaptions} without captions)
  Audio: ${page.mediaElements.filter((m) => m.type === 'audio').length}
  Iframes: ${page.mediaElements.filter((m) => m.type === 'iframe').length}

INTERACTIVE ELEMENTS:
  Icon-only buttons (no label): ${page.interactiveElements.filter((i) => i.isIconOnly).length}
  Total interactive: ${page.interactiveElements.length}
`.trim();
}

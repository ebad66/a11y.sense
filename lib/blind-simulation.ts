import * as cheerio from 'cheerio';
import axios from 'axios';

interface SRElement {
  kind: 'landmark' | 'heading' | 'link' | 'image' | 'button' | 'input' | 'text' | 'list';
  text: string;
  level?: number;
  href?: string;
  hasAlt?: boolean;
  src?: string;
  isLinked?: boolean;
  inputType?: string;
}

interface WalkState {
  elements: SRElement[];
  mainFound: boolean;
  tabStopsBeforeMain: number;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function walkNode($: any, node: any, state: WalkState): void {
  if (!node || node.type !== 'tag') return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tag: string = (node as any).tagName?.toLowerCase() ?? '';
  const el = node;
  if (!tag) return;
  const $el = $(el);

  if (['script', 'style', 'noscript', 'template', 'svg'].includes(tag)) return;
  if ($el.attr('aria-hidden') === 'true') return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recurse = () => $el.contents().each((_: any, child: any) => walkNode($, child, state));

  switch (tag) {
    case 'main':
      state.mainFound = true;
      state.elements.push({ kind: 'landmark', text: 'main' });
      recurse();
      break;

    case 'nav':
      state.elements.push({ kind: 'landmark', text: 'navigation' });
      recurse();
      break;

    case 'header':
      state.elements.push({ kind: 'landmark', text: 'banner' });
      recurse();
      break;

    case 'footer':
      state.elements.push({ kind: 'landmark', text: 'contentinfo' });
      recurse();
      break;

    case 'aside':
      state.elements.push({ kind: 'landmark', text: 'complementary' });
      recurse();
      break;

    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      const text = $el.text().trim();
      if (text) state.elements.push({ kind: 'heading', text, level: parseInt(tag[1]) });
      break;
    }

    case 'a': {
      const href = $el.attr('href') || '';
      if (!href || href.startsWith('javascript:')) {
        recurse();
        break;
      }
      const ariaLabel = $el.attr('aria-label') || $el.attr('title');
      const linkText = (ariaLabel || $el.text()).trim();
      const img = $el.find('img').first();

      if (!linkText && img.length > 0) {
        const alt = img.attr('alt');
        state.elements.push({
          kind: 'image',
          text: alt || '',
          hasAlt: !!alt && alt !== '',
          src: img.attr('src'),
          isLinked: true,
        });
      } else if (linkText) {
        state.elements.push({ kind: 'link', text: linkText.slice(0, 80), href });
      }
      if (!state.mainFound) state.tabStopsBeforeMain++;
      break;
    }

    case 'img': {
      if ($el.parents('a').length > 0) break; // already handled in link case
      if ($el.attr('role') === 'presentation') break;
      const alt = $el.attr('alt');
      state.elements.push({
        kind: 'image',
        text: alt || '',
        hasAlt: alt !== undefined && alt !== '',
        src: $el.attr('src') || '',
        isLinked: false,
      });
      break;
    }

    case 'button': {
      const ariaLabel = $el.attr('aria-label') || $el.attr('title');
      const text = (ariaLabel || $el.text()).trim();
      state.elements.push({ kind: 'button', text: text || '[unlabeled button]' });
      if (!state.mainFound) state.tabStopsBeforeMain++;
      break;
    }

    case 'input':
    case 'select':
    case 'textarea': {
      const inputType = $el.attr('type') || tag;
      if (inputType === 'hidden') break;
      const id = $el.attr('id');
      const ariaLabel = $el.attr('aria-label');
      const placeholder = $el.attr('placeholder');
      let label = ariaLabel || placeholder || '';
      if (id && !label) {
        const lbl = $(`label[for="${id}"]`);
        if (lbl.length) label = lbl.text().trim();
      }
      const required =
        $el.attr('required') !== undefined || $el.attr('aria-required') === 'true';
      state.elements.push({
        kind: 'input',
        text: `${label || 'unlabeled'}${required ? ', required' : ''}`,
        inputType,
      });
      if (!state.mainFound) state.tabStopsBeforeMain++;
      break;
    }

    case 'ul':
    case 'ol': {
      if ($el.parents('ul, ol').length > 0) {
        recurse();
        break;
      }
      const count = $el.children('li').length;
      if (count > 0) state.elements.push({ kind: 'list', text: `${count} items` });
      recurse();
      break;
    }

    case 'p': {
      const text = $el.text().trim();
      if (text.length > 20) {
        state.elements.push({
          kind: 'text',
          text: text.slice(0, 120) + (text.length > 120 ? '…' : ''),
        });
      }
      break; // don't recurse into paragraphs — avoids double-processing inline elements
    }

    default:
      recurse();
  }
}

function renderLine(n: number, el: SRElement): string {
  switch (el.kind) {
    case 'landmark':
      return `<div class="line landmark">${n}.&nbsp;[LANDMARK: ${esc(el.text)}]</div>`;

    case 'heading':
      return `<div class="line heading">${n}.&nbsp;[HEADING ${el.level}]: ${esc(el.text)}</div>`;

    case 'link': {
      const href = el.href || '';
      const shortHref = href.length > 55 ? href.slice(0, 55) + '…' : href;
      return `<div class="line link">${n}.&nbsp;[LINK]: ${esc(el.text)} <span class="dim">→ ${esc(shortHref)}</span></div>`;
    }

    case 'text':
      return `<div class="line text">${n}.&nbsp;[TEXT]: ${esc(el.text)}</div>`;

    case 'button':
      return `<div class="line btn">${n}.&nbsp;[BUTTON]: ${esc(el.text)}</div>`;

    case 'input': {
      const t = (el.inputType || 'text').toUpperCase();
      return `<div class="line btn">${n}.&nbsp;[INPUT ${esc(t)}]: ${esc(el.text)}</div>`;
    }

    case 'list':
      return `<div class="line structural">${n}.&nbsp;[LIST]: ${esc(el.text)}</div>`;

    case 'image': {
      if (el.hasAlt) {
        return `<div class="line text">${n}.&nbsp;[IMAGE]: ${esc(el.text)}</div>`;
      }
      const src = el.src || '';
      const filename = src.split('/').pop()?.split('?')[0] || 'image';
      const msg = el.isLinked
        ? 'destination unknown \u2014 could be anything or nowhere'
        : `${filename.slice(0, 36)} \u2014 completely invisible`;
      const pad = Math.max(0, 44 - msg.length);
      return [
        `<div class="line image-bad">${n}.&nbsp;[IMAGE]: <span class="strike">no alt text</span></div>`,
        `<div class="box-bad">\u2554${'═'.repeat(46)}\u2557`,
        `\u2551 ${esc(msg)}${' '.repeat(pad)} \u2551`,
        `\u255a${'═'.repeat(46)}\u255d</div>`,
      ].join('\n');
    }

    default:
      return '';
  }
}

export async function generateBlindSimulationHtml(url: string): Promise<string> {
  let rawHtml = '';
  let domain = url;

  try {
    domain = new URL(url).hostname;
  } catch {
    /* keep url as domain */
  }

  try {
    const resp = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; InclusionLens/1.0; Accessibility Auditor)',
        Accept: 'text/html,application/xhtml+xml',
      },
      maxRedirects: 5,
    });
    rawHtml = resp.data;
  } catch (err) {
    rawHtml = `<html><body><h1>Could not fetch page: ${(err as Error).message}</h1></body></html>`;
  }

  const $ = cheerio.load(rawHtml);

  const state: WalkState = { elements: [], mainFound: false, tabStopsBeforeMain: 0 };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $('body').contents().each((_: any, child: any) => walkNode($, child, state));

  const { elements, tabStopsBeforeMain } = state;
  const lineHtml = elements.map((el, i) => renderLine(i + 1, el)).filter(Boolean).join('\n');
  const total = elements.length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Screen Reader \u2014 ${esc(domain)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0f1117;
    color: #c4b5fd;
    font-family: 'Courier New', Courier, monospace;
    font-size: 13px;
    line-height: 1.75;
    min-height: 100vh;
    overflow-x: hidden;
  }
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0,0,0,0.06) 2px,
      rgba(0,0,0,0.06) 4px
    );
    pointer-events: none;
    z-index: 999;
  }
  .topbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 14px;
    background: #090b10;
    border-bottom: 1px solid #1a1a30;
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .logo  { color: #a78bfa; font-weight: bold; }
  .sep   { color: #252540; }
  .sub   { color: #4b5068; font-size: 12px; }
  .dom   { margin-left: auto; color: #3a3a5c; font-size: 11px; }
  .focus-bar {
    margin: 12px 14px 4px;
    padding: 6px 11px;
    border: 1px solid #7c3aed;
    color: #a78bfa;
    font-weight: bold;
    font-size: 12px;
    display: inline-block;
  }
  .tab-box {
    margin: 8px 14px 14px;
    padding: 7px 12px;
    background: rgba(255,215,0,0.07);
    border: 1px solid #ffd700;
    color: #ffd700;
    font-size: 12px;
    font-weight: bold;
  }
  .stream { padding: 0 14px 60px; }
  .line, .box-bad { display: none; padding: 1px 0; }
  .landmark   { color: #a78bfa; }
  .heading    { color: #a78bfa; font-weight: bold; }
  .link       { color: #818cf8; }
  .btn        { color: #818cf8; }
  .text       { color: #c4b5fd; }
  .structural { color: #6b7280; }
  .image-bad  { color: #f87171; }
  .dim        { color: #4b5068; }
  .strike     { text-decoration: line-through; opacity: 0.7; }
  .box-bad {
    margin: 1px 0 5px 18px;
    color: #f87171;
    font-size: 12px;
    white-space: pre;
    line-height: 1.6;
  }
  .end-marker {
    display: none;
    color: #252540;
    margin-top: 20px;
    padding-bottom: 10px;
  }
  .cursor {
    display: inline-block;
    width: 7px;
    height: 13px;
    background: #00ff41;
    vertical-align: middle;
    animation: blink 1s step-end infinite;
    margin-left: 3px;
  }
  @keyframes blink { 50% { opacity: 0; } }
</style>
</head>
<body>

<div class="topbar">
  <span>🔍</span>
  <span class="logo">InclusionLens</span>
  <span class="sep">&middot;</span>
  <span class="sub">Blind simulation</span>
  <span class="dom">${esc(domain)}</span>
</div>

<div class="focus-bar">&#9654; FOCUS IS HERE &mdash; element 1</div>

<div class="tab-box">&#9888; ${tabStopsBeforeMain} TAB STOPS BEFORE MAIN CONTENT &mdash; Tab must be pressed ${tabStopsBeforeMain} times before reaching any content</div>

<div class="stream" id="stream">
${lineHtml}
<div class="end-marker" id="end-marker">&mdash;&mdash; END OF PAGE (${total} elements) &mdash;&mdash;&mdash;&mdash;&mdash;<span class="cursor"></span></div>
</div>

<script>
(function () {
  var nodes = document.getElementById('stream').querySelectorAll('.line, .box-bad, .end-marker');
  var i = 0;
  function next() {
    if (i >= nodes.length) return;
    nodes[i].style.display = 'block';
    i++;
    window.scrollTo(0, document.body.scrollHeight);
    setTimeout(next, 260 + Math.random() * 140);
  }
  setTimeout(next, 500);
})();
</script>

</body>
</html>`;
}

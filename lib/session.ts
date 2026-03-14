import { AccessibilityIssue } from './claude';
import { ScrapedPage } from './scraper';
import { ElementBox } from './screenshot';

export interface ScanSession {
  sessionId: string;
  url: string;
  pageTitle: string;
  createdAt: number;
  expiresAt: number;
  issues: Record<string, AccessibilityIssue[]>;
  screenshot?: string; // base64
  screenshotMime?: string;
  screenshotWidth?: number;
  screenshotHeight?: number;
  /** selector → bounding box (percentages of full page), resolved during scan */
  elementCoords?: Record<string, ElementBox>;
}

// In-memory store — use global to survive Next.js hot-reloads and cross-route module instances
const g = global as typeof global & { _sessions?: Map<string, ScanSession> };
if (!g._sessions) g._sessions = new Map<string, ScanSession>();
const sessions = g._sessions;

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function createSession(
  sessionId: string,
  url: string,
  page: ScrapedPage,
  issues: Record<string, AccessibilityIssue[]>,
  screenshot?: string,
  screenshotMime?: string,
  screenshotWidth?: number,
  screenshotHeight?: number,
  elementCoords?: Record<string, ElementBox>
): ScanSession {
  const now = Date.now();
  const session: ScanSession = {
    sessionId,
    url,
    pageTitle: page.title,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    issues,
    screenshot,
    screenshotMime,
    screenshotWidth,
    screenshotHeight,
    elementCoords,
  };
  sessions.set(sessionId, session);

  // Clean up expired sessions periodically
  scheduleCleanup();

  return session;
}

export function getSession(sessionId: string): ScanSession | null {
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }
  return session;
}

export function updateSessionScreenshot(
  sessionId: string,
  screenshot: string,
  mimeType: string
): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;
  session.screenshot = screenshot;
  session.screenshotMime = mimeType;
  return true;
}

let cleanupScheduled = false;
function scheduleCleanup() {
  if (cleanupScheduled) return;
  cleanupScheduled = true;
  setTimeout(() => {
    const now = Date.now();
    for (const [id, session] of sessions.entries()) {
      if (now > session.expiresAt) {
        sessions.delete(id);
      }
    }
    cleanupScheduled = false;
  }, 60 * 60 * 1000); // run every hour
}

import { AccessibilityIssue } from './claude';
import { ScrapedPage } from './scraper';
import { ElementBox } from './screenshot';
import { JourneyRun } from './journey';
import { JourneyTranscript } from './sr-transcript';

export interface SessionArtifact {
  artifactId: string;
  kind: 'exec-pdf';
  fileName: string;
  createdAt: number;
  contentType: 'application/pdf';
  dataBase64: string;
}

export interface BaselineSnapshot {
  score: number;
  blockerCount: number;
  riskScore: number;
  capturedAt: number;
}

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
  journeyRun?: JourneyRun;
  transcript?: JourneyTranscript;
  baseline?: BaselineSnapshot;
  artifacts: SessionArtifact[];
}

// In-memory store — use global to survive Next.js hot-reloads and cross-route module instances
const g = global as typeof global & {
  _sessions?: Map<string, ScanSession>;
  _latestBaselineByUrl?: Map<string, BaselineSnapshot>;
};
if (!g._sessions) g._sessions = new Map<string, ScanSession>();
if (!g._latestBaselineByUrl) g._latestBaselineByUrl = new Map<string, BaselineSnapshot>();
const sessions = g._sessions;
const latestBaselineByUrl = g._latestBaselineByUrl;

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
  elementCoords?: Record<string, ElementBox>,
  journeyRun?: JourneyRun,
  transcript?: JourneyTranscript
): ScanSession {
  const now = Date.now();
  const baseline = latestBaselineByUrl.get(url);
  const allIssues = Object.values(issues).flat();
  const criticalCount = allIssues.filter((i) => i.severity === 'Critical').length;
  const warningCount = allIssues.filter((i) => i.severity === 'Warning').length;
  const blockerCount = criticalCount + warningCount;
  const score = Math.max(0, 100 - (criticalCount * 10 + warningCount * 3));
  const riskScore = criticalCount * 12 + warningCount * 4;

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
    journeyRun,
    transcript,
    baseline,
    artifacts: [],
  };
  sessions.set(sessionId, session);
  latestBaselineByUrl.set(url, { score, blockerCount, riskScore, capturedAt: now });

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

export function addSessionArtifact(sessionId: string, artifact: SessionArtifact): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;
  session.artifacts.unshift(artifact);
  session.artifacts = session.artifacts.slice(0, 10);
  return true;
}

export function getSessionArtifact(sessionId: string, artifactId: string): SessionArtifact | null {
  const session = getSession(sessionId);
  if (!session) return null;
  return session.artifacts.find((a) => a.artifactId === artifactId) ?? null;
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

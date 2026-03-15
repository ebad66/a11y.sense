import net from 'node:net';

const MAX_URL_LENGTH = 2048;
const PRIVATE_HOST_SUFFIXES = ['.local', '.internal', '.lan', '.home.arpa'];

export type UrlValidationResult =
  | { ok: true; normalizedUrl: string }
  | { ok: false; code: 'BAD_REQUEST' | 'INVALID_URL' | 'URL_NOT_ALLOWED'; message: string };

export function validateAndNormalizeUrl(raw: unknown): UrlValidationResult {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { ok: false, code: 'BAD_REQUEST', message: 'URL is required.' };
  }

  const trimmed = raw.trim();
  if (trimmed.length > MAX_URL_LENGTH) {
    return {
      ok: false,
      code: 'INVALID_URL',
      message: `URL is too long. Maximum length is ${MAX_URL_LENGTH} characters.`,
    };
  }

  const candidate = /^(https?:)?\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, code: 'INVALID_URL', message: 'Invalid URL format.' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return {
      ok: false,
      code: 'URL_NOT_ALLOWED',
      message: 'Only http:// and https:// URLs are allowed.',
    };
  }

  if (!parsed.hostname) {
    return { ok: false, code: 'INVALID_URL', message: 'URL must include a hostname.' };
  }

  if (isPrivateHostname(parsed.hostname)) {
    return {
      ok: false,
      code: 'URL_NOT_ALLOWED',
      message: 'Private, local, or loopback hosts are not allowed.',
    };
  }

  return { ok: true, normalizedUrl: parsed.toString() };
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();

  if (host === 'localhost') return true;
  if (PRIVATE_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;

  if (!host.includes('.')) {
    // Bare intranet hostnames (e.g. "web01")
    return true;
  }

  const ipVersion = net.isIP(host);
  if (ipVersion === 4) return isPrivateIPv4(host);
  if (ipVersion === 6) return isPrivateIPv6(host);

  return false;
}

function isPrivateIPv4(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return (
    normalized === '::1' ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd')
  );
}

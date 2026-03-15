import { describe, expect, it } from 'vitest';
import { validateAndNormalizeUrl } from '../lib/url';

describe('validateAndNormalizeUrl', () => {
  it('normalizes scheme when omitted', () => {
    const result = validateAndNormalizeUrl('example.com/path');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalizedUrl).toBe('https://example.com/path');
    }
  });

  it('rejects unsupported protocols', () => {
    const result = validateAndNormalizeUrl('ftp://example.com');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('URL_NOT_ALLOWED');
    }
  });

  it('rejects localhost and private hosts', () => {
    const localhost = validateAndNormalizeUrl('http://localhost:3000');
    const privateIp = validateAndNormalizeUrl('http://192.168.0.10');

    expect(localhost.ok).toBe(false);
    expect(privateIp.ok).toBe(false);

    if (!localhost.ok) expect(localhost.code).toBe('URL_NOT_ALLOWED');
    if (!privateIp.ok) expect(privateIp.code).toBe('URL_NOT_ALLOWED');
  });

  it('rejects very long URLs', () => {
    const longPath = 'a'.repeat(2100);
    const result = validateAndNormalizeUrl(`https://example.com/${longPath}`);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('INVALID_URL');
    }
  });

  it('accepts public https URL', () => {
    const result = validateAndNormalizeUrl('https://www.w3.org/WAI/');
    expect(result.ok).toBe(true);
  });
});

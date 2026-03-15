export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'INVALID_URL'
  | 'URL_NOT_ALLOWED'
  | 'MISSING_CONFIG'
  | 'SESSION_NOT_FOUND'
  | 'SCAN_CAPTURE_FAILED'
  | 'SCAN_PARSE_FAILED'
  | 'SCAN_AUDIT_FAILED'
  | 'SCAN_TIMEOUT'
  | 'SCAN_UNEXPECTED'
  | 'SIMULATION_FAILED';

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    stage?: string;
    retryable?: boolean;
  };
}

export function makeApiError(
  code: ApiErrorCode,
  message: string,
  options?: { stage?: string; retryable?: boolean }
): ApiErrorBody {
  return {
    error: {
      code,
      message,
      stage: options?.stage,
      retryable: options?.retryable,
    },
  };
}

export function readApiErrorMessage(payload: unknown, fallback = 'Request failed'): string {
  if (!payload || typeof payload !== 'object') return fallback;

  const data = payload as {
    error?: string | { message?: string; code?: string; retryable?: boolean; stage?: string };
  };

  if (typeof data.error === 'string' && data.error.trim()) {
    return data.error;
  }

  if (data.error && typeof data.error === 'object' && typeof data.error.message === 'string') {
    return data.error.message;
  }

  return fallback;
}

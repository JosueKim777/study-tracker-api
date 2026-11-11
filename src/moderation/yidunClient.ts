// src/moderation/yidunClient.ts

import { randomInt } from 'node:crypto';
import { genSignature } from './signature';
import { ModerationVerdict, TextModerator } from './types';

export const DEFAULT_ENDPOINT = 'https://as.dun.163.com/v5/text/check';
// Yidun suggests 200ms-1s, which assumes a server inside mainland China.
// Measured from Sydney: TCP connect ~130ms + TLS ~300ms + response ~200ms ≈ 600ms per cold request,
// and the very first call (DNS + cold TLS) exceeded 1s. 3s leaves headroom; override with YIDUN_TIMEOUT_MS.
export const DEFAULT_TIMEOUT_MS = 3000;

export interface YidunConfig {
  secretId: string;
  secretKey: string;
  businessId: string;
  endpoint?: string;
  timeoutMs?: number;
}

// Thrown when Yidun answers but the body's `code` is not 200.
// Note: Yidun returns HTTP 200 even for errors like a bad signature,
// so the HTTP status alone is not enough to tell whether a call succeeded.
export class YidunApiError extends Error {
  constructor(public readonly code: number, message: string) {
    super(`Yidun API error ${code}: ${message}`);
    this.name = 'YidunApiError';
  }
}

// Thrown for transport-level problems: timeout, network failure, non-2xx HTTP, unreadable body
export class YidunTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'YidunTransportError';
  }
}

interface YidunResponse {
  code: number;
  msg: string;
  result?: {
    antispam?: {
      suggestion: number;
      labels?: { label: number }[];
    };
  };
}

// suggestion: 0 = pass, 1 = suspicious, 2 = reject
function toVerdict(suggestion: number): ModerationVerdict {
  if (suggestion === 0) return 'pass';
  if (suggestion === 1) return 'review';
  if (suggestion === 2) return 'reject';
  throw new YidunApiError(200, `Unexpected suggestion value ${suggestion}`);
}

type FetchFn = typeof fetch;

export class YidunTextModerator implements TextModerator {
  private readonly endpoint: string;
  private readonly timeoutMs: number;

  // fetchFn is injectable so tests can replace the real network call with a fake
  constructor(private readonly config: YidunConfig, private readonly fetchFn: FetchFn = fetch) {
    this.endpoint = config.endpoint ?? DEFAULT_ENDPOINT;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async check(content: string, dataId: string): Promise<ModerationVerdict> {
    const params: Record<string, string> = {
      secretId: this.config.secretId,
      businessId: this.config.businessId,
      version: 'v5.2',
      timestamp: String(Date.now()),
      nonce: String(randomInt(1, 2 ** 31 - 1)), // nonce + timestamp stop replay attacks
      dataId,
      content
    };
    params.signature = genSignature(params, this.config.secretKey);

    // AbortController cancels the request if Yidun does not answer in time
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchFn(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString(),
        signal: controller.signal
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new YidunTransportError(`Yidun request timed out after ${this.timeoutMs}ms`);
      }
      throw new YidunTransportError(`Yidun request failed: ${String(err)}`);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new YidunTransportError(`Yidun returned HTTP ${response.status}`);
    }

    let body: YidunResponse;
    try {
      body = (await response.json()) as YidunResponse;
    } catch {
      throw new YidunTransportError('Yidun response was not valid JSON');
    }

    if (body.code !== 200) {
      throw new YidunApiError(body.code, body.msg);
    }
    if (!body.result?.antispam) {
      throw new YidunApiError(body.code, 'Response is missing result.antispam');
    }
    return toVerdict(body.result.antispam.suggestion);
  }
}

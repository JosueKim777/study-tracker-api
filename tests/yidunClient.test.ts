// tests/yidunClient.test.ts

import {
  YidunTextModerator,
  YidunApiError,
  YidunTransportError,
  DEFAULT_ENDPOINT
} from '../src/moderation/yidunClient';
import { genSignature } from '../src/moderation/signature';

const config = { secretId: 'sid', secretKey: 'skey', businessId: 'bid' };

// Builds a fake fetch that records the request and returns the given JSON body
function fakeFetch(body: unknown, status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

function okBody(suggestion: number) {
  return { code: 200, msg: 'ok', result: { antispam: { suggestion, labels: [] } } };
}

describe('YidunTextModerator request', () => {
  test('Should POST a signed form-urlencoded request to the v5 endpoint', async () => {
    const { fn, calls } = fakeFetch(okBody(0));
    await new YidunTextModerator(config, fn).check('hello', 'data-1');

    expect(calls).toHaveLength(1);
    const { url, init } = calls[0];
    expect(url).toBe(DEFAULT_ENDPOINT);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' });

    const sent = Object.fromEntries(new URLSearchParams(init.body as string));
    expect(sent).toMatchObject({
      secretId: 'sid',
      businessId: 'bid',
      version: 'v5.2',
      dataId: 'data-1',
      content: 'hello'
    });
    expect(sent.timestamp).toMatch(/^\d{13}$/);
    expect(sent.nonce).toMatch(/^\d+$/);
    // The signature must be valid for exactly the parameters that were sent
    const { signature, ...rest } = sent;
    expect(signature).toBe(genSignature(rest, 'skey'));
    // The secret key itself must never be sent
    expect(init.body as string).not.toContain('skey');
  });

  test('Should use a custom endpoint when configured', async () => {
    const { fn, calls } = fakeFetch(okBody(0));
    await new YidunTextModerator({ ...config, endpoint: 'https://example.test/check' }, fn).check(
      'x',
      'd'
    );
    expect(calls[0].url).toBe('https://example.test/check');
  });
});

describe('YidunTextModerator verdicts', () => {
  test.each([
    [0, 'pass'],
    [1, 'review'],
    [2, 'reject']
  ])('Should map suggestion %i to %s', async (suggestion, verdict) => {
    const { fn } = fakeFetch(okBody(suggestion));
    await expect(new YidunTextModerator(config, fn).check('x', 'd')).resolves.toBe(verdict);
  });

  test('Should reject an unknown suggestion value', async () => {
    const { fn } = fakeFetch(okBody(9));
    await expect(new YidunTextModerator(config, fn).check('x', 'd')).rejects.toThrow(
      YidunApiError
    );
  });
});

describe('YidunTextModerator errors', () => {
  test('Should throw YidunApiError with the code when body code is not 200 (HTTP is still 200)', async () => {
    const { fn } = fakeFetch({ code: 410, msg: '签名验证失败' });
    const err = await new YidunTextModerator(config, fn).check('x', 'd').catch(e => e);
    expect(err).toBeInstanceOf(YidunApiError);
    expect(err.code).toBe(410);
    expect(err.message).toContain('签名验证失败');
  });

  test('Should throw YidunApiError when result.antispam is missing', async () => {
    const { fn } = fakeFetch({ code: 200, msg: 'ok', result: {} });
    await expect(new YidunTextModerator(config, fn).check('x', 'd')).rejects.toThrow(
      YidunApiError
    );
  });

  test('Should throw YidunTransportError on a non-2xx HTTP status', async () => {
    const { fn } = fakeFetch({}, 502);
    await expect(new YidunTextModerator(config, fn).check('x', 'd')).rejects.toThrow(
      'HTTP 502'
    );
  });

  test('Should throw YidunTransportError when the body is not JSON', async () => {
    const fn = (async () => new Response('<html>gateway error</html>')) as unknown as typeof fetch;
    await expect(new YidunTextModerator(config, fn).check('x', 'd')).rejects.toThrow(
      'not valid JSON'
    );
  });

  test('Should throw YidunTransportError when the network fails', async () => {
    const fn = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    await expect(new YidunTextModerator(config, fn).check('x', 'd')).rejects.toThrow(
      YidunTransportError
    );
  });

  test('Should abort and throw a timeout error when Yidun is too slow', async () => {
    // A fetch that never answers until it is aborted
    const fn = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          const abortErr = new Error('aborted');
          abortErr.name = 'AbortError';
          reject(abortErr);
        });
      })) as unknown as typeof fetch;

    const moderator = new YidunTextModerator({ ...config, timeoutMs: 20 }, fn);
    await expect(moderator.check('x', 'd')).rejects.toThrow('timed out after 20ms');
  });
});

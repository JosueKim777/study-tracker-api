// tests/signature.test.ts

import { genSignature } from '../src/moderation/signature';

describe('genSignature', () => {
  test('Should match the worked example from the Yidun docs', () => {
    // Docs: sorted string is "bar2baz4foo1foo_bar3" + secretKey, then MD5
    const params = { foo: '1', bar: '2', foo_bar: '3', baz: '4' };
    const secretKey = '6308afb129ea00301bd7c79621d07591';
    expect(genSignature(params, secretKey)).toBe('730b0588690874dde18fa58cb1301787');
  });

  test('Should not depend on the order parameters were added in', () => {
    const a = genSignature({ b: '2', a: '1' }, 'key');
    const b = genSignature({ a: '1', b: '2' }, 'key');
    expect(a).toBe(b);
  });

  test('Should ignore an existing signature parameter', () => {
    const without = genSignature({ a: '1' }, 'key');
    const withOld = genSignature({ a: '1', signature: 'stale' }, 'key');
    expect(withOld).toBe(without);
  });

  test('Should hash Chinese content as UTF-8 and return 32 hex characters', () => {
    const sig = genSignature({ content: '网易易盾' }, 'key');
    expect(sig).toMatch(/^[0-9a-f]{32}$/);
    // md5("content网易易盾key") over UTF-8 bytes, computed independently with Python's hashlib
    expect(sig).toBe('58dd5a9e0a5ea0417c4e1e711710d8c0');
  });

  test('Should change when the secret key changes', () => {
    expect(genSignature({ a: '1' }, 'key1')).not.toBe(genSignature({ a: '1' }, 'key2'));
  });
});

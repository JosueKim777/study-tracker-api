// src/moderation/signature.ts

import { createHash } from 'node:crypto';

// Builds the request signature required by every NetEase Yidun content-security API.
// Algorithm (from the official "接口鉴权" docs):
//   1. Take every request parameter except `signature` itself
//   2. Sort the parameter names in ascending ASCII order
//   3. Concatenate them as key1value1key2value2... (no "=" or "&")
//   4. Append the secretKey, then MD5 the UTF-8 bytes and output 32 lowercase hex characters
// The secretKey is never sent over the network. Yidun recomputes the same hash on its side,
// so a matching signature proves the request came from us and was not modified in transit.
export function genSignature(params: Record<string, string>, secretKey: string): string {
  const keys = Object.keys(params)
    .filter(key => key !== 'signature')
    .sort(); // default sort compares UTF-16 code units, which equals ASCII order for ASCII keys

  let raw = '';
  for (const key of keys) {
    raw += key + params[key];
  }
  raw += secretKey;

  return createHash('md5').update(raw, 'utf8').digest('hex');
}

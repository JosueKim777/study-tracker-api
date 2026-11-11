// scripts/check-text.ts
// Manually send one piece of text to the real Yidun API and print the verdict.
// Usage: put your credentials in .env (see .env.example), then:
//   npm run yidun:check -- "text to check"

import { YidunTextModerator, YidunApiError } from '../src/moderation/yidunClient';

async function main(): Promise<void> {
  const text = process.argv.slice(2).join(' ');
  const { YIDUN_SECRET_ID, YIDUN_SECRET_KEY, YIDUN_BUSINESS_ID } = process.env;

  if (!text) {
    console.error('Usage: npm run yidun:check -- "text to check"');
    process.exit(1);
  }
  if (!YIDUN_SECRET_ID || !YIDUN_SECRET_KEY || !YIDUN_BUSINESS_ID) {
    console.error('Missing YIDUN_SECRET_ID, YIDUN_SECRET_KEY or YIDUN_BUSINESS_ID (see .env.example)');
    process.exit(1);
  }

  const moderator = new YidunTextModerator({
    secretId: YIDUN_SECRET_ID,
    secretKey: YIDUN_SECRET_KEY,
    businessId: YIDUN_BUSINESS_ID,
    endpoint: process.env.YIDUN_ENDPOINT || undefined
  });

  const started = Date.now();
  try {
    const verdict = await moderator.check(text, `manual-${started}`);
    console.log(`verdict: ${verdict} (${Date.now() - started}ms)`);
  } catch (err) {
    if (err instanceof YidunApiError) {
      console.error(`Yidun rejected the request (code ${err.code}). ${err.message}`);
    } else {
      console.error(String(err));
    }
    process.exit(1);
  }
}

void main();

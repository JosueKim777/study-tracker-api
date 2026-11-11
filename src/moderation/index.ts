// src/moderation/index.ts

import { ModerationVerdict, TextModerator } from './types';
import { YidunTextModerator } from './yidunClient';

export * from './types';

// Used when no Yidun credentials are configured (local development, CI, tests)
export const noopModerator: TextModerator = {
  async check(): Promise<ModerationVerdict> {
    return 'pass';
  }
};

type Logger = Pick<Console, 'warn'>;

// Fail-open wrapper: if the moderation service is down, slow or misconfigured,
// log a warning and let the request through instead of blocking every user.
// The trade-off: during an outage, unchecked content can be saved.
// A platform with stricter compliance needs would fail closed instead.
export function failOpen(inner: TextModerator, logger: Logger = console): TextModerator {
  return {
    async check(content: string, dataId: string): Promise<ModerationVerdict> {
      try {
        return await inner.check(content, dataId);
      } catch (err) {
        logger.warn(`[moderation] check failed for dataId=${dataId}, allowing request:`, String(err));
        return 'pass';
      }
    }
  };
}

// Builds the moderator from environment variables. All three credentials are required;
// if any is missing, moderation is switched off rather than half-configured.
export function createModeratorFromEnv(env: NodeJS.ProcessEnv = process.env): TextModerator {
  const { YIDUN_SECRET_ID, YIDUN_SECRET_KEY, YIDUN_BUSINESS_ID } = env;
  if (!YIDUN_SECRET_ID || !YIDUN_SECRET_KEY || !YIDUN_BUSINESS_ID) {
    return noopModerator;
  }
  const timeoutMs = Number(env.YIDUN_TIMEOUT_MS) || undefined;
  return failOpen(
    new YidunTextModerator({
      secretId: YIDUN_SECRET_ID,
      secretKey: YIDUN_SECRET_KEY,
      businessId: YIDUN_BUSINESS_ID,
      endpoint: env.YIDUN_ENDPOINT || undefined,
      timeoutMs
    })
  );
}

// src/moderation/types.ts

// pass   = publish normally
// review = suspicious: accept but mark the task as flagged
// reject = not allowed: refuse the request
export type ModerationVerdict = 'pass' | 'review' | 'reject';

// Any text moderation backend (Yidun, a fake in tests, or a no-op) implements this interface,
// so the routes never depend on a specific provider.
export interface TextModerator {
  check(content: string, dataId: string): Promise<ModerationVerdict>;
}

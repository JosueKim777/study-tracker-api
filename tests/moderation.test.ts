// tests/moderation.test.ts

import request from 'supertest';
import { createApp } from '../src/app';
import { clearTasks, getTask } from '../src/tasks';
import {
  ModerationVerdict,
  TextModerator,
  createModeratorFromEnv,
  failOpen,
  noopModerator
} from '../src/moderation';
import { YidunTextModerator } from '../src/moderation/yidunClient';

// A fake moderator that returns a fixed verdict and records what it was asked to check
function fakeModerator(verdict: ModerationVerdict) {
  const checked: { content: string; dataId: string }[] = [];
  const moderator: TextModerator = {
    async check(content, dataId) {
      checked.push({ content, dataId });
      return verdict;
    }
  };
  return { moderator, checked };
}

beforeEach(() => {
  clearTasks();
});

describe('POST /tasks with moderation', () => {
  test('Should create the task normally when the title passes', async () => {
    const { moderator, checked } = fakeModerator('pass');
    const res = await request(createApp(moderator)).post('/tasks').send({ title: '  Revise AVL trees  ' });

    expect(res.status).toBe(201);
    expect(res.body.flagged).toBeUndefined();
    // The trimmed title is what gets checked
    expect(checked).toHaveLength(1);
    expect(checked[0].content).toBe('Revise AVL trees');
    expect(checked[0].dataId).toMatch(/^task-new-/);
  });

  test('Should create the task but flag it when the title is suspicious', async () => {
    const { moderator } = fakeModerator('review');
    const res = await request(createApp(moderator)).post('/tasks').send({ title: 'suspicious' });

    expect(res.status).toBe(201);
    expect(res.body.flagged).toBe(true);
  });

  test('Should return 422 and not create the task when the title is rejected', async () => {
    const { moderator } = fakeModerator('reject');
    const app = createApp(moderator);
    const res = await request(app).post('/tasks').send({ title: 'bad words' });

    expect(res.status).toBe(422);
    expect(typeof res.body.error).toBe('string');
    const list = await request(app).get('/tasks');
    expect(list.body).toEqual([]);
  });

  test('Should not call the moderator when the title is invalid', async () => {
    const { moderator, checked } = fakeModerator('pass');
    const res = await request(createApp(moderator)).post('/tasks').send({ title: '' });

    expect(res.status).toBe(400);
    expect(checked).toHaveLength(0);
  });

  test('Should still create the task when the moderation service fails (fail-open)', async () => {
    const broken: TextModerator = {
      async check() {
        throw new Error('timeout');
      }
    };
    const logger = { warn: jest.fn() };
    const res = await request(createApp(failOpen(broken, logger))).post('/tasks').send({ title: 'ok' });

    expect(res.status).toBe(201);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  test('Should return 500 when an unwrapped moderator throws', async () => {
    const broken: TextModerator = {
      async check() {
        throw new Error('boom');
      }
    };
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(createApp(broken)).post('/tasks').send({ title: 'ok' });
    spy.mockRestore();

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal Server Error' });
  });
});

describe('PATCH /tasks/:id with moderation', () => {
  test('Should leave the task unchanged when the new title is rejected', async () => {
    const pass = createApp(noopModerator);
    await request(pass).post('/tasks').send({ title: 'Original' });

    const { moderator } = fakeModerator('reject');
    const res = await request(createApp(moderator)).patch('/tasks/1').send({ title: 'bad', status: 'done' });

    expect(res.status).toBe(422);
    expect(getTask(1)).toMatchObject({ title: 'Original', status: 'todo' });
  });

  test('Should flag the task when the new title is suspicious, and clear the flag when it passes', async () => {
    await request(createApp(noopModerator)).post('/tasks').send({ title: 'Original' });

    const review = await request(createApp(fakeModerator('review').moderator))
      .patch('/tasks/1')
      .send({ title: 'hmm' });
    expect(review.body.flagged).toBe(true);

    const pass = await request(createApp(fakeModerator('pass').moderator))
      .patch('/tasks/1')
      .send({ title: 'fine' });
    expect(pass.status).toBe(200);
    expect(pass.body.flagged).toBeUndefined();
  });

  test('Should not call the moderator when the title is not being changed', async () => {
    await request(createApp(noopModerator)).post('/tasks').send({ title: 'Original' });
    const { moderator, checked } = fakeModerator('pass');
    const res = await request(createApp(moderator)).patch('/tasks/1').send({ status: 'done' });

    expect(res.status).toBe(200);
    expect(checked).toHaveLength(0);
  });

  test('Should return 404 without calling the moderator when the task does not exist', async () => {
    const { moderator, checked } = fakeModerator('pass');
    const res = await request(createApp(moderator)).patch('/tasks/99').send({ title: 'x' });

    expect(res.status).toBe(404);
    expect(checked).toHaveLength(0);
  });

  test('Should use task-<id> as the dataId', async () => {
    await request(createApp(noopModerator)).post('/tasks').send({ title: 'Original' });
    const { moderator, checked } = fakeModerator('pass');
    await request(createApp(moderator)).patch('/tasks/1').send({ title: 'New' });

    expect(checked[0].dataId).toBe('task-1');
  });
});

describe('createModeratorFromEnv', () => {
  test('Should return the no-op moderator when credentials are missing', async () => {
    expect(createModeratorFromEnv({})).toBe(noopModerator);
    expect(createModeratorFromEnv({ YIDUN_SECRET_ID: 'a', YIDUN_SECRET_KEY: 'b' })).toBe(noopModerator);
    await expect(noopModerator.check('anything', 'd')).resolves.toBe('pass');
  });

  test('Should build a fail-open Yidun moderator when all credentials are set', async () => {
    const moderator = createModeratorFromEnv({
      YIDUN_SECRET_ID: 'a',
      YIDUN_SECRET_KEY: 'b',
      YIDUN_BUSINESS_ID: 'c',
      YIDUN_ENDPOINT: 'http://127.0.0.1:9/unreachable',
      YIDUN_TIMEOUT_MS: '50'
    });
    expect(moderator).not.toBe(noopModerator);

    // The endpoint is unreachable, so the call fails and fail-open lets it pass
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(moderator.check('x', 'd')).resolves.toBe('pass');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test('YidunTextModerator should be usable directly', () => {
    expect(new YidunTextModerator({ secretId: 'a', secretKey: 'b', businessId: 'c' })).toBeDefined();
  });
});

// src/app.ts

import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import {
  createTask,
  listTasks,
  getTask,
  deleteTask,
  updateTask,
  validateTitle
} from './tasks';
import { ValidationError, NotFoundError, ContentRejectedError } from './errors';
import { TextModerator, createModeratorFromEnv } from './moderation';

// Helper function to parse and validate ID following the DRY principle
// Throws ValidationError directly if format is invalid
function parseId(idStr: string): number {
  const num = Number(idStr);
  if (!Number.isInteger(num) || num <= 0) {
    throw new ValidationError('Invalid task ID format');
  }
  return num;
}

// Express 4 does not catch errors from async handlers (a rejected promise is ignored),
// so this wrapper forwards them to the error middleware via next(err).
function asyncHandler(
  fn: (req: Request, res: Response) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res).catch(next);
  };
}

// The app is built by a factory so tests can inject a fake moderator.
// app.ts is only responsible for creating the app, not for listening to ports.
export function createApp(moderator: TextModerator): express.Express {
  const app = express();

  app.use(express.json());

  // Validates the title locally first (cheap), then asks the moderator (a paid network call).
  // Returns whether the task should be flagged; throws if the content is rejected.
  async function moderateTitle(title: unknown, dataId: string): Promise<boolean> {
    const cleanTitle = validateTitle(title);
    const verdict = await moderator.check(cleanTitle, dataId);
    if (verdict === 'reject') {
      throw new ContentRejectedError('Title contains content that is not allowed');
    }
    return verdict === 'review';
  }

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  // POST /tasks route
  app.post(
    '/tasks',
    asyncHandler(async (req, res) => {
      const { title, course, dueDate } = req.body ?? {};
      const flagged = await moderateTitle(title, `task-new-${randomUUID()}`);
      const task = createTask(title, course, dueDate, flagged);
      res.status(201).json(task);
    })
  );

  // GET /tasks route (with query filtering and sorting support)
  app.get('/tasks', (req: Request, res: Response) => {
    const { status, course } = req.query;
    const tasks = listTasks({ status, course });
    res.status(200).json(tasks);
  });

  // GET /tasks/:id route
  app.get('/tasks/:id', (req: Request, res: Response) => {
    const idNum = parseId(req.params.id);
    const task = getTask(idNum);
    res.status(200).json(task);
  });

  // PATCH /tasks/:id route
  app.patch(
    '/tasks/:id',
    asyncHandler(async (req, res) => {
      const idNum = parseId(req.params.id);
      getTask(idNum); // 404 early, before spending a moderation call on a missing task

      const body: unknown = req.body;
      let flagged: boolean | undefined;
      if (typeof body === 'object' && body !== null && 'title' in body) {
        flagged = await moderateTitle((body as { title: unknown }).title, `task-${idNum}`);
      }
      const task = updateTask(idNum, body, flagged);
      res.status(200).json(task);
    })
  );

  // DELETE /tasks/:id route
  app.delete('/tasks/:id', (req: Request, res: Response) => {
    const idNum = parseId(req.params.id);
    deleteTask(idNum);
    res.status(204).send();
  });

  // Centralized error handling middleware (must have all 4 parameters for Express to recognize it as error middleware)
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof ContentRejectedError) {
      res.status(422).json({ error: err.message });
      return;
    }
    // Log unexpected internal errors securely, and hide implementation details from client
    console.error('Unhandled Server Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  });

  return app;
}

// Default app: uses Yidun when YIDUN_* environment variables are set, otherwise no moderation
export const app = createApp(createModeratorFromEnv());

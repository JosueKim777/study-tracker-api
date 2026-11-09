// src/app.ts

import express, { Request, Response } from 'express';
import { createTask } from './tasks';

// app.ts is only responsible for creating the app, not for listening to ports.
// This allows tests to pass the app directly to supertest without starting an actual server.
export const app = express();

app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// POST /tasks route
app.post('/tasks', (req: Request, res: Response) => {
  try {
    const { title, course, dueDate } = req.body;
    const task = createTask(title, course, dueDate);
    res.status(201).json(task);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    res.status(400).json({ error: message });
  }
});

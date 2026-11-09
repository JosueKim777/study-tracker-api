// src/app.ts

import express, { Request, Response } from 'express';
import { createTask, listTasks, getTask, deleteTask } from './tasks';

// app.ts is only responsible for creating the app, not for listening to ports.
// This allows tests to pass the app directly to supertest without starting an actual server.
export const app = express();

app.use(express.json());

// Helper function to parse and validate ID following the DRY principle
function parseId(idStr: string): number | null {
  const num = Number(idStr);
  if (!Number.isInteger(num) || num <= 0) {
    return null;
  }
  return num;
}

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

// GET /tasks route
app.get('/tasks', (_req: Request, res: Response) => {
  const tasks = listTasks();
  res.status(200).json(tasks);
});

// GET /tasks/:id route
app.get('/tasks/:id', (req: Request, res: Response) => {
  const idNum = parseId(req.params.id);
  if (idNum === null) {
    res.status(400).json({ error: 'Invalid task ID format' });
    return;
  }

  try {
    const task = getTask(idNum);
    res.status(200).json(task);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Not found';
    res.status(404).json({ error: message });
  }
});

// DELETE /tasks/:id route
app.delete('/tasks/:id', (req: Request, res: Response) => {
  const idNum = parseId(req.params.id);
  if (idNum === null) {
    res.status(400).json({ error: 'Invalid task ID format' });
    return;
  }

  try {
    deleteTask(idNum);
    res.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Not found';
    res.status(404).json({ error: message });
  }
});

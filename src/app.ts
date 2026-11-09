// src/app.ts

import express, { Request, Response, NextFunction } from 'express';
import { createTask, listTasks, getTask, deleteTask, updateTask } from './tasks';
import { ValidationError, NotFoundError } from './errors';

// app.ts is only responsible for creating the app, not for listening to ports.
// This allows tests to pass the app directly to supertest without starting an actual server.
export const app = express();

app.use(express.json());

// Helper function to parse and validate ID following the DRY principle
// Throws ValidationError directly if format is invalid
function parseId(idStr: string): number {
  const num = Number(idStr);
  if (!Number.isInteger(num) || num <= 0) {
    throw new ValidationError('Invalid task ID format');
  }
  return num;
}

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// POST /tasks route
app.post('/tasks', (req: Request, res: Response) => {
  const { title, course, dueDate } = req.body;
  const task = createTask(title, course, dueDate);
  res.status(201).json(task);
});

// GET /tasks route
app.get('/tasks', (_req: Request, res: Response) => {
  const tasks = listTasks();
  res.status(200).json(tasks);
});

// GET /tasks/:id route
app.get('/tasks/:id', (req: Request, res: Response) => {
  const idNum = parseId(req.params.id);
  const task = getTask(idNum);
  res.status(200).json(task);
});

// DELETE /tasks/:id route
// PATCH /tasks/:id route
app.patch('/tasks/:id', (req: Request, res: Response) => {
  const idNum = parseId(req.params.id);
  const task = updateTask(idNum, req.body);
  res.status(200).json(task);
});

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
  // Log unexpected internal errors securely, and hide implementation details from client
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});


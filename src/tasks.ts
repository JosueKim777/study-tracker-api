// src/tasks.ts

import { ValidationError, NotFoundError } from './errors';

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task {
  id: number;
  title: string;
  course?: string;
  status: TaskStatus;
  dueDate?: string;
}

// Internal state, encapsulated to prevent direct external modification
let tasks: Task[] = [];
let nextId = 1;

// Reset state before each Jest test case
export function clearTasks(): void {
  tasks = [];
  nextId = 1;
}

const VALID_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done'];
const MAX_TITLE_LENGTH = 100;

// Shared by createTask and updateTask so both apply exactly the same title rules
function validateTitle(title: unknown): string {
  if (typeof title !== 'string' || title.trim() === '') {
    throw new ValidationError('Title is required and must be a string');
  }
  const trimmedTitle = title.trim();
  if (trimmedTitle.length > MAX_TITLE_LENGTH) {
    throw new ValidationError(`Title cannot exceed ${MAX_TITLE_LENGTH} characters`);
  }
  return trimmedTitle;
}

// Type guard: if this returns true, TypeScript narrows value to TaskStatus
function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (VALID_STATUSES as string[]).includes(value);
}

function validateOptionalString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`${field} must be a string`);
  }
  return value;
}

// Create a new task
export function createTask(title: unknown, course?: string, dueDate?: string): Task {
  const trimmedTitle = validateTitle(title);

  const newTask: Task = {
    id: nextId++,
    title: trimmedTitle,
    course,
    status: 'todo', // Default status for new tasks is todo
    dueDate
  };

  tasks.push(newTask);
  return { ...newTask };
}

// Return a copy of each task (a shallow copy is enough because every field is a primitive) to maintain strict encapsulation
export function listTasks(): Task[] {
  return tasks.map(t => ({ ...t }));
}

// Find and return a task copy by its ID
export function getTask(id: number): Task {
  const task = tasks.find(t => t.id === id);
  if (!task) {
    throw new NotFoundError('Task not found');
  }
  return { ...task };
}

// Delete a task by its ID
export function deleteTask(id: number): void {
  const index = tasks.findIndex(t => t.id === id);
  if (index === -1) {
    throw new NotFoundError('Task not found');
  }
  tasks.splice(index, 1);
}

// Partially update a task. Every field is validated before anything is changed,
// so a request with one invalid field leaves the task completely untouched (atomic).
export function updateTask(id: number, updates: unknown): Task {
  const task = tasks.find(t => t.id === id);
  if (!task) {
    throw new NotFoundError('Task not found');
  }

  if (typeof updates !== 'object' || updates === null || Array.isArray(updates)) {
    throw new ValidationError('Request body must be an object');
  }
  const body = updates as Record<string, unknown>;

  const changes: Partial<Task> = {};
  if ('title' in body) {
    changes.title = validateTitle(body.title);
  }
  if ('status' in body) {
    if (!isTaskStatus(body.status)) {
      throw new ValidationError(`Status must be one of: ${VALID_STATUSES.join(', ')}`);
    }
    changes.status = body.status;
  }
  if ('course' in body) {
    changes.course = validateOptionalString(body.course, 'course');
  }
  if ('dueDate' in body) {
    changes.dueDate = validateOptionalString(body.dueDate, 'dueDate');
  }

  if (Object.keys(changes).length === 0) {
    throw new ValidationError('No valid fields to update');
  }

  // Only reached when every field passed validation
  Object.assign(task, changes);
  return { ...task };
}

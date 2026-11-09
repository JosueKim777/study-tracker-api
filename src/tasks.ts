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

const MAX_COURSE_LENGTH = 20;
const DATE_FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;

// Course codes are trimmed and upper-cased so "comp2521" and "COMP2521" are treated as the same course
function validateCourse(course: unknown): string {
  if (typeof course !== 'string' || course.trim() === '') {
    throw new ValidationError('Course must be a non-empty string');
  }
  const normalised = course.trim().toUpperCase();
  if (normalised.length > MAX_COURSE_LENGTH) {
    throw new ValidationError(`Course cannot exceed ${MAX_COURSE_LENGTH} characters`);
  }
  return normalised;
}

// Accepts only real calendar dates in YYYY-MM-DD format.
// JavaScript's Date silently rolls invalid dates over (2026-02-30 becomes 2026-03-02),
// so after building the date we check that year, month and day did not change.
function validateDueDate(dueDate: unknown): string {
  if (typeof dueDate !== 'string') {
    throw new ValidationError('Due date must be a string in YYYY-MM-DD format');
  }
  const match = DATE_FORMAT.exec(dueDate);
  if (!match) {
    throw new ValidationError('Due date must be in YYYY-MM-DD format');
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new ValidationError('Due date is not a real calendar date');
  }
  return dueDate;
}

// Create a new task. Optional fields are only validated when they are provided.
export function createTask(title: unknown, course?: unknown, dueDate?: unknown): Task {
  const trimmedTitle = validateTitle(title);
  const validCourse = course === undefined ? undefined : validateCourse(course);
  const validDueDate = dueDate === undefined ? undefined : validateDueDate(dueDate);

  const newTask: Task = {
    id: nextId++,
    title: trimmedTitle,
    course: validCourse,
    status: 'todo', // Default status for new tasks is todo
    dueDate: validDueDate
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
  // For optional fields, null means "remove this field"
  if ('course' in body) {
    changes.course = body.course === null ? undefined : validateCourse(body.course);
  }
  if ('dueDate' in body) {
    changes.dueDate = body.dueDate === null ? undefined : validateDueDate(body.dueDate);
  }

  if (Object.keys(changes).length === 0) {
    throw new ValidationError('No valid fields to update');
  }

  // Only reached when every field passed validation
  Object.assign(task, changes);
  return { ...task };
}

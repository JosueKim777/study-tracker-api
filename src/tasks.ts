// src/tasks.ts

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

// Create a new task
export function createTask(title: unknown, course?: string, dueDate?: string): Task {
  if (typeof title !== 'string' || title.trim() === '') {
    throw new Error('Title is required and must be a string');
  }

  const trimmedTitle = title.trim();
  if (trimmedTitle.length > 100) {
    throw new Error('Title cannot exceed 100 characters');
  }

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

// Return a deep copy array of tasks to maintain strict encapsulation
export function listTasks(): Task[] {
  return tasks.map(t => ({ ...t }));
}

// Find and return a task copy by its ID
export function getTask(id: number): Task {
  const task = tasks.find(t => t.id === id);
  if (!task) {
    throw new Error('Task not found');
  }
  return { ...task };
}

// Delete a task by its ID
export function deleteTask(id: number): void {
  const index = tasks.findIndex(t => t.id === id);
  if (index === -1) {
    throw new Error('Task not found');
  }
  tasks.splice(index, 1);
}

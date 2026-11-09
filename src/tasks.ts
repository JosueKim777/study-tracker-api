// src/tasks.ts

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task {
  id: number;
  title: string;
  course?: string;
  status: TaskStatus;
  dueDate?: string;
}

// 内部状态，外部无法直接修改（封装）
let tasks: Task[] = [];
let nextId = 1;

// 在 Jest 每个测试用例开始前重置状态
export function clearTasks(): void {
  tasks = [];
  nextId = 1;
}

// 创建任务
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
    status: 'todo', // 新建任务默认状态为 todo
    dueDate
  };

  tasks.push(newTask);
  return newTask;
}

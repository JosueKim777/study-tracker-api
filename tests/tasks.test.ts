// tests/tasks.test.ts

import { createTask, clearTasks, listTasks, getTask, deleteTask } from '../src/tasks';

describe('createTask', () => {
  beforeEach(() => {
    clearTasks();
  });

  test('Valid title creates task successfully with default status', () => {
    const task = createTask('Finish homework');
    expect(task).toEqual({
      id: 1,
      title: 'Finish homework',
      status: 'todo',
      course: undefined,
      dueDate: undefined
    });
  });

  test('Creating tasks consecutively increments id correctly', () => {
    const task1 = createTask('Task 1');
    const task2 = createTask('Task 2');
    expect(task1.id).toBe(1);
    expect(task2.id).toBe(2);
  });

  test('Title with leading and trailing spaces has spaces trimmed when saved', () => {
    const task = createTask('  Read notes  ');
    expect(task.title).toBe('Read notes');
  });

  test('Empty string, whitespace-only string, and titles exceeding 100 characters throw an error', () => {
    expect(() => createTask('')).toThrow('Title is required and must be a string');
    expect(() => createTask('   ')).toThrow('Title is required and must be a string');
    
    const longTitle = 'a'.repeat(101);
    expect(() => createTask(longTitle)).toThrow('Title cannot exceed 100 characters');
  });

  test('Boundary cases for 100 characters title limit work correctly', () => {
    // Exactly 100 characters should pass
    const exactTitle = 'a'.repeat(100);
    expect(createTask(exactTitle).title).toBe(exactTitle);

    // 102 characters total, but trimmed length is 100 (after stripping leading/trailing spaces) should pass
    const paddedExactTitle = ' ' + 'a'.repeat(100) + ' ';
    expect(createTask(paddedExactTitle).title).toBe(exactTitle);
  });

  test('Passing non-string types like numbers throws an error', () => {
    expect(() => createTask(123)).toThrow('Title is required and must be a string');
  });

  test('Optional course and dueDate fields are stored correctly', () => {
    const task = createTask('Lab', 'COMP2521', '2026-11-20');
    expect(task).toEqual({
      id: 1,
      title: 'Lab',
      course: 'COMP2521',
      status: 'todo',
      dueDate: '2026-11-20'
    });
  });
});

describe('listTasks, getTask and deleteTask', () => {
  beforeEach(() => {
    clearTasks();
  });


  test('listTasks returns empty array initially and all tasks when created', () => {
    expect(listTasks()).toEqual([]);
    createTask('Task 1');
    createTask('Task 2');
    expect(listTasks().length).toBe(2);
  });

  test('listTasks returns a copy preventing direct internal mutation', () => {
    createTask('Task 1');
    const tasksCopy = listTasks();
    tasksCopy[0].title = 'Hacked Title';

    const originalTask = getTask(1);
    expect(originalTask.title).toBe('Task 1');
  });

  test('getTask retrieves existing task or throws when missing', () => {
    createTask('Task 1');
    const task = getTask(1);
    expect(task.title).toBe('Task 1');

    expect(() => getTask(999)).toThrow('Task not found');
  });

  test('deleteTask removes task successfully or throws when missing', () => {
    createTask('Task 1');
    deleteTask(1);
    expect(() => getTask(1)).toThrow('Task not found');

    expect(() => deleteTask(999)).toThrow('Task not found');
  });
});

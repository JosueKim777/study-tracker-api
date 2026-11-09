// tests/tasks.test.ts

import { createTask, clearTasks, listTasks, getTask, deleteTask } from '../src/tasks';
import { ValidationError, NotFoundError } from '../src/errors';

describe('Tasks Core Logic', () => {
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

  test('Empty string, whitespace-only string, and titles exceeding 100 characters throw ValidationError', () => {
    expect(() => createTask('')).toThrow(ValidationError);
    expect(() => createTask('   ')).toThrow(ValidationError);
    
    const longTitle = 'a'.repeat(101);
    expect(() => createTask(longTitle)).toThrow(ValidationError);
  });

  test('Boundary cases for 100 characters title limit work correctly', () => {
    const exactTitle = 'a'.repeat(100);
    expect(createTask(exactTitle).title).toBe(exactTitle);

    const paddedExactTitle = ' ' + 'a'.repeat(100) + ' ';
    expect(createTask(paddedExactTitle).title).toBe(exactTitle);
  });

  test('Passing non-string types like numbers throws ValidationError', () => {
    expect(() => createTask(123)).toThrow(ValidationError);
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

  test('getTask retrieves existing task or throws NotFoundError when missing', () => {
    createTask('Task 1');
    const task = getTask(1);
    expect(task.title).toBe('Task 1');

    expect(() => getTask(999)).toThrow(NotFoundError);
  });

  test('deleteTask removes task successfully or throws NotFoundError when missing', () => {
    createTask('Task 1');
    deleteTask(1);
    expect(() => getTask(1)).toThrow(NotFoundError);

    expect(() => deleteTask(999)).toThrow(NotFoundError);
  });
});

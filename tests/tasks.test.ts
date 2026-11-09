// tests/tasks.test.ts

import { createTask, clearTasks, listTasks, getTask, deleteTask, updateTask } from '../src/tasks';
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

describe('updateTask', () => {
  beforeEach(() => {
    clearTasks();
    createTask('Original title', 'COMP2521', '2026-11-20');
  });

  test('updates only the title and leaves other fields unchanged', () => {
    const updated = updateTask(1, { title: '  New title  ' });
    expect(updated).toEqual({
      id: 1,
      title: 'New title',
      course: 'COMP2521',
      status: 'todo',
      dueDate: '2026-11-20',
    });
  });

  test('updates status to each valid value', () => {
    expect(updateTask(1, { status: 'in_progress' }).status).toBe('in_progress');
    expect(updateTask(1, { status: 'done' }).status).toBe('done');
    expect(updateTask(1, { status: 'todo' }).status).toBe('todo');
  });

  test('updates course and dueDate', () => {
    const updated = updateTask(1, { course: 'MATH1081', dueDate: '2026-12-01' });
    expect(updated.course).toBe('MATH1081');
    expect(updated.dueDate).toBe('2026-12-01');
  });

  test('changes are persisted, not just returned', () => {
    updateTask(1, { status: 'done' });
    expect(getTask(1).status).toBe('done');
  });

  test('throws ValidationError for an invalid status', () => {
    expect(() => updateTask(1, { status: 'finished' })).toThrow(ValidationError);
    expect(() => updateTask(1, { status: 'DONE' })).toThrow(ValidationError);
  });

  test('applies the same title rules as createTask', () => {
    expect(() => updateTask(1, { title: '' })).toThrow(ValidationError);
    expect(() => updateTask(1, { title: 'a'.repeat(101) })).toThrow(ValidationError);
    expect(updateTask(1, { title: 'a'.repeat(100) }).title).toBe('a'.repeat(100));
  });

  test('throws ValidationError for non-string course or dueDate', () => {
    expect(() => updateTask(1, { course: 123 })).toThrow(ValidationError);
    expect(() => updateTask(1, { dueDate: true })).toThrow(ValidationError);
  });

  test('throws ValidationError when there is nothing to update', () => {
    expect(() => updateTask(1, {})).toThrow(ValidationError);
    expect(() => updateTask(1, { unknownField: 'x' })).toThrow(ValidationError);
    expect(() => updateTask(1, null)).toThrow(ValidationError);
    expect(() => updateTask(1, ['title'])).toThrow(ValidationError);
  });

  test('throws NotFoundError for a missing task', () => {
    expect(() => updateTask(999, { title: 'x' })).toThrow(NotFoundError);
  });

  test('is atomic: one invalid field means nothing is changed', () => {
    expect(() => updateTask(1, { title: 'New title', status: 'wrong' })).toThrow(ValidationError);
    expect(getTask(1)).toEqual({
      id: 1,
      title: 'Original title',
      course: 'COMP2521',
      status: 'todo',
      dueDate: '2026-11-20',
    });
  });
});

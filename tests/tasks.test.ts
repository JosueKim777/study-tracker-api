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

describe('dueDate validation', () => {
  beforeEach(() => {
    clearTasks();
  });

  test('accepts real calendar dates, including leap days', () => {
    expect(createTask('A', undefined, '2026-11-20').dueDate).toBe('2026-11-20');
    expect(createTask('B', undefined, '2028-02-29').dueDate).toBe('2028-02-29');
    expect(createTask('C', undefined, '2026-12-31').dueDate).toBe('2026-12-31');
  });

  test('rejects dates that do not exist', () => {
    for (const bad of ['2026-02-29', '2026-02-30', '2026-04-31', '2026-13-01', '2026-00-10', '2026-01-00']) {
      expect(() => createTask('Task', undefined, bad)).toThrow('Due date is not a real calendar date');
    }
  });

  test('rejects the wrong format', () => {
    for (const bad of ['2026-1-5', '20261120', '20-11-2026', '2026/11/20', 'tomorrow', '', ' 2026-11-20']) {
      expect(() => createTask('Task', undefined, bad)).toThrow('Due date must be in YYYY-MM-DD format');
    }
  });

  test('rejects non-string values', () => {
    expect(() => createTask('Task', undefined, 20261120)).toThrow(ValidationError);
    expect(() => createTask('Task', undefined, null)).toThrow(ValidationError);
  });

  test('updateTask uses the same date rules and can clear the date with null', () => {
    createTask('Task', undefined, '2026-11-20');
    expect(() => updateTask(1, { dueDate: '2026-02-30' })).toThrow(ValidationError);
    expect(getTask(1).dueDate).toBe('2026-11-20');

    expect(updateTask(1, { dueDate: null }).dueDate).toBeUndefined();
  });
});

describe('course validation', () => {
  beforeEach(() => {
    clearTasks();
  });

  test('trims and upper-cases the course code', () => {
    expect(createTask('Task', '  comp2521 ').course).toBe('COMP2521');
  });

  test('accepts exactly 20 characters and rejects 21', () => {
    expect(createTask('Task', 'A'.repeat(20)).course).toBe('A'.repeat(20));
    expect(() => createTask('Task', 'A'.repeat(21))).toThrow('Course cannot exceed 20 characters');
  });

  test('rejects empty, whitespace-only and non-string courses', () => {
    expect(() => createTask('Task', '')).toThrow(ValidationError);
    expect(() => createTask('Task', '   ')).toThrow(ValidationError);
    expect(() => createTask('Task', 2521)).toThrow(ValidationError);
  });

  test('updateTask can clear the course with null', () => {
    createTask('Task', 'COMP2521');
    expect(updateTask(1, { course: null }).course).toBeUndefined();
  });
});

describe('listTasks sorting', () => {
  beforeEach(() => {
    clearTasks();
  });

  test('moves a dated task ahead of an undated task that was created first', () => {
    createTask('No date');
    createTask('Has date', undefined, '2026-11-20');
    expect(listTasks().map(t => t.title)).toEqual(['Has date', 'No date']);
  });
});

// tests/tasksRoutes.test.ts

import request from 'supertest';
import { app } from '../src/app';
import { clearTasks } from '../src/tasks';

beforeEach(() => {
  clearTasks();
});

describe('POST /tasks', () => {
  test('Should create a task successfully with valid title and return 201', async () => {
    const response = await request(app)
      .post('/tasks')
      .send({ title: 'Learn TypeScript' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: 1,
      title: 'Learn TypeScript',
      status: 'todo'
    });
  });

  test('Should create a task successfully with optional course and dueDate', async () => {
    const response = await request(app)
      .post('/tasks')
      .send({
        title: 'Complete assignment',
        course: 'COMP2521',
        dueDate: '2026-11-20'
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: 1,
      title: 'Complete assignment',
      course: 'COMP2521',
      status: 'todo',
      dueDate: '2026-11-20'
    });
  });

  test('Should return 400 when title is missing, empty, or not a string', async () => {
    const resMissing = await request(app).post('/tasks').send({});
    expect(resMissing.status).toBe(400);
    expect(typeof resMissing.body.error).toBe('string');

    const resEmpty = await request(app).post('/tasks').send({ title: '' });
    expect(resEmpty.status).toBe(400);
    expect(typeof resEmpty.body.error).toBe('string');

    const resWhitespace = await request(app).post('/tasks').send({ title: '   ' });
    expect(resWhitespace.status).toBe(400);
    expect(typeof resWhitespace.body.error).toBe('string');

    const resNumber = await request(app).post('/tasks').send({ title: 123 });
    expect(resNumber.status).toBe(400);
    expect(typeof resNumber.body.error).toBe('string');
  });

  test('Should return 400 when title exceeds 100 characters', async () => {
    const longTitle = 'a'.repeat(101);
    const response = await request(app)
      .post('/tasks')
      .send({ title: longTitle });

    expect(response.status).toBe(400);
    expect(typeof response.body.error).toBe('string');
  });
});

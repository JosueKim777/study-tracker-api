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

describe('GET /tasks and GET /tasks/:id', () => {
  test('GET /tasks returns 200 and array of tasks', async () => {
    await request(app).post('/tasks').send({ title: 'Task 1' });
    const response = await request(app).get('/tasks');

    expect(response.status).toBe(200);
    expect(response.body.length).toBe(1);
    expect(response.body[0].title).toBe('Task 1');
  });

  test('GET /tasks/:id returns 200 for valid id, 404 for missing id, and 400 for invalid formats', async () => {
    await request(app).post('/tasks').send({ title: 'Task 1' });

    // Valid
    const resValid = await request(app).get('/tasks/1');
    expect(resValid.status).toBe(200);
    expect(resValid.body.title).toBe('Task 1');

    // Not found
    const resNotFound = await request(app).get('/tasks/999');
    expect(resNotFound.status).toBe(404);
    expect(typeof resNotFound.body.error).toBe('string');

    // Invalid formats (abc, decimals, negative)
    for (const invalidId of ['abc', '1.5', '-1', '0']) {
      const resInvalid = await request(app).get(`/tasks/${invalidId}`);
      expect(resInvalid.status).toBe(400);
      expect(typeof resInvalid.body.error).toBe('string');
    }
  });
});

describe('DELETE /tasks/:id', () => {
  test('DELETE /tasks/:id returns 204 on success and 404 when missing', async () => {
    await request(app).post('/tasks').send({ title: 'Task 1' });

    const resDelete = await request(app).delete('/tasks/1');
    expect(resDelete.status).toBe(204);

    // Verify task is gone
    const resGet = await request(app).get('/tasks/1');
    expect(resGet.status).toBe(404);

    // Delete non-existent
    const resDeleteMissing = await request(app).delete('/tasks/999');
    expect(resDeleteMissing.status).toBe(404);

    // Invalid format
    const resInvalid = await request(app).delete('/tasks/abc');
    expect(resInvalid.status).toBe(400);
  });
});

describe('PATCH /tasks/:id', () => {
  beforeEach(async () => {
    await request(app).post('/tasks').send({ title: 'Task 1' });
  });

  test('returns 200 with the updated task', async () => {
    const res = await request(app).patch('/tasks/1').send({ status: 'done' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 1, title: 'Task 1', status: 'done' });

    const resGet = await request(app).get('/tasks/1');
    expect(resGet.body.status).toBe('done');
  });

  test('returns 400 for an invalid status or empty body', async () => {
    for (const body of [{ status: 'finished' }, {}]) {
      const res = await request(app).patch('/tasks/1').send(body);
      expect(res.status).toBe(400);
      expect(typeof res.body.error).toBe('string');
    }
  });

  test('returns 404 for a missing task', async () => {
    const res = await request(app).patch('/tasks/999').send({ title: 'x' });
    expect(res.status).toBe(404);
    expect(typeof res.body.error).toBe('string');
  });

  test('returns 400 for an invalid id', async () => {
    const res = await request(app).patch('/tasks/abc').send({ title: 'x' });
    expect(res.status).toBe(400);
  });
});

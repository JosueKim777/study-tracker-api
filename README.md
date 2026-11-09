# Study Tracker API

A small REST API for tracking study tasks (assignments, readings, exam prep), built with **TypeScript**, **Express** and **Jest**, with automated checks on every push via **GitHub Actions**.

## Getting started

```bash
npm install
npm run dev        # start the server with auto-reload on http://localhost:3000
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the server and restart on file changes |
| `npm test` | Run all Jest tests |
| `npm run test:coverage` | Run tests and print a coverage report |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Type-check with the TypeScript compiler |

## API

A task looks like:

```json
{
  "id": 1,
  "title": "Read lecture 5 notes",
  "course": "COMP2521",
  "dueDate": "2026-11-20",
  "status": "todo"
}
```

`status` is one of `todo`, `in_progress`, `done`. `course` and `dueDate` are optional. Errors are returned as `{ "error": "<message>" }`.

| Method | Route | Success | Errors |
|---|---|---|---|
| GET | `/health` | 200 `{ "status": "ok" }` | |
| POST | `/tasks` | 201 created task | 400 invalid body |
| GET | `/tasks` | 200 list of tasks (supports `?status=` and `?course=`) | 400 invalid `status` filter |
| GET | `/tasks/:id` | 200 task | 404 not found |
| PATCH | `/tasks/:id` | 200 updated task | 400 invalid body, 404 not found |
| DELETE | `/tasks/:id` | 204 no content | 404 not found |

### Validation rules

- `title`: required on create, a non-empty string of at most 100 characters
- `dueDate`: optional, a real calendar date in `YYYY-MM-DD` format
- `status`: one of the three values above; new tasks start as `todo`
- `GET /tasks` returns tasks sorted by `dueDate` (tasks without one go last)

## Testing

- **Unit tests** cover the task logic in `src/tasks.ts` directly.
- **Integration tests** send real HTTP requests to the Express app with `supertest`.
- CI runs lint, type-check and the full test suite with coverage on every push.

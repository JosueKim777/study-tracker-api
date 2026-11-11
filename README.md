# Study Tracker API
![CI](https://github.com/JosueKim777/study-tracker-api/actions/workflows/ci.yml/badge.svg)
A small REST API for tracking study tasks (assignments, readings, exam prep), built with **TypeScript**, **Express** and **Jest**, with automated checks on every push via **GitHub Actions**.

Task titles are checked with **NetEase Yidun text moderation** (signed form-urlencoded API calls, timeout handling, fail-open fallback). See [Content moderation](#content-moderation).

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
| `npm run yidun:check -- "text"` | Send one real request to Yidun using `.env` and print the verdict and latency |

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
| POST | `/tasks` | 201 created task | 400 invalid body, 422 title rejected by moderation |
| GET | `/tasks` | 200 list of tasks (supports `?status=` and `?course=`) | 400 invalid `status` filter |
| GET | `/tasks/:id` | 200 task | 400 invalid id, 404 not found |
| PATCH | `/tasks/:id` | 200 updated task | 400 invalid id or body, 404 not found, 422 title rejected by moderation |
| DELETE | `/tasks/:id` | 204 no content | 400 invalid id, 404 not found |

The full API is described in [`docs/openapi.yaml`](docs/openapi.yaml) (OpenAPI 3.0). Import it into Apifox or Postman to get ready-made requests.

### Validation rules

- `title`: required on create, a non-empty string of at most 100 characters
- `dueDate`: optional, a real calendar date in `YYYY-MM-DD` format (`2026-02-30` and `2026-02-29` are rejected, `2028-02-29` is accepted)
- `course`: optional, a non-empty string of at most 20 characters, stored trimmed and upper-cased (`comp2521` becomes `COMP2521`)
- `status`: one of the three values above; new tasks start as `todo`
- `GET /tasks` returns tasks sorted by `dueDate` (tasks without one go last)
- `PATCH /tasks/:id` accepts any subset of `title`, `course`, `dueDate`, `status`. All fields are validated before any change is applied, so an invalid field leaves the task untouched. Sending `null` for `course` or `dueDate` removes that field

## Content moderation

When `YIDUN_SECRET_ID`, `YIDUN_SECRET_KEY` and `YIDUN_BUSINESS_ID` are set (copy `.env.example` to `.env`), every new or changed task title is sent to the [Yidun text check API](https://support.dun.163.com/documents/588434200783982592?docId=589310433773625344) (`/v5/text/check`). Without credentials, moderation is switched off so local development and CI need no keys.

| Yidun `suggestion` | Meaning | What the API does |
|---|---|---|
| 0 | pass | Saves the task normally |
| 1 | suspicious | Saves the task with `"flagged": true` |
| 2 | reject | Returns **422** and saves nothing |

Design notes:

- **Signature**: parameters sorted by name, joined as `key1value1key2value2`, secretKey appended, MD5 over UTF-8 (`src/moderation/signature.ts`). The secretKey is never sent.
- **Errors**: Yidun returns HTTP 200 even for failures, so the client checks the body's `code` and raises `YidunApiError` with it; timeouts and network problems raise `YidunTransportError`.
- **Timeout**: 3s by default (`YIDUN_TIMEOUT_MS`). Yidun suggests 1s, but from Sydney a cold request takes ~0.6s and the first one went over 1s.
- **Fail-open**: if Yidun is down or slow, the request is allowed and a warning is logged. The trade-off is explained in the troubleshooting guide.
- **Saving quota**: the title is validated locally and the task's existence is checked before calling Yidun.
- **Testable**: the moderator is injected into `createApp()`, and the HTTP client takes an injectable `fetch`, so all tests run offline.

Problems hit during integration and how to diagnose them: [`docs/yidun-troubleshooting.md`](docs/yidun-troubleshooting.md).

## Testing

- **Unit tests** cover the task logic in `src/tasks.ts` directly.
- **Integration tests** send real HTTP requests to the Express app with `supertest`.
- **Moderation tests** use a fake moderator and a fake `fetch` to cover every verdict, error code, timeout and the fail-open path without touching the network.
- CI runs lint, type-check and the full test suite with coverage on every push.

import express, { Request, Response } from 'express';

// app.ts 只负责"创建" app，不负责监听端口。
// 这样测试可以直接把 app 交给 supertest，不用真的启动服务器。
export const app = express();

app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// TODO: 在这里加上 /tasks 相关的 route（见 README 里的 API 设计）

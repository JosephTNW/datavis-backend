import { Hono } from "hono";
import { logger } from "hono/logger";
import modelRouter from "./routes/model";
import dataRouter from "./routes/data";
import authRouter from "./routes/auth";
import qwenRouter from "./routes/qwen";
import { cors } from 'hono/cors'

const app = new Hono();

app.use("*", logger());
app.use('*', cors())

app.get("/hello", (c) => {
  return c.json({ message: "Hello, World!" });
});

app.route("/model", qwenRouter);
app.route("/data", dataRouter);
app.route("/auth", authRouter);

export default app;

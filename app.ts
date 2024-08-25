import { Hono } from "hono";
import { logger } from "hono/logger";
import actionRouter from "./routes/action";
import dataRouter from "./routes/data";

const app = new Hono();

app.use("*", logger());

app.get("/hello", (c) => {
  return c.json({ message: "Hello, World!" });
});

app.route("/action", actionRouter);
app.route("/data", dataRouter);

export default app;

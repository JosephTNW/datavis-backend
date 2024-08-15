import { Hono } from "hono";
import { logger } from "hono/logger";
import promptRouter from "./routes/prompt";
import dataRouter from "./routes/data";

const app = new Hono();

app.use(('*'), logger());

app.get("/hello", (c) => {
    return c.json({ message: "Hello, World!" });
})

app.route("/prompt", promptRouter);
app.route("/data", dataRouter);

export default app;
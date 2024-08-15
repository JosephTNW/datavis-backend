import { Hono } from "hono";

const promptRouter = new Hono();

promptRouter.get("/", (c) => {
  return c.json({
    prompt: "PROMPT TO MAKE ACTION PARSER MODEL",
    datasets: ["DatasetA", "DatasetB", "DatasetC"],
  });
});

export default promptRouter;

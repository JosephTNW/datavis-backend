import { Hono } from "hono";

const dataRouter = new Hono();

dataRouter.get("/", (c) => {
    return c.json({ 
        message: {
            prompt: "PROMPT TO MAKE ACTION PARSER MODEL",
            datasets: ["DatasetA", "DatasetB", "DatasetC"],
        },
     });
});

export default dataRouter;

import { Hono } from "hono";
import { Client } from "@gradio/client";
import { PrismaClient } from "@prisma/client";
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const actionRouter = new Hono();
const client = new PrismaClient();

const fetchIndexes = async () => {
  const indexes = await client.datasets.findMany({ select: { name: true } });
  return indexes
}

actionRouter.get("/indexes", async (c) => {
  return c.json({"indexes": (await fetchIndexes()).map((index) => index.name)});
});

actionRouter.get("/prompt", async (c) => {
  const fileContent = fs.readFileSync(String(process.env.ACTION_PROMPT_PATH), 'utf-8');

  return c.json({"prompt": fileContent});
});

actionRouter.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const query = body.query;

    const fileContent = fs.readFileSync(String(process.env.ACTION_PROMPT_PATH), 'utf-8');

    const prompt = fileContent.replace(/DATASETS/g, (await fetchIndexes()).map((index) => "- " + index.name).join("\n"));

    const client = await Client.connect("Qwen/Qwen2-72B-Instruct");
    const result = await client.predict(
      "/model_chat_1", {
        query: query,
        history: [],
        system: prompt, 
    });

    return c.json({ message: result });

  } catch (error) {
      console.error(error);
  }

});

export default actionRouter;

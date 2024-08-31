import { Hono } from "hono";
import { Client } from "@gradio/client";
import { PrismaClient } from "@prisma/client";
import { fetchPrompt } from "../prompts/ulils";
import dotenv from "dotenv";

dotenv.config();

const modelRouter = new Hono();
const client = new PrismaClient();

const fetchIndexes = async () => {
  const indexes = await client.datasets.findMany({
    select: { name: true, data: true },
  });

  return indexes;
};

const actionPrompt = fetchPrompt(
  String(process.env.ACTION_PROMPT_PATH),
  "utf-8"
).replace(
  /DATASETS/g,
  (await fetchIndexes())
    .map((index, i) => {
      let columns = [];
      for (let key in index.data[0]) {
        columns.push(key);
      }
      return `${i + 1}. ${index.name} \n Columns: [${columns.join(", ")}]`;
    })
    .join("\n")
);

const dataPrompt = fetchPrompt(String(process.env.DATA_PROMPT_PATH), "utf-8");

const namerPrompt = fetchPrompt(String(process.env.NAMER_PROMPT_PATH), "utf-8");

modelRouter.get("/indexes", async (c) => {
  return c.json({
    indexes: (await fetchIndexes()).map((index, i) => {
      let columns = [];
      for (let key in index.data[0]) {
        columns.push(key);
        console.log(key + " : " + index.data[0][key]);
      }
      return `${i + 1}. ${index.name} \n Columns: [${columns.join(", ")}]`;
    }),
  });
});

modelRouter.get("/prompt", async (c) => {
  const fileContent = fetchPrompt(
    String(process.env.ACTION_PROMPT_PATH),
    "utf-8"
  );

  return c.json({ prompt: fileContent });
});

const modelClient = await Client.connect("Qwen/Qwen2-72B-Instruct");

modelRouter.post("/main", async (c) => {
  try {
    const body = await c.req.json();

    if (parseInt(String(process.env.REQUIRE_AUTH)) == 1) {
      if (!body.token) {
        return c.json({ success: false, message: "Forbidden: Token Missing" });
      }

      const session = await client.sessions.findFirst({
        where: {
          id: body.token,
        },
      });

      if (!session) {
        return c.json({ success: false, message: "Forbidden: Token Invalid" });
      }

      if (
        session.createdAt <
        new Date(
          Date.now() - parseInt(String(process.env.TOKEN_EXPIRY_DURATION))
        )
      ) {
        return c.json({ success: false, messageT: "Forbidden: Token expired" });
      }
    }

    let conversationHistory = [];
    if (body.conversationId) {
      const conversation = await client.conversations.findFirst({
        where: {
          id: body.conversationId,
        },
      });

      if (!conversation) {
        return c.json({
          success: false,
          message: "Not Found: Invalid Conversation Id",
        });
      }

      conversationHistory = conversation?.chat || [];
    }

    const actionResult = await modelClient.predict("/model_chat_1", {
      query: body.query,
      history: [],
      system: actionPrompt,
    });

    const actionJson = actionResult.data[1][0][1];
    const startIndex = actionJson.indexOf("{");
    const endIndex = actionJson.lastIndexOf("}");
    const extractedJson = JSON.parse(
      actionJson.substring(startIndex, endIndex + 1)
    );

    // return c.json({
    //   success: true,
    //   extractedJson: extractedJson,
    // });

    let relevantData = {};
    let datasetContent = [];
    let datasetName
    for (dataset in extractedJson.datasets) {
      if (datasetName == dataset.name) {
        break;
      }
      datasetName = dataset.name;
      const currDataset = await client.datasets.findFirst({
        where: {
          name: datasetName,
        },
      });

      if (!currDataset) {
        return c.json({
          success: false,
          message: "Not Found: Invalid Dataset Name",
        });
      }

      if (currDataset.data.length == 0) {
        // KODE DOWNLOAD RANDY GUNZ
      }

      datasetContent.push(currDataset);
    }

    if (extractedJson.action == "Map columns to two axes of the same dataset") {
      relevantData.xAxisName = extractedJson.datasets[0].column;
      relevantData.yAxisName = extractedJson.datasets[1].column;
      relevantData.name = `X and Y data points of ${relevantData.xAxisName} and ${relevantData.yAxisName}`;

      relevantData.xData = [];
      relevantData.yData = [];

      for (item in datasetContent) {
        relevantData.xData.push(item[relevantData.xAxisName]);
        relevantData.yData.push(item[relevantData.yAxisName]);
      }

    } else if (extractedJson.action == "Sum one column") {
      relevantData.sumColumnName = extractedJson.datasets[0].column;
      relevantData.name = `Sum of ${relevantData.sumColumnName}`;
      relevantData.sum = 0;

      for (item in datasetContent.data) {
        relevantData.sum += item[relevantData.sumColumnName];
      }
    } else if (
      extractedJson.action ==
      "Frequency distribution of one column's data point"
    ) {
      relevantData.yData = "count"
      relevantData.xAxisName = extractedJson.datasets[0].column;
      for (dataPoint in dataSetContent[relevantData.xAxisName]){ 
        if (relevantData.xData == dataPoint){
          relevantData.yData += 1
        }
      }
    }

    const dataImbuedPrompt = dataPrompt.replace(
      "Here are the relevant data:",
      "Here are the relevant data: \n " + JSON.stringify(relevantData)
    );

    modelClient.predict("/model_chat_1", {
      query: body.query,
      history: [],
      system: dataImbuedPrompt,
    });

    const datasetSampleData = datasetIndex.data;
    const datasetColumns = Object.keys(datasetSampleData[0]);

    const dataResult = await modelClient.predict("/model_chat_1", {
      query: body.query,
      history: [],
      system: dataPrompt,
    });

    const dataJson = dataResult.data[1][0][1];
    const startDataIndex = dataJson.indexOf("{");
    const endDataIndex = dataJson.lastIndexOf("}");
    const extractedDataJson = JSON.parse(
      dataJson.substring(startDataIndex, endDataIndex + 1)
    );

    for (column in extractedDataJson.columns) {
      const columnName = extractedDataJson.columns[column];
      if (!datasetColumns.includes(columnName)) {
        return c.json({
          success: false,
          message: "Not Found: Invalid Column Name",
        });
      }
    }

    const data = await client.datasets.findMany({
      where: {
        name: datasetName,
      },
    });

    const filteredData = data.filter((row) => {
      let isValid = true;
      for (column in extractedDataJson.columns) {
        const columnName = extractedDataJson.columns[column];
        if (row[columnName] != extractedDataJson.values[column]) {
          isValid = false;
          break;
        }
      }
      return isValid;
    });

    if (filteredData.length == 0) {
      return c.json({
        success: false,
        message: "Not Found: No data found",
      });
    }

    let conversationName;
    if (conversationHistory.length == 0) {
      conversationName = await modelClient.predict("/model_chat_1", {
        query: body.query,
        history: [],
        system: namerPrompt,
      });

      if (body.returnAll) {
        return c.json({
          chat: actionResult.data,
          name: conversationName.data,
        });
      }

      const conversation = await client.conversations.create({
        data: {
          chat: [body.query, actionResult.data[1][0][1]],
          name: conversationName.data[1][0][1],
        },
      });

      return c.json({
        chat: actionResult.data[1][0][1],
        name: conversationName.data[1][0][1],
        conversationId: conversation.id,
      });
    } else {
      await client.conversations.update({
        where: {
          id: body.conversationId,
        },
        data: {
          chat: {
            push: [body.query, actionResult.data[1][0][1]],
          },
        },
      });

      return c.json({
        chat: actionResult.data[1][0][1],
      });
    }
  } catch (error) {
    console.error(error);
    return c.json({
      success: false,
      message: "Serverside error occured, ",
      error,
    });
  }
});

modelRouter.post("/parse", async (c) => {
  const body = await c.req.json();

  const modelClient = await Client.connect("Qwen/Qwen2-72B-Instruct");

  const result = await modelClient.predict("/model_chat_1", {
    query: body.query,
    history: [],
    system: actionPrompt,
  });

  if (body.returnAll) {
    return c.json({ success: true, chat: result.data });
  }

  return c.json({ success: true, chat: result.data[1][0][1] });
});

export default modelRouter;

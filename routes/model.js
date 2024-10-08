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

modelRouter.get("/conversations", async (c) => {
  const body = await c.req.json();

  const conversations = await client.conversations.findMany({
    select: { name: true, chat: true },
    where: {
      userId: body.userId,
    },
  });

  return c.json({ success: true, conversations: conversations });
})

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
    //   extractedJson: extractedJson.datasets,
    // });

    let relevantData = {}
    let datasetContent = {};
    let datasetName = "";
    for (const dataset of extractedJson.datasets) {
      if (datasetName == dataset.name) {
        break;
      }
      datasetName = dataset.name;
    
      try {
        const currDataset = await client.datasets.findFirst({
          select: { data: true },
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
    
        datasetContent = currDataset.data;
      } catch (error) {
        console.error("Error fetching dataset:", error);
        return c.json({
          success: false,
          message: "An error occurred while fetching the dataset",
        });
      }
    }
    
    // return c.json({
    //   success: true,
    //   extractedJson: extractedJson,
    //   datasetContent: datasetContent,
    // });

    if (extractedJson.action == "Map columns to two axes of the same dataset") {
      relevantData.xAxisName = extractedJson.datasets[0].column;
      relevantData.yAxisName = extractedJson.datasets[1].column;
      relevantData.name = `X and Y data points of ${relevantData.xAxisName} and ${relevantData.yAxisName}`;

      relevantData.xData = [];
      relevantData.yData = [];

      datasetContent.forEach(row => {
        relevantData.xData.push(row[relevantData.xAxisName]);
        relevantData.yData.push(row[relevantData.yAxisName]);
      }); 
    } else if (extractedJson.action == "Sum one column") {
      relevantData.sumColumnName = extractedJson.datasets[0].column;
      relevantData.name = `Sum of ${relevantData.sumColumnName}`;
      relevantData.sum = 0;

      datasetContent.forEach(item => {
        relevantData.sum += item[relevantData.sumColumnName];
      });
    } else if (
      extractedJson.action ==
      "Frequency count of one column's data point"
    ) {
      relevantData.yAxisName = "count";
      relevantData.xAxisName = extractedJson.datasets[0].column;
    
      // Calculate the number of bins using Sturges' formula
      const n = datasetContent.length;
      const numBins = Math.ceil(1 + 3.322 * Math.log10(n));
    
      // Determine min and max values for the data
      const dataValues = datasetContent.map(dataPoint => dataPoint[relevantData.xAxisName]);
      const minValue = Math.min(...dataValues);
      const maxValue = Math.max(...dataValues);
    
      // Calculate bin width
      const binWidth = (maxValue - minValue) / numBins;
    
      // Initialize xData and yData
      relevantData.xData = [];
      relevantData.yData = new Array(numBins).fill(0);
    
      // Iterate through datasetContent to calculate frequency distribution
      datasetContent.forEach(dataPoint => {
        const xValue = dataPoint[relevantData.xAxisName];
        const binIndex = Math.floor((xValue - minValue) / binWidth);
    
        // Make sure the last bin includes the maxValue
        const actualBinIndex = binIndex >= numBins ? numBins - 1 : binIndex;
        relevantData.yData[actualBinIndex] += 1;
      });
    
      // Create bin ranges for xData
      for (let i = 0; i < numBins; i++) {
        const rangeStart = minValue + i * binWidth;
        const rangeEnd = rangeStart + binWidth;
        relevantData.xData.push(`${rangeStart.toFixed(2)} - ${rangeEnd.toFixed(2)}`);
      }
    }

    // return c.json({
    //   success: true,
    //   extractedJson: extractedJson,
    //   datasetContent: datasetContent,
    //   relevantData: relevantData
    // });

    const dataImbuedPrompt = dataPrompt.replace(
      "RELEVANT DATA",
      JSON.stringify(relevantData)
    );

    const dataResult = await modelClient.predict("/model_chat_1", {
      query: body.query,
      history: [],
      system: dataImbuedPrompt,
    });

    let conversationName;
    if (conversationHistory.length == 0) {
      conversationName = await modelClient.predict("/model_chat_1", {
        query: body.query,
        history: [],
        system: namerPrompt,
      });

      const conversation = await client.conversations.create({
        data: {
          chat: [body.query, dataResult.data[1][0][1]],
          name: conversationName.data[1][0][1],
        },
      });

      return c.json({
        chat: dataResult,
        name: conversationName.data[1][0][1],
        relevantData: relevantData,
        conversationId: conversation.id,
      });
    } else {
      await client.conversations.update({
        where: {
          id: body.conversationId,
        },
        data: {
          chat: {
            push: [body.query, dataResult.data[1][0][1]],
          },
        },
      });

      return c.json({
        success: true,
        extractedJson: extractedJson,
        datasetContent: datasetContent,
        relevantData: relevantData,
        chat: dataResult.data,
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

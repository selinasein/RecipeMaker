const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const path = require("path");
const dotenv = require("dotenv");
const PORT = process.env.PORT || 3001;

const app = express();

// Serve static files from the Vite build directory
app.use(express.static(path.join(__dirname, "dist")));

dotenv.config();

// Enable CORS for all routes
app.use(cors());

// SSE Endpoint
app.get("/recipeStream", (req, res) => {
  console.log("HIT");
  const { ingredients, mealType, cuisine, cookingTime, complexity } = req.query;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Function to send messages
  const sendEvent = (chunk) => {
    let chunkResponse;
    if (chunk.choices[0].finish_reason === "stop") {
      res.write(`data: ${JSON.stringify({ action: "close" })}\n\n`);
    } else {
      if (
        chunk.choices[0].delta.role &&
        chunk.choices[0].delta.role === "assistant"
      ) {
        chunkResponse = {
          action: "start",
        };
      } else {
        chunkResponse = {
          action: "chunk",
          chunk: chunk.choices[0].delta.content,
        };
      }
      res.write(`data: ${JSON.stringify(chunkResponse)}\n\n`);
    }
  };

  const prompt = [];
  prompt.push("Generate a recipe that incorporates the following details:");
  prompt.push(`[Ingredients: ${ingredients}]`);
  prompt.push(`[Meal Type: ${mealType}]`);
  prompt.push(`[Cuisine Preference: ${cuisine}]`);
  prompt.push(`[Cooking Time: ${cookingTime}]`);
  prompt.push(`[Complexity: ${complexity}]`);
  prompt.push(
    "Please provide a detailed recipe, including steps for preparation and cooking. Only use the ingredients provided."
  );
  prompt.push(
    "The recipe should highlight the fresh and vibrant flavors of the ingredients."
  );
  prompt.push(
    "Also give the recipe a suitable name in its local language based on cuisine preference."
  );

  const messages = [
    {
      role: "system",
      content: prompt.join(" "),
    },
  ];
  fetchOpenAICompletionsStream(messages, sendEvent);

  // Clear interval and close connection on client disconnect
  req.on("close", () => {
    res.end();
  });
});

// All other GET requests not handled before will return the React app
app.get("/*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

async function fetchOpenAICompletionsStream(messages, callback) {
  //NOTE - Refactor this to a .env file before deployment!
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  const aiModel = "gpt-4";
  try {
    const completion = await openai.chat.completions.create({
      model: aiModel,
      messages: messages,
      temperature: 1, // NOTE - Temperature is a representation of creativity
      stream: true,
    });

    for await (const chunk of completion) {
      callback(chunk);
    }
  } catch (error) {
    console.error("Error fetching data from OpenAI API:", error);
    throw new Error("Error fetching data from OpenAI API.");
  }
}

app.listen(PORT, () => {
  console.log("Server listening on port", PORT);
});

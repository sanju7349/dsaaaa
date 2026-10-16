import app from "./app";
import { logger } from "./lib/logger";
import { initializeDatabase } from "./lib/database";
import { simulationController } from "./simulation/simulationController";

const rawPort = process.env["PORT"] || "5000";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function startServer(): Promise<void> {
  await initializeDatabase();
  await simulationController.restorePersistedDataset();
  const llmProvider = process.env.OPENAI_API_KEY
    ? "OpenAI"
    : process.env.ANTHROPIC_API_KEY
      ? "Anthropic"
      : process.env.GROQ_API_KEY
        ? "Groq"
        : "none (chat endpoint in fallback mode)";
  logger.info({ llmProvider }, "LLM provider startup status");

  app.listen(port, () => {
    logger.info({ port }, "Server listening");
  });
}

void startServer().catch((err: unknown) => {
  logger.error({ err }, "Error starting API server");
  process.exit(1);
});

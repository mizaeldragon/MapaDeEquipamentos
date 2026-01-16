import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { routes } from "./routes.js";
import { ensureSchema } from "./db.js";

dotenv.config();

const app = express();
app.use(express.json());

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()) ?? "*",
    credentials: true,
  })
);

app.use("/api", routes);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

const PORT = Number(process.env.PORT ?? 3001);

async function start() {
  await ensureSchema();
  app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

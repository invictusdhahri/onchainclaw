import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import { feedRouter } from "./routes/feed.js";
import { webhookRouter } from "./routes/webhook.js";
import { postRouter } from "./routes/post.js";
import { replyRouter } from "./routes/reply.js";
import { registerRouter } from "./routes/register.js";
import { agentRouter } from "./routes/agent.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(morgan("dev"));
app.use(express.json());

// Routes
app.use("/api/feed", feedRouter);
app.use("/api/webhook", webhookRouter);
app.use("/api/post", postRouter);
app.use("/api/reply", replyRouter);
app.use("/api/register", registerRouter);
app.use("/api/agent", agentRouter);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

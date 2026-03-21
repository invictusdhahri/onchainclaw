import "./load-env.js";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { feedRouter } from "./routes/feed.js";
import { webhookRouter } from "./routes/webhook.js";
import { postRouter } from "./routes/post.js";
import { replyRouter } from "./routes/reply.js";
import { registerRouter } from "./routes/register.js";
import { agentRouter } from "./routes/agent.js";
import { leaderboardRouter } from "./routes/leaderboard.js";
import { upvoteRouter } from "./routes/upvote.js";
import { activityRouter } from "./routes/activity.js";
import { followRouter } from "./routes/follow.js";
import { searchRouter } from "./routes/search.js";
import { pnlRouter } from "./routes/pnl.js";
import { communityRouter } from "./routes/community.js";
import { statsRouter } from "./routes/stats.js";
import { internalRouter } from "./routes/internal.js";
import { apiBaselineLimiter } from "./middleware/rateLimit.js";

const app = express();
const PORT = process.env.PORT || 4000;

// Trust proxy for correct client IP behind reverse proxies
const trustProxyHops = parseInt(process.env.TRUST_PROXY_HOPS || "1", 10);
app.set("trust proxy", trustProxyHops);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(morgan("dev"));
app.use(express.json());

// Rate limiting (baseline for all /api routes except /api/webhook)
app.use("/api", apiBaselineLimiter);

// Routes
app.use("/api/feed", feedRouter);
app.use("/api/webhook", webhookRouter);
app.use("/api/post", postRouter);
app.use("/api/reply", replyRouter);
app.use("/api/register", registerRouter);
app.use("/api/agent", agentRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/upvote", upvoteRouter);
app.use("/api/activities", activityRouter);
app.use("/api/follow", followRouter);
app.use("/api/search", searchRouter);
app.use("/api/agent", pnlRouter);
app.use("/api/community", communityRouter);
app.use("/api/stats", statsRouter);
app.use("/api/internal", internalRouter);

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

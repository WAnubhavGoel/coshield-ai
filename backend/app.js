import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import passport from "passport";

import "./passport.js";
import authRouter from "./routes/auth.js";
import documentsRouter from "./routes/documents.js";
import complianceRouter from "./routes/compliance.js";

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(passport.initialize());

// Strict rate limit on auth routes: 15 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests from this IP. Please try again later." }
});

// General API limit: 100 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded. Please slow down." }
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy", timestamp: new Date() });
});

app.use("/uploads", express.static("./uploads"));

app.use("/api/v1/auth", authLimiter, authRouter);
app.use("/api/v1/documents", apiLimiter, documentsRouter);
app.use("/api/v1/compliance", apiLimiter, complianceRouter);

app.use((err, req, res, next) => {
  console.error("Global Error Handler caught:", err);

  const status = err.status || 500;
  const message = err.message || "An unexpected error occurred on the server";

  res.status(status).json({
    error: message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined
  });
});

export default app;

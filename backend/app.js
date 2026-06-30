import "dotenv/config";
import express from "express";
import cors from "cors";
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

app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy", timestamp: new Date() });
});

app.use("/uploads", express.static("./uploads"));

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/documents", documentsRouter);
app.use("/api/v1/compliance", complianceRouter);

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

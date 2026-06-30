import express from "express";
import { authenticateJWT } from "../middleware/auth.js";
import { queryCompliance } from "../controllers/compliance.js";

const router = express.Router();

router.post("/query", authenticateJWT, queryCompliance);

export default router;

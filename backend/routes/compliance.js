import express from "express";
import { authenticateJWT } from "../middleware/auth.js";
import { queryCompliance } from "../controllers/compliance.js";
import { validateComplianceQuery } from "../middleware/validate.js";

const router = express.Router();

router.post("/query", authenticateJWT, validateComplianceQuery, queryCompliance);

export default router;

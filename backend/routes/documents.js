import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authenticateJWT, requireRole } from "../middleware/auth.js";
import { uploadDocument, getDocuments, getDocumentStatus } from "../controllers/documents.js";

const router = express.Router();

const UPLOADS_DIR = path.resolve("./uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only PDF documents are supported"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.post(
  "/upload",
  authenticateJWT,
  requireRole("COMPLIANCE_OFFICER"),
  upload.single("pdf"),
  uploadDocument
);

router.get("/", authenticateJWT, getDocuments);
router.get("/:id/status", authenticateJWT, getDocumentStatus);

export default router;

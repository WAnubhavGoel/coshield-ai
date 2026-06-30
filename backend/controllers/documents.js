import path from "path";
import fs from "fs";
import { prisma } from "../prisma/prisma.js";
import { documentQueue } from "../services/queue.js";

export const uploadDocument = async (req, res) => {
  const { title, roleRequired, departmentId } = req.body;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "No PDF file uploaded" });
  }

  const documentTitle = title || path.basename(file.originalname, path.extname(file.originalname));
  const targetRole = roleRequired || "USER";

  try {
    const document = await prisma.document.create({
      data: {
        title: documentTitle,
        s3Url: file.path,
        status: "PENDING",
        tenantId: req.user.tenantId,
        uploadedById: req.user.id,
        roleRequired: targetRole,
        departmentId: departmentId || null
      }
    });

    if (documentQueue) {
      await documentQueue.add(`ingest-${document.id}`, {
        documentId: document.id,
        filePath: file.path,
        tenantId: req.user.tenantId,
        roleRequired: targetRole,
        departmentId: departmentId || null
      });
      console.log(`Dispatched background parsing job for Document: ${document.id}`);
    } else {
      console.warn("BullMQ queue is not available. Document will remain in PENDING status.");
    }

    return res.status(202).json({
      message: "Document upload accepted, ingestion started in background",
      document
    });
  } catch (error) {
    console.error("Document upload error:", error);
    if (file && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    return res.status(500).json({ error: "Failed to create document record during upload" });
  }
};

export const getDocuments = async (req, res) => {
  try {
    const documents = await prisma.document.findMany({
      where: {
        tenantId: req.user.tenantId
      },
      include: {
        uploadedBy: {
          select: {
            email: true
          }
        },
        department: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return res.status(200).json({ documents });
  } catch (error) {
    console.error("Get documents error:", error);
    return res.status(500).json({ error: "Failed to query tenant documents" });
  }
};

export const getDocumentStatus = async (req, res) => {
  const { id } = req.params;

  try {
    const document = await prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        title: true,
        tenantId: true
      }
    });

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (document.tenantId !== req.user.tenantId) {
      return res.status(403).json({ error: "Access Denied" });
    }

    return res.status(200).json({
      id: document.id,
      title: document.title,
      status: document.status
    });
  } catch (error) {
    console.error("Get status error:", error);
    return res.status(500).json({ error: "Failed to query document status" });
  }
};

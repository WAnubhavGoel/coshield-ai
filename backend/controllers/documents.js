import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { v2 as cloudinary } from "cloudinary";
import { prisma } from "../prisma/prisma.js";
import { documentQueue } from "../services/queue.js";
import { invalidateByPattern, buildDocumentsCacheKey } from "../services/cache.js";

export const deleteDocument = async (req, res) => {
  const { id } = req.params;

  try {
    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true, tenantId: true, s3Url: true, title: true }
    });

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (document.tenantId !== req.user.tenantId) {
      return res.status(403).json({ error: "Access Denied" });
    }

    // Delete all chunks first (FK constraint)
    await prisma.documentChunk.deleteMany({ where: { documentId: id } });

    // Delete the document record
    await prisma.document.delete({ where: { id } });

    // Clean up file storage
    if (document.s3Url) {
      if (document.s3Url.startsWith("http://") || document.s3Url.startsWith("https://")) {
        // Cloudinary upload: delete it from cloud storage
        if (process.env.CLOUDINARY_CLOUD_NAME) {
          cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET
          });
          await cloudinary.uploader.destroy(`coshield_documents/${id}`, { resource_type: "raw" }).catch(() => {});
        }
      } else {
        // Local upload: delete it from local disk
        await fs.unlink(document.s3Url).catch(() => {});
      }
    }

    // Invalidate cache
    await invalidateByPattern(`coshield:documents:${req.user.tenantId}*`);
    await invalidateByPattern(`coshield:compliance:${req.user.tenantId}:*`);

    console.log(`Document "${document.title}" (${id}) deleted by ${req.user.email}`);
    return res.status(200).json({ message: "Document deleted successfully" });
  } catch (error) {
    console.error("Delete document error:", error);
    return res.status(500).json({ error: "Failed to delete document" });
  }
};

export const uploadDocument = async (req, res) => {
  const { title, roleRequired, departmentId } = req.body;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "No PDF file uploaded" });
  }

  const documentTitle = title || path.basename(file.originalname, path.extname(file.originalname));
  const targetRole = roleRequired || "USER";

  // Create document ID beforehand so we can use it as Cloudinary public ID
  const tempId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

  try {
    let fileUrl = file.path;

    // Check if Cloudinary is configured
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      console.log(`Cloudinary is configured. Uploading ${file.originalname} to cloud storage...`);
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
      });

      const uploadResult = await cloudinary.uploader.upload(file.path, {
        resource_type: "raw",
        folder: "coshield_documents",
        public_id: tempId
      });

      fileUrl = uploadResult.secure_url;
      console.log(`Successfully uploaded file to Cloudinary: ${fileUrl}`);

      // Clean up the local temp file saved by multer
      await fs.unlink(file.path).catch(() => {});
    }

    const document = await prisma.document.create({
      data: {
        id: tempId,
        title: documentTitle,
        s3Url: fileUrl,
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
        filePath: fileUrl,
        tenantId: req.user.tenantId,
        roleRequired: targetRole,
        departmentId: departmentId || null
      });
      console.log(`Dispatched background parsing job for Document: ${document.id}`);
    } else {
      console.warn("BullMQ queue is not available. Document will remain in PENDING status.");
    }

    await invalidateByPattern(`coshield:documents:${req.user.tenantId}*`);

    return res.status(202).json({
      message: "Document upload accepted, ingestion started in background",
      document
    });
  } catch (error) {
    console.error("Document upload error:", error);
    if (file) {
      await fs.unlink(file.path).catch(() => {});
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

export const serveDocument = async (req, res) => {
  const { id } = req.params;

  try {
    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true, title: true, s3Url: true, tenantId: true }
    });

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (document.tenantId !== req.user.tenantId) {
      return res.status(403).json({ error: "Access Denied" });
    }

    const filePath = document.s3Url;

    if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
      console.log(`Redirecting document request to remote storage: ${filePath}`);
      return res.redirect(filePath);
    }

    if (!fsSync.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found on disk" });
    }

    const stat = fsSync.statSync(filePath);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Disposition", `inline; filename="${document.title}.pdf"`);
    res.setHeader("Cache-Control", "private, max-age=3600");

    const stream = fsSync.createReadStream(filePath);
    stream.pipe(res);
  } catch (error) {
    console.error("Serve document error:", error);
    return res.status(500).json({ error: "Failed to serve document" });
  }
};

export const getDocumentStats = async (req, res) => {
  const tenantId = req.user.tenantId;

  try {
    const [documentCount, chunkCount] = await Promise.all([
      prisma.document.count({ where: { tenantId } }),
      prisma.documentChunk.count({ where: { tenantId } })
    ]);

    return res.status(200).json({
      documentCount,
      chunkCount,
      tenantId
    });
  } catch (error) {
    console.error("Get stats error:", error);
    return res.status(500).json({ error: "Failed to fetch document stats" });
  }
};

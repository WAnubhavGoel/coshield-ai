import { Worker } from "bullmq";
import fs from "fs/promises";
import crypto from "crypto";
import { prisma } from "../prisma/prisma.js";
import { getEmbedding } from "./gemini.js";
import { QUEUE_NAME, redisConnection } from "./queue.js";
import { invalidateByPattern } from "./cache.js";

async function extractTextFromPDF(filePath) {
  try {
    let dataBuffer;
    
    // Support remote URLs (e.g. Cloudinary) as well as local disk paths
    if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
      console.log(`Downloading remote PDF from: ${filePath}`);
      const response = await fetch(filePath);
      if (!response.ok) throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      dataBuffer = Buffer.from(await response.arrayBuffer());
    } else {
      dataBuffer = await fs.readFile(filePath);
    }

    try {
      const pdfModule = await import("pdf-parse");
      // pdf-parse is CommonJS — in ESM interop, the function is either .default or the module itself
      const pdfParse = pdfModule.default ?? pdfModule;
      if (typeof pdfParse !== "function") throw new Error("pdf-parse did not export a function");
      const data = await pdfParse(dataBuffer);
      const text = data.text || "";
      console.log(`pdf-parse extracted ${text.length} characters from ${filePath}`);
      return text;
    } catch (pdfErr) {
      console.warn("pdf-parse failed:", pdfErr.message, "— falling back to regex extractor.");
      const contentString = dataBuffer.toString("latin1");
      const textMatches = contentString.match(/[\x20-\x7E]{8,}/g);
      if (textMatches && textMatches.length > 0) {
        return textMatches.join("\n");
      }
      return "Empty or un-extractable document content.";
    }
  } catch (error) {
    console.error(`Error reading file at ${filePath}:`, error.message);
    throw error;
  }
}


function chunkText(text, size = 500, overlap = 100) {
  const chunks = [];
  let startIndex = 0;

  const cleanText = text.replace(/\s+/g, " ").trim();

  if (cleanText.length === 0) return [];

  while (startIndex < cleanText.length) {
    const chunk = cleanText.substring(startIndex, startIndex + size);
    chunks.push(chunk);
    startIndex += size - overlap;
  }

  return chunks;
}

if (redisConnection) {
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { documentId, filePath, tenantId, roleRequired, departmentId } = job.data;
      console.log(`Processing ingestion job ${job.id} for Document: ${documentId}`);

      try {
        await prisma.document.update({
          where: { id: documentId },
          data: { status: "PROCESSING" }
        });

        const fullText = await extractTextFromPDF(filePath);

        const textChunks = chunkText(fullText, 600, 150);
        console.log(`Document split into ${textChunks.length} chunks.`);

        for (let i = 0; i < textChunks.length; i++) {
          const content = textChunks[i];
          const pageNumber = Math.floor(i / 3) + 1;

          const embedding = await getEmbedding(content);
          const embeddingString = `[${embedding.join(",")}]`;
          const chunkId = crypto.randomUUID();

          await prisma.$executeRaw`
            INSERT INTO "DocumentChunk" (
              "id", 
              "documentId", 
              "content", 
              "pageNumber", 
              "tenantId", 
              "roleRequired", 
              "departmentId", 
              "embedding", 
              "createdAt", 
              "updatedAt"
            )
            VALUES (
              ${chunkId},
              ${documentId},
              ${content},
              ${pageNumber},
              ${tenantId},
              ${roleRequired}::"Role",
              ${departmentId},
              cast(${embeddingString} as vector),
              now(),
              now()
            )
          `;
        }

        await prisma.document.update({
          where: { id: documentId },
          data: { status: "COMPLETED" }
        });

        // Invalidate compliance and documents cache for this tenant
        // so that the newly ingested document is included in future queries
        await invalidateByPattern(`coshield:compliance:${tenantId}:*`);
        await invalidateByPattern(`coshield:documents:${tenantId}*`);

        console.log(`Ingestion job ${job.id} completed. Cache invalidated for tenant ${tenantId}.`);
      } catch (error) {
        console.error(`Ingestion job ${job.id} failed:`, error.message);

        await prisma.document.update({
          where: { id: documentId },
          data: { status: "FAILED" }
        }).catch(err => console.error("Failed to update status to FAILED:", err.message));

        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 2
    }
  );

  worker.on("completed", (job) => {
    console.log(`Job ${job.id} has completed!`);
  });

  worker.on("failed", (job, err) => {
    console.error(`Job ${job?.id} failed with ${err.message}`);
  });

  console.log("BullMQ Ingestion Worker initialized and listening for jobs...");
} else {
  console.warn("BullMQ Ingestion Worker disabled: Redis connection not available.");
}

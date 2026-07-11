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

    if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
      
      const response = await fetch(filePath);
      if (!response.ok) throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      dataBuffer = Buffer.from(await response.arrayBuffer());
    } else {
      dataBuffer = await fs.readFile(filePath);
    }

    try {
      const pdfModule = await import("pdf-parse");
      
      const pdfParse = pdfModule.default ?? pdfModule;
      if (typeof pdfParse !== "function") throw new Error("pdf-parse did not export a function");
      const data = await pdfParse(dataBuffer);
      const text = data.text || "";
      
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

      try {
        await prisma.document.update({
          where: { id: documentId },
          data: { status: "PROCESSING" }
        });

        const fullText = await extractTextFromPDF(filePath);

        const textChunks = chunkText(fullText, 600, 150);

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

        await invalidateByPattern(`coshield:compliance:${tenantId}:*`);
        await invalidateByPattern(`coshield:documents:${tenantId}*`);

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
    
  });

  worker.on("failed", (job, err) => {
    console.error(`Job ${job?.id} failed with ${err.message}`);
  });

} else {
  console.warn("BullMQ Ingestion Worker disabled: Redis connection not available.");
}

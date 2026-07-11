import { prisma } from "../prisma/prisma.js";
import { getEmbedding, generateChatCompletion } from "../services/gemini.js";
import { getCached, setCache, buildComplianceCacheKey } from "../services/cache.js";
import { CACHE_TTL } from "../config/constants.js";

function performRRF(vectorResults, keywordResults, k = 60) {
  const scoreMap = new Map();
  const chunkDetails = new Map();

  const processList = (list) => {
    list.forEach((item, index) => {
      const id = item.id;
      const rank = index + 1;
      const score = 1 / (k + rank);

      if (!chunkDetails.has(id)) {
        chunkDetails.set(id, item);
      }

      const existingScore = scoreMap.get(id) || 0;
      scoreMap.set(id, existingScore + score);
    });
  };

  processList(vectorResults);
  processList(keywordResults);

  const sortedIds = Array.from(scoreMap.keys()).sort((a, b) => {
    return scoreMap.get(b) - scoreMap.get(a);
  });

  return sortedIds.map(id => ({
    ...chunkDetails.get(id),
    rrfScore: scoreMap.get(id)
  }));
}

export const queryCompliance = async (req, res) => {
  const { question } = req.body;

  const tenantId = req.user.tenantId;
  const userRole = req.user.role;
  const userDepartments = req.user.departments || [];

  const cacheKey = buildComplianceCacheKey(tenantId, userRole, userDepartments, question);
  const cached = await getCached(cacheKey);
  if (cached) {
    return res.status(200).json({ ...cached, cached: true });
  }

  try {
    const queryEmbedding = await getEmbedding(question);
    const embeddingString = `[${queryEmbedding.join(",")}]`;

    const vectorChunks = await prisma.$queryRaw`
      SELECT 
        c.id, 
        c."documentId", 
        c.content, 
        c."pageNumber",
        d.title as "documentTitle",
        1 - (c.embedding <=> cast(${embeddingString} as vector)) as "similarityScore"
      FROM "DocumentChunk" c
      JOIN "Document" d ON c."documentId" = d.id
      WHERE c."tenantId" = ${tenantId}
        AND c."roleRequired" <= ${userRole}::"Role"
        AND (c."departmentId" IS NULL OR c."departmentId" = ANY(${userDepartments}::text[]))
      ORDER BY c.embedding <=> cast(${embeddingString} as vector)
      LIMIT 10
    `;

    const keywordChunks = await prisma.$queryRaw`
      SELECT 
        c.id, 
        c."documentId", 
        c.content, 
        c."pageNumber",
        d.title as "documentTitle",
        ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', ${question})) as "relevanceScore"
      FROM "DocumentChunk" c
      JOIN "Document" d ON c."documentId" = d.id
      WHERE c."tenantId" = ${tenantId}
        AND c."roleRequired" <= ${userRole}::"Role"
        AND (c."departmentId" IS NULL OR c."departmentId" = ANY(${userDepartments}::text[]))
        AND to_tsvector('english', c.content) @@ plainto_tsquery('english', ${question})
      ORDER BY "relevanceScore" DESC
      LIMIT 10
    `;

    const fusedChunks = performRRF(vectorChunks, keywordChunks).slice(0, 5);

    if (fusedChunks.length === 0) {
      return res.status(200).json({
        answer: "No relevant security policies or compliance documents were found matching your request. Please ensure the document is uploaded and you have appropriate department clearances.",
        citations: [],
        cached: false
      });
    }

    const contextContent = fusedChunks
      .map((chunk) => `[Source ID: ${chunk.id}] [Document: ${chunk.documentTitle}] [Page: ${chunk.pageNumber}]\nContent: ${chunk.content}`)
      .join("\n\n---\n\n");

    const systemPrompt = `You are CoShield AI, a premium Enterprise Security & Compliance RAG Engine.
Analyze the user's compliance question using the provided context chunks.
Synthesize a professional, accurate compliance response based STRICTLY on the facts inside the context.
If the context does not contain enough information to answer, state clearly what is missing rather than fabricating facts.

Your output MUST be a valid JSON object containing exactly two keys: "answer" and "citations".
Do not wrap your output in markdown code blocks like \`\`\`json. Return only the raw JSON string.

Schema:
{
  "answer": "Detailed synthesis of the answer, including direct points from policies.",
  "citations": [
    {
      "chunk_id": "The exact 'Source ID' UUID from the context used to back this statement",
      "document_title": "The exact title of the document referenced",
      "page_number": 1,
      "snippet": "A short, direct quote from the source text verifying the statement"
    }
  ]
}

Strictly enforce that you only include citations for chunk_ids that are present in the context and that you actually referenced to formulate the answer.`;

    const userPrompt = `Context:\n${contextContent}\n\nQuestion: ${question}`;

    const llmRawResponse = await generateChatCompletion(systemPrompt, userPrompt);

    let responsePayload;
    try {
      
      const startIdx = llmRawResponse.indexOf("{");
      const endIdx = llmRawResponse.lastIndexOf("}");
      
      if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
        throw new Error("No JSON object found in response");
      }
      
      const jsonString = llmRawResponse.substring(startIdx, endIdx + 1);
      responsePayload = JSON.parse(jsonString);
    } catch (parseError) {
      console.warn("Standard JSON parsing failed, trying cleaned fallback. Raw response was:", llmRawResponse);
      try {
        const cleaned = llmRawResponse.replace(/```json|```/g, "").trim();
        responsePayload = JSON.parse(cleaned);
      } catch (fallbackError) {
        console.error("All JSON parsing attempts failed:", fallbackError);
        
        responsePayload = {
          answer: llmRawResponse || "An error occurred while parsing the AI response.",
          citations: []
        };
      }
    }

    if (!responsePayload || typeof responsePayload !== "object") {
      responsePayload = {
        answer: String(responsePayload || "Invalid AI response format."),
        citations: []
      };
    }

    responsePayload.source_documents = fusedChunks.map(chunk => ({
      chunk_id: chunk.id,
      document_id: chunk.documentId,
      document_title: chunk.documentTitle,
      page_number: chunk.pageNumber,
      content_snippet: chunk.content.substring(0, 200) + "..."
    }));

    await setCache(cacheKey, responsePayload, CACHE_TTL.COMPLIANCE_QUERY);

    return res.status(200).json({ ...responsePayload, cached: false });
  } catch (error) {
    console.error("Compliance search error:", error);
    return res.status(500).json({ error: "An error occurred during compliance query synthesis." });
  }
};

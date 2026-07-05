import crypto from "crypto";
import { redisConnection } from "./queue.js";

const buildKey = (...parts) => parts.join(":");

export const getCached = async (key) => {
  if (!redisConnection) return null;
  try {
    const data = await redisConnection.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

export const setCache = async (key, value, ttl) => {
  if (!redisConnection) return;
  try {
    await redisConnection.set(key, JSON.stringify(value), "EX", ttl);
  } catch {}
};

export const invalidateByPattern = async (pattern) => {
  if (!redisConnection) return;
  try {
    const keys = await redisConnection.keys(pattern);
    if (keys.length > 0) {
      await redisConnection.del(...keys);
    }
  } catch {}
};

export const buildComplianceCacheKey = (tenantId, userRole, departments, question) => {
  const normalizedQuestion = question.toLowerCase().trim();
  const questionHash = crypto.createHash("md5").update(normalizedQuestion).digest("hex");
  const deptKey = [...departments].sort().join(",") || "none";
  return buildKey("coshield", "compliance", tenantId, userRole, deptKey, questionHash);
};

export const buildDocumentsCacheKey = (tenantId) => {
  return buildKey("coshield", "documents", tenantId);
};


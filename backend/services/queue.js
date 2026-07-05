import { Queue } from "bullmq";
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

let connection = null;
let documentQueue = null;

try {
  const redisOptions = {
    maxRetriesPerRequest: null,
  };

  if (REDIS_URL.startsWith("rediss://")) {
    redisOptions.tls = {
      rejectUnauthorized: false
    };
  }

  connection = new Redis(REDIS_URL, redisOptions);

  connection.on("error", (err) => {
    console.error("Redis connection error:", err.message);
  });

  documentQueue = new Queue("DocumentQueue", {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    },
  });

  console.log("BullMQ DocumentQueue initialized successfully using Redis.");
} catch (error) {
  console.error("Failed to initialize Redis connection for BullMQ:", error.message);
}

export { documentQueue, connection as redisConnection };
export const QUEUE_NAME = "DocumentQueue";

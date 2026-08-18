import { Queue, type Worker } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../env.js";
import logger from "../logger.js";

export const bullConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 1000 },
  removeOnComplete: 100,
  removeOnFail: 500,
};

export const createQueue = <T>(name: string) =>
  new Queue<T, unknown, string>(name, {
    connection: bullConnection,
    defaultJobOptions,
  });

const workers: Worker[] = [];

export const registerWorker = (worker: Worker) => {
  worker.on("error", (err) => {
    logger.error(`Worker ${worker.name} encountered an error`, { err });
  });
  worker.on("failed", (job, err) => {
    logger.error(`Worker ${worker.name} failed job ${job?.id}`, {
      err: err.message,
    });
  });
  workers.push(worker);
};

export const closeWorkers = async () => {
  await Promise.all(workers.map((w) => w.close()));
  await bullConnection.quit();
};

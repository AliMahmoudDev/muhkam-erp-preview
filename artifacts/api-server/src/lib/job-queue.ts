/**
 * job-queue.ts — Lightweight in-memory async job queue
 *
 * Works without Redis/BullMQ in development.
 * Each job runs in the same Node.js process via setImmediate.
 * Designed to be swapped for BullMQ when REDIS_URL is available.
 *
 * Usage:
 *   const jobId = enqueueJob("payroll_process", { periodId, companyId }, handler);
 *   const status = getJobStatus(jobId);
 */

import crypto from "node:crypto";
import { logger } from "./logger";

export type JobStatus = "queued" | "running" | "done" | "failed";

export interface JobRecord {
  id:        string;
  type:      string;
  status:    JobStatus;
  payload:   Record<string, unknown>;
  result?:   unknown;
  error?:    string;
  queued_at: string;
  done_at?:  string;
  progress?: number; // 0-100
}

const MAX_JOBS = 1000;
const jobs = new Map<string, JobRecord>();

/** Enqueue a job. Returns the jobId immediately. The handler runs async. */
export function enqueueJob<P extends Record<string, unknown>>(
  type: string,
  payload: P,
  handler: (job: JobRecord, updateProgress: (pct: number) => void) => Promise<unknown>,
): string {
  const id = crypto.randomUUID();
  const job: JobRecord = {
    id, type, status: "queued", payload,
    queued_at: new Date().toISOString(),
  };
  jobs.set(id, job);

  // Evict oldest jobs if we exceed the cap
  if (jobs.size > MAX_JOBS) {
    const oldest = Array.from(jobs.keys()).slice(0, jobs.size - MAX_JOBS);
    for (const k of oldest) jobs.delete(k);
  }

  setImmediate(async () => {
    job.status = "running";
    try {
      const updateProgress = (pct: number) => { job.progress = Math.min(100, Math.max(0, pct)); };
      job.result = await handler(job, updateProgress);
      job.status = "done";
      job.progress = 100;
      logger.info({ jobId: id, type }, "[JobQueue] Job completed");
    } catch (err) {
      job.status = "failed";
      job.error  = err instanceof Error ? err.message : String(err);
      logger.error({ jobId: id, type, err }, "[JobQueue] Job failed");
    } finally {
      job.done_at = new Date().toISOString();
    }
  });

  return id;
}

export function getJobStatus(jobId: string): JobRecord | undefined {
  return jobs.get(jobId);
}

export function getQueueStats() {
  let queued = 0, running = 0, done = 0, failed = 0;
  for (const j of jobs.values()) {
    if (j.status === "queued")  queued++;
    if (j.status === "running") running++;
    if (j.status === "done")    done++;
    if (j.status === "failed")  failed++;
  }
  return { total: jobs.size, queued, running, done, failed };
}

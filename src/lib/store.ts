import type { ReportJob } from "./types";

// Pluggable job store with three backends, picked by which env vars are present:
//   1. REDIS_URL           -> standard Redis (Railway's Redis plugin, etc.) via ioredis
//   2. KV_REST_API_URL     -> Vercel KV / Upstash REST API via @vercel/kv
//   3. (neither)           -> in-memory map (local dev only; not durable)
//
// In production you MUST have one of the first two, or jobs vanish between
// requests / restarts.

const KEY_PREFIX = "report:job:";
const INDEX_KEY = "report:jobs:index";

type Backend = {
  getJob(id: string): Promise<ReportJob | null>;
  saveJob(job: ReportJob): Promise<void>;
  listJobs(limit: number): Promise<ReportJob[]>;
};

let backend: Backend | null = null;

async function makeBackend(): Promise<Backend> {
  // --- 1. Standard Redis (Railway) ---
  if (process.env.REDIS_URL) {
    const { default: Redis } = await import("ioredis");
    const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 3 });
    return {
      async getJob(id) {
        const raw = await redis.get(KEY_PREFIX + id);
        return raw ? (JSON.parse(raw) as ReportJob) : null;
      },
      async saveJob(job) {
        const existed = await redis.exists(KEY_PREFIX + job.id);
        await redis.set(KEY_PREFIX + job.id, JSON.stringify(job));
        if (!existed) await redis.lpush(INDEX_KEY, job.id);
      },
      async listJobs(limit) {
        const ids = await redis.lrange(INDEX_KEY, 0, limit - 1);
        if (ids.length === 0) return [];
        const raws = await redis.mget(ids.map((id) => KEY_PREFIX + id));
        return raws.filter((r): r is string => Boolean(r)).map((r) => JSON.parse(r) as ReportJob);
      },
    };
  }

  // --- 2. Vercel KV / Upstash REST ---
  if (process.env.KV_REST_API_URL) {
    const { kv } = await import("@vercel/kv");
    return {
      async getJob(id) {
        return (await kv.get<ReportJob>(KEY_PREFIX + id)) ?? null;
      },
      async saveJob(job) {
        const existed = await kv.get<ReportJob>(KEY_PREFIX + job.id);
        await kv.set(KEY_PREFIX + job.id, job);
        if (!existed) await kv.lpush(INDEX_KEY, job.id);
      },
      async listJobs(limit) {
        const ids = await kv.lrange(INDEX_KEY, 0, limit - 1);
        const jobs = await Promise.all(ids.map((id) => kv.get<ReportJob>(KEY_PREFIX + id)));
        return jobs.filter((j): j is ReportJob => Boolean(j));
      },
    };
  }

  // --- 3. In-memory (local dev only) ---
  const mem = new Map<string, ReportJob>();
  const index: string[] = [];
  return {
    async getJob(id) {
      return mem.get(id) ?? null;
    },
    async saveJob(job) {
      if (!mem.has(job.id)) index.unshift(job.id);
      mem.set(job.id, job);
    },
    async listJobs(limit) {
      return index.slice(0, limit).map((id) => mem.get(id)!).filter(Boolean);
    },
  };
}

async function getBackend(): Promise<Backend> {
  if (!backend) backend = await makeBackend();
  return backend;
}

export async function saveJob(job: ReportJob): Promise<void> {
  job.updatedAt = new Date().toISOString();
  await (await getBackend()).saveJob(job);
}

export async function getJob(id: string): Promise<ReportJob | null> {
  return (await getBackend()).getJob(id);
}

export async function listJobs(limit = 50): Promise<ReportJob[]> {
  return (await getBackend()).listJobs(limit);
}

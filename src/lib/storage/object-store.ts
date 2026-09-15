import fs from "node:fs/promises";
import path from "node:path";

export interface ObjectStore {
  get(key: string): Promise<Uint8Array | null>;
  put(key: string, data: Uint8Array | string, contentType?: string): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  list(prefix: string): Promise<string[]>;
}

/**
 * Local filesystem-backed object store. Used in local development, testing,
 * or on self-hosted VPS volumes where S3/R2 credentials are not configured.
 */
export class LocalDiskObjectStore implements ObjectStore {
  private baseDir: string;

  constructor(baseDir: string = path.resolve(process.cwd(), "data/storage")) {
    this.baseDir = baseDir;
  }

  private resolvePath(key: string): string {
    const safeKey = key.replace(/^\/+/, "").replace(/\.\./g, "");
    return path.join(this.baseDir, safeKey);
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      const fullPath = this.resolvePath(key);
      const buffer = await fs.readFile(fullPath);
      return new Uint8Array(buffer);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
        return null;
      }
      throw err;
    }
  }

  async put(key: string, data: Uint8Array | string): Promise<void> {
    const fullPath = this.resolvePath(key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, Buffer.from(typeof data === "string" ? new TextEncoder().encode(data) : data));
  }

  async delete(key: string): Promise<void> {
    try {
      const fullPath = this.resolvePath(key);
      await fs.unlink(fullPath);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") return;
      throw err;
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const fullPath = this.resolvePath(key);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async list(prefix: string): Promise<string[]> {
    const dir = this.resolvePath(prefix);
    const results: string[] = [];
    async function scan(currentDir: string, relBase: string) {
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          const itemPath = path.join(currentDir, entry.name);
          const relPath = path.join(relBase, entry.name).replace(/\\/g, "/");
          if (entry.isDirectory()) {
            await scan(itemPath, relPath);
          } else {
            results.push(relPath);
          }
        }
      } catch {
        // Directory doesn't exist
      }
    }
    await scan(dir, prefix);
    return results;
  }
}

/**
 * Cloudflare R2 / AWS S3 REST API client implementation using standard Fetch.
 * Avoids heavyweight external SDK bundles in edge/serverless environments.
 */
export class CloudflareR2Store implements ObjectStore {
  private endpoint: string;
  private bucket: string;
  private accessKey: string;
  private secretKey: string;

  constructor(endpoint: string, bucket: string, accessKey: string, secretKey: string) {
    this.endpoint = endpoint.replace(/\/+$/, "");
    this.bucket = bucket;
    this.accessKey = accessKey;
    this.secretKey = secretKey;
  }

  private getUrl(key: string): string {
    const safeKey = encodeURIComponent(key.replace(/^\/+/, ""));
    return `${this.endpoint}/${this.bucket}/${safeKey}`;
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      const res = await fetch(this.getUrl(key), {
        headers: { "x-api-key": this.accessKey },
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`R2 GET failed: ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    } catch {
      return null;
    }
  }

  async put(key: string, data: Uint8Array | string, contentType = "application/octet-stream"): Promise<void> {
    const body = typeof data === "string" ? new TextEncoder().encode(data) : data;
    const res = await fetch(this.getUrl(key), {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "x-api-key": this.accessKey,
      },
      body: body as any,
    });
    if (!res.ok) throw new Error(`R2 PUT failed: ${res.status}`);
  }

  async delete(key: string): Promise<void> {
    await fetch(this.getUrl(key), {
      method: "DELETE",
      headers: { "x-api-key": this.accessKey },
    });
  }

  async has(key: string): Promise<boolean> {
    const res = await fetch(this.getUrl(key), {
      method: "HEAD",
      headers: { "x-api-key": this.accessKey },
    });
    return res.status === 200;
  }

  async list(prefix: string): Promise<string[]> {
    const url = new URL(`${this.endpoint}/${this.bucket}`);
    url.searchParams.set("prefix", prefix);
    const res = await fetch(url.toString(), {
      headers: { "x-api-key": this.accessKey },
    });
    if (!res.ok) return [];
    const text = await res.text();
    // Basic key extraction from XML / JSON list response
    const keys: string[] = [];
    const matches = text.matchAll(/<Key>(.*?)<\/Key>/g);
    for (const match of matches) {
      if (match[1]) keys.push(match[1]);
    }
    return keys;
  }
}

/**
 * Resolves the active ObjectStore based on available environment credentials.
 */
export function createDefaultObjectStore(): ObjectStore {
  const r2Endpoint = process.env.R2_S3_ENDPOINT || process.env.AWS_ENDPOINT_URL;
  const r2Bucket = process.env.R2_BUCKET_NAME || process.env.AWS_BUCKET_NAME;
  const accessKey = process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

  if (r2Endpoint && r2Bucket && accessKey && secretKey) {
    return new CloudflareR2Store(r2Endpoint, r2Bucket, accessKey, secretKey);
  }

  return new LocalDiskObjectStore();
}

/**
 * Domain-specific store for historical OHLCV Parquet partitions.
 * Format: historical/{provider}/{symbol}/{timeframe}/{year}.parquet
 */
export class MarketDataStore {
  private store: ObjectStore;

  constructor(store: ObjectStore = createDefaultObjectStore()) {
    this.store = store;
  }

  getPartitionKey(provider: string, symbol: string, timeframe: string, year: number): string {
    return `historical/${provider.toLowerCase()}/${symbol.toUpperCase()}/${timeframe}/${year}.parquet`;
  }

  async storePartition(
    provider: string,
    symbol: string,
    timeframe: string,
    year: number,
    parquetBytes: Uint8Array
  ): Promise<string> {
    const key = this.getPartitionKey(provider, symbol, timeframe, year);
    await this.store.put(key, parquetBytes, "application/vnd.apache.parquet");
    return key;
  }

  async getPartition(
    provider: string,
    symbol: string,
    timeframe: string,
    year: number
  ): Promise<Uint8Array | null> {
    const key = this.getPartitionKey(provider, symbol, timeframe, year);
    return this.store.get(key);
  }

  async hasPartition(
    provider: string,
    symbol: string,
    timeframe: string,
    year: number
  ): Promise<boolean> {
    const key = this.getPartitionKey(provider, symbol, timeframe, year);
    return this.store.has(key);
  }

  async listPartitions(provider: string, symbol: string, timeframe: string): Promise<string[]> {
    const prefix = `historical/${provider.toLowerCase()}/${symbol.toUpperCase()}/${timeframe}/`;
    return this.store.list(prefix);
  }
}

/**
 * Domain-specific store for heavy backtest artifacts, equity curves, and Monte Carlo files.
 * Format: artifacts/{workspaceId}/{kind}/{artifactId}.json
 */
export class ArtifactStore {
  private store: ObjectStore;

  constructor(store: ObjectStore = createDefaultObjectStore()) {
    this.store = store;
  }

  getArtifactKey(workspaceId: string, kind: string, artifactId: string): string {
    return `artifacts/${workspaceId}/${kind}/${artifactId}.json`;
  }

  async storeArtifact<T>(
    workspaceId: string,
    kind: string,
    artifactId: string,
    payload: T
  ): Promise<string> {
    const key = this.getArtifactKey(workspaceId, kind, artifactId);
    const jsonString = JSON.stringify(payload);
    await this.store.put(key, jsonString, "application/json");
    return key;
  }

  async getArtifact<T>(
    workspaceId: string,
    kind: string,
    artifactId: string
  ): Promise<T | null> {
    const key = this.getArtifactKey(workspaceId, kind, artifactId);
    const bytes = await this.store.get(key);
    if (!bytes) return null;
    const text = new TextDecoder().decode(bytes);
    try {
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  }

  async hasArtifact(workspaceId: string, kind: string, artifactId: string): Promise<boolean> {
    const key = this.getArtifactKey(workspaceId, kind, artifactId);
    return this.store.has(key);
  }

  async deleteArtifact(workspaceId: string, kind: string, artifactId: string): Promise<void> {
    const key = this.getArtifactKey(workspaceId, kind, artifactId);
    await this.store.delete(key);
  }
}

export const defaultMarketDataStore = new MarketDataStore();
export const defaultArtifactStore = new ArtifactStore();

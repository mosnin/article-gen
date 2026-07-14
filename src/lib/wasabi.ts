/**
 * Wasabi object storage (S3-compatible).
 *
 * Env:
 *   WASABI_ACCESS_KEY_ID / WASABI_SECRET_ACCESS_KEY — bucket credentials
 *   WASABI_BUCKET                                   — bucket name
 *   WASABI_REGION                                   — e.g. "us-east-1"
 *   WASABI_ENDPOINT (optional)                      — defaults to the
 *     region service endpoint https://s3.<region>.wasabisys.com
 *
 * Security model:
 *  - All keys are namespaced under users/<userId>/ and every helper takes
 *    the userId; callers cannot escape their prefix (keys are sanitized and
 *    validated against the prefix before any operation).
 *  - Data in transit is HTTPS (presigned URLs are https); Wasabi encrypts
 *    all objects at rest with AES-256 by default.
 *  - Presigned URLs are short-lived: 15 min for uploads, 60 min for
 *    downloads by default.
 */

import crypto from "crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const UPLOAD_URL_TTL_SECONDS = 15 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 60 * 60;

/** Max object size accepted through the direct (server-relayed) upload path. */
export const MAX_DIRECT_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

let cachedClient: S3Client | null = null;

export function isWasabiConfigured(): boolean {
  return Boolean(
    process.env.WASABI_ACCESS_KEY_ID &&
    process.env.WASABI_SECRET_ACCESS_KEY &&
    process.env.WASABI_BUCKET,
  );
}

function bucket(): string {
  const b = process.env.WASABI_BUCKET;
  if (!b) throw new Error("WASABI_BUCKET is not configured");
  return b;
}

function client(): S3Client {
  if (cachedClient) return cachedClient;
  const accessKeyId = process.env.WASABI_ACCESS_KEY_ID;
  const secretAccessKey = process.env.WASABI_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("Wasabi storage is not configured (WASABI_ACCESS_KEY_ID / WASABI_SECRET_ACCESS_KEY)");
  }
  const region = process.env.WASABI_REGION || "us-east-1";
  const endpoint = process.env.WASABI_ENDPOINT || `https://s3.${region}.wasabisys.com`;
  cachedClient = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    // Wasabi works with virtual-hosted style, but path style is the safe
    // default for buckets with dots in the name.
    forcePathStyle: true,
  });
  return cachedClient;
}

function userPrefix(userId: string): string {
  return `users/${userId}/uploads/`;
}

/** Make a filename safe for use in an object key. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "");
  return (cleaned || "file").slice(0, 180);
}

/** Build a fresh, collision-resistant key inside the user's namespace. */
export function buildUserKey(userId: string, filename: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const rand = crypto.randomUUID().slice(0, 8);
  return `${userPrefix(userId)}${stamp}/${rand}-${sanitizeFilename(filename)}`;
}

/** Validate that a caller-supplied key belongs to the user. Throws if not. */
export function assertUserKey(userId: string, key: string): string {
  const normalized = key.replace(/^\/+/, "");
  if (normalized.includes("..") || !normalized.startsWith(userPrefix(userId))) {
    throw new Error("Invalid storage key");
  }
  return normalized;
}

export type StoredObject = {
  key: string;
  size: number;
  lastModified: string | null;
};

export async function uploadObject(params: {
  userId: string;
  filename: string;
  body: Buffer | Uint8Array | string;
  contentType: string;
}): Promise<{ key: string }> {
  const key = buildUserKey(params.userId, params.filename);
  await client().send(new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    Body: typeof params.body === "string" ? Buffer.from(params.body, "utf8") : params.body,
    ContentType: params.contentType,
  }));
  return { key };
}

export async function presignUpload(params: {
  userId: string;
  filename: string;
  contentType: string;
}): Promise<{ key: string; uploadUrl: string; expiresInSeconds: number }> {
  const key = buildUserKey(params.userId, params.filename);
  const uploadUrl = await getSignedUrl(
    client(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: params.contentType }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS },
  );
  return { key, uploadUrl, expiresInSeconds: UPLOAD_URL_TTL_SECONDS };
}

export async function presignDownload(userId: string, key: string): Promise<{ downloadUrl: string; expiresInSeconds: number }> {
  const safeKey = assertUserKey(userId, key);
  const downloadUrl = await getSignedUrl(
    client(),
    new GetObjectCommand({ Bucket: bucket(), Key: safeKey }),
    { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
  );
  return { downloadUrl, expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS };
}

export async function deleteObject(userId: string, key: string): Promise<void> {
  const safeKey = assertUserKey(userId, key);
  await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: safeKey }));
}

export async function listObjects(userId: string, opts?: { limit?: number }): Promise<StoredObject[]> {
  const res = await client().send(new ListObjectsV2Command({
    Bucket: bucket(),
    Prefix: userPrefix(userId),
    MaxKeys: Math.min(opts?.limit ?? 100, 1000),
  }));
  return (res.Contents ?? []).map((o) => ({
    key: o.Key ?? "",
    size: o.Size ?? 0,
    lastModified: o.LastModified ? o.LastModified.toISOString() : null,
  }));
}

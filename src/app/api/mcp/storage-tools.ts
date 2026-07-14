import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  isWasabiConfigured,
  uploadObject,
  presignUpload,
  presignDownload,
  listObjects,
  deleteObject,
  MAX_DIRECT_UPLOAD_BYTES,
} from "@/lib/wasabi";
import { defineTool, jsonResult, errorResult } from "@/lib/mcp/context";
import type { McpAuth } from "@/lib/mcp/auth";

/**
 * Wasabi-backed content storage for agents. Everything is confined to the
 * authenticated user's users/<id>/uploads/ prefix; transfers run over HTTPS
 * with short-lived presigned URLs; Wasabi encrypts objects at rest (AES-256).
 * File bodies are redacted from the audit log.
 */

const notConfigured = () =>
  errorResult("File storage is not configured. Set the WASABI_* environment variables.");

export function registerStorageTools(server: McpServer, auth: McpAuth) {
  defineTool(server, auth, {
    name: "upload_content",
    description:
      "Upload a file to the user's cloud storage (Wasabi). Provide content_text for text files or content_base64 for binary; max 10 MB. Returns the storage key and a temporary download URL.",
    scope: "storage",
    schema: {
      filename: z.string().min(1).max(300),
      content_text: z.string().max(MAX_DIRECT_UPLOAD_BYTES).optional().describe("UTF-8 text body"),
      content_base64: z.string().max(Math.ceil(MAX_DIRECT_UPLOAD_BYTES * 1.4)).optional().describe("Base64-encoded binary body"),
      content_type: z.string().max(120).regex(/^[\w.+-]+\/[\w.+-]+$/).default("application/octet-stream"),
    },
    handler: async ({ filename, content_text, content_base64, content_type }) => {
      if (!isWasabiConfigured()) return notConfigured();
      if (!content_text && !content_base64) {
        return errorResult("Provide content_text or content_base64");
      }
      let body: Buffer;
      if (content_base64) {
        try {
          body = Buffer.from(content_base64, "base64");
        } catch {
          return errorResult("content_base64 is not valid base64");
        }
      } else {
        body = Buffer.from(content_text as string, "utf8");
      }
      if (body.byteLength > MAX_DIRECT_UPLOAD_BYTES) {
        return errorResult("File exceeds the 10 MB direct-upload limit; use get_upload_url for larger files");
      }
      const { key } = await uploadObject({ userId: auth.userId, filename, body, contentType: content_type });
      const { downloadUrl, expiresInSeconds } = await presignDownload(auth.userId, key);
      return jsonResult({ uploaded: true, key, sizeBytes: body.byteLength, downloadUrl, downloadUrlExpiresInSeconds: expiresInSeconds });
    },
  });

  defineTool(server, auth, {
    name: "get_upload_url",
    description:
      "Get a presigned HTTPS PUT URL for uploading a large file directly to storage (valid 15 minutes). PUT the raw bytes with the same Content-Type.",
    scope: "storage",
    schema: {
      filename: z.string().min(1).max(300),
      content_type: z.string().max(120).regex(/^[\w.+-]+\/[\w.+-]+$/).default("application/octet-stream"),
    },
    handler: async ({ filename, content_type }) => {
      if (!isWasabiConfigured()) return notConfigured();
      const result = await presignUpload({ userId: auth.userId, filename, contentType: content_type });
      return jsonResult(result);
    },
  });

  defineTool(server, auth, {
    name: "list_uploads",
    description: "List files in the user's cloud storage (key, size, last modified).",
    scope: "read",
    schema: { limit: z.number().int().min(1).max(500).default(100) },
    handler: async ({ limit }) => {
      if (!isWasabiConfigured()) return notConfigured();
      const objects = await listObjects(auth.userId, { limit });
      return jsonResult(objects);
    },
  });

  defineTool(server, auth, {
    name: "get_download_url",
    description: "Get a temporary HTTPS download URL (valid 60 minutes) for a stored file.",
    scope: "read",
    schema: { key: z.string().min(1).max(600) },
    handler: async ({ key }) => {
      if (!isWasabiConfigured()) return notConfigured();
      const result = await presignDownload(auth.userId, key);
      return jsonResult(result);
    },
  });

  defineTool(server, auth, {
    name: "delete_upload",
    description: "Delete a file from the user's cloud storage.",
    scope: "storage",
    schema: { key: z.string().min(1).max(600) },
    handler: async ({ key }) => {
      if (!isWasabiConfigured()) return notConfigured();
      await deleteObject(auth.userId, key);
      return jsonResult({ deleted: true, key });
    },
  });
}

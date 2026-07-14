"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type StoredObject = { key: string; size: number; lastModified: string | null };

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function displayName(key: string): string {
  const base = key.split("/").pop() ?? key;
  // Strip the 8-char collision prefix added at upload time ("a1b2c3d4-name.ext")
  return base.replace(/^[0-9a-f]{8}-/, "");
}

export default function UploadsPage() {
  const [objects, setObjects] = useState<StoredObject[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/storage/objects");
      const data = await res.json();
      setObjects(data.objects ?? []);
      setConfigured(data.configured !== false);
    } catch {
      toast.error("Failed to load files");
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        const presignRes = await fetch("/api/storage/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, contentType: file.type || "application/octet-stream" }),
        });
        const presign = await presignRes.json();
        if (!presignRes.ok) throw new Error(presign.error || "Presign failed");

        const putRes = await fetch(presign.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!putRes.ok) throw new Error(`Storage returned ${putRes.status}`);
        toast.success(`Uploaded ${file.name}`);
      } catch (e) {
        toast.error(`${file.name}: ${(e as Error).message}`);
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    refresh();
  };

  const handleDownload = async (key: string) => {
    try {
      const res = await fetch("/api/storage/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ downloadKey: key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleDelete = async (key: string) => {
    if (!window.confirm(`Delete ${displayName(key)}?`)) return;
    try {
      const res = await fetch(`/api/storage/objects?key=${encodeURIComponent(key)}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Delete failed");
      setObjects((prev) => prev.filter((o) => o.key !== key));
      toast.success("Deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Files</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Your cloud storage. Files uploaded here (or by your agents via MCP) are private,
            encrypted at rest, and shared only through expiring links.
          </p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || !configured}
          className="shrink-0 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Upload Files"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {!configured && (
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-raised)] p-4 text-sm text-[var(--text-secondary)]">
          File storage is not configured yet. Set the <code className="font-mono text-xs">WASABI_*</code> environment
          variables (see .env.example) to enable uploads.
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)]">
        {loading ? (
          <p className="p-6 text-sm text-[var(--text-secondary)]">Loading…</p>
        ) : objects.length === 0 ? (
          <p className="p-6 text-sm text-[var(--text-secondary)]">
            No files yet. Upload something, or ask your agent to store content with the upload_content tool.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-default)] text-left text-xs uppercase tracking-wide text-[var(--text-tertiary)]">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Size</th>
                <th className="px-4 py-3 font-medium">Uploaded</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {objects.map((o) => (
                <tr key={o.key} className="border-b border-[var(--border-default)] last:border-0">
                  <td className="max-w-[280px] truncate px-4 py-3 font-medium text-[var(--text-primary)]" title={o.key}>
                    {displayName(o.key)}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{formatBytes(o.size)}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {o.lastModified ? new Date(o.lastModified).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDownload(o.key)}
                      className="mr-3 text-xs font-medium text-[var(--accent)] hover:underline">
                      Download
                    </button>
                    <button onClick={() => handleDelete(o.key)}
                      className="text-xs font-medium text-[var(--error,#dc2626)] hover:underline">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const UPSTASH_URL = () => process.env.UPSTASH_VECTOR_REST_URL;
const UPSTASH_TOKEN = () => process.env.UPSTASH_VECTOR_REST_TOKEN;

export type UpstashVector = {
  id: string;
  vector: number[];
  metadata?: Record<string, unknown>;
};

export type UpstashQueryMatch = {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
};

async function call<T = unknown>(path: string, body: unknown): Promise<T> {
  const url = UPSTASH_URL();
  const token = UPSTASH_TOKEN();
  if (!url || !token) throw new Error("Upstash Vector env not configured");
  const resp = await fetch(`${url}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Upstash ${path} failed (${resp.status}): ${text}`);
  }
  const data = (await resp.json()) as { result: T };
  return data.result;
}

export async function upsertVector(
  namespace: string,
  v: UpstashVector,
): Promise<void> {
  await call(`/upsert?namespace=${encodeURIComponent(namespace)}`, {
    id: v.id,
    vector: v.vector,
    metadata: v.metadata,
  });
}

export async function queryVector(
  namespace: string,
  vector: number[],
  topK: number,
  includeMetadata = true,
): Promise<UpstashQueryMatch[]> {
  const result = await call<UpstashQueryMatch[]>(
    `/query?namespace=${encodeURIComponent(namespace)}`,
    { vector, topK, includeMetadata },
  );
  return result ?? [];
}

export async function deleteVector(namespace: string, id: string): Promise<void> {
  await call(`/delete?namespace=${encodeURIComponent(namespace)}`, { ids: [id] });
}

export function userNamespace(userId: string): string {
  return `user:${userId}`;
}

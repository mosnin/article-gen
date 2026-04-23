export interface GscAnalyticsRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscAnalyticsResponse {
  rows?: GscAnalyticsRow[];
}

/**
 * HTTP status returned by Search Console when access is denied (typically because the
 * authenticated user is not a verified owner/user of the site URL being queried).
 */
export const GSC_ACCESS_DENIED_STATUSES = new Set<number>([403, 404]);

export interface RunSearchAnalyticsResult {
  ok: boolean;
  status: number;
  data: GscAnalyticsResponse | null;
}

function isAnalyticsResponse(value: unknown): value is GscAnalyticsResponse {
  if (!value || typeof value !== "object") return false;
  const rows = (value as Record<string, unknown>).rows;
  if (rows === undefined) return true;
  if (!Array.isArray(rows)) return false;
  return rows.every((r) => {
    if (!r || typeof r !== "object") return false;
    const row = r as Record<string, unknown>;
    return (
      Array.isArray(row.keys) &&
      row.keys.every((k) => typeof k === "string") &&
      typeof row.clicks === "number" &&
      typeof row.impressions === "number" &&
      typeof row.ctr === "number" &&
      typeof row.position === "number"
    );
  });
}

/**
 * POST to the Search Console searchAnalytics/query endpoint.
 * Returns {ok, status, data}. Callers decide whether non-ok statuses (403/404) should
 * translate to "connected but empty" or be surfaced as a warning.
 */
export async function runSearchAnalytics(
  accessToken: string,
  siteUrl: string,
  body: Record<string, unknown>,
): Promise<RunSearchAnalyticsResult> {
  let res: Response;
  try {
    res = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
  } catch {
    return { ok: false, status: 0, data: null };
  }

  if (!res.ok) {
    return { ok: false, status: res.status, data: null };
  }

  let parsed: unknown;
  try {
    parsed = await res.json();
  } catch {
    return { ok: false, status: res.status, data: null };
  }

  if (!isAnalyticsResponse(parsed)) {
    return { ok: false, status: res.status, data: null };
  }

  return { ok: true, status: res.status, data: parsed };
}

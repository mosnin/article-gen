import { NextResponse } from "next/server";
import type { ZodSchema } from "zod";

export async function parseJsonBody<T>(req: Request, schema: ZodSchema<T>): Promise<T | NextResponse> {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: issue?.message || "Invalid request body" },
      { status: 400 }
    );
  }

  return parsed.data;
}

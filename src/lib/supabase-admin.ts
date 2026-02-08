import { createClient } from "@supabase/supabase-js";

const BUCKET_NAME = "article-images";

let bucketEnsured = false;

export function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function ensureImageBucket() {
  if (bucketEnsured) return;
  const admin = getAdminClient();
  const { data } = await admin.storage.getBucket(BUCKET_NAME);
  if (!data) {
    await admin.storage.createBucket(BUCKET_NAME, { public: true });
  }
  bucketEnsured = true;
}

export async function uploadImage(
  userId: string,
  articleId: string,
  filename: string,
  buffer: Buffer
): Promise<string> {
  await ensureImageBucket();
  const admin = getAdminClient();
  const path = `${userId}/${articleId}/${filename}.png`;

  const { error } = await admin.storage
    .from(BUCKET_NAME)
    .upload(path, buffer, {
      contentType: "image/png",
      upsert: true,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return path;
}

export function getPublicUrl(storagePath: string): string {
  const admin = getAdminClient();
  const { data } = admin.storage
    .from(BUCKET_NAME)
    .getPublicUrl(storagePath);
  return data.publicUrl;
}

export async function downloadImage(storagePath: string): Promise<Buffer> {
  const admin = getAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET_NAME)
    .download(storagePath);

  if (error || !data) throw new Error(`Storage download failed: ${error?.message || "No data"}`);
  return Buffer.from(await data.arrayBuffer());
}

export { BUCKET_NAME };

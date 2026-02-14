export function isInScope(
  selectedBlogId: string,
  wpBlogId?: string | null
): boolean {
  if (!selectedBlogId) {
    return !wpBlogId;
  }

  return wpBlogId === selectedBlogId;
}

"""Storage-facing tools. Uploads go through /api/internal/upload-image."""

from __future__ import annotations

from modal_app.harness.tools.http import post_internal


async def upload_image(
    user_id: str, article_id: str, filename: str, base64_png: str
) -> dict:
    """POST /api/internal/upload-image. Returns {storagePath, publicUrl}."""
    return await post_internal(
        "/upload-image",
        {
            "userId": user_id,
            "articleId": article_id,
            "filename": filename,
            "base64Png": base64_png,
        },
    )

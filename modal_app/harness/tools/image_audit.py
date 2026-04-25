"""ImageOptimizer tools — corpus image scan + recommendation persistence."""
from __future__ import annotations

from agents import function_tool

from modal_app.harness.tools.http import get_run_id, post_internal


@function_tool
async def list_articles_with_images(user_id: str, limit: int = 200) -> dict:
    """Pull the user's recent published articles that have at least one
    generated image. Returns
    { articles: [{id, title, generatedImages: [{type, altText, storagePath,
    publicUrl, success}, ...]}] }."""
    return await post_internal(
        "/list-articles-with-images",
        {"userId": user_id, "limit": limit},
    )


@function_tool
async def save_image_optimization_recommendations(
    user_id: str, recommendations: list[dict]
) -> dict:
    """Persist image optimization recommendations. Each recommendation:
    {articleId, imageIndex, imageStoragePath?, issue, recommendedAction,
    currentValue?, recommendedValue?}. Returns {insertedCount}."""
    return await post_internal(
        "/save-image-optimization-recommendations",
        {
            "userId": user_id,
            "runId": get_run_id(),
            "recommendations": recommendations,
        },
    )

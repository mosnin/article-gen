"""SchemaDoctor tools — schema validation + persistence."""
from __future__ import annotations

from agents import function_tool

from modal_app.harness.tools.http import get_run_id, post_internal


@function_tool
async def get_article_schema(user_id: str, article_id: str) -> dict:
    """Fetch an article's current schema_json + relevant fields.

    Returns { articleId, title, focusKeyword, slug, schemaJson?,
    articleMarkdown? }.
    """
    return await post_internal(
        "/get-article", {"userId": user_id, "articleId": article_id}
    )


@function_tool
async def validate_jsonld(schema_json_str: str) -> dict:
    """Validate JSON-LD against schema.org rules.

    Returns { valid: bool, errors: [str], warnings: [str],
    typesFound: [str] }. Server-side: parses JSON, checks
    @context = schema.org, walks @graph for required fields per type.
    """
    return await post_internal("/validate-jsonld", {"schemaJson": schema_json_str})


@function_tool
async def save_schema_diagnosis(
    user_id: str,
    article_id: str,
    current_schema: dict | None,
    recommended_schema: dict,
    recommendations: list[dict],
    validation_status: str,
    validation_errors: list[str],
) -> dict:
    """Persist a SchemaDiagnosis row. Returns {diagnosisId}."""
    return await post_internal(
        "/save-schema-diagnosis",
        {
            "userId": user_id,
            "runId": get_run_id(),
            "articleId": article_id,
            "currentSchema": current_schema,
            "recommendedSchema": recommended_schema,
            "recommendations": recommendations,
            "validationStatus": validation_status,
            "validationErrors": validation_errors,
        },
    )

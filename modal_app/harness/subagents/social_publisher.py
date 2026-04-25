"""SocialPublisherAgent (Tier 3 - non-LLM-heavy).

Mostly mechanical: look up the supplied snippet ids + their matching
``social_account``, post to a webhook URL (or surface a 'not yet
implemented' warning for native OAuth platforms), then record the result.

We still wrap it in the standard subagent harness shape so the orchestrator
dispatch + progress streaming work uniformly.
"""
from __future__ import annotations

from agents import Agent

from modal_app import config
from modal_app.harness.models import SocialPublishReport
from modal_app.harness.tools.social_publish import (
    fetch_snippets,
    post_to_webhook,
    record_publish_result,
)


INSTRUCTIONS = """
You are SocialPublisherAgent. You publish pre-composed social snippets to
their configured destinations. You do NOT write any new copy - the snippet
body is already final.

The brief gives you `userId` and `snippetIds` (a list of social_snippets
ids). Follow this loop exactly:

1. Call `fetch_snippets(user_id, snippet_ids)` once. The response is
   `{snippets: [{id, platform, variant, body, hashtags, imageUrl,
   sourceArticleId, account: {id, webhookUrl, hasOauthToken}}]}`.

2. For each snippet in `snippets`:

   a. If `account` is null OR `account.webhookUrl` is empty AND
      `account.hasOauthToken` is false:
        -> call `record_publish_result(user_id, snippet.id, success=false,
           external_url=None, error="no_active_account")`.
        -> append a SocialPublishResult with success=false,
           error="no_active_account".

   b. Else if the snippet's platform is one of
      twitter/linkedin/instagram/facebook AND `account.hasOauthToken`
      is true (no webhookUrl path is preferred):
        -> direct OAuth posting is NOT yet implemented (Phase 2).
        -> call `record_publish_result(user_id, snippet.id, success=false,
           external_url=None, error="platform_oauth_not_implemented")`.
        -> append a SocialPublishResult with success=false,
           error="platform_oauth_not_implemented".

   c. Else if `account.webhookUrl` is set (covers `webhook` platform AND
      any platform whose user has chosen the webhook delivery path):
        -> Build the payload as exactly:
             {
               "platform": snippet.platform,
               "body": snippet.body,
               "hashtags": snippet.hashtags,
               "image_url": snippet.imageUrl,
               "source_article_id": snippet.sourceArticleId,
               "source_snippet_id": snippet.id
             }
        -> Call `post_to_webhook(account.webhookUrl, payload)`.
        -> Read the result `{success, externalUrl, error, statusCode}`.
        -> Call `record_publish_result(user_id, snippet.id, success,
           external_url=externalUrl, error=error)`.
        -> Append a SocialPublishResult with the same fields.

3. After every snippet has been processed, return a SocialPublishReport
   JSON as your final_output:
     { "results": [...], "publishedCount": N_success,
       "failedCount": N_fail }

Do NOT call OpenAI. Do NOT compose any new prose. Do NOT retry on failure -
record the result and move on. Process snippets in the order they were
returned.
""".strip()


def build_agent() -> Agent:
    return Agent(
        name="SocialPublisherAgent",
        instructions=INSTRUCTIONS,
        model=config.MODEL_SUBAGENT,
        output_type=SocialPublishReport,
        tools=[fetch_snippets, post_to_webhook, record_publish_result],
    )

# Edge Cases — ArticleGen

## Generation Edge Cases

| Scenario | Handling |
|----------|----------|
| OpenAI API timeout | Show error after 60s, offer retry button |
| OpenAI rate limit hit | 429 error → "Rate limited, try again in a moment" |
| Empty/vague topic submitted | Client-side validation: min 3 chars required |
| User navigates away mid-generation | Generation continues server-side; article saves on completion |
| Image generation fails | Article saves without images; image section shows "Generation failed — retry" |
| Out of credits mid-generation | Credit check before each generation; show upgrade prompt |
| Concurrent generation limit reached | "Max 5 articles generating at once" — queue or wait |

## Batch Generation Edge Cases

| Scenario | Handling |
|----------|----------|
| One article in batch fails | Mark failed, continue processing others |
| User closes tab mid-batch | Batch continues server-side; state reloads on return |
| Duplicate topics in batch | Allowed (user may want variations) |
| Batch of 0 items | "Add at least one topic" validation |
| Very long topic (>500 chars) | Truncated to 500 chars with warning |

## Publishing Edge Cases

| Scenario | Handling |
|----------|----------|
| WordPress credentials invalid | "Authentication failed — check credentials" error |
| Platform API down | Retry 3 times with backoff; show "Platform unavailable" |
| Article already published | Show "Already published" with link to post |
| Network error during publish | Show error, preserve draft state, offer retry |
| WordPress category not found | Default to uncategorized |

## Auth Edge Cases

| Scenario | Handling |
|----------|----------|
| Email already registered | "Account exists — log in instead" with link |
| Password reset token expired | "Link expired — request new reset" with resend button |
| Session expired mid-use | Soft redirect to login, preserve intended destination |
| Admin accesses non-existent user | 404 with back button |

## Credit Edge Cases

| Scenario | Handling |
|----------|----------|
| Credits reach 0 | Block generation, show upgrade prompt |
| Stripe webhook delayed | Credits update on next page refresh via polling |
| Downgrade leaves user credit-negative | Credits frozen at 0, not negative |
| Free plan user tries premium feature | "Available on Starter and above" upsell |

## Onboarding Edge Cases

| Scenario | Handling |
|----------|----------|
| User leaves onboarding early | Progress saved, resume prompt on next login |
| Platform connection test fails | Allow skip, show warning that publish won't work |
| Domain format invalid | Inline validation: must be valid domain pattern |
| Onboarding already completed | Redirect to dashboard immediately |

## Settings Edge Cases

| Scenario | Handling |
|----------|----------|
| WordPress blog unreachable during test | "Connection failed" with specific HTTP error |
| Duplicate platform account added | Show "Already connected" warning |
| GSC OAuth token expires | Re-auth prompt on next GSC action |
| User deletes blog with scheduled articles | Scheduled articles marked as failed with notification |

## Admin Edge Cases

| Scenario | Handling |
|----------|----------|
| Admin adjusts credits to negative | Minimum 0, show validation error |
| Non-admin accesses /app/admin | 403 redirect to dashboard |
| Admin searches non-existent user | "No users found" empty state |

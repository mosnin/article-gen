# 26 Observability and Monitoring

> **TL;DR:** Defines the logging, error tracking, metrics, and alerting strategy for production SaaS apps. Covers structured logging conventions, Sentry integration rules, health checks, and alerting thresholds.
> **Covers:** structured logging, error tracking, health checks, metrics collection, alerting rules, production debugging | **Depends on:** 09, 17 | **Used by:** 05, 14 | **Phase:** 4 (setup), 14 (polish)

## Purpose

A shipped SaaS app with no observability is a black box. This file defines what to log, how to track errors, what to monitor, and when to alert — so production issues are detected and diagnosed before users report them.

---

## Structured Logging

### Log Format

All server-side logs must be structured JSON. Never use `console.log` with plain strings in production code.

```typescript
// Bad
console.log("User signed up: " + email)

// Good
logger.info("user.signup", { userId: user.id, email: user.email, plan: "free" })
```

### Log Levels

| Level | When to Use | Example |
|-------|------------|---------|
| `error` | Something broke. User-facing failure or data integrity risk. | Database connection failed, Stripe webhook signature invalid |
| `warn` | Something is off but not broken. Degraded behavior. | Rate limit approaching, retry succeeded after failure |
| `info` | Normal business events worth tracking. | User signed up, subscription changed, onboarding completed |
| `debug` | Developer-only context. Never in production by default. | Query parameters, raw API responses |

### Required Log Fields

Every log entry must include:

| Field | Type | Source |
|-------|------|--------|
| `timestamp` | ISO 8601 | Auto-generated |
| `level` | string | Log level |
| `message` | string | Human-readable event name (dot-notation: `auth.login.success`) |
| `organizationId` | string | From session/context (when available) |
| `userId` | string | From session/context (when available) |
| `requestId` | string | Generated per request (middleware) |

### Event Naming Convention

Use dot-notation for log messages: `{domain}.{action}.{result}`

```
auth.login.success
auth.login.failed
billing.subscription.created
billing.webhook.received
billing.webhook.failed
onboarding.step.completed
feature.project.created
feature.project.deleted
admin.user.suspended
email.send.success
email.send.failed
```

### What to Log

| Category | Events to Log |
|----------|--------------|
| **Auth** | Login success/failure, signup, password reset request, email verification, session expiry |
| **Billing** | Subscription created/changed/canceled, payment success/failure, webhook received/processed/failed |
| **Admin** | Any admin action (user management, plan changes, feature toggles) |
| **Data mutations** | Entity create/update/delete for core entities (not every read) |
| **Integrations** | Connection/disconnection, sync success/failure, token refresh |
| **Errors** | All caught exceptions with stack trace, all API error responses |
| **Performance** | Slow queries (>500ms), slow API responses (>2s) |

### What NOT to Log

- Passwords, tokens, API keys, or secrets (even partially)
- Full request/response bodies (log relevant fields only)
- PII beyond what's needed for debugging (email is OK, full address is not)
- Every GET request (use access logs for that, not application logs)
- Debug-level noise in production

### Logger Implementation

Create a shared logger utility at `src/lib/logger.ts`:

```typescript
type LogLevel = "error" | "warn" | "info" | "debug"

interface LogContext {
  userId?: string
  organizationId?: string
  requestId?: string
  [key: string]: unknown
}

function log(level: LogLevel, message: string, context?: LogContext) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  }

  // In production: send to log aggregation service
  // In development: pretty-print to console
  if (process.env.NODE_ENV === "production") {
    process[level === "error" ? "stderr" : "stdout"].write(
      JSON.stringify(entry) + "\n"
    )
  } else {
    console[level === "debug" ? "log" : level](message, context)
  }
}

export const logger = {
  error: (msg: string, ctx?: LogContext) => log("error", msg, ctx),
  warn: (msg: string, ctx?: LogContext) => log("warn", msg, ctx),
  info: (msg: string, ctx?: LogContext) => log("info", msg, ctx),
  debug: (msg: string, ctx?: LogContext) => log("debug", msg, ctx),
}
```

---

## Error Tracking (Sentry)

### Setup

Install and configure Sentry during Phase 4 if the project includes it in the tech stack:

```bash
npx @sentry/wizard@latest -i nextjs
```

### What Sentry Captures

| Error Type | Sentry Behavior |
|-----------|----------------|
| Unhandled exceptions (server) | Auto-captured |
| Unhandled exceptions (client) | Auto-captured via error boundary |
| API route errors | Captured in catch blocks with `Sentry.captureException()` |
| Webhook processing errors | Captured with billing context |
| Auth failures (repeated) | Captured as breadcrumbs, alert on threshold |

### Context Rules

Always attach context to Sentry errors:

```typescript
Sentry.setUser({ id: user.id, email: user.email })
Sentry.setTag("organization", organization.slug)
Sentry.setTag("plan", subscription.plan)
```

### What NOT to Send to Sentry

- Expected errors (404 for unknown routes, 401 for unauthenticated requests)
- Validation errors (422 responses — these are user input errors, not bugs)
- Rate limit responses (429 — expected behavior)

Filter these in `sentry.server.config.ts`:

```typescript
beforeSend(event) {
  const status = event.contexts?.response?.status_code
  if (status && [401, 404, 422, 429].includes(status)) {
    return null // Don't send to Sentry
  }
  return event
}
```

### Source Maps

Enable source maps in production for readable stack traces. Sentry's Next.js SDK handles this automatically with `withSentryConfig` in `next.config.ts`.

---

## Health Checks

### Endpoint

Create a health check endpoint at `/api/health`:

```typescript
// src/app/api/health/route.ts
export async function GET() {
  const checks = {
    database: await checkDatabase(),
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_APP_VERSION || "unknown",
  }

  const healthy = checks.database
  return Response.json(checks, { status: healthy ? 200 : 503 })
}

async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch {
    return false
  }
}
```

### What to Check

| Check | Method | Failure Meaning |
|-------|--------|----------------|
| Database connectivity | `SELECT 1` | App cannot serve data |
| Redis/cache (if used) | `PING` | Rate limiting and caching degraded |
| External API (Stripe) | Skip — don't health-check external services | Use webhook monitoring instead |

### Health Check Rules

- Health checks must respond in <500ms
- Do not health-check external services (Stripe, Resend, etc.) — their failures are detected via webhook/send failures
- Return 200 for healthy, 503 for unhealthy
- Include database status and app version
- Do not require authentication

---

## Metrics

### Key Metrics to Track

| Metric | Type | Source |
|--------|------|--------|
| API response time (p50, p95, p99) | Histogram | Middleware timing |
| Error rate (5xx responses / total) | Ratio | API route responses |
| Active users (DAU/WAU/MAU) | Counter | Login events or session activity |
| Signup rate | Counter | Auth signup events |
| Onboarding completion rate | Ratio | Onboarding completion / signups |
| Subscription conversion rate | Ratio | Paid subscriptions / signups |
| Churn rate | Ratio | Cancellations / active subscriptions |
| Webhook processing time | Histogram | Webhook handler timing |
| Email delivery rate | Ratio | Successful sends / total sends |

### Where Metrics Live

For v1, metrics can be derived from:
1. **Usage Events table** — already defined in `07_data_models.md`
2. **Analytics Summary table** — pre-aggregated rollups
3. **Vercel Analytics** — automatic web vitals and serverless function metrics
4. **Sentry Performance** — automatic transaction tracing

Do not build a custom metrics pipeline for v1. Use existing data stores and the admin dashboard for visibility.

---

## Alerting

### Alert Thresholds

| Condition | Severity | Action |
|-----------|----------|--------|
| Health check returns 503 for >2 minutes | Critical | Page on-call |
| Error rate >5% for 5 minutes | Critical | Page on-call |
| Error rate >1% for 15 minutes | Warning | Notify via Slack/email |
| Stripe webhook failures >3 in 1 hour | Warning | Investigate billing |
| Email send failure rate >10% | Warning | Check Resend status |
| API p95 response time >3s for 10 minutes | Warning | Investigate performance |
| Database connection pool exhausted | Critical | Page on-call |

### Alert Rules

- Alerts fire on sustained conditions, not single events (avoid alert fatigue)
- Every alert must have a runbook or at least a "first thing to check" note
- Critical alerts require human acknowledgment
- Warning alerts auto-resolve when condition clears
- Do not alert on expected spikes (deployments, batch jobs)

### Implementation for v1

For v1, use Sentry's built-in alerting:
- Configure alert rules for error count thresholds
- Use Sentry's Slack integration for notifications
- Health check monitoring via Vercel's built-in checks or UptimeRobot (free tier)

---

## Production Debugging Checklist

When a production issue is reported:

1. **Check Sentry** — is there a matching error with stack trace?
2. **Check logs** — filter by `requestId`, `userId`, or `organizationId`
3. **Check health endpoint** — is the app healthy? Is the database up?
4. **Check Vercel dashboard** — any deployment issues? Function timeouts?
5. **Check Stripe dashboard** — if billing-related, check webhook delivery logs
6. **Check recent deployments** — did this start after a deploy? Compare with previous version.

---

## Integration with Error Taxonomy (File 17)

The error types defined in `17_error_state_taxonomy.md` map to observability actions:

| Error Type (from file 17) | Log Level | Sentry? | Alert? |
|---------------------------|-----------|---------|--------|
| Network error | warn | No (client-side) | No |
| Auth error (401) | info | No | Only if rate >threshold |
| Permission error (403) | warn | No | Only if unexpected |
| Not found (404) | info | No | No |
| Validation error (422) | info | No | No |
| Rate limit (429) | info | No | No |
| Server error (500) | error | Yes | Yes if rate >1% |
| Database error | error | Yes | Yes |
| External service error | error | Yes | Yes if sustained |

## Final Principle

Observability is not optional polish — it's infrastructure. Without it, you're debugging production issues by asking users "what did you click?" Build logging and error tracking into Phase 4 setup, not Phase 14 polish.

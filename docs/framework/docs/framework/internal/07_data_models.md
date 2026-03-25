# 07 Data Models

> **TL;DR:** Defines the canonical core entities (User, Organization, Membership, Subscription, Settings, Integration, Usage Event, Analytics Summary, Admin Record) with fields, types, and relationships.
> **Covers:** entity schemas, field definitions, relationships, multi-tenancy pattern, product entity extension, Prisma reference schema | **Depends on:** None | **Used by:** 02, 05, 06, 09 | **Phase:** 3, 4

## Purpose

Define the canonical core entities for SaaS products so that data modeling stays stable and consistent across projects. Product specific entities attach to these — they do not replace them.

## Canonical Core Entities

### User

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | primary key |
| email | string | unique, required |
| name | string | display name |
| avatar_url | string | nullable |
| email_verified | boolean | default false |
| password_hash | string | nullable if social auth only |
| last_login_at | timestamp | nullable |
| created_at | timestamp | |
| updated_at | timestamp | |

### Organization

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | primary key |
| name | string | workspace display name |
| slug | string | unique, used in URLs |
| logo_url | string | nullable |
| plan | enum | free, starter, pro, enterprise |
| created_by | uuid | FK to User |
| created_at | timestamp | |
| updated_at | timestamp | |

### Membership

Joins User to Organization with a role. A user can belong to multiple organizations.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | primary key |
| user_id | uuid | FK to User |
| organization_id | uuid | FK to Organization |
| role | enum | member, manager, admin, owner |
| status | enum | active, invited, suspended |
| invited_email | string | nullable, for pending invites |
| invited_at | timestamp | nullable |
| joined_at | timestamp | nullable |
| created_at | timestamp | |

Unique constraint on (user_id, organization_id).

### Subscription

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | primary key |
| organization_id | uuid | FK to Organization |
| stripe_customer_id | string | from billing provider |
| stripe_subscription_id | string | from billing provider |
| plan | enum | free, starter, pro, enterprise |
| status | enum | active, trialing, past_due, canceled, paused |
| current_period_start | timestamp | |
| current_period_end | timestamp | |
| cancel_at_period_end | boolean | default false |
| created_at | timestamp | |
| updated_at | timestamp | |

### Settings

Per-organization configuration. Key-value or structured JSON depending on product needs.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | primary key |
| organization_id | uuid | FK to Organization, unique |
| preferences | jsonb | notification prefs, feature toggles, defaults |
| onboarding_completed | boolean | default false |
| onboarding_step | string | nullable, tracks progress |
| created_at | timestamp | |
| updated_at | timestamp | |

### Integration

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | primary key |
| organization_id | uuid | FK to Organization |
| provider | string | e.g. slack, github, stripe |
| status | enum | active, disconnected, error |
| access_token | string | encrypted |
| refresh_token | string | encrypted, nullable |
| config | jsonb | provider-specific settings |
| connected_by | uuid | FK to User |
| connected_at | timestamp | |
| created_at | timestamp | |

### Usage Event

Append-only log for metering and analytics.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | primary key |
| organization_id | uuid | FK to Organization |
| user_id | uuid | FK to User, nullable for system events |
| event_type | string | e.g. api_call, message_sent, file_uploaded |
| metadata | jsonb | event-specific data |
| created_at | timestamp | immutable |

Index on (organization_id, event_type, created_at) for queries.

### Analytics Summary

Pre-aggregated rollups computed from Usage Events. Avoids expensive queries on raw events.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | primary key |
| organization_id | uuid | FK to Organization |
| period | enum | daily, weekly, monthly |
| period_start | date | |
| metric | string | e.g. total_api_calls, active_users, storage_used |
| value | numeric | |
| created_at | timestamp | |

Unique constraint on (organization_id, period, period_start, metric).

### Admin Record

System-level audit trail for admin actions.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | primary key |
| actor_id | uuid | FK to User (admin who performed action) |
| target_type | string | e.g. user, organization, subscription |
| target_id | uuid | |
| action | string | e.g. suspended_user, changed_plan, toggled_flag |
| details | jsonb | before/after state or context |
| created_at | timestamp | immutable |

## Relationships

```
User 1──M Membership M──1 Organization
Organization 1──1 Subscription
Organization 1──1 Settings
Organization 1──M Integration
Organization 1──M Usage Event
Organization 1──M Analytics Summary
User 1──M Admin Record (as actor)
```

## Extending With Product Entities

Product specific entities should reference Organization (for multi-tenancy) and optionally User (for ownership). Example pattern:

```
Project (product entity)
├── id: uuid
├── organization_id: uuid (FK to Organization)
├── created_by: uuid (FK to User)
├── name: string
├── status: enum
├── created_at: timestamp
└── updated_at: timestamp
```

## Prisma Reference Schema

Use this as the starting point for `prisma/schema.prisma`. Adapt field names and add product-specific models during Phase 4.

```prisma
// Enums
enum Role {
  member
  manager
  admin
  owner
}

enum MembershipStatus {
  active
  invited
  suspended
}

enum Plan {
  free
  starter
  pro
  enterprise
}

enum SubscriptionStatus {
  active
  trialing
  past_due
  canceled
  paused
}

enum IntegrationStatus {
  active
  disconnected
  error
}

enum AnalyticsPeriod {
  daily
  weekly
  monthly
}

// Models
model User {
  id             String       @id @default(uuid())
  email          String       @unique
  name           String
  avatarUrl      String?
  emailVerified  Boolean      @default(false)
  passwordHash   String?      // nullable if social auth only
  lastLoginAt    DateTime?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  memberships    Membership[]
  adminRecords   AdminRecord[]
  usageEvents    UsageEvent[]
  integrations   Integration[] @relation("ConnectedBy")
}

model Organization {
  id          String       @id @default(uuid())
  name        String
  slug        String       @unique   // URL-safe: lowercase, alphanumeric + hyphens, 3-60 chars
  logoUrl     String?
  plan        Plan         @default(free)
  createdBy   String       // FK to User.id
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  memberships    Membership[]
  subscription   Subscription?
  settings       Settings?
  integrations   Integration[]
  usageEvents    UsageEvent[]
  analyticsSummaries AnalyticsSummary[]

  @@index([slug])
}

model Membership {
  id             String           @id @default(uuid())
  userId         String
  organizationId String
  role           Role             @default(member)
  status         MembershipStatus @default(active)
  invitedEmail   String?          // for pending invites before user account exists
  invitedAt      DateTime?
  joinedAt       DateTime?
  createdAt      DateTime         @default(now())

  user           User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization   Organization     @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([userId, organizationId])
  @@index([organizationId])
  @@index([invitedEmail])
}

model Subscription {
  id                    String             @id @default(uuid())
  organizationId        String             @unique
  stripeCustomerId      String?
  stripeSubscriptionId  String?
  plan                  Plan               @default(free)
  status                SubscriptionStatus @default(active)
  currentPeriodStart    DateTime?
  currentPeriodEnd      DateTime?
  cancelAtPeriodEnd     Boolean            @default(false)
  createdAt             DateTime           @default(now())
  updatedAt             DateTime           @updatedAt

  organization          Organization       @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}

model Settings {
  id                  String   @id @default(uuid())
  organizationId      String   @unique
  preferences         Json     @default("{}")  // notification prefs, feature toggles, defaults
  onboardingCompleted Boolean  @default(false)
  onboardingStep      String?  // tracks current step for resume
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  organization        Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}

model Integration {
  id             String            @id @default(uuid())
  organizationId String
  provider       String            // e.g. "slack", "github", "stripe"
  status         IntegrationStatus @default(active)
  accessToken    String            // encrypted at application layer
  refreshToken   String?           // encrypted at application layer
  config         Json              @default("{}")  // provider-specific settings
  connectedBy    String            // FK to User.id
  connectedAt    DateTime          @default(now())
  createdAt      DateTime          @default(now())

  organization   Organization      @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user           User              @relation("ConnectedBy", fields: [connectedBy], references: [id])

  @@index([organizationId])
  @@unique([organizationId, provider])
}

model UsageEvent {
  id             String   @id @default(uuid())
  organizationId String
  userId         String?  // nullable for system events
  eventType      String   // e.g. "api_call", "message_sent", "file_uploaded"
  metadata       Json     @default("{}")
  createdAt      DateTime @default(now())  // immutable

  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user           User?        @relation(fields: [userId], references: [id])

  @@index([organizationId, eventType, createdAt])
}

model AnalyticsSummary {
  id             String          @id @default(uuid())
  organizationId String
  period         AnalyticsPeriod
  periodStart    DateTime
  metric         String          // e.g. "total_api_calls", "active_users"
  value          Decimal
  createdAt      DateTime        @default(now())

  organization   Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([organizationId, period, periodStart, metric])
  @@index([organizationId, metric])
}

model AdminRecord {
  id         String   @id @default(uuid())
  actorId    String   // FK to User (admin who performed action)
  targetType String   // e.g. "user", "organization", "subscription"
  targetId   String
  action     String   // e.g. "suspended_user", "changed_plan"
  details    Json     @default("{}")  // before/after state
  createdAt  DateTime @default(now())  // immutable

  actor      User     @relation(fields: [actorId], references: [id])

  @@index([targetType, targetId])
  @@index([actorId])
  @@index([createdAt])
}
```

## Membership State Machine

Valid state transitions for `Membership.status`:

```
invited → active     (user accepts invite)
invited → [deleted]  (invite revoked or expired)
active → suspended   (admin suspends member)
suspended → active   (admin reactivates member)
active → [deleted]   (member leaves or is removed)
```

## Organization Slug Rules

- Lowercase alphanumeric characters and hyphens only: `/^[a-z0-9][a-z0-9-]*[a-z0-9]$/`
- Minimum 3 characters, maximum 60 characters
- Must not start or end with a hyphen
- Reserved slugs: `admin`, `api`, `app`, `auth`, `billing`, `dashboard`, `settings`, `www`

## Cascade Delete Rules

- Deleting an Organization cascades to: Membership, Subscription, Settings, Integration, UsageEvent, AnalyticsSummary, and all product-specific entities
- Deleting a User cascades to: Membership (removes from all orgs). Does NOT delete Organization — ownership transfers first.

## Schema Migration Strategy

### Phase 4: Initial Schema

The initial schema is created from this file plus product-specific entities from the architecture plan. Run:

```bash
npx prisma migrate dev --name init
```

This creates the first migration. Commit both `prisma/schema.prisma` and `prisma/migrations/` to git.

### Post-Phase 4: Schema Changes

When subsequent phases need new entities or columns (common in Phase 9 when building features):

1. **Modify `schema.prisma`** — add the new model or field.
2. **Create a named migration:**
   ```bash
   npx prisma migrate dev --name add_[entity]_table
   # or
   npx prisma migrate dev --name add_status_to_projects
   ```
3. **Review the generated SQL** — Prisma writes SQL to `prisma/migrations/[timestamp]_[name]/migration.sql`. Read it before applying. Watch for:
   - Unintended column drops (Prisma may drop + recreate if you rename)
   - Missing default values on new required columns
   - Large table locks on production (adding NOT NULL column without default)
4. **Commit the migration** — both the schema change and the migration SQL.

### Migration Naming Convention

Use descriptive snake_case names: `create_[entity]`, `add_[field]_to_[entity]`, `remove_[field]_from_[entity]`, `add_[entity]_index`.

### Renaming vs. Dropping

Prisma interprets field renames as "drop + add" by default, which causes data loss. To rename:

1. Add the new column with `@map("old_column_name")` to preserve the database column.
2. Or use a custom migration: run `npx prisma migrate dev --create-only`, edit the SQL to use `ALTER TABLE RENAME COLUMN`, then apply.

### Required Column on Existing Data

Never add a required (`NOT NULL`) column without a default to a table that already has rows:

```prisma
// Bad — migration fails if table has data
status String

// Good — provide a default
status String @default("active")
```

### Production Migrations

For production deployments:

```bash
npx prisma migrate deploy
```

This applies pending migrations without generating new ones. Include this in the deployment pipeline (e.g., Vercel build command or GitHub Actions).

### When NOT to Migrate

- Schema-only changes (adding `@@index`) that don't affect data: safe to migrate anytime.
- Dropping columns: create the migration but verify no code references the column first.
- Enum value removal: dangerous — check that no rows use the value before migrating.

## Core Principle

Use a small set of stable core entities, then attach product specific entities to them. Never reinvent user, organization, membership, or billing models per project.

## Final Principle

Core entities should remain stable across projects. Product specific entities should extend them cleanly rather than reinventing account and permission logic every time.

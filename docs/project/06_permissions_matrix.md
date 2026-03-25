# Permissions Matrix — ArticleGen

## Roles
- **Guest** — unauthenticated visitor
- **User** — authenticated free or paid user
- **Admin** — authenticated user with `role = 'admin'` in user_profiles

## Route Permissions

| Route | Guest | User | Admin |
|-------|-------|------|-------|
| `/` (landing page) | ✅ | ✅ | ✅ |
| `/app` (dashboard) | ❌ → `/login` | ✅ | ✅ |
| `/app/onboarding` | ❌ → `/login` | ✅ | ✅ |
| `/app/settings` | ❌ → `/login` | ✅ | ✅ |
| `/app/billing` | ❌ → `/login` | ✅ | ✅ |
| `/app/publish/[id]` | ❌ → `/login` | ✅ (own) | ✅ |
| `/app/admin` | ❌ → `/login` | ❌ → `/app` | ✅ |

## Feature Permissions

| Feature | Guest | User | Admin |
|---------|-------|------|-------|
| View marketing site | ✅ | ✅ | ✅ |
| Generate articles | ❌ | ✅ (credits required) | ✅ |
| View own articles | ❌ | ✅ | ✅ |
| Delete own articles | ❌ | ✅ | ✅ |
| View other users' articles | ❌ | ❌ | ✅ |
| Publish to platforms | ❌ | ✅ | ✅ |
| Manage own settings | ❌ | ✅ | ✅ |
| View billing | ❌ | ✅ | ✅ |
| Manage billing | ❌ | ✅ (own) | ✅ |
| View admin panel | ❌ | ❌ | ✅ |
| Adjust user credits | ❌ | ❌ | ✅ |
| View all users | ❌ | ❌ | ✅ |

## Data Isolation

All Supabase tables with user data enforce Row Level Security (RLS):
- Articles: `user_id = auth.uid()`
- Clusters: `user_id = auth.uid()`
- UserSettings: `user_id = auth.uid()`
- WpBlogs: `user_id = auth.uid()`
- PublishingPlatforms: `user_id = auth.uid()`
- PublishLogs: `user_id = auth.uid()`
- GenerationSlots: `user_id = auth.uid()`

Admin bypass: Service role key used only in server-side admin API routes.

## Middleware Enforcement

`src/middleware.ts` protects all `/app/*` routes:
- Unauthenticated → redirect to `/login`
- Admin-only routes (`/app/admin`) → check `user_profiles.role = 'admin'`

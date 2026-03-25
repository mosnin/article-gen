# Feature Spec — ArticleGen

## F1: Article Generation Pipeline

**Priority**: P0 (core)

### Steps
1. **Research** — `/api/generate/research` — pulls context, related topics, and entities
2. **Metadata** — `/api/generate/metadata` — title, meta description, slug, focus keyword
3. **Article** — `/api/generate/article` — full markdown article with headings, intros, CTAs
4. **Images** — `/api/generate/images` — AI image prompts and DALL-E generation (optional)

### Quality Levels
- **Standard** — faster, GPT-4.1-mini, shorter prompts
- **Premium** — longer prompts, deeper research, more word count

### States
- idle → loading (with progress steps shown) → success (result panel) → error (retry)

### Inputs
- Topic (required)
- Focus keyword (optional, defaults to topic)
- Quality (standard/premium)
- Generate images (boolean toggle)
- Advanced settings (domain, site name, author info)

---

## F2: Batch Generation

**Priority**: P0

- User enters 1–50 topics (one per line or JSON import)
- Articles queued and processed in batches of 2
- 60-second delay between batches (rate limiting)
- Progress pill: minimizable floating indicator
- Failed articles highlighted with retry option

---

## F3: Topic Cluster Generation

**Priority**: P0

- User defines pillar topic + keyword
- AI generates 8 cluster article ideas
- Phase 1: Plan cluster ideas
- Phase 2: Generate pillar article
- Phase 3: Generate cluster articles in batches
- Phase 4: Regenerate pillar with all cluster links injected
- All cluster articles automatically interlinked

---

## F4: Multi-Platform Publishing

**Priority**: P0

### Platforms
- **WordPress**: REST API, encrypted app password, custom author, category selection
- **Medium**: Integration token, canonical URL
- **Dev.to**: API key, tags, canonical URL
- **Ghost**: Admin API key, custom slug
- **Shopify**: Storefront blog, access token

### Flow
1. User selects platform(s) in publish panel
2. One-click publish with status feedback
3. Success shows URL to published post
4. Failure shows error with retry

---

## F5: Scheduled Publishing

**Priority**: P1

- User schedules article for future publish date/time
- Cron job (`/api/cron/publish`) checks every minute
- Published via configured platform

---

## F6: Dashboard

**Priority**: P0

- Total articles generated (all time)
- Articles this month
- Published vs unpublished count
- Credits remaining / plan
- Recent articles list (last 10, with status badges)
- Topic clusters list with progress phases
- Quick action: "Generate new article"

---

## F7: Onboarding

**Priority**: P0

### Steps
1. **Welcome** — product overview, first-time context
2. **Site Setup** — domain, site name, site description
3. **Platform Connect** — connect at least one publishing platform (optional skip)
4. **First Article** — prompt user to generate their first article

### Rules
- Skip-able (except step 2 if domain required for cluster mode)
- Progress persisted to DB
- Redirects to dashboard on completion

---

## F8: Settings

**Priority**: P0

### Sections
- General: domain, site name, site about, author name/bio
- WordPress: manage multiple blogs (add/edit/delete)
- Other Platforms: Shopify, Medium, Ghost, Dev.to connections
- Generation Presets: saved quality/tone/audience settings
- Google Search Console: OAuth connect, site selection, keyword import

---

## F9: Billing & Credits

**Priority**: P0

- View current plan and credit balance
- Upgrade/downgrade via Stripe Checkout
- Manage payment via Stripe Customer Portal
- Credits deducted per generation (atomic, idempotent)
- Rate limit: max 5 concurrent generations

---

## F10: Admin Panel

**Priority**: P1

- List all users with plan, credits, join date
- Adjust credits for any user (add/remove)
- View system stats

---

## F11: Google Search Console Integration

**Priority**: P1

- OAuth connect (Google sign-in)
- Select connected site
- Import search queries as article topics (auto-fill batch queue)

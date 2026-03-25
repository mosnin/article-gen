# User Flows — ArticleGen

## First Value Event

**Definition**: User sees their first complete, publish-ready article with metadata, AI images, and schema markup — within 90 seconds of submitting a topic.

---

## Flow 1: New User Signup → First Article

1. User lands on marketing homepage
2. Clicks "Get started free"
3. Signs up with email + password
4. Email verification (Supabase handles)
5. Redirected to `/app/onboarding`
6. **Onboarding Step 1** (Welcome): Reviews what ArticleGen does, clicks "Get started"
7. **Onboarding Step 2** (Site Setup): Enters domain, site name, optional site description. Clicks "Continue"
8. **Onboarding Step 3** (Platform Connect): Optionally connects WordPress or another platform. Clicks "Continue" or "Skip for now"
9. Redirected to dashboard with empty state + "Generate your first article" CTA
10. Enters topic, clicks "Generate"
11. Sees progress steps animate (Research → Outline → Writing → Images)
12. Article appears in result panel → **First Value Event achieved**

---

## Flow 2: Returning User — Generate Single Article

1. User logs in → `/app`
2. Dashboard shows recent articles and credit balance
3. Clicks "New Article" or types in the topic input
4. Optionally adjusts keyword, quality, image toggle
5. Clicks "Generate"
6. Progress panel animates through generation steps
7. Article appears in right panel
8. Reviews article, copies markdown, or publishes directly

---

## Flow 3: Batch Generation

1. User navigates to batch mode tab
2. Pastes 5–20 topics (one per line)
3. Optionally imports ideas from GSC or Ideas generator
4. Selects quality level
5. Clicks "Start Batch"
6. Floating progress pill appears ("2/15 complete")
7. User can minimize pill, navigate around app
8. Articles appear in sidebar as completed
9. User reviews and publishes each

---

## Flow 4: Topic Cluster Generation

1. User navigates to Cluster mode tab
2. Enters pillar topic + keyword
3. Optionally enters existing pillar URL (for relinking only)
4. Enters domain (required for interlinking)
5. Clicks "Generate Cluster"
6. Phase indicators: Planning → Pillar → Clusters → Relinking
7. All articles appear in cluster view on completion
8. User reviews pillar + cluster articles together
9. Publishes all with one click or individually

---

## Flow 5: Settings → Connect WordPress

1. User clicks Settings in sidebar
2. Navigates to "WordPress" section
3. Clicks "Add Blog"
4. Enters site URL, username, app password
5. Clicks "Test Connection" → success/error feedback
6. Saves blog
7. Blog appears in publish panel of all future articles

---

## Flow 6: Publish Article

1. User generates or opens a saved article
2. Clicks "Publish" button in article result panel
3. Publish drawer opens
4. Selects platform (WordPress, Medium, etc.)
5. Selects blog/account if multiple configured
6. Clicks "Publish now" or sets scheduled date
7. Loading state → success toast with link to published post

---

## Flow 7: Billing Upgrade

1. User sees "Out of credits" banner or views billing page
2. Clicks "Upgrade plan"
3. Selects plan tier
4. Stripe Checkout opens
5. Enters payment info
6. Redirected back → credits updated, plan badge updated

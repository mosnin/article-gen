# Acceptance Criteria — ArticleGen

## AC1: Article Generation
- [ ] User can submit topic + keyword and receive a complete article within 90 seconds
- [ ] Generation shows progress steps: Research → Metadata → Writing → Images
- [ ] Article includes: title, meta description, slug, markdown content, image prompts
- [ ] Failed generation shows clear error message with retry button
- [ ] Credits are deducted exactly once per successful generation (atomic)
- [ ] Out-of-credits state shows upgrade prompt, not generic error

## AC2: Batch Generation
- [ ] User can queue 1–50 topics and process them in sequence
- [ ] Floating progress pill shows current progress (N/Total)
- [ ] Pill is minimizable and doesn't block UI
- [ ] Failed articles are highlighted; successful ones available immediately
- [ ] Batch survives page refresh (state reloaded from DB)

## AC3: Topic Clusters
- [ ] Pillar + cluster workflow completes all 4 phases
- [ ] Cluster articles contain links to pillar and each other
- [ ] Phase progress indicator is visible during generation
- [ ] Completed cluster shows all articles in a grouped view

## AC4: Publishing
- [ ] User can connect WordPress and publish with one click
- [ ] Publish shows success with link to live post
- [ ] Platform connection test gives clear pass/fail feedback
- [ ] Scheduled publish fires within 2 minutes of scheduled time

## AC5: Onboarding
- [ ] New user sees onboarding on first login (not on subsequent logins)
- [ ] Onboarding has exactly 3 steps with accurate progress indicator
- [ ] Step 2 (site setup) has inline validation for domain field
- [ ] Platform connection step is skippable
- [ ] Completion redirects to dashboard with empty state + first article CTA

## AC6: Dashboard
- [ ] Shows credit balance, articles generated (month + all time), published count
- [ ] Recent articles list shows last 10 with status badges
- [ ] Active clusters show phase progress
- [ ] Empty state has clear "Generate first article" CTA

## AC7: Settings
- [ ] User can add, edit, delete WordPress blogs
- [ ] WordPress connection test provides pass/fail within 5 seconds
- [ ] User can connect Medium, Dev.to, Ghost, Shopify
- [ ] General settings (domain, site name, author info) save and persist
- [ ] GSC connection shows site list and allows keyword import

## AC8: Billing
- [ ] Stripe Checkout opens and completes without errors
- [ ] Plan and credit balance update within 30 seconds of payment
- [ ] Customer Portal allows plan management and invoice access

## AC9: Admin
- [ ] Admin can view paginated user list
- [ ] Admin can add/remove credits for any user
- [ ] Non-admin users cannot access admin routes

## AC10: Auth
- [ ] Signup, login, logout work correctly
- [ ] Unauthenticated users are redirected to login when accessing `/app/*`
- [ ] Session persists across page refreshes
- [ ] Password reset email delivers within 60 seconds

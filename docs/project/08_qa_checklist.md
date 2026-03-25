# QA Checklist — ArticleGen

## Auth
- [ ] Signup with new email works
- [ ] Signup with duplicate email shows correct error
- [ ] Login with correct credentials works
- [ ] Login with wrong password shows error
- [ ] Logout clears session and redirects to home
- [ ] Password reset email is received
- [ ] Reset password flow completes successfully
- [ ] Unauthenticated access to /app redirects to login

## Onboarding
- [ ] New user sees onboarding on first login
- [ ] Returning user skips onboarding
- [ ] Step indicator is accurate at each step
- [ ] Invalid domain shows validation error
- [ ] Skipping platform step works
- [ ] Completion redirects to dashboard
- [ ] Onboarding progress survives page refresh

## Article Generation
- [ ] Single article generates successfully
- [ ] Progress steps animate correctly
- [ ] Error state shows with retry button
- [ ] Article saved to DB after generation
- [ ] Images generate (when enabled)
- [ ] Images skip gracefully (when disabled)
- [ ] Credits deducted after generation
- [ ] Out-of-credits blocks generation with upgrade prompt

## Batch Generation
- [ ] 5-article batch queues and completes
- [ ] 20-article batch completes without errors
- [ ] Progress pill shows accurate count
- [ ] Failed articles don't break the queue
- [ ] Pill can be minimized and restored

## Cluster Generation
- [ ] All 4 phases complete
- [ ] Articles contain cross-links
- [ ] Phase progress is visible
- [ ] Cluster appears in dashboard

## Publishing
- [ ] WordPress publish succeeds with valid credentials
- [ ] WordPress connection test passes/fails correctly
- [ ] Medium publish works
- [ ] Dev.to publish works
- [ ] Article marked as posted after publish
- [ ] Publish log entry created

## Dashboard
- [ ] Stats cards show correct numbers
- [ ] Recent articles list loads
- [ ] Empty state shows for new users
- [ ] Clusters section shows active clusters

## Settings
- [ ] WordPress blog add/edit/delete works
- [ ] General settings save and reload correctly
- [ ] Platform connections persist across sessions
- [ ] GSC connect and disconnect works

## Billing
- [ ] Checkout session opens
- [ ] Payment completes and credits update
- [ ] Customer portal opens
- [ ] Plan badge updates correctly

## Admin
- [ ] Admin user accesses /app/admin
- [ ] Non-admin redirected from /app/admin
- [ ] Credit adjustment saves and reflects immediately

## Responsive / Mobile
- [ ] Mobile navigation drawer opens and closes
- [ ] Generation form is usable on mobile
- [ ] Article preview is readable on mobile
- [ ] Settings forms are usable on mobile
- [ ] Dashboard stats stack correctly on mobile

## Accessibility
- [ ] Tab navigation works through main flows
- [ ] Focus rings visible on all interactive elements
- [ ] Error messages announced (role="alert")
- [ ] Loading states have appropriate aria labels
- [ ] Color contrast meets WCAG AA

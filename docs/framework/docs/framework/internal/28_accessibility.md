# 28 Accessibility Requirements

> **TL;DR:** Defines WCAG 2.1 AA compliance rules for the internal product and marketing site — keyboard navigation, screen reader support, color contrast, focus management, ARIA patterns, and testing approach.
> **Covers:** compliance target, keyboard navigation, focus management, screen reader support, color contrast, ARIA patterns, form accessibility, motion sensitivity, testing | **Depends on:** 08, 10, 12, 15 | **Used by:** 09, 14 | **Phase:** 4 (setup), 7+ (every build phase), 14 (audit)

## Purpose

Accessibility is not a Phase 14 afterthought — it's a build-time requirement. Every component, page, and interaction must be accessible from the moment it's built. This file defines the minimum standard and the specific patterns to follow.

---

## Compliance Target

**WCAG 2.1 Level AA** for both the internal product and the marketing site. This is the industry standard for commercial web applications and covers the vast majority of accessibility needs.

---

## Keyboard Navigation

### Global Rules

1. **Every interactive element must be reachable via Tab** — buttons, links, form inputs, dropdowns, modals, tabs.
2. **Tab order must follow visual order** — left-to-right, top-to-bottom. Never use `tabindex` values greater than 0.
3. **Focus must be visible** — every focused element must have a visible focus ring. Use the design token: `ring-2 ring-primary-500 ring-offset-2`.
4. **Escape closes overlays** — modals, drawers, dropdowns, and popovers must close on Escape key.
5. **Enter/Space activates** — buttons and links must respond to Enter. Checkboxes and toggles must respond to Space.

### Component-Specific Keyboard Patterns

| Component | Keys | Behavior |
|-----------|------|----------|
| **Modal** | Escape | Close modal |
| **Modal** | Tab | Cycle focus within modal (focus trap) |
| **Dropdown** | Arrow Up/Down | Navigate options |
| **Dropdown** | Enter | Select option |
| **Dropdown** | Escape | Close dropdown |
| **Tabs** | Arrow Left/Right | Switch tabs |
| **Tabs** | Home/End | First/last tab |
| **Table (sortable)** | Enter on header | Toggle sort |
| **Accordion** | Enter/Space | Toggle section |
| **Sidebar** | Arrow Up/Down | Navigate items |
| **Toast** | Focus + Escape | Dismiss toast |

### Skip Navigation

Add a "Skip to content" link as the first focusable element on every page:

```tsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:p-4 focus:bg-surface-base focus:text-primary"
>
  Skip to content
</a>
```

The main content area must have `id="main-content"`.

---

## Focus Management

### When to Move Focus Programmatically

| Event | Move Focus To |
|-------|--------------|
| Modal opens | First focusable element inside modal |
| Modal closes | The element that triggered the modal |
| Drawer opens | First focusable element inside drawer |
| Drawer closes | The element that triggered the drawer |
| Page navigation | Page title or main content area |
| Item deleted from list | Previous item, next item, or the list's empty state |
| Form submission error | First field with an error |
| Toast appears | Do not move focus (toasts are non-modal) |

### Focus Trap

Modals and drawers must trap focus — Tab should cycle through elements inside the overlay and never escape to the page behind it. shadcn's Dialog component (built on Radix) handles this automatically.

### Never Remove Focus Indicators

Never set `outline: none` or `focus:outline-none` on interactive elements without providing an alternative visible focus state. The `focus-visible` variant in Tailwind (`focus-visible:ring-2`) is preferred over `focus:ring-2` as it only shows for keyboard navigation, not mouse clicks.

---

## Screen Reader Support

### Semantic HTML First

Use the correct HTML element before reaching for ARIA:

| Need | Use | Not |
|------|-----|-----|
| Navigation | `<nav>` | `<div role="navigation">` |
| Main content | `<main>` | `<div role="main">` |
| Page heading | `<h1>` | `<div aria-level="1">` |
| Button | `<button>` | `<div onClick>` |
| Link | `<a href>` | `<span onClick>` |
| List | `<ul>/<ol>` | `<div>` with items |

### Required ARIA Attributes

| Pattern | Required ARIA |
|---------|--------------|
| Icon-only buttons | `aria-label="Description"` |
| Loading spinners | `aria-busy="true"` on the container, `role="status"` on the spinner |
| Form errors | `aria-invalid="true"` on the field, `aria-describedby` pointing to the error message |
| Modals | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to the title |
| Tabs | `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected` |
| Toggle/switch | `role="switch"`, `aria-checked` |
| Expandable sections | `aria-expanded` on the trigger |
| Live updates | `aria-live="polite"` for non-urgent updates (toast, save confirmation) |
| Status badges | Text content must be meaningful (not just color) |
| Data tables | `<th scope="col">` for column headers, `<th scope="row">` for row headers |

### Heading Hierarchy

- Every page must have exactly one `<h1>` (the page title from PageHeader)
- Headings must not skip levels (`<h1>` → `<h3>` is invalid)
- Heading levels must reflect content hierarchy, not visual size
- Cards within a section use `<h3>` if the section has an `<h2>` title

### Alt Text Rules

| Image Type | Alt Text |
|-----------|----------|
| Informational (product screenshot) | Describe what the image shows: "Dashboard showing 3 active projects" |
| Decorative (background pattern) | `alt=""` (empty alt, not missing alt) |
| Icon with label | `aria-hidden="true"` (the label provides the meaning) |
| Icon without label | `aria-label="Description"` on the parent button/link |
| Chart | Describe the trend: "Line chart showing revenue growth from $10K to $45K over 6 months" |
| Avatar | `alt="User's name"` or `alt=""` if name is displayed next to it |

---

## Color and Contrast

### Minimum Contrast Ratios (WCAG AA)

| Content Type | Minimum Ratio |
|-------------|---------------|
| Body text (< 24px / < 18.66px bold) | 4.5:1 |
| Large text (≥ 24px / ≥ 18.66px bold) | 3:1 |
| UI components (borders, icons, focus rings) | 3:1 |
| Disabled elements | No minimum (but must be perceivable) |

### Rules

1. **Never convey meaning through color alone** — always pair color with text, icon, or pattern. A red badge must also say "Error", not just be red.
2. **Status badges must include text** — "Active" in green, not just a green dot.
3. **Charts must be distinguishable without color** — use patterns, labels, or different line styles for colorblind users.
4. **Form error states must use more than red** — include an error icon and error text, not just a red border.
5. **Links must be distinguishable from body text** — underline or use icon, not just color difference.

### Verified Contrast (Internal Product)

See `10_design_tokens_internal.md` for the full color system. Key pairs verified:

| Combination | Ratio | Passes |
|-------------|-------|--------|
| text-primary on surface-base (light) | 15.4:1 | AA, AAA |
| text-secondary on surface-base (light) | 5.0:1 | AA |
| text-primary on surface-base (dark) | 13.8:1 | AA, AAA |
| text-inverse on primary-600 | 4.6:1 | AA |

See `design_system_tokens.md` for website-specific contrast verification.

---

## Form Accessibility

### Rules

1. **Every input must have a label** — use `<label htmlFor="id">` or `aria-label`. Never rely on placeholder text alone.
2. **Required fields must be marked** — use `aria-required="true"` and visual indicator (asterisk).
3. **Error messages must be associated** — use `aria-describedby` to connect the field to its error message.
4. **Group related fields** — use `<fieldset>` and `<legend>` for radio groups and related checkbox sets.
5. **Announce errors on submission** — when a form fails validation, announce the error summary with `aria-live="assertive"` or move focus to the first error.

### Example: Accessible Input with Error

```tsx
<div>
  <label htmlFor="email" className="text-sm font-medium">
    Email <span aria-hidden="true">*</span>
  </label>
  <input
    id="email"
    type="email"
    aria-required="true"
    aria-invalid={!!errors.email}
    aria-describedby={errors.email ? "email-error" : undefined}
  />
  {errors.email && (
    <p id="email-error" role="alert" className="text-sm text-status-error mt-1">
      {errors.email}
    </p>
  )}
</div>
```

---

## Motion and Animation

### `prefers-reduced-motion`

All animations must respect the user's motion preference:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Or in Motion (framer-motion):

```typescript
import { useReducedMotion } from "framer-motion"

function Component() {
  const shouldReduceMotion = useReducedMotion()
  // Skip animation or use opacity-only transition
}
```

### Rules

- Marquees must pause on `prefers-reduced-motion`
- Page entrance animations must reduce to simple opacity fade or skip entirely
- Never use motion as the only way to convey information
- Autoplay video must have pause controls

---

## Touch Targets

### Minimum Size

All interactive elements must have a minimum touch target of **44x44px** (WCAG 2.1 Success Criterion 2.5.5).

This applies to:
- Buttons (including icon-only buttons)
- Links in navigation
- Form inputs
- Checkbox/radio clickable area
- Dropdown trigger
- Table row action buttons
- Pagination controls

If the visual element is smaller than 44px (e.g., a 24px icon button), use padding to expand the clickable area:

```tsx
<button className="p-2.5"> {/* 24px icon + 10px padding each side = 44px target */}
  <Icon size={24} />
</button>
```

---

## Testing

### Automated Testing (Phase 14)

1. **axe-core** — run accessibility audits in Playwright tests:
   ```typescript
   import AxeBuilder from "@axe-core/playwright"

   test("page has no accessibility violations", async ({ page }) => {
     await page.goto("/dashboard")
     const results = await new AxeBuilder({ page }).analyze()
     expect(results.violations).toEqual([])
   })
   ```

2. **Lighthouse accessibility audit** — score must be >90 on all pages.

### Manual Testing Checklist (Phase 14)

- [ ] Navigate the entire app using only keyboard (no mouse)
- [ ] Complete the signup → onboarding → dashboard flow with keyboard only
- [ ] Test with a screen reader (VoiceOver on Mac, NVDA on Windows)
- [ ] Verify all images have appropriate alt text
- [ ] Verify heading hierarchy on every page (no skipped levels)
- [ ] Verify focus is visible on every interactive element
- [ ] Verify modals trap focus and return focus on close
- [ ] Verify form errors are announced to screen readers
- [ ] Test at 200% browser zoom (content should not overflow or overlap)
- [ ] Verify `prefers-reduced-motion` disables animations

### Validation Gate

Add to `docs/project/custom_gates.md`:

```markdown
### gate:accessibility-axe
**What:** No axe-core violations on key pages.
```bash
# Run after Playwright is set up
npx playwright test --grep "accessibility" 2>&1 | tail -5
```
**Pass:** All accessibility tests pass.
**Common failure:** Missing aria-labels, missing alt text, insufficient contrast.
```

---

## Build-Phase Checklist

Every build phase (4–14) must verify these before marking complete:

- [ ] All new interactive elements are keyboard-accessible
- [ ] All new images have alt text
- [ ] All new form fields have labels
- [ ] All new modals/drawers trap focus
- [ ] No heading levels were skipped
- [ ] Focus indicators are visible on all new elements
- [ ] Color is not the sole means of conveying information

## Final Principle

Accessibility is not a feature you add — it's a quality you maintain. Build it right the first time. Retrofitting accessibility is 3x harder than building it in. Every component in `08_ui_system_internal.md` must be accessible by default.

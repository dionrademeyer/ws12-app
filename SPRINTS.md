# WS12 Sprint Tracker

Updated by `ws12-product-lead` after every run. A sprint is DONE only when `ws12-qa` signs off every box.

**Current sprint:** Sprint 0
**Sprint length:** 1 week
**Status key:** TODO / IN PROGRESS / IN REVIEW / DONE / BLOCKED

## Needs from Didi

- [ ] Tier contents for R99, R199 and R349
- [ ] Visual reference image for the dashboard
- [ ] WS12 Constitution (if it exists)
- [ ] Create the Supabase project (or approve the agents creating one) - needed by Sprint 1
- [ ] Google OAuth client ID for sign-in - needed by Sprint 2
- [ ] PayFast sandbox and Stripe test keys - needed by Sprint 2 (My Library purchases)

---

## Sprint 0 - Product Bible (status: TODO)

Write `docs/product-bible.md` covering the 14 chapters in `docs/build-plan.md`.

- [ ] Learner persona, parent persona, teacher persona (South African context)
- [ ] App architecture and how the website and app share one login
- [ ] Screen-by-screen UX for every screen in the brief, each answering "what does the learner do next?"
- [ ] Feature priorities (must / should / later) mapped to sprints
- [ ] User journeys: learner signup, parent buys and invites, learner adds parent, daily study loop
- [ ] Database architecture (tables, relations, RLS approach)
- [ ] AI agent architecture and the content-to-knowledge plan for Melvin's book
- [ ] Monetisation (tiers), analytics and KPIs, admin, school portal, parent portal, app store plan
- [ ] Open questions listed for Didi
- [ ] QA sign-off: matches brief and decisions, copy rules followed

## Sprint 1 - Foundation (status: TODO)

- [ ] Vite + React + TypeScript + Tailwind project, Prettier and ESLint
- [ ] Folder structure separating UI, business logic, data, AI services, auth
- [ ] Supabase client setup with environment variables (no secrets in code)
- [ ] Full schema migration from the Product Bible with RLS on every table
- [ ] App shell: bottom nav on mobile, sidebar on desktop, avatar menu
- [ ] i18n layer with English and Afrikaans
- [ ] Demo mode with seed learner Thabo Mokoena, clearly labelled as demo
- [ ] CI: build, lint, type check and tests pass
- [ ] QA sign-off

## Sprint 2 - Identity, Library and Parents (status: TODO)

- [ ] Welcome, Google sign-in, email sign-in
- [ ] 5-step onboarding with progress indicator
- [ ] Profile view and edit, subjects, exam date
- [ ] My Library: purchased books (EN and AF) and bonus files from Supabase storage, by tier
- [ ] Purchase flow hooks: PayFast ITN and Stripe webhook edge functions (sandbox only)
- [ ] Parent linking both ways (invite code and add-parent), with POPIA parental consent
- [ ] QA sign-off including RLS tests (a learner cannot read another learner's data)

## Sprint 3 - Dashboard (status: TODO)

- [ ] Real exam countdown from profile, "Set your exam date" empty state
- [ ] Today's Study Plan with tasks that save, update progress and streak
- [ ] Streak card calculated from real activity, milestones 3, 5, 7, 14, 30, 60, 100
- [ ] Tip of the Day from the tips table
- [ ] "Your Next Win" rule-based recommendation
- [ ] Notification bell with unread badge
- [ ] QA sign-off at 360px, 768px, 1024px, 1440px

## Sprint 4 - Productivity (status: TODO)

- [ ] Goals: create, edit, progress, deadline, action button
- [ ] Planner: today, week, month; add, edit, delete, complete sessions
- [ ] Streak engine hardened (time zones, missed days)
- [ ] Planner built so AI can generate sessions later
- [ ] QA sign-off

## Sprint 5 - Intelligence (status: TODO)

- [ ] Progress screen: subject bars, study hours, tasks, streaks, weekly and monthly charts from real state
- [ ] Recommendation engine v2 using goals, activity, weak areas, upcoming exams
- [ ] Analytics events table and tracking of the events listed in the brief
- [ ] Parent weekly progress summary (data ready; sending needs Didi's approval)
- [ ] QA sign-off

## Sprint 6 - AI Tutor (status: TODO)

- [ ] Tutor chat UI with suggested actions
- [ ] AI service layer behind a Supabase edge function (no API keys in the browser)
- [ ] Knowledge base tables and retrieval from approved WS12 content only
- [ ] First controlled content: a small set of lessons approved by Didi
- [ ] Guardrails: says "I don't know" rather than inventing content
- [ ] QA sign-off

## Sprint 7 - Launch readiness (status: TODO)

- [ ] PWA install and offline shell
- [ ] Performance budget met on a slow 3G profile
- [ ] Security review, privacy policy and terms pages
- [ ] Accessibility audit
- [ ] Deployment to staging; production only after Didi approves
- [ ] App store preparation notes
- [ ] QA sign-off

---

## Run log

Newest first. One entry per run: date, sprint, what was done, what QA found, what is blocked.

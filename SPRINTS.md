# WS12 Sprint Tracker

Updated by `ws12-product-lead` after every run. A sprint is DONE only when `ws12-qa` signs off every box.

**Current sprint:** Sprint 1
**Sprint length:** 1 week
**Status key:** TODO / IN PROGRESS / IN REVIEW / DONE / BLOCKED

## Needs from Didi

- [ ] Tier contents for R99, R199 and R349
- [ ] Visual reference image for the dashboard
- [ ] WS12 Constitution (if it exists)
- [ ] Create the Supabase project (or approve the agents creating one) - needed by Sprint 1
- [ ] Google OAuth client ID for sign-in - needed by Sprint 2
- [ ] PayFast sandbox and Stripe test keys - needed by Sprint 2 (My Library purchases)
- [ ] Book manuscript MLS 1 to 52 in English and Afrikaans (editable format, with lesson numbers) - needed before lessons load (Sprint 4) and for Tutor content (Sprint 6)
- [ ] Core IP text from the book: DCA formula, DNA of a Successful Matriculant, Pencil story, Force Field Analysis - needed by Sprint 4
- [ ] The five profiling questionnaires with items, scoring and result bands (EN and AF) - needed by Sprint 5
- [ ] Approve the POPIA parental consent flow (Product Bible 3.3) - needed by Sprint 2
- [ ] Approve adding Product Bible items to sprints (lesson card, Journey, Self-assessments, Parent home, Settings, Help, Logout, Exam calendar, Strategy Library, Achievements, Push notifications, offline sync, Admin) - see Product Bible Chapter 15, question 10
- [ ] Lesson unlock rule and pre-season view for the Class of 2027 - needed by Sprint 3
- [ ] Verified South African support lines for Help and the AI Tutor - needed by Sprint 2
- [ ] AI model provider, budget and daily Tutor limit - needed by Sprint 6
- [ ] Parent purchases: does a parent's purchase cover one linked child, all linked children, or only the parent (Product Bible Chapter 15, question 18) - needed by Sprint 2
- [ ] Grade 11 sign-ups: allow Class of 2027 learners who are still in Grade 11 the full experience (Product Bible Chapter 15, question 13) - needed by Sprint 2
- Full list of open questions: `docs/product-bible.md` Chapter 15

---

## Sprint 0 - Product Bible (status: DONE)

Write `docs/product-bible.md` covering the 14 chapters in `docs/build-plan.md`.

- [x] Learner persona, parent persona, teacher persona (South African context)
- [x] App architecture and how the website and app share one login
- [x] Screen-by-screen UX for every screen in the brief, each answering "what does the learner do next?"
- [x] Feature priorities (must / should / later) mapped to sprints
- [x] User journeys: learner signup, parent buys and invites, learner adds parent, daily study loop
- [x] Database architecture (tables, relations, RLS approach)
- [x] AI agent architecture and the content-to-knowledge plan for Melvin's book
- [x] Monetisation (tiers), analytics and KPIs, admin, school portal, parent portal, app store plan
- [x] Open questions listed for Didi
- [x] QA sign-off: matches brief and decisions, copy rules followed

## Sprint 1 - Foundation (status: TODO)

- [ ] Vite + React + TypeScript + Tailwind project, Prettier and ESLint
- [ ] Folder structure separating UI, business logic, data, AI services, auth
- [ ] Supabase client setup with environment variables (no secrets in code)
- [ ] Full schema migration from the Product Bible with RLS on every table
- [ ] App shell: bottom nav on mobile, sidebar on desktop, avatar menu
- [ ] i18n layer with English and Afrikaans
- [ ] Demo mode with seed learner Thabo Mokoena, clearly labelled as demo
- [ ] CI: build, lint, type check and tests pass
- [ ] Block client writes to `profiles.is_demo` in the migration (server-only) (Sprint 0 QA carry-over)
- [ ] `give_consent()` switches an existing pending parent link to active; unique constraint on `parent_links` (`learner_id`, `parent_id`) (Sprint 0 QA carry-over)
- [x] Product Bible 3.3 wording aligned: language is saved before consent (Sprint 0 QA carry-over, doc edit)
- [x] Product Bible 6.2 relations include `learner_preferences`, one row per learner (Sprint 0 QA carry-over, doc edit)
- [ ] QA sign-off

## Sprint 2 - Identity, Library and Parents (status: TODO)

- [ ] Welcome, Google sign-in, email sign-in
- [ ] 5-step onboarding with progress indicator
- [ ] Profile view and edit, subjects, exam date
- [ ] My Library: purchased books (EN and AF) and bonus files from Supabase storage, by tier
- [ ] Purchase flow hooks: PayFast ITN and Stripe webhook edge functions (sandbox only)
- [ ] Parent linking both ways (invite code and add-parent), with POPIA parental consent
- [ ] QA sign-off including RLS tests (a learner cannot read another learner's data)

Verification note from Sprint 0 QA: confirm how Supabase handles Google name and picture metadata on each sign-in, and test that no name or picture is kept in app tables before parental consent (Product Bible 2.3).

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

### 2026-11-10 - Sprint 0 (DONE)

- QA round 3 on 0b9db4d: PASS on all 10 Sprint 0 boxes, no blocking findings. QA note: RLS and consent rules are signed off as design only and must be proven by Sprint 1 and 2 tests.
- Sprint 0 boxes ticked, status DONE, Current sprint set to Sprint 1 (not started in this run).
- Four QA carry-overs added to Sprint 1. The two doc edits (3.3 language before consent, 6.2 `learner_preferences` relation) were made in this run and ticked on the coordinator's instruction without a separate QA pass; QA can confirm them in the Sprint 1 review.

### 2026-11-10 - Sprint 0 (IN REVIEW)

- Done: wrote `docs/product-bible.md` (14 chapters plus Chapter 15, Open questions for Didi), committed chapter by chapter. Added a "Product context" section to `docs/decisions.md` with Didi's audience, book, website, affiliate, visual and timing facts. Prettier and the copy check (no ampersands, no em or en dashes) pass on the docs and commit messages.
- QA round 1 (run by the coordinator): FAIL on boxes 4, 6 and 10, PASS on boxes 1, 2, 3, 5, 7, 8 and 9. Copy rules and Prettier passed. Findings: minors could self-declare as adults; RLS undefined for several tables; website sign-up stored minors' emails before consent; unmarked "proposed sprint" items; missing columns and tables; AI quiz generation and first name sent to the model; screen state gaps; checkout not server-side; no subject percentage formula; Next Win inconsistency. All 12 findings fixed in the Product Bible and sent back to QA for round 2. No boxes ticked.
- QA round 2: 11 of 12 round 1 findings fixed; FAIL on box 6 only (profile updates before consent, onboarding preference storage, RLS details for roles, links, consent status and reference tables, Google metadata, sprint scope list, proposed values). All fixed and sent back for round 3. No boxes ticked.
- Blocked: nothing in Sprint 0 is blocked by Didi. Sprint 1 can start once QA passes Sprint 0. New items added to "Needs from Didi" (manuscript, core IP, questionnaires, consent flow, sprint scope, unlock rule, support lines, AI provider).

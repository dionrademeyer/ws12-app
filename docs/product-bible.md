# WS12 Product Bible

Winning Strategies for Grade 12 (Afrikaans: Wenner Strategieë vir Graad 12)

Version 1.0, Sprint 0, 2026-11-10. Owner: Didi (final approver). Maintained by `ws12-product-lead`.

This document answers: exactly what are we building, how does it work, who is it for, and what does every screen do? It is the first source of truth in `CLAUDE.md`. Where it is silent, `docs/build-brief.md`, `docs/build-plan.md` and `docs/decisions.md` apply in that order.

## How to read this document

- **"To be supplied from the book"** marks anything that must come from Melvin Monroe Tobias's book. Agents never write that content themselves.
- **"Proposed"** marks a recommendation that Didi has not yet approved. It is listed again in Chapter 15 (Open questions for Didi).
- **Sprint tags** such as (S3) show which sprint in `SPRINTS.md` builds the item.

## Product in one paragraph

WS12 is a mobile-first learner app built on the 100% human-written book "Winning Strategies for Grade 12" by Melvin Monroe Tobias, a South African educator. The book has 52 weekly lessons (MLS 1 to 52), one for every week of the Grade 12 year, in English and Afrikaans. The app turns those lessons into a guided weekly journey, adds a daily study plan, goals, a planner, progress tracking, saved self-assessments and an AI Tutor that answers only from approved WS12 content. Every time a learner opens the app it answers one question: "What should I do next to improve my chances of succeeding in Grade 12?" Parents, who usually pay, can link to their child's account and get a weekly progress update. AI assists learners, parents and teachers; it never replaces them.

## Product principles

1. **One next action.** Every screen ends with a clear next step. A learner understands their next action within five seconds of opening the app.
2. **Every metric leads to an action.** "Maths: 62%" comes with "Continue Maths practice".
3. **The book is the heart.** The 52-week journey and Melvin's frameworks are the reason WS12 is different from a generic study app.
4. **Hope, not pressure.** Grade 12 learners are already tired and stressed. The tone is warm, honest and encouraging, never guilt-driven.
5. **Light on data.** The app must work well on a cheap Android phone on a slow, prepaid connection.
6. **Trust first.** Parents buy peace of mind. Privacy, honesty and real testimonials only.
7. **Human-led, AI-assisted.** The AI Tutor points back to teachers, parents and the book. It says "I don't know" rather than invent.
8. **Success, not screen time.** Gentle gamification: streaks, milestones, celebrations. No manipulative mechanics, no excessive notifications.

---

## Chapter 1. Personas (learner, parent, teacher)

These personas are fictional composites built from Didi's audience brief (`docs/decisions.md`, Product context) and the build brief. They are not research findings and contain no statistics. Replace or refine them when real user interviews are done.

### 1.1 Learner persona: Thabo (primary user)

- **Who:** Thabo, 17, Grade 12 at a public high school in Gauteng. Takes Mathematics, Physical Sciences, English Home Language, Life Orientation and others. (Thabo Mokoena is also the demo learner in the app.)
- **Device and data:** a mid-range or older Android phone, sometimes shared. Prepaid data bought in small bundles; often relies on Wi-Fi at school or at home. Storage space is tight.
- **Daily life:** school, homework, extra classes, chores, sometimes a part-time job or long travel times. Studies late at night.
- **How he feels:** tired and under pressure. Worried about the finals, about university or work applications and about letting his family down. Sometimes overwhelmed and not sure where to start.
- **What he responds to:** short video, humour and hope. Lives on TikTok and Instagram. Switches off when an app feels like school admin or a lecture.
- **What he needs from WS12:**
  - Know what to do today without having to plan it himself.
  - See that he is making progress, even small progress.
  - A short weekly lesson that feels relevant to his life.
  - Help when he is stuck, without feeling judged.
  - Something that works on his phone without eating his data.
- **What would make him leave:** long onboarding, heavy pages, guilt-trip notifications, childish design, anything that feels fake.
- **Language:** some learners in this persona prefer Afrikaans for everything. The app must be fully usable in either language and let the learner switch at any time.

### 1.2 Parent persona: Nomsa (primary buyer)

- **Who:** Nomsa, 44, mother of a Grade 12 learner. Works full time. May be the first in her family to see a child through matric with real options after school.
- **Device and channels:** Android phone. Uses Facebook and WhatsApp every day. Reads WhatsApp messages from the school group and family.
- **How she feels:** anxious. Wants her child to succeed but cannot always help with the work or see what is happening. Has been burned by products that promise too much.
- **What she wants:** trust and peace of mind. Proof the product is real (a real author, a real educator, real testimonials), a fair price, and a simple way to know her child is on track.
- **What she needs from WS12:**
  - A clear explanation of what she is buying and what her child gets.
  - Easy payment (PayFast or Stripe) and an easy way to send the account to her child.
  - A short weekly update: did my child study, what is coming up, how can I help?
  - Confidence that her child's data is safe.
- **What would make her leave:** confusing tiers, hidden costs, pushy messaging, anything that looks like a scam.

### 1.3 Teacher persona: Mr Botha (bulk channel, later)

- **Who:** Mr Botha, Grade 12 Life Orientation teacher and grade head at a dual-medium (English and Afrikaans) school in the Western Cape.
- **How he feels:** responsible for many learners with limited time. Wants tools that support his teaching, not more admin.
- **What he wants:** a structured, values-based programme he can run across the Grade 12 year (one lesson a week fits a school term rhythm), in both languages, at a bulk price the school can approve.
- **What he needs from WS12 (later, School Portal):** bulk licences, class codes, a class overview of lesson completion, and material he can use in class. He must never feel the AI is replacing him.
- **Role in the business:** a bulk channel and a trust signal for parents. Educator Partners earn a 15 percent affiliate commission (planned).

### 1.4 Supporting audiences

- **Afrikaans-speaking families:** the full product in Afrikaans, using the official product name "Wenner Strategieë vir Graad 12".
- **Influencers and student ambassadors:** marketing channels through the planned affiliate programme (Chapter 9).
- **Didi and the WS12 team:** administrators who manage content, exam dates, tips and support (Chapter 11).

---

## Chapter 2. Complete app architecture

### 2.1 System overview

```text
  winstrat12.co.za (marketing site)        app.winstrat12.co.za (learner app, PWA)
  Plain HTML on Gary's hosting             React + TypeScript + Vite + Tailwind
  Free account sign-up, checkout,          Dashboard, Journey, Goals, Planner,
  link to My Library                       Progress, AI Tutor, Library, Parent view
            |                                          |
            +------------------+-----------------------+
                               |
                     ONE Supabase project
        Auth (Google, email) | Postgres with RLS | Storage | Edge functions
                               |
         +---------------------+----------------------+
         |                     |                      |
   Payments webhooks     AI gateway function     Scheduled jobs
   (PayFast ITN,         (AI Tutor, later        (streak checks, weekly
   Stripe)               more agents)            lesson unlock, parent
                               |                 summaries)
                     WS12 knowledge base
                     (approved book content only)
```

### 2.2 Frontend layers

The brief asks for clean separation between UI, business logic, data, AI services and auth. Proposed folder structure (built in S1):

| Folder                | Holds                                                                         |
| --------------------- | ----------------------------------------------------------------------------- |
| `src/ui/`             | Reusable presentational components (cards, buttons, progress bars, nav)       |
| `src/features/`       | One folder per feature (dashboard, journey, goals, planner, progress, tutor)  |
| `src/domain/`         | Pure TypeScript business logic: countdown, streaks, progress, Next Win rules |
| `src/data/`           | Supabase queries and repositories, one per table group                       |
| `src/ai/`             | Client interfaces to the AI gateway; no model keys                            |
| `src/auth/`           | Sign-in, session, role and consent state                                      |
| `src/i18n/`           | English and Afrikaans strings                                                 |
| `src/demo/`           | Demo learner data (Thabo Mokoena), clearly labelled                           |
| `supabase/migrations` | Schema and RLS                                                                |
| `supabase/functions`  | Edge functions (payments, AI gateway, invites, scheduled jobs)                |

Rules:

- `src/domain/` has no React and no Supabase imports, so it can be reused unchanged in a future Expo app (Chapter 14) and unit-tested.
- UI never calls Supabase directly; it goes through `src/data/`.
- No secrets in the client. Only the Supabase URL and the publishable (anon) key are in client environment variables. Service role keys, payment secrets and AI keys live only in edge function secrets.

### 2.3 How the website and the app share one login

Decision: website accounts and the app share ONE Supabase login (`docs/decisions.md`).

- **One identity.** Both winstrat12.co.za and app.winstrat12.co.za use the same Supabase project and the same `auth.users` table. A person has one account, one password or Google identity, and one profile.
- **Website side.** The plain HTML site loads `supabase-js` from a pinned script and uses the publishable key for sign-up, sign-in and "Forgot password". The website only handles: free account sign-up (lead capture), sign-in, checkout hand-off, and a "Go to My Library" link. All logged-in features live in the app, so they are built once.
- **App side.** The app handles everything after sign-in.
- **Session between the two sites.** By default Supabase stores the session per origin, so a person signed in on the website is not automatically signed in on the app subdomain. Proposed for v1: the website's "Open the app" and "My Library" links go to the app, which asks the person to sign in with the same account (one tap with Google). Later option: a shared cookie on `.winstrat12.co.za` so one sign-in covers both. This needs a small custom storage adapter and Gary's help on the website side.
- **Configuration.** Both origins are listed as allowed redirect URLs in Supabase Auth and as authorised origins on the Google OAuth client.
- **Purchases before an account exists.** If a parent pays on the website before creating an account, the payment webhook stores the entitlement against the verified buyer email. When an account with that email is created or signs in, the entitlement is claimed automatically.
- **Apple sign-in later.** Auth code keeps providers in one list so Apple can be added without changing screens.

### 2.4 Roles

| Role    | Who                                 | Gets                                                                  |
| ------- | ----------------------------------- | --------------------------------------------------------------------- |
| learner | Grade 12 learner (default role)     | Their own data only                                                   |
| parent  | Parent or guardian                  | Their own account, plus a read-only summary of linked learners       |
| teacher | Teacher at a school (later, S7+)    | Class-level summaries for learners who joined their class             |
| admin   | Didi and the WS12 team              | Admin dashboard; content, exam dates, tips, support                   |

A person can hold more than one role (for example a teacher who is also a parent). Roles live in a `user_roles` table that only admins can change; they are never taken from client input.

### 2.5 Navigation

- **Mobile (360px and up):** bottom navigation with five tabs as in the brief: Dashboard, Goals, Planner, Progress, AI Tutor.
- **Desktop (1024px and up):** left sidebar with the same five items, plus Lesson Journey, Strategy Library and My Library.
- **Tablet (768px and up):** bottom navigation, wider two-column cards.
- **Header:** WS12 logo on the left (no hamburger menu, per `CLAUDE.md`), centred "WS12 / WINNING STRATEGIES FOR GRADE 12" on wider screens, notification bell with unread badge and profile avatar on the right.
- **Avatar menu:** Profile, My Library, Family (parent linking), Settings, Help, Logout.
- **Lesson Journey, Strategy Library and Self-assessments** are reached from Dashboard cards and from the Strategy Library. See Chapter 15 for an open question about giving the Journey its own tab.

### 2.6 Performance and offline

- Route-level code splitting: the Tutor, Progress charts, Admin and Parent areas load only when opened. Admin code is never in the learner bundle's first load.
- Target budget (proposed, checked in S7): first load under 200 KB of JavaScript compressed, usable on a slow 3G profile, no web fonts required (system font stack).
- Images: SVG icons, compressed WebP where photos are needed, no autoplay video. Video lessons (if any) only load on tap and show their size first.
- PWA (S7): installable, offline app shell, the current week's lesson and today's plan cached for offline reading. Task ticks made offline are queued and synced.
- Respect the device "Data Saver" setting: when on, do not preload anything.

### 2.7 Visual system

Starting point is the September prototype (`docs/decisions.md`, Product context) until the reference image arrives.

| Token          | Value                          | Use                                         |
| -------------- | ------------------------------ | ------------------------------------------- |
| navy           | #10163F                        | Header, hero background, primary text on light |
| indigo-violet  | #3B33C9                        | Primary buttons, links, gradients with navy |
| gold           | #F9C22E                        | Accent, highlights, countdown number, focus ring on navy |
| mint           | Proposed light mint, to confirm | Streak card background                     |
| cream          | Proposed warm cream, to confirm | Tip of the Day card background             |
| white          | #FFFFFF                        | Content areas                               |

- Rounded cards, soft shadows, generous spacing, large readable type, strong hierarchy, friendly icons. Premium, not childish: "I'm preparing for my future."
- Contrast: gold is used on navy or as a background behind navy text, never as text on white (it fails contrast). All text meets WCAG AA.
- Touch targets at least 44 by 44 px. Visible focus states on every control.

### 2.8 Bilingual

- Every learner-facing string goes through `src/i18n/` with English and Afrikaans values. No hard-coded UI text.
- Language is chosen on the Welcome screen, stored on the profile, and can be changed in Settings at any time.
- Book content (lessons, questionnaires, tips) is stored in both languages per item. If an Afrikaans version of an item is not yet supplied, the app shows the English version with a small "Afrikaans coming soon" note rather than a machine translation.
- Afrikaans UI strings are reviewed by a first-language Afrikaans reviewer before launch.

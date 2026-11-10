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

| Folder                | Holds                                                                        |
| --------------------- | ---------------------------------------------------------------------------- |
| `src/ui/`             | Reusable presentational components (cards, buttons, progress bars, nav)      |
| `src/features/`       | One folder per feature (dashboard, journey, goals, planner, progress, tutor) |
| `src/domain/`         | Pure TypeScript business logic: countdown, streaks, progress, Next Win rules |
| `src/data/`           | Supabase queries and repositories, one per table group                       |
| `src/ai/`             | Client interfaces to the AI gateway; no model keys                           |
| `src/auth/`           | Sign-in, session, role and consent state                                     |
| `src/i18n/`           | English and Afrikaans strings                                                |
| `src/demo/`           | Demo learner data (Thabo Mokoena), clearly labelled                          |
| `supabase/migrations` | Schema and RLS                                                               |
| `supabase/functions`  | Edge functions (payments, AI gateway, invites, scheduled jobs)               |

Rules:

- `src/domain/` has no React and no Supabase imports, so it can be reused unchanged in a future Expo app (Chapter 14) and unit-tested.
- UI never calls Supabase directly; it goes through `src/data/`.
- No secrets in the client. Only the Supabase URL and the publishable (anon) key are in client environment variables. Service role keys, payment secrets and AI keys live only in edge function secrets.

### 2.3 How the website and the app share one login

Decision: website accounts and the app share ONE Supabase login (`docs/decisions.md`).

- **One identity.** Both winstrat12.co.za and app.winstrat12.co.za use the same Supabase project and the same `auth.users` table. A person has one account, one password or Google identity, and one profile.
- **Website side.** The plain HTML site loads `supabase-js` from a pinned script and uses the publishable key for sign-up, sign-in and "Forgot password". The website only handles: free account sign-up (lead capture), sign-in, checkout hand-off, and a "Go to My Library" link. All logged-in features live in the app, so they are built once.
- **Website sign-up and age.** The website sign-up form asks "Are you 18 or older?" before anything else. Adults (mostly parents) create their free account on the website. Anyone under 18 is sent to the app's Register screen (app.winstrat12.co.za/register), where the consent flow in 3.3 runs. The website never stores a minor's email or adds it to a marketing list. Marketing emails go only to adults who opted in.
- **Google profile data.** Supabase Auth keeps the Google name and picture in its own user metadata. The sign-up trigger never copies them into `profiles`. For a learner waiting for consent, the consent edge function clears the name and picture from the auth metadata at sign-up, so only the email is held until a parent consents.
- **Checkout is server-side.** The plain HTML site holds no payment secrets. Its "Buy" buttons call a `create-checkout` edge function with the product code. That function creates the Stripe Checkout Session, or builds and signs the PayFast payment request with the PayFast passphrase, and returns the redirect. Prices come from the `products` table, never from the page.
- **App side.** The app handles everything after sign-in.
- **Session between the two sites.** By default Supabase stores the session per origin, so a person signed in on the website is not automatically signed in on the app subdomain. Proposed for v1: the website's "Open the app" and "My Library" links go to the app, which asks the person to sign in with the same account (one tap with Google). Later option: a shared cookie on `.winstrat12.co.za` so one sign-in covers both. This needs a small custom storage adapter and Gary's help on the website side.
- **Configuration.** Both origins are listed as allowed redirect URLs in Supabase Auth and as authorised origins on the Google OAuth client.
- **Purchases before an account exists.** If a parent pays on the website before creating an account, the payment webhook stores the entitlement against the verified buyer email. When an account with that email signs in, a `claim_entitlements()` function claims it, but only if Supabase Auth has verified that email (a confirmed email sign-up, or a Google account with a verified email). An unverified account never claims a purchase.
- **Apple sign-in later.** Auth code keeps providers in one list so Apple can be added without changing screens.

### 2.4 Roles

| Role    | Who                              | Gets                                                           |
| ------- | -------------------------------- | -------------------------------------------------------------- |
| learner | Grade 12 learner (default role)  | Their own data only                                            |
| parent  | Parent or guardian               | Their own account, plus a read-only summary of linked learners |
| teacher | Teacher at a school (later, S7+) | Class-level summaries for learners who joined their class      |
| admin   | Didi and the WS12 team           | Admin dashboard; content, exam dates, tips, support            |

A person can hold more than one role (for example a teacher who is also a parent). Roles live in a `user_roles` table. Every new account gets the learner role from the sign-up trigger. The parent role is self-service but narrow: "I'm a parent" calls a `claim_parent_role()` security definer function that can add only the parent role to the caller's own account (and is refused for an account waiting for parental consent). Teacher and admin roles are granted only by admins. Clients can never write to `user_roles` directly.

### 2.5 Navigation

- **Mobile (360px and up):** bottom navigation with five tabs as in the brief: Dashboard, Goals, Planner, Progress, AI Tutor.
- **Desktop (1024px and up):** left sidebar with the same five items, plus Lesson Journey, Strategy Library and My Library.
- **Tablet (768px and up):** bottom navigation, wider two-column cards.
- **Header (all sizes):** as in the brief, the centre shows the wordmark "WS12 / WINNING STRATEGIES FOR GRADE 12" (stacked on mobile); the right shows the notification bell with unread badge and the profile avatar. The brief's left hamburger icon is not used (`CLAUDE.md`): on the Dashboard the left slot is empty, and on inner screens it holds a Back button.
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

| Token         | Value                           | Use                                                      |
| ------------- | ------------------------------- | -------------------------------------------------------- |
| navy          | #10163F                         | Header, hero background, primary text on light           |
| indigo-violet | #3B33C9                         | Primary buttons, links, gradients with navy              |
| gold          | #F9C22E                         | Accent, highlights, countdown number, focus ring on navy |
| mint          | Proposed light mint, to confirm | Streak card background                                   |
| cream         | Proposed warm cream, to confirm | Tip of the Day card background                           |
| white         | #FFFFFF                         | Content areas                                            |

- Rounded cards, soft shadows, generous spacing, large readable type, strong hierarchy, friendly icons. Premium, not childish: "I'm preparing for my future."
- Contrast: gold is used on navy or as a background behind navy text, never as text on white (it fails contrast). All text meets WCAG AA.
- Touch targets at least 44 by 44 px. Visible focus states on every control.

### 2.8 Bilingual

- Every learner-facing string goes through `src/i18n/` with English and Afrikaans values. No hard-coded UI text.
- Language is chosen on the Welcome screen, stored on the profile, and can be changed in Settings at any time.
- Book content (lessons, questionnaires, tips) is stored in both languages per item. If an Afrikaans version of an item is not yet supplied, the app shows the English version with a small "Afrikaans coming soon" note rather than a machine translation.
- Afrikaans UI strings are reviewed by a first-language Afrikaans reviewer before launch.

---

## Chapter 3. Screen-by-screen UX

Every screen below follows the same template:

- **Purpose:** why it exists.
- **Shows:** what is on it, top to bottom on mobile.
- **States:** empty, loading and error behaviour. Loading uses skeleton cards, never a blank screen. Errors say what happened and offer a retry, in plain language.
- **Next action:** the answer to "What does the learner do next?" Every screen has exactly one primary button.

### 3.0 Screen map

```text
Welcome > Sign in or Register > Consent (if under 18) > Onboarding (5 steps) > Dashboard

Bottom nav:  Dashboard | Goals | Planner | Progress | AI Tutor
From cards:  Exam calendar, Lesson Journey > Lesson, Self-assessments > Result,
             Strategy Library > Tip or Strategy
Header:      Notifications | Avatar menu > Profile, My Library, Family, Settings, Help, Logout
Other roles: Parent home (Chapter 13), Admin (Chapter 11), School Portal (Chapter 12, later)
```

### 3.1 Welcome (S2)

- **Purpose:** first impression; start sign-up or sign-in.
- **Shows:** WS12 logo, product name in the chosen language, the line "Your Grade 12 journey starts here.", a language switch (English / Afrikaans), buttons "Continue with Google", "Continue with Email", and links "Login" and "Register". A small line under the buttons: "Based on the book by Melvin Monroe Tobias." A "Try the demo" link opens demo mode (S1).
- **States:** if Google sign-in fails, a message under the button and the email option stays available. Offline: "You're offline. Connect to sign in."
- **Next action:** Continue with Google.

### 3.2 Sign in and Register (S2)

- **Purpose:** create an account or sign in with the same login used on winstrat12.co.za.
- **Shows:** Register asks only for email and password (or Google), plus one question: "Are you 18 or older?" (Yes / No). We do not ask for a date of birth at this point. Sign in asks for email and password, with "Forgot password". Both offer "I'm a parent" to switch to the parent sign-up path (Chapter 13).
- **States:** clear field errors ("That email already has an account. Sign in instead?"); email verification screen with "Resend email" after 60 seconds.
- **Age answer is locked.** The answer is saved once, at sign-up, by a `declare_age()` security definer function into `age_declarations`. The learner cannot change it later in the app; a mistake is corrected through support. Choosing "I'm a parent" requires answering Yes.
- **Next action:** Create account, then onboarding (or Consent if under 18).

### 3.3 Parental consent (S2)

- **Purpose:** POPIA requires consent from a parent or guardian before we process a child's personal information beyond what is needed to ask for that consent.
- **Shows (learner under 18):** "Before we start, a parent or guardian needs to say yes." Two options: "My parent already has a WS12 account" (enter their invite code) or "Send my parent a link" (parent's email, or cell number once an SMS provider is chosen, Chapter 15, question 24). Explains in one sentence what the parent will see (a weekly summary, not private chats or answers).
- **Until consent is given (proposed):** the learner can complete onboarding and use the demo-style experience on the device, but nothing beyond the account email, age answer and parent contact is saved to the server, and the AI Tutor is off. When the parent consents, onboarding answers are saved. Every consent check (saving onboarding answers, the AI Tutor in 7.4) calls a `has_consent()` function that reads `age_declarations` and `parental_consents`. It never trusts a flag the client can edit.
- **Parent side:** a consent page that says who is asking, what is collected, why, and how to withdraw. Buttons "I give consent" and "This is not my child".
- **States:** "Waiting for your parent" with "Resend" and "Change contact". The parent's contact is kept encrypted in `consent_contacts` only so that Resend works, and is deleted as soon as consent is given or the request expires (proposed: 30 days). Sending real messages to real parents needs Didi's approval before go-live.
- **Next action:** Send my parent a link.

### 3.4 Onboarding, 5 steps (S2)

- **Purpose:** collect only what the app needs to plan for the learner, without overwhelming them. Every step shows "STEP n OF 5" and a progress bar, has Back, and can be finished later from Profile.
- **Step 1, About you:** first name, grade (12 preselected; 11 allowed for early sign-ups), school (search list, or "My school isn't listed"), province.
- **Step 2, Subjects and targets:** choose subjects (Life Orientation and a home language suggested), target mark per subject (slider, optional).
- **Step 3, Exam dates:** trial and final exam dates, prefilled from the WS12 exam calendar for the learner's year with the note "Provisional until the official timetable is published". The learner can adjust them.
- **Step 4, Study time:** study availability (which days) and preferred study times (morning, afternoon, evening, late).
- **Step 5, Goals and interests:** one academic goal (suggested goals from targets) and career interests (optional chips). Ends with "Start my journey".
- **Not asked:** surname, ID number, address, phone, gender, race, home language beyond the app language choice. Surname is optional later in Profile only if needed for certificates.
- **States:** answers are saved per step (on the device only, for a learner waiting for consent), so closing the app does not lose progress. Skipped optional fields lead to friendly empty states later.
- **Next action:** Next, then "Start my journey" which opens the Dashboard with a first-time welcome.

### 3.5 Dashboard (S3)

- **Purpose:** the learner's home. Answers "What should I do next?" in five seconds.
- **Shows, in the brief's order:**
  1. **Header:** logo, notification bell with unread badge, avatar.
  2. **Exam countdown hero:** navy card with gold number. Shows the next exam first: before trials, "TRIALS: 42 DAYS TO GO", with a smaller line "Finals in 105 days". After trials, finals become the main number. Shows the exam date and "View exam calendar". A short encouraging line from approved copy, for example "You've got this! Stay focused, stay consistent, and make it count." Days are calculated in South African time from the learner's dates, never hard-coded. Includes a slim line "Week 14 of 52" linking to the Lesson Journey (proposed).
  3. **Today's Study Plan:** up to four tasks, each with subject, activity, time (for example 09:00 to 10:30), checkbox and status. When the week's lesson is not done, it appears as a task "WS12 lesson: MLS 14" (proposed). Ticking a task saves it, updates progress and the streak, and shows short feedback ("Nice. 2 of 4 done today."). "View all" opens the Planner.
  4. **Streak card (mint):** "5-DAY STREAK!", Monday to Sunday dots that fill in for days with study activity, and a milestone message at 3, 5, 7, 14, 30, 60 and 100 days. The number comes from real activity.
  5. **This week's lesson (proposed):** title of the unlocked lesson in the learner's language, estimated reading time, "Read this week's lesson" or a tick if done.
  6. **Tip of the Day (cream):** one tip from the tips table, with "MORE STRATEGIES" to the Strategy Library.
  7. **Your Next Win:** one recommendation with a reason and one button, for example "Your Mathematics practice has dropped this week." with "START 20-MINUTE MATHS SESSION".
- **Empty states:** no exam date: "Set your exam date" with a button. No plan: "Let's build your first study plan." with "CREATE STUDY PLAN". No streak: "Your first study session starts today." with "START STUDYING".
- **States:** each card loads on its own skeleton; one failing card shows a small retry and does not break the page. Demo mode shows a fixed "Demo data" banner.
- **Next action:** the Your Next Win button. If there is no recommendation yet, the first unticked task.

### 3.6 Exam calendar (S3, proposed)

- **Purpose:** see all upcoming exam dates.
- **Shows:** list of the learner's exams (trials and finals, per subject when the timetable is loaded), with days to go. Dates marked "Provisional" until confirmed by an admin. "Edit my dates" for learner overrides.
- **Empty:** "Set your exam date" with a button.
- **Next action:** View exam preparation plan (opens the Planner filtered to the next exam).

### 3.7 Goals (S4)

- **Purpose:** turn ambitions into tracked targets.
- **Shows:** goal cards grouped by type (academic, subject, study, exam, personal development). Each card: title (for example "Improve Mathematics from 55% to 70%"), current, target, progress percentage, deadline, and an action button ("Continue practice"). Floating "New goal" button.
- **Create or edit goal:** type, subject (if relevant), title, current value, target value, deadline. Validation blocks empty titles, marks outside 0 to 100 and deadlines in the past. A target below the current value is allowed but shows a warning ("Your target is lower than where you are now. Is that right?").
- **Empty:** "You haven't created a goal yet." with "CREATE MY FIRST GOAL".
- **Next action:** the action button on the goal closest to its deadline.

### 3.8 Planner (S4)

- **Purpose:** plan and complete study sessions.
- **Shows:** tabs Today, Week, Month. Today is a time list; Week is seven columns (stacked days on mobile); Month is a calendar with dots per day. Each session: subject, activity, start time, duration, notes, complete toggle. Add, edit, delete (with undo) and mark complete.
- **Built for AI later:** each session has a `source` (learner, template, ai) so the future Study Planner Agent can propose sessions that the learner accepts or rejects.
- **Empty:** "Let's build your first study plan." with "CREATE STUDY PLAN" (offers a starter plan built from onboarding study times).
- **Next action:** Start the next session.

### 3.9 Progress (S5)

- **Purpose:** answer "Where am I? What is improving? What needs attention?"
- **Shows:** overall progress at the top; subject bars (for example "Mathematics 72%"); study hours this week; tasks completed; current and longest streak; weekly and monthly activity charts; goal completion; Lesson Journey progress ("14 of 52 lessons"); latest self-assessment dates. Each block has an action ("Physics needs attention" with "Practice Physics").
- **Formulas:** a subject's percentage is the average of the learner's three most recent `subject_marks` for that subject. With no marks logged it uses `current_mark` from `learner_subjects`; with neither, the bar shows "Add a mark" instead of a number. The bar always says how many marks it is based on. "Needs attention" means the percentage is at least 10 points below `target_mark` (configurable). Overall study progress is tasks completed this week divided by tasks planned this week.
- **Charts:** simple bar charts from real state, lazy-loaded, with a text summary for screen readers.
- **Empty:** "Your progress shows up after your first study session." with "START STUDYING".
- **Next action:** the action on the weakest subject.

### 3.10 AI Tutor (S6)

- **Purpose:** a supportive study assistant that answers from approved WS12 content.
- **Shows:** greeting with the learner's first name, built in the app and never sent to the model ("Hi Thabo, what are we working on today?"), suggested actions: Explain a concept, Help me study, Give me a quiz, Explain my mistake, Create a study plan. Chat thread, input box, and a small line: "WS12 Tutor uses the WS12 book. Check with your teacher if you're unsure." Answers that use book content show their source ("From MLS 14").
- **When content does not cover a question:** "I don't have WS12 content on that yet. Your teacher is the best person to ask." It never invents lessons, quotes or statistics.
- **States:** typing indicator, timeout with retry, daily usage limit message (proposed, to control cost), offline: "The Tutor needs a connection."
- **Locked for under-18 learners until parental consent** is given.
- **Next action:** tap a suggested action.

### 3.11 Lesson Journey (S3 card, full screen proposed for S4)

- **Purpose:** the 52-week journey through the book, one lesson a week. A key differentiator.
- **Shows:** a vertical path of 52 lessons (MLS 1 to 52) grouped by school term. Each item: number, title in the learner's language, state (done, unlocked, locked with unlock date). Progress "14 of 52" and the countdown to trials and finals at the top. Locked lessons show "Unlocks on Monday 12 April" style text and cannot be opened.
- **Unlock rule (proposed):** lessons follow the Grade 12 calendar. On sign-up, all lessons up to the current week are unlocked so late joiners can catch up; then one new lesson unlocks every Monday. Learners who sign up before the school year (Class of 2027 from November 2026) see a pre-season view with MLS 1 as a preview (Chapter 15).
- **Empty or pre-season:** "Your journey starts in January. Here's a taste of week 1." with "READ THE PREVIEW".
- **Next action:** Read this week's lesson (or the oldest unread unlocked lesson).

### 3.12 Lesson (S4, proposed)

- **Purpose:** read and act on one weekly lesson.
- **Shows:** lesson number and title, reading time, the lesson text from the book, then the lesson's activity (for example a reflection question or a short exercise), an optional short quiz, and "Mark lesson complete". Text-first and light on data; optional audio or video only on tap. Language switch per lesson if both versions exist.
- **Content:** to be supplied from the book. Nothing is written by agents.
- **States:** offline reading for the current week's lesson once cached. Saved reflection answers are private to the learner.
- **Next action:** Mark lesson complete, then "Add a study task from this lesson" or back to the Dashboard.

### 3.13 Self-assessments (S5, proposed)

- **Purpose:** the book's five profiling questionnaires online, with saved results that can be retaken. A key differentiator.
- **Shows:** list of the five questionnaires (names to be supplied from the book), each with time to complete, last taken date and "Take" or "Retake". Questionnaire screen: one question per screen on mobile, progress bar, answer options, Back. Result screen: the result as the book defines it, what it means, and one suggested next step linked to a lesson or goal. History: previous results by date, with a simple comparison where the book's scoring allows it.
- **Related core IP:** the DCA formula, the DNA of a Successful Matriculant and Force Field Analysis may appear as guided worksheets here or inside lessons (Chapter 8). Their content is to be supplied from the book.
- **Privacy:** answers and results are private to the learner. Parents and teachers see only that a self-assessment was completed, unless the learner chooses to share a result.
- **Empty:** "Get to know yourself as a learner. It takes about 10 minutes." with "TAKE MY FIRST SELF-ASSESSMENT" (time to be confirmed from the book).
- **Next action:** Take or retake the next questionnaire.

### 3.14 Strategy Library (S3, proposed)

- **Purpose:** browse WS12 strategies and tips beyond Tip of the Day.
- **Shows:** search, filters (topic, lesson), tip cards, links into the Lesson Journey and Self-assessments. Content comes from the content and tips tables; only approved items appear.
- **Empty:** "New strategies are on the way." (only if no approved content exists).
- **Next action:** open a strategy, then "Add to today's plan".

### 3.15 Notifications centre (S3)

- **Purpose:** one place for reminders and announcements.
- **Shows:** list grouped by Today and Earlier. Types: study reminder, goal reminder, streak reminder, new strategy, exam countdown, achievement, important announcement, plus "new lesson unlocked" and parent link requests. Unread items are bold; opening marks read; "Mark all as read". Each notification links to its action.
- **Limits:** at most one reminder push per day by default; quiet hours by default from 22:30 to 06:00 (proposed). If the learner chose "late" study times in onboarding, quiet hours start one hour after their latest study time instead, so late studiers still get their reminder. The learner can change quiet hours in Settings; every type can be turned off in Settings. No guilt-based copy.
- **Empty:** "You're all caught up."
- **Next action:** tap the newest unread notification.

### 3.16 Profile (S2)

- **Purpose:** see and edit learner information.
- **Shows:** name, school, grade, subjects, target marks, current streak, goals summary, achievements, exam dates, linked parents, and "Edit". "Settings" link.
- **States:** skeleton while loading; on error, "We couldn't load your profile." with Retry. Missing optional fields show an "Add" prompt instead of a blank. Saving shows "Saved"; a failed save keeps the edits on screen with "Try again".
- **Next action:** Edit profile (or "Add your exam date" if missing).

### 3.17 My Library (S2)

- **Purpose:** re-download purchased books in both languages and bonus files by tier.
- **Shows:** "My books" with English and Afrikaans editions the person owns, each with file size and "Download"; "Bonus files" for their tier; free planners for every free account. Locked items show which tier includes them and "Upgrade".
- **How it works:** files sit in private Supabase storage. Tapping Download calls an edge function that checks the entitlement and returns a short-lived signed link.
- **Empty (free account):** "Your free planners are ready." with "DOWNLOAD PLANNER" and a soft "See the full book" link.
- **Errors:** a download that fails or stops shows "The download didn't finish. Try again, ideally on Wi-Fi." with Retry. If the entitlement check fails, "We couldn't confirm your purchase." with "Contact support" and the purchase reference, so support can help quickly. An expired link is renewed automatically on Retry.
- **Next action:** Download.

### 3.18 Family (parent linking) (S2)

- **Purpose:** link learner and parent accounts both ways.
- **Learner view:** linked parents, "Add a parent" (send a link by email, or by SMS once a provider is chosen, or enter the parent's invite code), "Remove". Plain-language list of what parents can see.
- **Parent view:** linked children, "Invite my child" (shows an invite code and share link for WhatsApp), pending invites, "Remove".
- **Rules:** a link becomes active only when both sides have accepted. Either side can remove it at any time.
- **Empty:** learner: "No parent linked yet. A parent gets a short weekly summary so they can support you." with "ADD A PARENT". Parent: "Invite your child to get started." with "INVITE MY CHILD".
- **States:** pending links show "Waiting for [first name] to accept" with Resend and Cancel. A wrong or expired code shows "That code didn't work. Check it or ask for a new one." Too many wrong tries: "Please wait a while and try again." Errors offer Retry.
- **Next action:** Add a parent (learner) or Invite my child (parent).

### 3.19 Settings (S2, proposed)

- **Shows:** language, notification types and quiet hours, study reminder time, data saver, exam dates, privacy (download my data, delete my account request, parent links), Log out.
- **States:** each change saves straight away with a small "Saved". If a save fails, the control switches back and shows "Couldn't save. Try again." Loading shows the last saved values.
- **Next action:** none required; "Done" returns to the previous screen.

### 3.20 Help (S2, proposed)

- **Shows:** short FAQs (account, payments, My Library, parent linking, privacy), "Contact support" (email link), and a "Need someone to talk to?" section with verified South African support lines (to be supplied and checked by Didi).
- **States:** FAQs are bundled with the app, so they work offline. "Contact support" opens the email app; if there is none, the support address is shown with a Copy button.
- **Next action:** Contact support.

### 3.21 Logout (S2, proposed)

- From the avatar menu or Settings. Confirms "Log out of WS12?", clears the session on the device, returns to Welcome. Queued offline changes are synced first, or the learner is warned if they cannot be.
- **Next action:** Log out (the confirm button). On Welcome, the next action is to sign in again.

### 3.22 Achievements (S3, proposed, inside Profile)

- **Shows:** earned milestones (streaks at 3, 5, 7, 14, 30, 60, 100 days; first goal; lessons completed; first self-assessment) and the next one to earn. Celebrations are short and skippable. No rewards that look like gambling.
- **Next action:** the action that earns the next achievement.

### 3.23 Demo mode (S1)

- Seed learner Thabo Mokoena, Grade 12, subjects Mathematics, Physical Sciences, English Home Language, Life Orientation. A fixed "Demo data" banner on every screen, and nothing is written to real learner tables. "Create my own account" is always visible.
- **Next action:** Create my own account.

---

## Chapter 4. Feature priorities

**Must** = needed for the first public release. **Should** = in version 1 if time allows. **Later** = after version 1. Sprints refer to `SPRINTS.md`. Items marked "proposed sprint" are not yet boxes in `SPRINTS.md` and need Didi's approval to add (Chapter 15).

| Feature                                                          | Priority | Sprint                     |
| ---------------------------------------------------------------- | -------- | -------------------------- |
| Project foundation, folder structure, CI                         | Must     | S1                         |
| Full schema with RLS on every table                              | Must     | S1                         |
| App shell: bottom nav, sidebar, avatar menu (no hamburger)       | Must     | S1                         |
| English and Afrikaans i18n layer                                 | Must     | S1                         |
| Demo mode (Thabo Mokoena)                                        | Must     | S1                         |
| Welcome, Google sign-in, email sign-in, shared website login     | Must     | S2                         |
| Parental consent for under-18 learners                           | Must     | S2                         |
| 5-step onboarding                                                | Must     | S2                         |
| Profile view and edit                                            | Must     | S2                         |
| My Library (books EN and AF, bonus files by tier, free planners) | Must     | S2                         |
| PayFast ITN and Stripe webhooks (sandbox)                        | Must     | S2                         |
| Parent linking both ways                                         | Must     | S2                         |
| Settings, Help, Logout                                           | Must     | S2 (proposed sprint)       |
| Real exam countdown (trials and finals)                          | Must     | S3                         |
| Exam calendar screen                                             | Must     | S3 (proposed sprint)       |
| Today's Study Plan with saving tasks                             | Must     | S3                         |
| Streak card and milestones                                       | Must     | S3                         |
| Tip of the Day                                                   | Must     | S3                         |
| Strategy Library                                                 | Must     | S3 (proposed sprint)       |
| Your Next Win (rule-based)                                       | Must     | S3                         |
| Notifications centre with unread badge                           | Must     | S3                         |
| This week's lesson card on the Dashboard                         | Must     | S3 (proposed sprint)       |
| Lesson Journey screen and Lesson screen (52 weeks)               | Must     | S4 (proposed sprint)       |
| Goals                                                            | Must     | S4                         |
| Planner (today, week, month)                                     | Must     | S4                         |
| Streak engine hardened                                           | Must     | S4                         |
| Self-assessments with saved results and retakes                  | Must     | S5 (proposed sprint)       |
| Progress screen with real charts                                 | Must     | S5                         |
| Recommendation engine v2                                         | Must     | S5                         |
| Analytics events                                                 | Must     | S5                         |
| Parent weekly summary data (sending needs Didi's approval)       | Must     | S5                         |
| Parent home screen (Chapter 13)                                  | Must     | S5 (proposed sprint)       |
| AI Tutor with retrieval from approved content                    | Must     | S6                         |
| First approved lessons in the knowledge base                     | Must     | S6                         |
| PWA install and offline shell                                    | Must     | S7                         |
| Performance, security, accessibility, privacy pages              | Must     | S7                         |
| Staging deployment (production only with Didi's approval)        | Must     | S7                         |
| Admin dashboard: content approval, tips, exam dates, support     | Should   | S5 to S7 (proposed sprint) |
| Achievements screen                                              | Should   | S3 (proposed sprint)       |
| Push notifications                                               | Should   | S7 (proposed sprint)       |
| Offline task ticks with sync                                     | Should   | S7 (proposed sprint)       |
| Shared session cookie across website and app                     | Later    | After v1                   |
| Apple sign-in                                                    | Later    | After v1                   |
| AI Study Planner Agent generating sessions                       | Later    | After v1                   |
| Other AI agents (Motivation, Exam Preparation, Parent Support)   | Later    | After v1                   |
| School Portal, teacher accounts, bulk licences                   | Later    | After v1                   |
| Affiliate programme tracking and payouts                         | Later    | After v1                   |
| Curriculum content and past papers in the knowledge base         | Later    | After v1                   |
| Native apps (Expo) and app store release                         | Later    | After v1                   |

---

## Chapter 5. User journeys

### 5.1 Learner signs up (learner first)

1. Thabo sees a WS12 TikTok and taps the link to winstrat12.co.za, or opens app.winstrat12.co.za directly.
2. On the website he answers "Are you 18 or older?" No, and is sent to the app's Register screen (2.3). No email is stored on the website.
3. In the app: Welcome, choose language, "Continue with Google".
4. Answers "Are you 18 or older?" No.
5. Consent screen: "Send my parent a link". Enters his mother's email (or cell number once an SMS provider is chosen). The parent receives a consent link (real sending needs Didi's approval before go-live).
6. Completes the 5-step onboarding while waiting. Answers stay on the device.
7. Parent taps the link, signs up or signs in as a parent, gives consent. The link between them is created at the same time.
8. Thabo's onboarding answers are saved, the AI Tutor unlocks, and he lands on the Dashboard with a first-time welcome. He has no plan for today yet, so Your Next Win says "Plan today's study" (rule 2 in 7.3). Once the plan exists, this week's lesson appears in it as a task. In pre-season, the Journey card offers the MLS 1 preview instead.

Learners aged 18 or older skip steps 5 and 7.

### 5.2 Parent buys and invites the learner (parent first)

1. Nomsa sees a WS12 post on Facebook or a message in a WhatsApp group and visits winstrat12.co.za.
2. Chooses a tier (R99, R199 or R349) and pays with PayFast or Stripe.
3. The payment webhook (edge function) verifies the payment and creates an entitlement for her verified email.
4. She is asked to create her parent account with the same email (or signs in). The entitlement is claimed and appears in her My Library.
5. Parent home shows "Invite my child". She shares the invite link on WhatsApp.
6. Her child opens the link, registers, and the invite code is filled in. Because the parent who invited is the one giving consent, the consent step is completed in the same flow: the parent confirms on her phone with one tap.
7. The child's account gets access through the parent's purchase (proposed: purchases made by a parent apply to the linked child). The child onboards and lands on the Dashboard.
8. Each week Nomsa gets a short progress summary (Chapter 13).

### 5.3 Learner adds a parent (learner already has an account)

1. Learner opens avatar menu, Family, "Add a parent".
2. Either enters the parent's invite code (if the parent already has an account) or sends a link by email (or SMS once a provider is chosen).
3. Parent opens the link, signs in or registers as a parent, and accepts.
4. Both see the link in Family. The learner sees exactly what the parent can see. Either can remove the link.

### 5.4 Daily study loop

1. Learner opens the app (a gentle study reminder at their preferred time, or by habit).
2. Dashboard: countdown says "TRIALS: 42 DAYS TO GO". Your Next Win says what to do first.
3. Learner taps it, or ticks off a task from Today's Study Plan after studying.
4. Each tick saves to `study_tasks`, writes a `study_activity` row, updates the streak and progress, and shows short feedback.
5. If the learner is stuck, they open the AI Tutor from the task ("Help me with this").
6. At the end of the day the streak card shows today filled in. If it is a milestone, a short celebration.
7. Next day, the plan is ready. Missed days are met with encouragement, not guilt ("New day, fresh start.").

### 5.5 Weekly lesson loop

1. Monday: the new lesson unlocks; a "New lesson unlocked" notification arrives (one per week).
2. The lesson appears on the Dashboard and in Today's Study Plan.
3. Learner reads it, does the activity, and marks it complete. Journey progress moves to "15 of 52".
4. Where the book links a lesson to a questionnaire or framework, the lesson ends with "Take the self-assessment" or "Try the worksheet".
5. Sunday: the parent weekly summary includes whether the week's lesson was completed.

### 5.6 Returning purchaser downloads books

1. Person signs in (website or app) and opens My Library.
2. Sees their books in English and Afrikaans and bonus files for their tier.
3. Taps Download; an edge function checks entitlement and returns a short-lived link.

---

## Chapter 6. Database architecture

All tables live in the one Supabase Postgres database, in the `public` schema unless noted. Every table has Row Level Security turned on, with no exceptions. Timestamps are `timestamptz`; dates that mean "a day in South Africa" are stored as `date` and calculated in the `Africa/Johannesburg` time zone.

### 6.1 Tables

**Identity and people**

| Table                      | Key columns                                                                                                                                                                                                             | Notes                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `auth.users`               | Managed by Supabase Auth                                                                                                                                                                                                | The "users" table from the brief. Shared by website and app                                                         |
| `profiles`                 | `id` (= auth user id), `first_name`, `grade`, `school_id`, `province`, `school_name_other` (text, when the school is not listed; reviewed by admins), `language` (en, af), `onboarding_step`, `onboarded_at`, `is_demo` | One per person. No ID number, no address. Created by the sign-up trigger; Google name and picture are not copied in |
| `age_declarations`         | `user_id`, `is_adult` (bool), `declared_at`                                                                                                                                                                             | Written once by `declare_age()`; no client update                                                                   |
| `user_roles`               | `user_id`, `role` (learner, parent, teacher, admin)                                                                                                                                                                     | Admin-managed only                                                                                                  |
| `parental_consents`        | `id`, `learner_id`, `parent_user_id`, `contact_hash`, `status` (pending, given, withdrawn), `given_at`, `withdrawn_at`, `policy_version`                                                                                | Proof of POPIA consent                                                                                              |
| `consent_contacts`         | `consent_id`, `channel` (email, sms), `contact_encrypted`, `expires_at`                                                                                                                                                 | Encrypted parent contact for Resend only; deleted when consent is given or expires; no client access                |
| `parent_links`             | `id`, `learner_id`, `parent_id`, `status` (pending, active, removed), `initiated_by`, `created_at`                                                                                                                      | Both directions use this one table                                                                                  |
| `invites`                  | `id`, `code` (short, random), `created_by`, `kind` (parent_to_learner, learner_to_parent), `expires_at`, `used_at`                                                                                                      | Codes expire; single use                                                                                            |
| `schools`                  | `id`, `name`, `province`, `emis_number` (optional)                                                                                                                                                                      | Public list; admin-managed                                                                                          |
| `notification_preferences` | `user_id`, per-type toggles, `quiet_start`, `quiet_end`, `reminder_time`                                                                                                                                                |                                                                                                                     |

**Study**

| Table                  | Key columns                                                                                                                                         | Notes                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `subjects`             | `id`, `code`, `name_en`, `name_af`                                                                                                                  | Reference list                                                                    |
| `learner_subjects`     | `learner_id`, `subject_id`, `target_mark`, `current_mark`                                                                                           | Current mark is entered by the learner                                            |
| `subject_marks`        | `id`, `learner_id`, `subject_id`, `mark`, `kind` (test, assignment, practice, trial), `recorded_on`                                                 | History for progress and Next Win                                                 |
| `exam_dates`           | `id`, `year`, `kind` (trial, final), `subject_id` (nullable), `starts_on`, `status` (provisional, confirmed), `source_note`                         | Admin-managed calendar                                                            |
| `learner_exam_dates`   | `learner_id`, `kind`, `subject_id` (nullable), `starts_on`                                                                                          | Learner overrides                                                                 |
| `goals`                | `id`, `learner_id`, `type` (academic, subject, study, exam, personal), `subject_id`, `title`, `current_value`, `target_value`, `deadline`, `status` |                                                                                   |
| `study_sessions`       | `id`, `learner_id`, `subject_id`, `activity`, `starts_at`, `duration_minutes`, `notes`, `status`, `source` (learner, template, ai)                  | Planner items                                                                     |
| `study_tasks`          | `id`, `learner_id`, `session_id` (nullable), `lesson_id` (nullable), `subject_id`, `title`, `due_on`, `start_time`, `end_time`, `completed_at`      | Today's Study Plan                                                                |
| `study_activity`       | `id`, `learner_id`, `activity_on` (date), `kind` (task, session, lesson, assessment), `minutes`, `ref_id`                                           | Source of truth for streaks and hours                                             |
| `streaks`              | `learner_id`, `current_length`, `longest_length`, `last_active_on`, `updated_at`                                                                    | Derived from `study_activity` by a database function, never written by the client |
| `achievements`         | `id`, `code`, `name_en`, `name_af`, `rule`                                                                                                          | Reference list (milestones 3, 5, 7, 14, 30, 60, 100)                              |
| `learner_achievements` | `learner_id`, `achievement_id`, `earned_at`                                                                                                         | Written by a database function                                                    |
| `notifications`        | `id`, `user_id`, `type`, `title_key`, `params`, `link`, `read_at`, `created_at`                                                                     | Text comes from i18n keys                                                         |
| `recommendations`      | `id`, `learner_id`, `rule_code`, `reason_key`, `action_link`, `shown_at`, `acted_at`                                                                | Your Next Win log, for tuning                                                     |

**Content (Melvin's book and WS12 material)**

| Table                         | Key columns                                                                                                                                                                                                                                                              | Notes                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| `content`                     | `id`, `kind` (chapter, strategy, topic, lesson, activity, framework, story, quiz, explanation), `parent_id`, `slug`, `title_en`, `title_af`, `body_en`, `body_af`, `status` (draft, in_review, approved, retired), `version`, `approved_by`, `approved_at`, `source_ref` | The brief's "content" table. Tree via `parent_id` |
| `lessons`                     | `id`, `content_id`, `mls_number` (1 to 52), `week_number`, `reading_minutes`, `min_tier`                                                                                                                                                                                 | Weekly lesson metadata                            |
| `lesson_progress`             | `learner_id`, `lesson_id`, `opened_at`, `completed_at`, `reflection` (private text)                                                                                                                                                                                      |                                                   |
| `tips`                        | `id`, `text_en`, `text_af`, `content_id` (nullable), `status`, `starts_on`                                                                                                                                                                                               | Tip of the Day                                    |
| `questionnaires`              | `id`, `slug`, `title_en`, `title_af`, `intro_en`, `intro_af`, `scoring_rule`, `status`, `version`                                                                                                                                                                        | The five profiling questionnaires                 |
| `questionnaire_items`         | `id`, `questionnaire_id`, `position`, `prompt_en`, `prompt_af`, `options` (json), `scale`                                                                                                                                                                                |                                                   |
| `questionnaire_results_bands` | `questionnaire_id`, `band`, `min_score`, `max_score`, `label_en`, `label_af`, `meaning_en`, `meaning_af`, `next_step_content_id`                                                                                                                                         | From the book only                                |
| `assessment_attempts`         | `id`, `learner_id`, `questionnaire_id`, `questionnaire_version`, `started_at`, `completed_at`, `score`, `band`, `shared_with_parent` (bool)                                                                                                                              | Saved results; retakes add new rows               |
| `assessment_answers`          | `attempt_id`, `item_id`, `answer`                                                                                                                                                                                                                                        | Private                                           |
| `worksheet_answers`           | `id`, `learner_id`, `activity_content_id`, `content_version`, `answers` (json), `saved_at`                                                                                                                                                                               | Guided worksheets (8.3); private                  |
| `plan_templates`              | `id`, `title_en`, `title_af`, `items` (json), `source_content_id`, `status`                                                                                                                                                                                              | Study plan templates (8.2); admin-managed         |

**Commerce and library**

| Table            | Key columns                                                                                                                                                     | Notes                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `products`       | `id`, `code`, `tier` (free, r99, r199, r349), `price_cents`, `active`                                                                                           | Prices are set by Didi only                                |
| `library_files`  | `id`, `title_en`, `title_af`, `language`, `storage_path`, `min_tier`, `kind` (book, bonus, planner), `size_bytes`                                               | Files in a private bucket                                  |
| `purchases`      | `id`, `buyer_email`, `buyer_user_id`, `product_id`, `provider` (payfast, stripe), `provider_ref`, `amount_cents`, `status`, `raw_event_id`                      | Written only by webhook functions                          |
| `entitlements`   | `id`, `user_id` (nullable until claimed), `email`, `tier`, `status` (active, inactive), `source_purchase_id`, `granted_for_learner_id` (nullable), `claimed_at` | What a person may access; refunds set `status` to inactive |
| `payment_events` | `id`, `provider`, `event_id` (unique), `received_at`, `payload_hash`                                                                                            | Idempotency for webhooks                                   |

**AI and analytics**

| Table              | Key columns                                                                          | Notes                       |
| ------------------ | ------------------------------------------------------------------------------------ | --------------------------- |
| `kb_chunks`        | `id`, `content_id`, `content_version`, `language`, `text`, `embedding` (pgvector)    | Only from approved content  |
| `ai_conversations` | `id`, `learner_id`, `agent` (tutor), `started_at`                                    |                             |
| `ai_messages`      | `id`, `conversation_id`, `role`, `text`, `source_chunk_ids`, `flagged`, `created_at` | Retention limit (Chapter 7) |
| `analytics_events` | `id`, `user_id`, `event`, `props` (json, no free text), `created_at`                 | Chapter 10                  |
| `audit_log`        | `id`, `actor_id`, `action`, `target`, `created_at`                                   | Admin actions               |

**Later (schema reserved, not built in v1):** `classes`, `class_members`, `licences` (school bulk), `affiliates`, `referrals`, `commissions`.

### 6.2 Relations (summary)

- `profiles` 1 to 1 `auth.users`.
- A learner has many `learner_subjects`, `goals`, `study_sessions`, `study_tasks`, `study_activity` rows, `lesson_progress` rows and `assessment_attempts`; one `streaks` row.
- `parent_links` joins a parent profile and a learner profile (many to many: a learner can have two parents, a parent several children).
- `content` is a tree: chapter, strategy, topic, lesson, activity, quiz. `lessons` adds weekly data to lesson nodes. `kb_chunks` belong to an approved `content` version.
- `purchases` create `entitlements`; `library_files` and `lessons` are gated by `min_tier` against the person's highest entitlement.

### 6.3 Row Level Security approach

1. **RLS on every table, default deny.** A table without policies returns nothing.
2. **Own rows.** Learner tables use `learner_id = auth.uid()` for select, insert, update and delete, with `with check` on inserts and updates so a learner cannot write rows for someone else.
3. **Parents read summaries, not raw data.** Parents never get select access to learner tables directly. They read from a `parent_learner_summary` view backed by a `security definer` function that first checks an active `parent_links` row and returns only summary fields (streak, lessons completed this week, study minutes, tasks done, next exam). Reflections, AI chats and self-assessment answers are never in it; a result appears only if the learner set `shared_with_parent`.
4. **Admins** are checked with an `is_admin()` function that reads `user_roles`. Admin-only tables and write access to content, tips, exam dates and products use it. Roles are never read from client-editable data.
5. **Reference and content tables** (`subjects`, `schools`, `achievements`, `exam_dates`, `tips`, `plan_templates`, approved `content`, `lessons`, `questionnaires`, `questionnaire_items`, `questionnaire_results_bands`) are readable by signed-in users only where `status = 'approved'`, and lesson bodies also check the unlock rule and `min_tier` through a function.
6. **Server-written tables** (`purchases`, `entitlements`, `payment_events`, `streaks`, `learner_achievements`) have no client write policies. They are written by edge functions using the service role, or by `security definer` database functions.
7. **Storage:** buckets are private. Downloads go through an edge function that checks entitlements and returns a signed URL valid for a few minutes.
8. **Demo data** is flagged `is_demo` and isolated from real learner data.
9. **Tables with no owner column** (`ai_messages`, `assessment_answers`, `questionnaire_items`, `questionnaire_results_bands`) get their policy through the parent row: an `exists` check that the parent row (`ai_conversations`, `assessment_attempts` or an approved `questionnaires` row) belongs to `auth.uid()` or is approved.
10. **Sensitive flows go through `security definer` functions**, never direct writes: `declare_age()`, `claim_parent_role()`, `request_consent()`, `give_consent()`, `withdraw_consent()`, `create_invite()`, `redeem_invite()`, `remove_link()`, `claim_entitlements()`. Each checks `auth.uid()` itself and writes `audit_log`.
11. **Invite codes cannot be enumerated.** Clients have no select on `invites` by code. `redeem_invite(code)` looks the code up on the server, returns only "valid" or "invalid", and is rate-limited per account (proposed: 5 failed tries per hour). Codes are at least 8 characters from an unambiguous alphabet, single use, and expire after 7 days (proposed).
12. **Tests (S1 and S2):** automated RLS tests prove that learner A cannot read or write learner B's rows; a parent cannot read an unlinked learner; a parent cannot read reflections, chats, worksheet or assessment answers; a non-admin cannot write content; a learner cannot change `age_declarations` or write `user_roles`; a learner under 18 without consent cannot save onboarding data or reach the Tutor even after editing any client-side value; a person cannot read invites by code or claim a purchase with an unverified email.

**Policies per table group**

| Tables                                                                                                                                                                                              | Select                                                                                    | Insert, update, delete                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `profiles`                                                                                                                                                                                          | Own row (`id = auth.uid()`); admins                                                       | Insert by sign-up trigger; update own row; delete only through the account deletion edge function      |
| `age_declarations`                                                                                                                                                                                  | Own row                                                                                   | `declare_age()` once; no client update or delete                                                       |
| `user_roles`                                                                                                                                                                                        | Own rows; admins                                                                          | `claim_parent_role()` (parent only); admins for teacher and admin                                      |
| `parental_consents`                                                                                                                                                                                 | Learner: own rows (status only); parent: rows where `parent_user_id = auth.uid()`; admins | Only through `request_consent()`, `give_consent()`, `withdraw_consent()`                               |
| `consent_contacts`                                                                                                                                                                                  | None (edge functions only)                                                                | Edge functions only                                                                                    |
| `parent_links`                                                                                                                                                                                      | Rows where the caller is the learner or the parent                                        | Only through `redeem_invite()`, `remove_link()`                                                        |
| `invites`                                                                                                                                                                                           | Own invites (`created_by = auth.uid()`)                                                   | `create_invite()`, `redeem_invite()`                                                                   |
| Study tables (`learner_subjects`, `subject_marks`, `learner_exam_dates`, `goals`, `study_sessions`, `study_tasks`, `study_activity`, `lesson_progress`, `worksheet_answers`, `assessment_attempts`) | Own rows (`learner_id = auth.uid()`)                                                      | Own rows with `with check`; requires `has_consent()`                                                   |
| `assessment_answers`                                                                                                                                                                                | Through own `assessment_attempts` row                                                     | Through own attempt; no update after the attempt is completed                                          |
| `streaks`, `learner_achievements`                                                                                                                                                                   | Own rows                                                                                  | Database functions only                                                                                |
| `recommendations`                                                                                                                                                                                   | Own rows                                                                                  | Insert own rows; update only `acted_at` on own rows                                                    |
| `notifications`                                                                                                                                                                                     | Own rows (`user_id = auth.uid()`)                                                         | Server inserts; learner may update only `read_at` on own rows                                          |
| `notification_preferences`                                                                                                                                                                          | Own row                                                                                   | Insert and update own row                                                                              |
| `analytics_events`                                                                                                                                                                                  | None for clients; admins through aggregate functions                                      | Insert own rows only (`user_id = auth.uid()`); server writes `purchase_completed`; no update or delete |
| `ai_conversations`, `ai_messages`                                                                                                                                                                   | Own conversations, and messages through them                                              | `ai-gateway` edge function only                                                                        |
| `kb_chunks`                                                                                                                                                                                         | None for clients                                                                          | `ai-gateway` and the indexing job only                                                                 |
| `products`                                                                                                                                                                                          | Active rows, also for signed-out visitors (website prices)                                | Admins only                                                                                            |
| `library_files`                                                                                                                                                                                     | Metadata for signed-in users (so locked items can show their tier)                        | Admins only; file access only through the download edge function                                       |
| `purchases`, `entitlements`                                                                                                                                                                         | Own rows (`buyer_user_id` or `user_id = auth.uid()`); admins                              | Payment webhooks and `claim_entitlements()` only                                                       |
| `payment_events`                                                                                                                                                                                    | None for clients                                                                          | Payment webhooks only                                                                                  |
| Reference and content tables (rule 5)                                                                                                                                                               | Signed-in users, approved rows only                                                       | Admins only                                                                                            |
| `audit_log`                                                                                                                                                                                         | Admins only                                                                               | Security definer functions and triggers only; no update or delete                                      |

### 6.4 Privacy and retention (POPIA)

- Collect only what each feature needs (Chapter 3.4 lists what onboarding does not ask).
- Parental consent recorded before processing a minor's data beyond the consent request.
- "Download my data" and "Delete my account" in Settings. Deletion removes learner rows and anonymises analytics events.
- Proposed retention: AI chat messages 90 days, analytics events 24 months, payment records as required by law. To be confirmed by Didi (Chapter 15).

---

## Chapter 7. AI agent architecture

### 7.1 Principles

- AI is an assistant to learners, parents, teachers and the WS12 team. It never replaces a teacher, mentor, parent or human leadership, and the UI never says it does.
- The AI never invents educational content, quotes, statistics or testimonials, and never presents Melvin's human-written book as AI-generated.
- No model API keys in the browser. Every model call goes through a Supabase edge function.
- Start small: version 1 builds only the AI Tutor and the rule-based Your Next Win. The architecture lets more agents be added without rewriting the app.

### 7.2 Orchestration layer

```text
App (src/ai/)  --->  Edge function: ai-gateway
                         |
                         +-- Auth check, consent check, rate limit
                         +-- Agent registry: picks the agent module
                         |      tutor (v1)
                         |      study-planner, motivation, exam-prep,
                         |      parent-support, teacher-support (later)
                         +-- Tools the agent is allowed to use
                         |      retrieve_ws12_content (kb_chunks)
                         |      read_learner_summary (no names)
                         |      propose_study_sessions (later; learner must accept)
                         +-- Model provider adapter (provider to be chosen by Didi)
                         +-- Output checks, logging to ai_messages
```

Each agent module declares:

| Field          | Meaning                                                  |
| -------------- | -------------------------------------------------------- |
| `id`           | For example `tutor`                                      |
| `purpose`      | One sentence                                             |
| `inputs`       | Typed input (question, learner summary, language)        |
| `allowedTools` | Exact list of tools; anything else is refused            |
| `outputSchema` | Typed output (answer text, source ids, suggested action) |
| `guardrails`   | Rules checked before and after the model call            |

Adding an agent means adding a module and registering it. The app talks to `ai-gateway` with an agent id, so screens do not change.

### 7.3 Your Next Win (rule-based, S3, v2 in S5)

Not a language model. A pure TypeScript function in `src/domain/` (mirrored in the database where needed) that takes the learner's goals, study activity, task completion, subject marks, upcoming exams, weak areas and lesson progress, and returns ONE action with a reason. Rules are ordered and fully explainable. Proposed starting rules, first match wins:

1. No exam date: "Set your exam date" (so the countdown works).
2. No plan for today: "Plan today's study" (starter plan from onboarding times).
3. This week's lesson not done and it is Thursday or later: "Read this week's lesson". In pre-season there is no weekly lesson, so this rule offers the MLS 1 preview once and is then skipped.
4. A subject with marks well below target and no practice in 7 days: "Start a 20-minute [subject] session".
5. A goal deadline within 14 days and progress behind schedule: "Continue [goal]".
6. Streak at risk (active yesterday, nothing today, after 17:00): "Complete one task to keep your streak".
7. Exam within 30 days: "View your exam preparation plan".
8. Default: the first unticked task today.

Rules that do not apply are skipped (for example rule 1 when the WS12 exam calendar already gives the learner's dates). Thresholds are set in one config file and tuned with the `recommendations` log. Unit tests cover each rule with realistic cases.

### 7.4 AI Tutor (S6)

- **Flow:** learner asks; the gateway checks consent with `has_consent()` and limits; retrieves the most relevant approved chunks in the learner's language; if no chunk passes the relevance threshold, the Tutor replies with the "I don't have WS12 content on that yet" message and suggests asking a teacher; otherwise it answers using only those chunks and returns their source ids, shown as "From MLS 14".
- **Suggested actions:** Explain a concept, Help me study, Give me a quiz (only approved quiz questions from the knowledge base; the Tutor never writes new questions. If a lesson has no approved quiz yet, it says so and offers to explain the lesson instead), Explain my mistake, Create a study plan (proposes sessions the learner accepts in the Planner).
- **Guardrails:**
  - Answers only from retrieved approved content; no outside facts presented as WS12 content.
  - Never claims to be Melvin, a teacher or a counsellor.
  - Does not ask for or store personal details. No name goes to the model. Only grade, language and the question are sent; the greeting with the first name is added in the app.
  - If a message suggests distress or risk of harm, the Tutor stops tutoring, responds with care, encourages talking to a trusted adult, and shows verified South African support lines (to be supplied and checked by Didi). The message is flagged for review.
  - Refuses to write assignments for the learner to hand in; offers to explain instead.
  - Daily message limit per learner (proposed) to control cost.
- **Logging:** `ai_messages` stores the text, source chunk ids and flags for quality review, with a retention limit (proposed 90 days). No analytics event contains message text.
- **Model choice:** provider and model are not decided. The adapter keeps the choice in one place (Chapter 15).

### 7.5 Future agents (architecture only)

From the brief: Executive Intelligence, Study Planner, AI Tutor, Curriculum, Learner Success, Motivation, Exam Preparation, Parent Support, Teacher Support, Marketing Intelligence. None is built in version 1 except the Tutor. Agents that act on learner data (Study Planner) only propose; the learner accepts. Agents that face parents or teachers only use summary data under the same RLS rules as the portals.

---

## Chapter 8. Melvin's content to AI knowledge architecture

### 8.1 The rule

The book is 100% human-written by a South African educator. WS12 turns it into structured content; it does not rewrite it, summarise it into new claims, or add invented lessons. Every item that reaches learners, and every chunk the AI can retrieve, has been approved. Nothing is published as Melvin's without Didi's approval.

### 8.2 The content hierarchy

From `docs/build-plan.md`: Book, Chapters, Strategies, Topics, Lessons, Activities, Quizzes, AI explanations, Study plans. Mapped to the `content` tree (Chapter 6):

| Level           | WS12 meaning                                                                                                | Stored as                             |
| --------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Book            | "Winning Strategies for Grade 12" / "Wenner Strategieë vir Graad 12"                                        | Root `content` row                    |
| Chapters        | Sections or terms of the book, as the book defines them (to be supplied from the book)                      | `kind = chapter`                      |
| Strategies      | Named strategies and frameworks: the DCA formula, the DNA of a Successful Matriculant, Force Field Analysis | `kind = strategy` or `framework`      |
| Topics          | Themes that cut across lessons (for example motivation, time, mindset), tagged from the book                | `kind = topic` and tags               |
| Lessons         | MLS 1 to 52, one per week                                                                                   | `kind = lesson` plus `lessons` row    |
| Activities      | Exercises, reflections and worksheets in the book                                                           | `kind = activity`                     |
| Quizzes         | Questions from the book, or approved practice questions                                                     | `kind = quiz`                         |
| AI explanations | Short explanations the Tutor may give, written or approved by the WS12 team, linked to their source lesson  | `kind = explanation`, status approved |
| Study plans     | Plan templates based on the book's guidance                                                                 | Planner templates                     |

Stories such as the Pencil story are stored as `kind = story` and linked to the lessons that use them.

### 8.3 What each type of book content becomes

- **Weekly lesson (MLS 1 to 52):** number, week, English and Afrikaans title and text, reading time, linked activity, optional quiz, linked strategies and stories, unlock week, minimum tier. Known titles include Momentum; Lessons from a Salmon (Lesse van 'n Salm); The Comfort Zone (Gemaksone); Entropy (Entropie); The Marshmallow Experiment (Marshmallow Eksperiment); Pressing the Self-Destruct Button; The Wait Is Almost Over (Die Wag Is Byna Verby); A Good Start to Project Matric. Their numbers, text and order are to be supplied from the book.
- **Framework (DCA formula, DNA of a Successful Matriculant, Force Field Analysis):** a `framework` item with its explanation from the book, plus an optional guided worksheet (an activity with fields the learner fills in and saves privately). What each framework contains is to be supplied from the book.
- **Story (the Pencil story):** a `story` item linked to its lessons. Text to be supplied from the book.
- **Profiling questionnaire (five):** a `questionnaire` with items, answer scale, scoring rule and result bands with meanings and a next step, all taken from the book. Learners take it online; each attempt is saved in `assessment_attempts` so they can retake it and compare. Names, items, scoring and bands are to be supplied from the book.
- **Saved results:** private to the learner, used by Your Next Win only where the book links a result to a lesson or action.

### 8.4 The content pipeline

1. **Source:** Didi supplies the manuscript in an editable format (Word or similar), in English and Afrikaans, plus the five questionnaires with their scoring.
2. **Structure:** the WS12 team (with agent help for formatting only) splits the manuscript into one Markdown file per item with a small header (type, MLS number, week, language, title, links). The text is copied, not rewritten.
3. **Check:** a script compares the structured text with the manuscript to confirm nothing was changed or lost.
4. **Review:** Didi (and Melvin where Didi decides) reviews each item in the admin content queue and approves it. Status moves draft, in review, approved.
5. **Publish:** approved items become visible to learners according to their unlock week and tier.
6. **Index:** only approved items are split into chunks, embedded and stored in `kb_chunks` with their content version. Retiring or changing an item removes or replaces its chunks.
7. **Version:** every edit creates a new version; saved assessment results keep the version they were taken on.

### 8.5 First controlled content (S6)

A small set of lessons chosen and approved by Didi goes into the knowledge base first. The Tutor is tested against them, including questions outside those lessons that must get the "I don't know" reply.

### 8.6 Later sources

Curriculum-aligned content, past papers and other approved study resources can be added as new `content` kinds with their own source labels, so the Tutor always says where an answer came from. Each source needs Didi's approval and must be properly licensed.

---

## Chapter 9. Monetisation

### 9.1 Offer

| Level        | Price | What it includes                                                                         |
| ------------ | ----- | ---------------------------------------------------------------------------------------- |
| Free account | R0    | Free planners in My Library, demo, and the account needed to link parents (lead capture) |
| Tier 1       | R99   | To be supplied by Didi (as on the earlier WS12 HTML landing page)                        |
| Tier 2       | R199  | To be supplied by Didi                                                                   |
| Tier 3       | R349  | To be supplied by Didi                                                                   |

- Prices are decided (`docs/decisions.md`) and are never changed by agents.
- What each tier unlocks in the app (books in EN and AF, bonus files, lessons, self-assessments, AI Tutor) is set per item through `min_tier`, so the tier contents can be filled in without code changes once Didi supplies them.
- Until the tier contents are supplied, the app treats every paid feature as "tier to be confirmed" and does not invent a mapping.

### 9.2 Payments

- PayFast and Stripe are both offered at checkout.
- Checkout starts on winstrat12.co.za (or an in-app "Upgrade" that opens the same checkout). Both call the `create-checkout` edge function (2.3), which creates the Stripe Checkout Session or the signed PayFast request on the server. No payment secret or price is ever taken from the browser.
- PayFast ITN and Stripe webhooks land in Supabase edge functions that verify the signature (and for PayFast, the source and amount), store the event once (`payment_events` for idempotency), then create the `purchases` and `entitlements` rows.
- Sandbox only until Didi approves taking real payments.
- Refunds and failed payments set the entitlement `status` to inactive; My Library updates immediately.
- An entitlement is claimed only by an account whose email Supabase Auth has verified and which matches the buyer email (`claim_entitlements()`).
- Parent purchases (proposed): a purchase by a parent applies to the parent's account and to one linked learner.

### 9.3 Bulk and partners (later)

- **School and teacher accounts with bulk licences:** a school buys a number of seats; teachers hand out class codes (Chapter 12). Pricing to be set by Didi.
- **Affiliate programme (planned):** Student Ambassadors 20 percent, Educator Partners 15 percent, Influencer Affiliates 25 percent commission. Built after version 1: referral codes on the checkout, a `referrals` table, commission calculation on confirmed (not refunded) purchases, and an affiliate dashboard. Student Ambassadors who are under 18 raise consent and payout questions (Chapter 15).

### 9.4 Marketing hooks inside the product

- From November 2026 the message targets the Class of 2027 and their parents.
- Parents (Facebook and WhatsApp): share-to-WhatsApp invite links, a clear "what your child gets" page, and real testimonials only.
- Learners (TikTok and Instagram): shareable streak and milestone cards (no personal data on them), a link back to a free account.
- Free account to paid: soft prompts at natural moments (a locked lesson, a bonus file), never blocking the daily loop.

---

## Chapter 10. Analytics and KPIs

### 10.1 Events (S5)

Stored in `analytics_events` with the user id, event name, a small set of non-personal properties and a timestamp. No free text, no message content, no names.

| Event                       | Properties                           |
| --------------------------- | ------------------------------------ |
| `user_registered`           | method (google, email), is_adult     |
| `consent_requested`         | channel (email, sms)                 |
| `consent_given`             |                                      |
| `onboarding_step_completed` | step                                 |
| `onboarding_completed`      |                                      |
| `task_created`              | source                               |
| `task_completed`            | subject_id                           |
| `study_session_started`     | subject_id                           |
| `study_session_completed`   | subject_id, minutes                  |
| `goal_created`              | type                                 |
| `goal_completed`            | type                                 |
| `lesson_opened`             | mls_number                           |
| `lesson_completed`          | mls_number                           |
| `assessment_started`        | questionnaire_id                     |
| `assessment_completed`      | questionnaire_id, is_retake          |
| `ai_tutor_opened`           |                                      |
| `ai_question_asked`         | had_source (bool)                    |
| `strategy_viewed`           | content_id                           |
| `tip_viewed`                | tip_id                               |
| `streak_extended`           | length                               |
| `next_win_shown`            | rule_code                            |
| `next_win_acted`            | rule_code                            |
| `parent_link_created`       | initiated_by                         |
| `library_download`          | file_id                              |
| `purchase_completed`        | tier, provider (written server-side) |

### 10.2 Questions the analytics must answer

From the brief: how many learners are active, how often they study, which subjects need help, where learners drop off, which strategies produce engagement.

### 10.3 KPIs

Targets are not set yet. They are agreed with Didi after the first weeks of real use, so the numbers are based on real baselines and not guesses.

| KPI                           | Definition                                                          |
| ----------------------------- | ------------------------------------------------------------------- |
| Weekly active learners        | Learners with at least one `study_activity` row in the week         |
| Study days per active learner | Average days with activity per week                                 |
| Weekly lesson completion      | Share of active learners who completed this week's lesson           |
| Onboarding completion         | `onboarding_completed` divided by `user_registered`                 |
| Consent completion            | `consent_given` divided by `consent_requested`                      |
| Retention                     | Learners active in week 1 who are still active in week 4 and week 8 |
| Streak health                 | Share of active learners on a streak of 3 days or more              |
| Next Win acceptance           | `next_win_acted` divided by `next_win_shown`, per rule              |
| Tutor "no source" rate        | Share of Tutor questions without approved content, to plan content  |
| Parent link rate              | Learners with at least one active parent link                       |
| Free to paid conversion       | Free accounts that make a purchase                                  |
| Drop-off points               | Onboarding step, lesson number or screen where learners stop        |

### 10.4 Privacy

- No third-party tracking scripts in the learner app in version 1 (proposed). Analytics stay in our own database.
- Aggregates shown to schools or in reports hide groups smaller than a minimum size (proposed: 5) so no single learner can be identified.

---

## Chapter 11. Admin dashboard

### 11.1 Access

- Route `/admin`, loaded as its own code chunk, visible only to users with the admin role. Every admin action is enforced by RLS and `is_admin()` on the server, not only hidden in the UI.
- Every change is written to `audit_log`.
- **Admin home:** counts of items waiting (content to review, school names to check, webhook failures, flagged Tutor messages). **Next action:** open the oldest item waiting for review.

### 11.2 Functions

From the brief, plus WS12 needs:

| Area                   | What admins can do                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Learners               | Search by email, see account status, consent status and entitlements; help with support. Cannot read reflections, chats or self-assessment answers |
| Subjects               | Add and edit subjects (EN and AF names)                                                                                                            |
| Strategies and content | Content queue: draft, in review, approved, retired; preview in EN and AF; set MLS number, week and minimum tier                                    |
| Questionnaires         | Load the five questionnaires, items, scoring and bands from the book; version them                                                                 |
| Tips                   | Add, schedule and approve tips                                                                                                                     |
| Exam dates             | Set trial and final dates per year, mark provisional or confirmed                                                                                  |
| Notifications          | Send important announcements (sending to real users needs Didi's approval)                                                                         |
| Library                | Upload files to private storage, set language and minimum tier                                                                                     |
| Purchases              | View purchases and entitlements; grant a manual entitlement for support                                                                            |
| Learner analytics      | Aggregated KPIs from Chapter 10                                                                                                                    |
| Platform health        | Error counts, edge function failures, webhook failures, AI gateway usage and cost                                                                  |

### 11.3 Not allowed

- Deleting learner data without Didi's approval.
- Changing prices (Didi only).
- Publishing content as Melvin's without Didi's approval.

---

## Chapter 12. School portal (later)

Built after version 1. The schema reserves `classes`, `class_members` and `licences`.

- **School account:** a school record with a bulk licence (number of seats, year, expiry).
- **Teacher account:** a teacher role linked to a school. Creates classes and shares a class code.
- **Learner joins a class:** enters the class code in Settings. The learner sees what the teacher will see before joining. For under-18 learners the parental consent already given covers WS12; the school's own consent processes may also apply for school use (Chapter 15, question 25).
- **Teacher view:** class lesson completion by week, active learners, and anonymised subject needs. Individual learner data only at summary level (as for parents), never reflections, chats or answers.
- **Teaching support:** the week's lesson for class use in both languages. The AI never replaces the teacher; a future Teacher Support Agent only helps prepare.
- **Admin:** licence management and school onboarding in the admin dashboard.

---

## Chapter 13. Parent portal

### 13.1 Parent account

- A parent signs up on the website or in the app with "I'm a parent". Same Supabase login as everyone else, with the parent role.
- Parents can buy for their child, invite their child, accept a learner's request, and give or withdraw parental consent.

### 13.2 Parent home (proposed for S5)

- **Purpose:** peace of mind in one glance.
- **Shows:** each linked child as a card with first name, days to trials or finals, this week's lesson done or not, study days this week (Monday to Sunday dots), study minutes, tasks done, current streak, and whether a self-assessment was completed (results only if the child shared them). One suggestion "How you can help this week", from approved copy.
- **Also:** My Library, Family (invite, pending, remove), consent management, Settings, Help.
- **Empty:** "Invite your child to get started." with "INVITE MY CHILD".
- **Next action:** Invite my child, or open the latest weekly update.

### 13.3 Weekly progress update

- Generated every Sunday from the `parent_learner_summary` (S5).
- Content: the same summary as Parent home, in the parent's language, short enough to read in a WhatsApp preview.
- Channel: email first; WhatsApp to be decided by Didi (WhatsApp Business messaging has its own approval and cost).
- Sending real updates to real parents needs Didi's approval before go-live. Until then the summary is visible in Parent home only.
- Parents can turn the update off. Learners can see that it is being sent.

### 13.4 What parents never see

Private reflections, AI Tutor chats, self-assessment answers (and results unless shared), exact times of activity, location.

---

## Chapter 14. Future app store strategy

### 14.1 Path

React and TypeScript web app, then an installable PWA (S7), then native iOS and Android with Expo (React Native) after version 1.

### 14.2 How version 1 keeps that path open

- Business logic in `src/domain/` is plain TypeScript with no browser or React dependencies, so Expo can reuse it.
- Data access in `src/data/` uses `supabase-js`, which also runs in React Native.
- i18n strings in plain JSON, reusable on native.
- No desktop-only assumptions: every feature works on a 360px touch screen first.
- Sign-in providers kept in one list so Apple sign-in can be added (Apple's rules may require it when Google sign-in is offered in an iOS app; check at submission time).
- Push notifications designed around a `notifications` table plus a delivery adapter (web push now, native push later).

### 14.3 Store considerations (to check before any submission)

- **Digital purchases:** Apple and Google have their own rules for selling digital content inside apps, which can differ from PayFast and Stripe on the web. The store strategy for payments must be checked against the current store rules before building native checkout (Chapter 15).
- **Young users:** store age ratings, privacy labels and family or child policies apply because many learners are under 18.
- **Listings:** in English and Afrikaans, with real screenshots and real testimonials only.
- **Accounts:** stores require in-app account deletion, which Settings already provides.
- Going live in any store needs Didi's approval.

---

## Chapter 15. Open questions for Didi

Each item is also tracked in "Needs from Didi" in `SPRINTS.md` where it blocks a sprint. Until answered, agents build what is clear and use the stated default.

### Content and IP

1. **Book manuscript:** the full text of MLS 1 to 52 in English and Afrikaans in an editable format, with lesson numbers and order. Needed before lessons can be loaded (S4) and before the Tutor's first content (S6).
2. **Core IP content:** the DCA formula, the DNA of a Successful Matriculant, the Pencil story and Force Field Analysis as they appear in the book, and which lessons they belong to.
3. **The five profiling questionnaires:** names, items, answer scales, scoring rules, result bands and their meanings, in both languages.
4. **Content approval:** who signs off each item: Didi alone, or Didi and Melvin? Default: Didi approves; nothing is published as Melvin's without Didi.
5. **Claims to confirm with Melvin** (already open in `docs/decisions.md`): "more than 30 years" experience and "20-year-old intellectual property". Until confirmed, the app does not use either claim.
6. **Foreword:** may the app show Gerald Williamson's name and title (Clinical Psychologist and Educationist) on the About or book pages?

### Product and UX

7. **Lesson unlock rule:** calendar-aligned (default proposed: catch up to the current school week on sign-up, then one per Monday) or personal (one per 7 days from sign-up)?
8. **Pre-season:** what do Class of 2027 learners see between November 2026 and the start of the school year? Default proposed: a preview of MLS 1 and the countdown.
9. **Journey placement:** keep the five bottom tabs from the brief and reach the Journey from the Dashboard (default), or replace a tab with "Journey"?
10. **Sprint scope:** approve adding boxes to `SPRINTS.md` for the This week's lesson card (S3), Lesson Journey and Lesson screens (S4), Self-assessments (S5), Parent home (S5), Settings, Help and Logout (S2), the Exam calendar, Strategy Library and Achievements screens (S3), Push notifications and offline task sync (S7) and the Admin dashboard (S5 to S7). These are in this Bible but not yet in `SPRINTS.md`.
11. **Reference image:** the dashboard visual reference is still missing. Until it arrives, the September prototype palette is used. Confirm the mint and cream colour values.
12. **Header:** confirm the avatar menu with no hamburger (current default).
13. **Grade 11 sign-ups:** allow Grade 11 learners (Class of 2027 signing up in late 2026) with the full experience?

### Privacy and safety

14. **Parental consent flow:** approve the proposed POPIA flow (age question, consent link to parent, limited mode until consent), including the website path: the website asks the age question and sends under-18s to the app's Register screen without storing their email (2.3). A legal review is recommended before go-live.
15. **Support lines:** supply verified South African helplines for the Help screen and the Tutor's distress response.
16. **Retention:** approve AI chat retention (proposed 90 days) and analytics retention (proposed 24 months).

### Business

17. **Tier contents** for R99, R199 and R349 (already open).
18. **Parent purchases:** does a parent's purchase cover one linked child, all linked children, or only the parent's own account? Default proposed: one linked child.
19. **Parent weekly update channel:** email only, or WhatsApp as well? Sending needs your approval before go-live.
20. **AI Tutor:** which model provider, monthly budget, and daily message limit per learner?
21. **Affiliates:** Student Ambassadors are likely to be under 18. How should consent and commission payouts work for minors?
22. **School licences:** pricing and seat model for bulk licences (later).
23. **App stores:** when native apps come, how to handle digital purchases under store rules (later).
24. **SMS for consent requests:** sending consent links by SMS needs an SMS provider and has a cost per message. Which provider, or email only for v1? Default: email only until you decide.
25. **School consent:** when a learner joins a school class (Chapter 12), is WS12's parental consent enough, or does the school's own consent process also apply? A legal review is recommended before the School Portal is built.

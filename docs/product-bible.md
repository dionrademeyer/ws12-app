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
- **Next action:** Create account, then onboarding (or Consent if under 18).

### 3.3 Parental consent (S2)

- **Purpose:** POPIA requires consent from a parent or guardian before we process a child's personal information beyond what is needed to ask for that consent.
- **Shows (learner under 18):** "Before we start, a parent or guardian needs to say yes." Two options: "My parent already has a WS12 account" (enter their invite code) or "Send my parent a link" (parent's email or cell number). Explains in one sentence what the parent will see (a weekly summary, not private chats or answers).
- **Until consent is given (proposed):** the learner can complete onboarding and use the demo-style experience on the device, but nothing beyond the account email, age answer and parent contact is saved to the server, and the AI Tutor is off. When the parent consents, onboarding answers are saved.
- **Parent side:** a consent page that says who is asking, what is collected, why, and how to withdraw. Buttons "I give consent" and "This is not my child".
- **States:** "Waiting for your parent" with "Resend" and "Change contact". Sending real messages to real parents needs Didi's approval before go-live.
- **Next action:** Send my parent a link.

### 3.4 Onboarding, 5 steps (S2)

- **Purpose:** collect only what the app needs to plan for the learner, without overwhelming them. Every step shows "STEP n OF 5" and a progress bar, has Back, and can be finished later from Profile.
- **Step 1, About you:** first name, grade (12 preselected; 11 allowed for early sign-ups), school (search list, or "My school isn't listed"), province.
- **Step 2, Subjects and targets:** choose subjects (Life Orientation and a home language suggested), target mark per subject (slider, optional).
- **Step 3, Exam dates:** trial and final exam dates, prefilled from the WS12 exam calendar for the learner's year with the note "Provisional until the official timetable is published". The learner can adjust them.
- **Step 4, Study time:** study availability (which days) and preferred study times (morning, afternoon, evening, late).
- **Step 5, Goals and interests:** one academic goal (suggested goals from targets) and career interests (optional chips). Ends with "Start my journey".
- **Not asked:** surname, ID number, address, phone, gender, race, home language beyond the app language choice. Surname is optional later in Profile only if needed for certificates.
- **States:** answers are saved per step, so closing the app does not lose progress. Skipped optional fields lead to friendly empty states later.
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

### 3.6 Exam calendar (S3)

- **Purpose:** see all upcoming exam dates.
- **Shows:** list of the learner's exams (trials and finals, per subject when the timetable is loaded), with days to go. Dates marked "Provisional" until confirmed by an admin. "Edit my dates" for learner overrides.
- **Empty:** "Set your exam date" with a button.
- **Next action:** View exam preparation plan (opens the Planner filtered to the next exam).

### 3.7 Goals (S4)

- **Purpose:** turn ambitions into tracked targets.
- **Shows:** goal cards grouped by type (academic, subject, study, exam, personal development). Each card: title (for example "Improve Mathematics from 55% to 70%"), current, target, progress percentage, deadline, and an action button ("Continue practice"). Floating "New goal" button.
- **Create or edit goal:** type, subject (if relevant), title, current value, target value, deadline. Validation stops impossible values (target below current for "improve" goals is allowed only with a warning).
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
- **Shows:** overall progress at the top; subject bars (for example "Mathematics 72%") where the percentage comes from the learner's own logged marks and completed work; study hours this week; tasks completed; current and longest streak; weekly and monthly activity charts; goal completion; Lesson Journey progress ("14 of 52 lessons"); latest self-assessment dates. Each block has an action ("Physics needs attention" with "Practice Physics").
- **Charts:** simple bar charts from real state, lazy-loaded, with a text summary for screen readers.
- **Empty:** "Your progress shows up after your first study session." with "START STUDYING".
- **Next action:** the action on the weakest subject.

### 3.10 AI Tutor (S6)

- **Purpose:** a supportive study assistant that answers from approved WS12 content.
- **Shows:** greeting with the learner's first name ("Hi Thabo, what are we working on today?"), suggested actions: Explain a concept, Help me study, Give me a quiz, Explain my mistake, Create a study plan. Chat thread, input box, and a small line: "WS12 Tutor uses the WS12 book. Check with your teacher if you're unsure." Answers that use book content show their source ("From MLS 14").
- **When content does not cover a question:** "I don't have WS12 content on that yet. Your teacher is the best person to ask." It never invents lessons, quotes or statistics.
- **States:** typing indicator, timeout with retry, daily usage limit message (proposed, to control cost), offline: "The Tutor needs a connection."
- **Locked for under-18 learners until parental consent** is given.
- **Next action:** tap a suggested action.

### 3.11 Lesson Journey (S3 card, full screen proposed for S4 or S5)

- **Purpose:** the 52-week journey through the book, one lesson a week. A key differentiator.
- **Shows:** a vertical path of 52 lessons (MLS 1 to 52) grouped by school term. Each item: number, title in the learner's language, state (done, unlocked, locked with unlock date). Progress "14 of 52" and the countdown to trials and finals at the top. Locked lessons show "Unlocks on Monday 12 April" style text and cannot be opened.
- **Unlock rule (proposed):** lessons follow the Grade 12 calendar. On sign-up, all lessons up to the current week are unlocked so late joiners can catch up; then one new lesson unlocks every Monday. Learners who sign up before the school year (Class of 2027 from November 2026) see a pre-season view with MLS 1 as a preview (Chapter 15).
- **Empty or pre-season:** "Your journey starts in January. Here's a taste of week 1." with "READ THE PREVIEW".
- **Next action:** Read this week's lesson (or the oldest unread unlocked lesson).

### 3.12 Lesson (S4 or S5, proposed)

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

### 3.14 Strategy Library (S3)

- **Purpose:** browse WS12 strategies and tips beyond Tip of the Day.
- **Shows:** search, filters (topic, lesson), tip cards, links into the Lesson Journey and Self-assessments. Content comes from the content and tips tables; only approved items appear.
- **Empty:** "New strategies are on the way." (only if no approved content exists).
- **Next action:** open a strategy, then "Add to today's plan".

### 3.15 Notifications centre (S3)

- **Purpose:** one place for reminders and announcements.
- **Shows:** list grouped by Today and Earlier. Types: study reminder, goal reminder, streak reminder, new strategy, exam countdown, achievement, important announcement, plus "new lesson unlocked" and parent link requests. Unread items are bold; opening marks read; "Mark all as read". Each notification links to its action.
- **Limits:** at most one reminder push per day by default; quiet hours from 21:30 to 06:00 (proposed); every type can be turned off in Settings. No guilt-based copy.
- **Empty:** "You're all caught up."
- **Next action:** tap the newest unread notification.

### 3.16 Profile (S2)

- **Purpose:** see and edit learner information.
- **Shows:** name, school, grade, subjects, target marks, current streak, goals summary, achievements, exam dates, linked parents, and "Edit". "Settings" link.
- **Next action:** Edit profile (or "Add your exam date" if missing).

### 3.17 My Library (S2)

- **Purpose:** re-download purchased books in both languages and bonus files by tier.
- **Shows:** "My books" with English and Afrikaans editions the person owns, each with file size and "Download"; "Bonus files" for their tier; free planners for every free account. Locked items show which tier includes them and "Upgrade".
- **How it works:** files sit in private Supabase storage. Tapping Download calls an edge function that checks the entitlement and returns a short-lived signed link.
- **Empty (free account):** "Your free planners are ready." with "DOWNLOAD PLANNER" and a soft "See the full book" link.
- **Next action:** Download.

### 3.18 Family (parent linking) (S2)

- **Purpose:** link learner and parent accounts both ways.
- **Learner view:** linked parents, "Add a parent" (send link by email or cell number, or enter the parent's invite code), "Remove". Plain-language list of what parents can see.
- **Parent view:** linked children, "Invite my child" (shows an invite code and share link for WhatsApp), pending invites, "Remove".
- **Rules:** a link becomes active only when both sides have accepted. Either side can remove it at any time.
- **Next action:** Add a parent (learner) or Invite my child (parent).

### 3.19 Settings (S2)

- **Shows:** language, notification types and quiet hours, study reminder time, data saver, exam dates, privacy (download my data, delete my account request, parent links), Log out.
- **Next action:** none required; "Done" returns to the previous screen.

### 3.20 Help (S2)

- **Shows:** short FAQs (account, payments, My Library, parent linking, privacy), "Contact support" (email link), and a "Need someone to talk to?" section with verified South African support lines (to be supplied and checked by Didi).
- **Next action:** Contact support.

### 3.21 Logout

- From the avatar menu or Settings. Confirms "Log out of WS12?", clears the session on the device, returns to Welcome. Queued offline changes are synced first, or the learner is warned if they cannot be.

### 3.22 Achievements (S3, inside Profile)

- **Shows:** earned milestones (streaks at 3, 5, 7, 14, 30, 60, 100 days; first goal; lessons completed; first self-assessment) and the next one to earn. Celebrations are short and skippable. No rewards that look like gambling.
- **Next action:** the action that earns the next achievement.

### 3.23 Demo mode (S1)

- Seed learner Thabo Mokoena, Grade 12, subjects Mathematics, Physical Sciences, English Home Language, Life Orientation. A fixed "Demo data" banner on every screen, and nothing is written to real learner tables. "Create my own account" is always visible.

---

## Chapter 4. Feature priorities

**Must** = needed for the first public release. **Should** = in version 1 if time allows. **Later** = after version 1. Sprints refer to `SPRINTS.md`. Items marked "proposed sprint" are not yet boxes in `SPRINTS.md` and need Didi's approval to add (Chapter 15).

| Feature                                                        | Priority | Sprint                  |
| -------------------------------------------------------------- | -------- | ----------------------- |
| Project foundation, folder structure, CI                       | Must     | S1                      |
| Full schema with RLS on every table                            | Must     | S1                      |
| App shell: bottom nav, sidebar, avatar menu (no hamburger)     | Must     | S1                      |
| English and Afrikaans i18n layer                               | Must     | S1                      |
| Demo mode (Thabo Mokoena)                                      | Must     | S1                      |
| Welcome, Google sign-in, email sign-in, shared website login   | Must     | S2                      |
| Parental consent for under-18 learners                         | Must     | S2                      |
| 5-step onboarding                                              | Must     | S2                      |
| Profile view and edit                                          | Must     | S2                      |
| My Library (books EN and AF, bonus files by tier, free planners) | Must   | S2                      |
| PayFast ITN and Stripe webhooks (sandbox)                      | Must     | S2                      |
| Parent linking both ways                                       | Must     | S2                      |
| Settings, Help, Logout                                         | Must     | S2                      |
| Real exam countdown (trials and finals)                        | Must     | S3                      |
| Today's Study Plan with saving tasks                           | Must     | S3                      |
| Streak card and milestones                                     | Must     | S3                      |
| Tip of the Day and Strategy Library                            | Must     | S3                      |
| Your Next Win (rule-based)                                     | Must     | S3                      |
| Notifications centre with unread badge                         | Must     | S3                      |
| This week's lesson card on the Dashboard                       | Must     | S3 (proposed sprint)    |
| Lesson Journey screen and Lesson screen (52 weeks)             | Must     | S4 (proposed sprint)    |
| Goals                                                          | Must     | S4                      |
| Planner (today, week, month)                                   | Must     | S4                      |
| Streak engine hardened                                         | Must     | S4                      |
| Self-assessments with saved results and retakes                | Must     | S5 (proposed sprint)    |
| Progress screen with real charts                               | Must     | S5                      |
| Recommendation engine v2                                       | Must     | S5                      |
| Analytics events                                               | Must     | S5                      |
| Parent weekly summary data (sending needs Didi's approval)     | Must     | S5                      |
| Parent home screen (Chapter 13)                                | Must     | S5 (proposed sprint)    |
| AI Tutor with retrieval from approved content                  | Must     | S6                      |
| First approved lessons in the knowledge base                   | Must     | S6                      |
| PWA install and offline shell                                  | Must     | S7                      |
| Performance, security, accessibility, privacy pages            | Must     | S7                      |
| Staging deployment (production only with Didi's approval)      | Must     | S7                      |
| Admin dashboard: content approval, tips, exam dates, support   | Should   | S5 to S7 (proposed)     |
| Achievements screen                                            | Should   | S3                      |
| Push notifications                                             | Should   | S7                      |
| Offline task ticks with sync                                   | Should   | S7                      |
| Shared session cookie across website and app                   | Later    | After v1                |
| Apple sign-in                                                  | Later    | After v1                |
| AI Study Planner Agent generating sessions                     | Later    | After v1                |
| Other AI agents (Motivation, Exam Preparation, Parent Support) | Later    | After v1                |
| School Portal, teacher accounts, bulk licences                 | Later    | After v1                |
| Affiliate programme tracking and payouts                       | Later    | After v1                |
| Curriculum content and past papers in the knowledge base       | Later    | After v1                |
| Native apps (Expo) and app store release                       | Later    | After v1                |

---

## Chapter 5. User journeys

### 5.1 Learner signs up (learner first)

1. Thabo sees a WS12 TikTok and taps the link to winstrat12.co.za, or opens app.winstrat12.co.za directly.
2. On the website he creates a free account (lead capture) and gets the free planners, or taps "Open the app".
3. In the app: Welcome, choose language, "Continue with Google".
4. Answers "Are you 18 or older?" No.
5. Consent screen: "Send my parent a link". Enters his mother's cell number or email. The parent receives a consent link (real sending needs Didi's approval before go-live).
6. Completes the 5-step onboarding while waiting. Answers stay on the device.
7. Parent taps the link, signs up or signs in as a parent, gives consent. The link between them is created at the same time.
8. Thabo's onboarding answers are saved, the AI Tutor unlocks, and he lands on the Dashboard with a first-time welcome and Your Next Win: "Read this week's lesson".

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
2. Either enters the parent's invite code (if the parent already has an account) or sends a link by email or cell number.
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

| Table                      | Key columns                                                                                         | Notes |
| -------------------------- | --------------------------------------------------------------------------------------------------- | ----- |
| `auth.users`               | Managed by Supabase Auth                                                                            | The "users" table from the brief. Shared by website and app |
| `profiles`                 | `id` (= auth user id), `first_name`, `grade`, `school_id`, `province`, `language` (en, af), `is_adult` (bool), `onboarding_step`, `onboarded_at`, `is_demo` | One per person. No ID number, no address |
| `user_roles`               | `user_id`, `role` (learner, parent, teacher, admin)                                                | Admin-managed only |
| `parental_consents`        | `id`, `learner_id`, `parent_user_id`, `contact_hash`, `status` (pending, given, withdrawn), `given_at`, `withdrawn_at`, `policy_version` | Proof of POPIA consent |
| `parent_links`             | `id`, `learner_id`, `parent_id`, `status` (pending, active, removed), `initiated_by`, `created_at` | Both directions use this one table |
| `invites`                  | `id`, `code` (short, random), `created_by`, `kind` (parent_to_learner, learner_to_parent), `expires_at`, `used_at` | Codes expire; single use |
| `schools`                  | `id`, `name`, `province`, `emis_number` (optional)                                                 | Public list; admin-managed |
| `notification_preferences` | `user_id`, per-type toggles, `quiet_start`, `quiet_end`, `reminder_time`                          | |

**Study**

| Table              | Key columns                                                                                       | Notes |
| ------------------ | ------------------------------------------------------------------------------------------------- | ----- |
| `subjects`         | `id`, `code`, `name_en`, `name_af`                                                                | Reference list |
| `learner_subjects` | `learner_id`, `subject_id`, `target_mark`, `current_mark`                                        | Current mark is entered by the learner |
| `subject_marks`    | `id`, `learner_id`, `subject_id`, `mark`, `kind` (test, assignment, practice, trial), `recorded_on` | History for progress and Next Win |
| `exam_dates`       | `id`, `year`, `kind` (trial, final), `subject_id` (nullable), `starts_on`, `status` (provisional, confirmed), `source_note` | Admin-managed calendar |
| `learner_exam_dates` | `learner_id`, `kind`, `starts_on`                                                               | Learner overrides |
| `goals`            | `id`, `learner_id`, `type` (academic, subject, study, exam, personal), `subject_id`, `title`, `current_value`, `target_value`, `deadline`, `status` | |
| `study_sessions`   | `id`, `learner_id`, `subject_id`, `activity`, `starts_at`, `duration_minutes`, `notes`, `status`, `source` (learner, template, ai) | Planner items |
| `study_tasks`      | `id`, `learner_id`, `session_id` (nullable), `lesson_id` (nullable), `subject_id`, `title`, `due_on`, `start_time`, `end_time`, `completed_at` | Today's Study Plan |
| `study_activity`   | `id`, `learner_id`, `activity_on` (date), `kind` (task, session, lesson, assessment), `minutes`, `ref_id` | Source of truth for streaks and hours |
| `streaks`          | `learner_id`, `current_length`, `longest_length`, `last_active_on`, `updated_at`                  | Derived from `study_activity` by a database function, never written by the client |
| `achievements`     | `id`, `code`, `name_en`, `name_af`, `rule`                                                        | Reference list (milestones 3, 5, 7, 14, 30, 60, 100) |
| `learner_achievements` | `learner_id`, `achievement_id`, `earned_at`                                                  | Written by a database function |
| `notifications`    | `id`, `user_id`, `type`, `title_key`, `params`, `link`, `read_at`, `created_at`                   | Text comes from i18n keys |
| `recommendations`  | `id`, `learner_id`, `rule_code`, `reason_key`, `action_link`, `shown_at`, `acted_at`             | Your Next Win log, for tuning |

**Content (Melvin's book and WS12 material)**

| Table                  | Key columns                                                                                     | Notes |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ----- |
| `content`              | `id`, `kind` (chapter, strategy, topic, lesson, activity, framework, story, quiz), `parent_id`, `slug`, `title_en`, `title_af`, `body_en`, `body_af`, `status` (draft, in_review, approved, retired), `version`, `approved_by`, `approved_at`, `source_ref` | The brief's "content" table. Tree via `parent_id` |
| `lessons`              | `content_id`, `mls_number` (1 to 52), `week_number`, `reading_minutes`, `min_tier`             | Weekly lesson metadata |
| `lesson_progress`      | `learner_id`, `lesson_id`, `opened_at`, `completed_at`, `reflection` (private text)             | |
| `tips`                 | `id`, `text_en`, `text_af`, `content_id` (nullable), `status`, `starts_on`                     | Tip of the Day |
| `questionnaires`       | `id`, `slug`, `title_en`, `title_af`, `intro_en`, `intro_af`, `scoring_rule`, `status`, `version` | The five profiling questionnaires |
| `questionnaire_items`  | `id`, `questionnaire_id`, `position`, `prompt_en`, `prompt_af`, `options` (json), `scale`      | |
| `questionnaire_results_bands` | `questionnaire_id`, `band`, `min_score`, `max_score`, `label_en`, `label_af`, `meaning_en`, `meaning_af`, `next_step_content_id` | From the book only |
| `assessment_attempts`  | `id`, `learner_id`, `questionnaire_id`, `questionnaire_version`, `started_at`, `completed_at`, `score`, `band`, `shared_with_parent` (bool) | Saved results; retakes add new rows |
| `assessment_answers`   | `attempt_id`, `item_id`, `answer`                                                                | Private |

**Commerce and library**

| Table           | Key columns                                                                                   | Notes |
| --------------- | --------------------------------------------------------------------------------------------- | ----- |
| `products`      | `id`, `code`, `tier` (free, r99, r199, r349), `price_cents`, `active`                         | Prices are set by Didi only |
| `library_files` | `id`, `title_en`, `title_af`, `language`, `storage_path`, `min_tier`, `kind` (book, bonus, planner), `size_bytes` | Files in a private bucket |
| `purchases`     | `id`, `buyer_email`, `buyer_user_id`, `product_id`, `provider` (payfast, stripe), `provider_ref`, `amount_cents`, `status`, `raw_event_id` | Written only by webhook functions |
| `entitlements`  | `id`, `user_id` (nullable until claimed), `email`, `tier`, `source_purchase_id`, `granted_for_learner_id` (nullable) | What a person may access |
| `payment_events`| `id`, `provider`, `event_id` (unique), `received_at`, `payload_hash`                          | Idempotency for webhooks |

**AI and analytics**

| Table               | Key columns                                                                                  | Notes |
| ------------------- | -------------------------------------------------------------------------------------------- | ----- |
| `kb_chunks`         | `id`, `content_id`, `content_version`, `language`, `text`, `embedding` (pgvector)           | Only from approved content |
| `ai_conversations`  | `id`, `learner_id`, `agent` (tutor), `started_at`                                           | |
| `ai_messages`       | `id`, `conversation_id`, `role`, `text`, `source_chunk_ids`, `flagged`, `created_at`        | Retention limit (Chapter 7) |
| `analytics_events`  | `id`, `user_id`, `event`, `props` (json, no free text), `created_at`                         | Chapter 10 |
| `audit_log`         | `id`, `actor_id`, `action`, `target`, `created_at`                                           | Admin actions |

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
5. **Reference and content tables** (`subjects`, `schools`, `achievements`, `exam_dates`, `tips`, approved `content`, `lessons`, `questionnaires`) are readable by signed-in users only where `status = 'approved'`, and lesson bodies also check the unlock rule and `min_tier` through a function.
6. **Server-written tables** (`purchases`, `entitlements`, `payment_events`, `streaks`, `learner_achievements`) have no client write policies. They are written by edge functions using the service role, or by `security definer` database functions.
7. **Storage:** buckets are private. Downloads go through an edge function that checks entitlements and returns a signed URL valid for a few minutes.
8. **Demo data** is flagged `is_demo` and isolated from real learner data.
9. **Tests (S1 and S2):** automated RLS tests prove that learner A cannot read or write learner B's rows, a parent cannot read an unlinked learner, a parent cannot read reflections or answers, and a non-admin cannot write content.

### 6.4 Privacy and retention (POPIA)

- Collect only what each feature needs (Chapter 3.4 lists what onboarding does not ask).
- Parental consent recorded before processing a minor's data beyond the consent request.
- "Download my data" and "Delete my account" in Settings. Deletion removes learner rows and anonymises analytics events.
- Proposed retention: AI chat messages 90 days, analytics events 24 months, payment records as required by law. To be confirmed by Didi (Chapter 15).

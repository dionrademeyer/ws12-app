You are the Lead Product Engineer, UX Engineer, Full-Stack Developer and AI Systems Architect for a new education platform called:

WINNING STRATEGIES FOR GRADE 12
Abbreviation: WS12

Your task is to build a fully functional, mobile-first student dashboard based on the attached visual reference.

IMPORTANT:
The attached image is a visual design reference, NOT merely a screenshot to copy.

Use it as the visual foundation while improving the UX, responsiveness, functionality and information architecture.

The ultimate goal is to create a production-ready foundation for a Grade 12 education platform that can eventually support one million learners.

==================================================
1. COMPANY CONTEXT
==================================================

Winning Strategies for Grade 12 is an education platform based on the book "Winning Strategies for Grade 12", written by Melvin Monroe Tobias.

Melvin Monroe Tobias is the author and educational expert behind the book. He has more than 30 years of experience as a teacher and principal and currently works directly with schools and learners as a motivational speaker.

Didi is the digital/product/creative partner responsible for transforming the original book into a modern digital education experience.

The AI systems in this platform are assistants to human educators and company leadership.

AI must NEVER be presented as replacing teachers, mentors, parents or human leadership.

The core mission is:

"Help one million Grade 12 learners succeed."

The product should feel:
- Premium
- Modern
- Motivational
- Intelligent
- Youth-friendly
- Trustworthy
- Simple
- Fast
- Mobile-first

==================================================
2. PRIMARY PRODUCT PHILOSOPHY
==================================================

The app must answer one question every time a learner opens it:

"What should I do next to improve my chances of succeeding in Grade 12?"

The dashboard must therefore be ACTIONABLE.

Do not simply display statistics.

Every important metric should lead to an action.

For example:

"Maths: 62%"
→ "Continue Maths Practice"

"3-day streak"
→ "Complete today's study session"

"30 days until exams"
→ "View Exam Preparation Plan"

"Physics needs attention"
→ "Practice Physics"

The dashboard should guide the learner rather than overwhelm them.

==================================================
3. TECHNOLOGY
==================================================

Build this as a modern responsive web application that can later be converted into a native mobile application.

Preferred stack:

Frontend:
- React
- TypeScript
- Tailwind CSS
- Modern component architecture

Backend:
- Supabase

Use Supabase for:
- Authentication
- PostgreSQL database
- User profiles
- Learner progress
- Study sessions
- Goals
- Tasks
- Streaks
- Notifications
- Content
- AI interactions

Authentication:
- Google Sign-In
- Email authentication

Design the architecture so that Apple Sign-In can be added later.

Use clean separation between:
- UI
- business logic
- database
- AI services
- authentication

Do NOT hard-code learner data into the interface.

Use realistic seed/demo data for development.

==================================================
4. RESPONSIVE DESIGN
==================================================

Mobile-first is mandatory.

The majority of learners will access WS12 through smartphones.

The interface must work beautifully on:

- Mobile phones
- Tablets
- Laptops
- Desktop screens

The mobile experience is the priority.

The attached reference image represents the primary mobile experience.

==================================================
5. BRAND / VISUAL DIRECTION
==================================================

Use the attached reference image as the visual direction.

Visual characteristics:

- Deep navy header
- White content areas
- Blue/purple gradients
- Bright yellow/gold accent
- Rounded cards
- Soft shadows
- Premium modern UI
- Large readable typography
- Strong visual hierarchy
- Friendly icons
- Generous spacing

The design should feel like:

"Netflix meets Duolingo meets a premium education platform."

Avoid making it childish.

This is Grade 12.

The learner should feel:

"I'm preparing for my future."

Use subtle motivational elements rather than excessive gamification.

==================================================
6. APPLICATION STRUCTURE
==================================================

Create the following primary navigation:

BOTTOM NAVIGATION ON MOBILE:

1. Dashboard
2. Goals
3. Planner
4. Progress
5. AI Tutor

Desktop should use an appropriate sidebar navigation.

Additional navigation:

- Profile
- Notifications
- Settings
- Help
- Logout

==================================================
7. DASHBOARD
==================================================

The Dashboard is the learner's home.

Structure it in this order:

----------------------------------------
HEADER
----------------------------------------

Left:
Hamburger/menu icon

Centre:
WS12
WINNING STRATEGIES
FOR GRADE 12

Right:
Notifications icon
Profile avatar

The notification icon must show an unread badge when appropriate.

Clicking the profile should open the learner profile.

Clicking notifications opens the notification centre.

----------------------------------------
EXAM COUNTDOWN
----------------------------------------

Large premium hero card.

Example:

EXAMS

30 DAYS
TO GO!

"You've got this! Stay focused, stay consistent, and make it count."

The countdown must be REAL.

Do NOT hard-code "30 days".

The learner's exam date must come from their profile/settings or configured academic calendar.

Calculate the number of days automatically.

Include:

- Days remaining
- Exam date
- View exam calendar

If the learner has not entered an exam date, show:

"Set your exam date"

with a button.

----------------------------------------
TODAY'S STUDY PLAN
----------------------------------------

Create a card titled:

TODAY'S STUDY PLAN

Each task contains:

Subject
Activity
Time
Completion checkbox
Status

Example:

Mathematics
Calculus Exercises
09:00 – 10:30
[✓]

Physical Sciences
Past Paper
11:00 – 12:30
[✓]

English Home Language
Essay
14:00 – 15:00
[ ]

Life Orientation
Mindset Boost
16:00 – 16:30
[ ]

The tasks must be interactive.

When a learner checks a task:

- Mark it complete in the database
- Update progress
- Update streak
- Update dashboard
- Trigger appropriate achievement/motivation feedback

"View All" opens the complete planner.

----------------------------------------
STREAK
----------------------------------------

Create a visually attractive study streak card.

Example:

🔥
5-DAY STREAK!

"You're on fire! Keep it up!"

Display:

Monday
Tuesday
Wednesday
Thursday
Friday
Saturday
Sunday

Completed days should visually change state.

The streak must be calculated from actual study activity.

Do NOT fake the number.

Store streak information in the database.

Include milestone logic:

3 days
5 days
7 days
14 days
30 days
60 days
100 days

----------------------------------------
TIP OF THE DAY
----------------------------------------

Display:

TIP OF THE DAY

"Study smart, not just hard. Take short breaks, stay hydrated, and remember why you started."

Button:

MORE STRATEGIES →

The content should eventually come from the Winning Strategies content database.

For now, create a structured content system so tips can be dynamically loaded.

----------------------------------------
PERSONALISED RECOMMENDATION
----------------------------------------

Add a section called:

YOUR NEXT WIN

This is extremely important.

The system should analyse the learner's:

- Goals
- Study activity
- Task completion
- Subject performance
- Upcoming exams
- Weak areas

Then recommend ONE clear next action.

Example:

YOUR NEXT WIN

"Your Mathematics practice has dropped this week."

Button:

START 20-MINUTE MATHS SESSION →

This is the beginning of the WS12 intelligence layer.

==================================================
8. GOALS
==================================================

Create a Goals screen.

Learners should be able to create:

- Academic goals
- Subject goals
- Study goals
- Exam goals
- Personal development goals

Example:

GOAL

"Improve Mathematics from 55% to 70%"

Show:

Current:
55%

Target:
70%

Progress:
42%

Deadline:
15 October

Action:
Continue Practice

Goals must be stored in the database.

==================================================
9. STUDY PLANNER
==================================================

Create a calendar/planner.

Views:

- Today
- Week
- Month

Learners can:

- Add study sessions
- Edit sessions
- Delete sessions
- Mark sessions complete
- Select subjects
- Set duration
- Add notes

Eventually an AI Study Planner will automatically generate schedules.

Build the architecture so the AI can later generate these sessions.

==================================================
10. PROGRESS
==================================================

Create a Progress dashboard.

Display:

Overall study progress

Subject performance:

Mathematics
████████░░ 72%

Physical Sciences
███████░░░ 64%

English
█████████░ 81%

etc.

Include:

- Study hours
- Tasks completed
- Current streak
- Longest streak
- Weekly activity
- Monthly activity
- Goal completion
- Subject performance

Use charts where useful.

Do not overload the screen.

The learner should immediately understand:

"Where am I?"
"What is improving?"
"What needs attention?"

==================================================
11. AI TUTOR
==================================================

Create the initial AI Tutor interface.

The AI Tutor should feel like a supportive academic assistant.

Example:

"Hi Thabo 👋
What are we working on today?"

Suggested actions:

[Explain a concept]

[Help me study]

[Give me a quiz]

[Explain my mistake]

[Create a study plan]

The AI Tutor architecture must be modular.

Create an AI service layer rather than placing AI logic directly inside UI components.

IMPORTANT:

The AI Tutor should eventually use the official Winning Strategies content as its knowledge source.

It must NOT simply hallucinate educational content.

Future architecture should support:

- Retrieval-Augmented Generation
- Winning Strategies book content
- Curriculum-aligned content
- Past papers
- Approved study resources

==================================================
12. AUTHENTICATION
==================================================

Create authentication screens:

WELCOME

"Your Grade 12 journey starts here."

Buttons:

Continue with Google

Continue with Email

Login

Register

After registration, create an onboarding process.

==================================================
13. LEARNER ONBOARDING
==================================================

Ask:

First name

Grade

School

Province

Subjects

Target marks

Exam date

Study availability

Preferred study times

Academic goals

Career interests

The learner should not be overwhelmed.

Use a multi-step onboarding flow.

Show progress:

STEP 1 OF 5

==================================================
14. LEARNER PROFILE
==================================================

Profile should display:

Name

School

Grade

Subjects

Target marks

Current streak

Goals

Achievements

Exam date

Settings

Allow learners to update their information.

==================================================
15. NOTIFICATIONS
==================================================

Create notification infrastructure.

Types:

Study reminder

Goal reminder

Streak reminder

New strategy

Exam countdown

Achievement

Important announcement

Notifications should eventually support push notifications.

==================================================
16. DATABASE DESIGN
==================================================

Create a proper relational schema.

At minimum:

users
profiles
subjects
learner_subjects
goals
study_sessions
study_tasks
study_activity
streaks
achievements
notifications
tips
content
exam_dates

Design for future expansion.

Each learner's data must be isolated securely.

Use Row Level Security in Supabase.

==================================================
17. ADMIN SYSTEM
==================================================

Create the architecture for an ADMIN dashboard.

Administrators should eventually be able to:

- Manage learners
- Manage subjects
- Manage study strategies
- Manage tips
- Manage content
- View learner analytics
- Manage notifications
- Manage exam dates
- Monitor platform health

Do not expose admin functionality to normal learners.

==================================================
18. ANALYTICS
==================================================

Track meaningful events.

Examples:

user_registered
onboarding_completed
task_created
task_completed
study_session_started
study_session_completed
goal_created
goal_completed
ai_tutor_opened
ai_question_asked
strategy_viewed
tip_viewed
streak_extended

Do NOT collect unnecessary personal information.

Analytics should ultimately help answer:

How many learners are active?

How often do they study?

Which subjects need help?

Where do learners drop off?

Which strategies produce engagement?

==================================================
19. AI AGENT ARCHITECTURE
==================================================

DO NOT build dozens of AI agents immediately.

Instead, create the architecture for an AI orchestration layer.

Future agents include:

Executive Intelligence Agent
Study Planner Agent
AI Tutor
Curriculum Agent
Learner Success Agent
Motivation Agent
Exam Preparation Agent
Parent Support Agent
Teacher Support Agent
Marketing Intelligence Agent

The initial application should only implement the AI Tutor foundation and recommendation logic.

The system should be designed so additional agents can be added without rewriting the application.

==================================================
20. SECURITY
==================================================

Implement:

- Secure authentication
- Supabase Row Level Security
- Environment variables
- No API keys exposed in frontend
- Input validation
- Secure database access
- Appropriate privacy controls

Never place secret keys in client-side code.

==================================================
21. PERFORMANCE
==================================================

The app must be fast on mobile devices.

Optimize for users who may have:

- Slow internet
- Limited mobile data
- Older smartphones

Avoid unnecessarily large assets.

Lazy-load where appropriate.

Design graceful loading states.

Provide useful empty states.

Handle errors elegantly.

==================================================
22. EMPTY STATES
==================================================

If a learner has no data, never show a broken or empty interface.

Examples:

No goals:

"You haven't created a goal yet."

[CREATE MY FIRST GOAL]

No study plan:

"Let's build your first study plan."

[CREATE STUDY PLAN]

No streak:

"Your first study session starts today."

[START STUDYING]

==================================================
23. GAMIFICATION
==================================================

Use motivational gamification carefully.

Include:

Streaks
Achievements
Milestones
Progress
Celebrations

Avoid:

Gambling mechanics
Manipulative engagement
Excessive notifications
Addictive design patterns

The purpose is learner success, not screen time.

==================================================
24. ACCESSIBILITY
==================================================

Follow accessibility best practices.

Ensure:

Readable typography
High contrast
Keyboard accessibility
Clear focus states
Screen-reader labels
Large touch targets
Meaningful error messages

==================================================
25. RESPONSIVE BREAKPOINTS
==================================================

Design specifically for:

Mobile:
360px+

Tablet:
768px+

Desktop:
1024px+

Large desktop:
1440px+

The mobile interface must remain excellent at 360px width.

==================================================
26. DEVELOPMENT REQUIREMENTS
==================================================

Do not merely create static HTML.

I want a WORKING application.

Buttons must work.

Navigation must work.

Forms must work.

Checkboxes must work.

Authentication architecture must work.

Database integration must be prepared.

Progress calculations must work.

Streak calculations must work.

Countdown must work.

Charts must use real application state.

Use reusable components.

Use clean TypeScript types.

Do not duplicate code unnecessarily.

==================================================
27. DEMO MODE
==================================================

Create a realistic demo learner.

Example:

Name:
Thabo Mokoena

Grade:
12

Subjects:
Mathematics
Physical Sciences
English Home Language
Life Orientation

Use realistic sample data.

The application must make it obvious that this is demo data.

==================================================
28. UX PRINCIPLE
==================================================

Every screen must answer:

"What does the learner do next?"

Avoid dashboard clutter.

The learner should be able to open the app and understand their next action within five seconds.

==================================================
29. FUTURE APP STORE ARCHITECTURE
==================================================

Although the first implementation may be a web application/PWA, architect the project so it can later become:

iOS application
Android application

Prefer technology choices that make this transition practical.

Potential future path:

React / TypeScript
→ PWA
→ React Native / Expo or equivalent mobile implementation

Do not lock the architecture into desktop-only assumptions.

==================================================
30. FINAL DELIVERABLE
==================================================

Build the application.

First:

1. Analyse the attached design.
2. Create the application architecture.
3. Create the database schema.
4. Create reusable UI components.
5. Build authentication.
6. Build onboarding.
7. Build dashboard.
8. Build Goals.
9. Build Planner.
10. Build Progress.
11. Build AI Tutor foundation.
12. Build Profile.
13. Build Notifications.
14. Build responsive layouts.
15. Add realistic demo data.
16. Test all primary interactions.
17. Fix errors.
18. Explain how to run the application.
19. Explain how to connect Supabase.
20. Explain how to deploy it.

Do not stop at a visual mock-up.

I want a functioning application that can be iterated into the real Winning Strategies for Grade 12 product.

==================================================
31. PRODUCT NORTH STAR
==================================================

The app should make a Grade 12 learner feel:

"I know what I need to do."

"I can see my progress."

"I am getting better."

"I have someone helping me."

"I can succeed."

The ultimate objective is not to build another education dashboard.

The objective is to build a digital system that helps a Grade 12 learner turn:

CONFUSION
→ CLARITY

CLARITY
→ ACTION

ACTION
→ CONSISTENCY

CONSISTENCY
→ CONFIDENCE

CONFIDENCE
→ SUCCESS

Build accordingly.
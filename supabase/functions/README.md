# WS12 edge functions

Each function folder holds a small Deno entry point (`index.ts`). The logic lives in `_shared/` as plain TypeScript with no Deno or Supabase imports, so Vitest can test it in Node (`supabase/tests/functions/`). `_shared/clients.ts` is the only shared file that creates Supabase clients.

| Function           | Caller                     | What it does                                                                                                         |
| ------------------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `request-consent`  | The app, signed-in learner | Hashes and encrypts the parent contact, opens the consent request. Sends nothing unless sending is enabled.          |
| `library-download` | The app, signed-in user    | Checks the entitlement in the database, returns a signed link to the private `library` bucket valid for 300 seconds. |
| `payfast-itn`      | PayFast, server to server  | Verifies source IP, signature, merchant, amount and the PayFast validate call, then records the payment once.        |
| `stripe-webhook`   | Stripe, server to server   | Verifies the `Stripe-Signature` header, then records completed checkouts and full refunds once.                      |

## Secrets

Set these as Supabase secrets only (`supabase secrets set NAME=value`). Never commit values and never put them in a `VITE_` variable.

| Name                        | Used by                               | Notes                                                                                              |
| --------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`              | all                                   | Provided by Supabase                                                                               |
| `SUPABASE_ANON_KEY`         | `request-consent`, `library-download` | Provided by Supabase; used with the caller's session so Row Level Security applies                 |
| `SUPABASE_SERVICE_ROLE_KEY` | all                                   | Provided by Supabase; used only for consent contacts, payments and signed links                    |
| `ALLOWED_ORIGINS`           | `request-consent`, `library-download` | Comma separated app origins for CORS, for example the app subdomain and the local dev server       |
| `CONSENT_CONTACT_KEY`       | `request-consent`                     | 32 random bytes, base64 encoded (`openssl rand -base64 32`). Encrypts stored parent contacts       |
| `CONSENT_SENDING_ENABLED`   | `request-consent`                     | Leave unset. Real consent messages need Didi's approval and an email provider, which is not chosen |
| `PAYFAST_MODE`              | `payfast-itn`                         | Must be `sandbox`. Any other value makes the function refuse every request                         |
| `PAYFAST_MERCHANT_ID`       | `payfast-itn`                         | Sandbox merchant id                                                                                |
| `PAYFAST_PASSPHRASE`        | `payfast-itn`                         | Sandbox passphrase, required                                                                       |
| `PAYFAST_ALLOWED_IPS`       | `payfast-itn`                         | Optional comma separated CIDR list that replaces the built-in PayFast ranges                       |
| `STRIPE_SECRET_KEY`         | `stripe-webhook`                      | Must start with `sk_test_`, otherwise the function refuses every request                           |
| `STRIPE_WEBHOOK_SECRET`     | `stripe-webhook`                      | The `whsec_` signing secret of the test mode webhook endpoint                                      |

## Deploying (needs the Supabase project, not done yet)

- `payfast-itn` and `stripe-webhook` are called by PayFast and Stripe without a Supabase session, so they are deployed with JWT verification off: `supabase functions deploy payfast-itn --no-verify-jwt` and the same for `stripe-webhook`. Their own signature checks protect them.
- `request-consent` and `library-download` keep JWT verification on.
- Enable `pg_cron` if the daily `run_housekeeping()` job should run in the database; the migration schedules it only when the extension exists.

## Checkout conventions

The `create-checkout` function (later sprint) must send what the webhooks expect: for PayFast, our reference in `m_payment_id`, the product code in `custom_str1` and the buyer email in `email_address`; for Stripe, the product code in the Checkout Session metadata as `product_code`, with the currency set to ZAR.

## Database function privileges

Supabase gives `anon` and `authenticated` execute on every new database function by default. Every migration that creates a function must revoke it from `public`, `anon` and `authenticated` (see the end of `supabase/migrations/20261123000200_consent_language_profile.sql`), then grant it to `authenticated` only when the app calls it, or to `service_role` only when an edge function calls it with the service role key. A function replaced with `create or replace` keeps its privileges. Add every grant to the expected list in `supabase/tests/rls.test.ts`, which fails on any grant that is not listed.

## Things to confirm on the real project

- PayFast's current notification source ranges (`PAYFAST_SOURCE_RANGES` in `_shared/payfast.ts`).
- That `X-Forwarded-For` on Supabase edge functions carries the real caller address first.
- How Supabase Auth refreshes Google metadata on sign-in, alongside the `strip_profile_metadata` trigger.

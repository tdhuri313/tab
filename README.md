# Tab
 
**Invoicing in one sentence, for freelancers.**
 
Type *"Bill Sarah Lee sarah@email.com $400 for logo design due Friday"* and Tab turns it into a real Stripe invoice, sends it, tracks the payment, and helps you follow up when it's late.
 
**Live demo:** https://tab-ejp7.vercel.app *(Stripe test mode: pay with card `4242 4242 4242 4242`, any future date, any CVC)*
 
![Tab demo](design/demo.gif)
 
---
 
## Why I built it
 
Freelancers like tutors, photographers, and designers bill a handful of clients a month. Most of them use Venmo, a notes app, or an invoicing tool built for accounting teams. The hard parts aren't making an invoice. They're **knowing who still owes you** and **chasing late payments without feeling awkward**.
 
Tab is built around those two jobs:
1. **Bill in one sentence.** No forms, no templates.
2. **See who owes you at a glance**, and send a reminder you approve in two clicks.
## What it does
 
| Feature | How it works |
|---|---|
| **Sentence → invoice** | Parses name, email, amount, description, and due date from plain English. Recognized parts show as chips while you type, and you can edit everything in a preview before sending. |
| **Real Stripe invoices** | Creates (or reuses) the Stripe customer, builds the invoice, finalizes it, and sends it. Clients pay on Stripe's hosted invoice page. |
| **Live dashboard** | Outstanding, overdue, and paid-this-month totals. Invoices sorted by urgency, with Draft, Sent, Overdue, Paid, and Void statuses. |
| **Payment notifications** | Stripe webhooks mark invoices paid, and the dashboard updates without a refresh: *"Sarah Lee just paid $400."* |
| **Approved reminders** | Overdue invoices get a Remind button. Pick a Friendly or Firm tone, edit the message, and approve. **Nothing sends without your approval.** |
 
## Stack
 
- **Next.js** (App Router), **TypeScript**, **Tailwind CSS**
- **Stripe API** (test mode): Customers, Invoices, hosted invoice pages, Webhooks with signature verification
- **Upstash Redis** for storing webhook events
- **chrono-node** for parsing dates like "Friday" or "next Tuesday"
- **Vercel** for hosting
- Designed in **Figma Make**, built with **Claude Code**
## Key decisions
 
**Stripe is the source of truth. No database.**
The dashboard reads invoices directly from Stripe, so there's no sync code and the app can never disagree with Stripe. A client paying, or me voiding an invoice in the Stripe Dashboard, shows up automatically. The tradeoff: each page load makes a live Stripe call, and sorting and filtering happen in memory. That's fine at freelancer scale. A database would make sense with many users, search, or analytics.
 
**Polling instead of server-sent events.**
My first plan streamed payment events to the browser over SSE from an in-memory list. That breaks on Vercel, because serverless functions don't share memory, so events would get lost. Instead, the webhook saves each event to Redis (de-duplicating Stripe's retries), and the dashboard checks for new events about every 10 seconds. Freelancers don't need payment alerts within a second, and this keeps the app serverless-friendly with no extra real-time service.
 
**Humans approve anything that touches money or clients.**
The parser fills a preview the user can edit before sending, and reminders are drafted but never sent automatically. When software acts on someone's behalf with their clients and their money, the user should have the final say.
 
**Safety defaults.**
- Stripe calls run only on the server (`import "server-only"`), so the secret key can't reach the browser.
- The app refuses to start unless the key is a `sk_test_` key, so it can't charge real money by accident.
- Webhook requests must have a valid Stripe signature. Forged requests are rejected.
- Customers are matched by lowercased email, so billing the same client twice doesn't create duplicates.
- If invoice creation fails partway through, the half-built draft is deleted.
- Amounts are stored as integer cents, so there's no floating-point rounding.
## Things I caught while testing
 
- **Punctuation broke the parser.** "…for logo design, due Friday" kept the comma in the description. The parser now strips stray punctuation around each field.
- **"New invoice" reopened the old preview.** Next.js `cacheComponents` keeps visited pages alive, so the home page came back with stale state. It now resets after sending.
- **Due dates shifted by a day for US users.** Invoices are due at 11:59 PM UTC on the due date, and dates display in UTC so "Friday" doesn't show up as Saturday.
## User testing

**Status:** in progress. I'm running 30-minute think-aloud sessions with 5 freelancers who bill their own clients (tutors, photographers, designers, and other solo service providers).

**What each session covers:**
1. First impression: can people tell what Tab does from the start screen?
2. Billing a real client in one sentence, using a test email
3. Finding the invoice and checking whether it's paid
4. Paying the invoice as the client, then seeing the dashboard update
5. Sending a reminder for an overdue invoice

**What I'm measuring:**
- Time to send a first invoice without help
- How often the parser fills every field correctly from real sentences
- Which fields people edit in the preview
- Whether people trust the app with client info and amounts (1–5 rating)
- Which reminder tone people pick, and how much they rewrite it

Every sentence participants type becomes a parser test case. Findings and the changes I made will be posted here.
 
## What I'd build next
 
- **Accounts.** Right now everyone shares one Stripe account. Next step: sign-in, plus Stripe Connect so each freelancer links their own account.
- **Time zones.** Use the freelancer's time zone for due dates.
- **Smarter input.** Let users type loosely and use an LLM only where the rule-based parser falls short.
- **Recurring invoices** for weekly tutoring or monthly retainers.
- **Mobile-first**, since many freelancers bill from their phones.
## Run it locally
 
**Prerequisites:** Node 18+, a Stripe account in test mode, the [Stripe CLI](https://docs.stripe.com/stripe-cli), and a free [Upstash Redis](https://upstash.com) database.
 
```bash
git clone https://github.com/tdhuri313/tab.git
cd tab
npm install
```
 
Create `.env.local`:
 
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...   # printed by `stripe listen` below
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
APP_PASSWORD=...                  # shared password for the login page
```
 
Run the app and forward webhooks:
 
```bash
npm run dev
stripe listen --events invoice.paid,invoice.payment_failed --forward-to localhost:3000/api/webhooks
```
 
Open http://localhost:3000.
 
## Project structure
 
```
app/
  page.tsx               Start screen
  new/                   Sentence → preview → send
  invoices/              Dashboard
  login/                 Password gate (APP_PASSWORD)
  api/invoices/          Create and send invoices (server-side)
  api/webhooks/          Verified Stripe webhook endpoint
  api/events/            Recent payment events for the dashboard to poll
lib/
  auth.ts                Password cookie helpers
  parseInvoice.ts        Sentence parser and validation
  stripe.ts              Server-only Stripe client
  invoices.ts            Status and urgency logic
proxy.ts                 Requires login everywhere except /api/webhooks
components/              Preview card, status badges, reminder drawer, toast
design/                  Figma screens
```
 
---
 
Built by [Tanvi Dhuri](https://miracle-happen-610679.framer.app/) · Computational Media at Georgia Tech
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Testing overdue invoices (reminders)

Stripe won't create an invoice with a past due date, so use a **test clock**
that starts in the past. The dashboard compares due dates to the real clock,
so the invoice shows as Overdue immediately. In Git Bash:

```bash
NOW=$(date +%s); START=$((NOW - 30*86400)); DUE=$((START + 7*86400))
stripe test_helpers test_clocks create --frozen-time=$START
stripe customers create --name="Client" --email="client+$NOW@example.com" --test-clock=clock_…
stripe invoices create --customer=cus_… --collection-method=send_invoice --due-date=$DUE \
  --pending-invoice-items-behavior=exclude --auto-advance=false --currency=usd
stripe invoiceitems create --customer=cus_… --invoice=in_… --amount=40000 --currency=usd --description="…"
stripe invoices finalize_invoice in_…
```

`invoices.list` hides test-clock invoices, so `lib/invoices.ts` fetches them
separately (test mode only). Test mode never sends emails; confirm a reminder
via `invoice.sent` in `stripe listen` and the invoice's metadata.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

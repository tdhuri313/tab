// Importing "server-only" makes the build fail if any Client Component ever
// imports this file, so the secret key can never end up in browser JS.
import "server-only";
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;

if (!key) {
  throw new Error("STRIPE_SECRET_KEY is missing. Add it to .env.local.");
}
// Safety net while Tab is in development: refuse to run against live money.
if (!key.startsWith("sk_test_")) {
  throw new Error("STRIPE_SECRET_KEY must be a test-mode key (sk_test_...).");
}

export const stripe = new Stripe(key);

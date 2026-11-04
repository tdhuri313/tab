import { connection } from "next/server";
import { listRecentPaymentEvents } from "@/lib/paymentEvents";

/**
 * GET /api/events — the dashboard polls this every ~10s.
 * Reads only from Redis (one command), never from Stripe, so it's cheap.
 */
export async function GET() {
  // Always run per request; never prerender or cache this response.
  await connection();

  try {
    const events = await listRecentPaymentEvents();
    return Response.json({ events }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Failed to read payment events:", err);
    return Response.json({ error: "Event feed unavailable." }, { status: 503 });
  }
}

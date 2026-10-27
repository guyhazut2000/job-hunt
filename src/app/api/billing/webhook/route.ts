import { NextResponse } from "next/server";
import { billingEnabled } from "@/lib/billing";

/**
 * Stripe webhook stub. When enabling billing: install `stripe`, verify the signature with
 * STRIPE_WEBHOOK_SECRET, and upsert Subscription/User.plan on
 * checkout.session.completed, customer.subscription.updated and customer.subscription.deleted.
 */
export async function POST() {
  if (!billingEnabled()) return NextResponse.json({ error: "billing disabled" }, { status: 501 });
  return NextResponse.json({ received: true });
}

import type { Plan } from "@prisma/client";

/**
 * Stripe-ready billing stub. When STRIPE_SECRET_KEY + STRIPE_PRICE_PRO are set, replace
 * `createCheckoutUrl` with a real Checkout Session (install `stripe`), and handle
 * `checkout.session.completed` / `customer.subscription.*` in /api/billing/webhook.
 */
export const PLANS: Record<Plan, { priceIls: number; aiReviewsPerMonth: number | null }> = {
  FREE: { priceIls: 0, aiReviewsPerMonth: 3 },
  PRO: { priceIls: 49, aiReviewsPerMonth: null },
};

export function billingEnabled() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_PRO);
}

export async function createCheckoutUrl(userId: string): Promise<string | null> {
  if (!billingEnabled()) return null;
  void userId; // TODO(billing): stripe.checkout.sessions.create({ mode: "subscription", ... })
  return null;
}

export function canUseAiReview(plan: Plan, usedThisMonth: number) {
  const limit = PLANS[plan].aiReviewsPerMonth;
  return limit === null || usedThisMonth < limit;
}

import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-02-25.clover',
      typescript: true,
    });
  }
  return _stripe;
}

export const PLANS = {
  FREE: {
    name: 'Free',
    price: 0,
    priceId: null,
    features: [
      '1 team member',
      'Basic CRM (WorkPipe)',
      '100 contacts',
      'Community support',
    ],
    apps: ['WORKPIPE'] as const,
  },
  STARTER: {
    name: 'Starter',
    price: 0,
    priceId: process.env.STRIPE_STARTER_PRICE_ID,
    features: [
      '5 team members',
      'Full CRM (WorkPipe)',
      '1,000 contacts',
      'Email support',
      'Basic automations',
    ],
    apps: ['WORKPIPE'] as const,
  },
  PRO: {
    name: 'Pro',
    price: 0,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    features: [
      '25 team members',
      'Full CRM (WorkPipe)',
      'Atrium (AI departments)',
      'Unlimited contacts',
      'Priority support',
      'Advanced automations',
      'Voice mode',
    ],
    apps: ['WORKPIPE', 'ATRIUM'] as const,
  },
  ENTERPRISE: {
    name: 'Enterprise',
    price: 0,
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID,
    features: [
      'Unlimited team members',
      'Full CRM (WorkPipe)',
      'Atrium (AI departments)',
      'Unlimited contacts',
      'Dedicated support',
      'Custom integrations',
      'Voice mode',
      'White-label option',
      'SLA guarantee',
    ],
    apps: ['WORKPIPE', 'ATRIUM'] as const,
  },
} as const;

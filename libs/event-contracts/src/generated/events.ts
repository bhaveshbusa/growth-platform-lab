// Generated from docs/tracking-plan.yaml by `pnpm contracts:generate`. Do not edit.
//
// The tracking plan is the source of truth; this file is a typed view of it.
// A test fails if the two disagree.

export const PLAN_VERSION = 1;
export const PLAN_PRODUCT = 'lingostreak';
export const PLAN_FINGERPRINT = 'sha256:11876f3cbe740acc';

export const CONSENT_PURPOSES = [
  'product_analytics',
  'personalisation',
  'marketing',
] as const;

export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const EVENT_KEYS = [
  'checkout_started@1',
  'lesson_completed@1',
  'lesson_started@1',
  'onboarding_completed@1',
  'page_viewed@1',
  'paywall_viewed@1',
  'signup_completed@1',
  'signup_started@1',
  'streak_extended@1',
  'subscription_cancelled@1',
  'subscription_started@1',
] as const;

export type EventKey = (typeof EVENT_KEYS)[number];

/**
 * The learner opened checkout for a specific plan.
 *
 * Owner: monetisation. Purpose: product_analytics. Source: client.
 */
export interface CheckoutStartedV1 {
  /** Plan selected at checkout. */
  plan: 'monthly' | 'annual';
}

/**
 * A lesson was finished. The activation metric is built from the learner's first three of these.
 *
 * Owner: learning. Purpose: product_analytics. Source: client.
 */
export interface LessonCompletedV1 {
  /** Stable lesson identifier. */
  lesson_id: string;
  /** Percentage score, 0-100. */
  score: number;
  /** Time spent in the lesson. */
  duration_seconds: number;
}

/**
 * A lesson was opened. Paired with lesson_completed to measure drop-off inside a lesson.
 *
 * Owner: learning. Purpose: product_analytics. Source: client.
 */
export interface LessonStartedV1 {
  /** Stable lesson identifier. */
  lesson_id: string;
  /** Curriculum unit the lesson belongs to. */
  unit: number;
}

/**
 * The learner finished choosing a language and a weekly goal.
 *
 * Owner: learning. Purpose: product_analytics. Source: client.
 */
export interface OnboardingCompletedV1 {
  /** ISO 639-1 code of the language being learned. */
  learning_language: string;
  /** Self-declared weekly study goal. */
  weekly_goal_minutes: number;
}

/**
 * A page or in-app screen was displayed. The only event allowed to fire on navigation.
 *
 * Owner: growth. Purpose: product_analytics. Source: client.
 */
export interface PageViewedV1 {
  /** Normalised route, for example /lesson/:id — never the raw URL with query parameters. */
  path: string;
  /** Host only; full referrer URLs are dropped at the gateway. */
  referrer_host?: string;
}

/**
 * The paywall was displayed, whatever triggered it.
 *
 * Owner: monetisation. Purpose: product_analytics. Source: client.
 */
export interface PaywallViewedV1 {
  /** Why the paywall appeared. */
  trigger: 'lesson_limit' | 'premium_lesson' | 'settings' | 'promotion';
}

/**
 * The account exists and the learner is authenticated. This is the anonymous-to-known transition.
 *
 * Owner: growth. Purpose: product_analytics. Source: client.
 */
export interface SignupCompletedV1 {
  /** Authentication method used. */
  method: 'email' | 'google' | 'apple';
}

/**
 * The learner submitted the signup form for the first time.
 *
 * Owner: growth. Purpose: product_analytics. Source: client.
 */
export interface SignupStartedV1 {
  /** Authentication method chosen. */
  method: 'email' | 'google' | 'apple';
}

/**
 * The learner practised on a new calendar day, extending their streak. Retention's in-product signal.
 *
 * Owner: learning. Purpose: product_analytics. Source: client.
 */
export interface StreakExtendedV1 {
  /** Streak length after this extension. */
  streak_days: number;
}

/**
 * The learner cancelled; the subscription may still be active until period end.
 *
 * Owner: monetisation. Purpose: product_analytics. Source: server.
 */
export interface SubscriptionCancelledV1 {
  /** Plan cancelled. */
  plan: 'monthly' | 'annual';
  /** Optional self-reported reason. */
  reason?: 'too_expensive' | 'not_using' | 'missing_content' | 'other';
}

/**
 * A paid subscription began. The conversion event; emitted server-side, never from the browser.
 *
 * Owner: monetisation. Purpose: product_analytics. Source: server.
 */
export interface SubscriptionStartedV1 {
  /** Plan purchased. */
  plan: 'monthly' | 'annual';
  /** Amount charged in the currency's minor units. */
  price_minor_units: number;
  /** ISO 4217 currency code. */
  currency: string;
}

/** Properties each planned event carries, keyed by name@version. */
export interface EventPropertiesByKey {
  'checkout_started@1': CheckoutStartedV1;
  'lesson_completed@1': LessonCompletedV1;
  'lesson_started@1': LessonStartedV1;
  'onboarding_completed@1': OnboardingCompletedV1;
  'page_viewed@1': PageViewedV1;
  'paywall_viewed@1': PaywallViewedV1;
  'signup_completed@1': SignupCompletedV1;
  'signup_started@1': SignupStartedV1;
  'streak_extended@1': StreakExtendedV1;
  'subscription_cancelled@1': SubscriptionCancelledV1;
  'subscription_started@1': SubscriptionStartedV1;
}

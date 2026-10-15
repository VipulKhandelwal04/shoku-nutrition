import type { Activity, Diet, Food, Goal, Meal, Sex, Targets } from './nutrition';

export type Role = 'user' | 'admin';

export type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: Role;
  disabled: boolean;
  goal: Goal | null;
  sex: Sex | null;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity: Activity | null;
  diet: Diet;
  restrictions: string[];
  targets: Targets | null;
  onboarded_at: string | null;
  created_at: string;
};

export type FoodRow = Food & { owner_id: string | null; active: boolean; updated_at?: string };

export type EntrySource = 'manual' | 'quick' | 'repeat' | 'plan' | 'photo_ai' | 'text_ai';

export type EntryRow = {
  id: string;
  user_id: string;
  day: string; // YYYY-MM-DD
  meal: Meal;
  food_id: string | null;
  food: Food; // snapshot at log time
  quantity: number;
  photo_path: string | null;
  source: EntrySource;
  created_at: string;
};

export type DayRow = { day: string; water_ml: number; done: boolean };

export type Quote = { id: number; text: string; author: string | null; active: boolean; sort: number };
export type TourSlide = { id: number; title: string; body: string; image_url: string; sort: number; active: boolean };

export type AiFeature = 'photo' | 'text' | 'plan' | 'coach';
/**
 * "AI Assist" (Gemini). `enabled` is the master feature flag admins toggle; the per-feature flags only apply
 * while it is on. A feature is usable when enabled && settings[feature] && the deployment has GEMINI_API_KEY.
 */
export type AiSettings = { enabled: boolean; daily_quota: number } & Record<AiFeature, boolean>;
export type FeatureSettings = { signups_open: boolean };

export const DEFAULT_AI_SETTINGS: AiSettings = { enabled: true, photo: true, text: true, plan: true, coach: true, daily_quota: 25 };

/** What the UI may show for AI Assist. `configured` is false when the server has no Gemini key. */
export type AiAssistStatus = { available: boolean; configured: boolean; features: Record<AiFeature, boolean>; dailyQuota: number };

export type WorkoutRow = {
  id: string;
  day: string;
  kind: string;
  label: string;
  minutes: number;
  kcal: number;
  kcal_source: 'estimate' | 'device';
  source: 'manual' | 'strava';
  external_id: string | null;
  hidden: boolean;
  created_at: string;
};

/** Connection status for the UI. Never carries tokens. */
export type ConnectionStatus = { provider: 'strava'; display_name: string | null; last_sync_at: string | null; connected_at: string };

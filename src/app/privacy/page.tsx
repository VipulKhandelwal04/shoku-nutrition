import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, SUPPORT_EMAIL } from '@/components/public/Legal';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What Shoku stores, why, who processes it, and how to get your data out.',
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="15 October 2026">
      <p>
        Shoku is an independent nutrition-tracking project. This page explains, in plain words, what we keep and why. We don’t sell your data and
        we don’t show ads.
      </p>

      <h2>What we store</h2>
      <ul>
        <li>
          <strong>Your Google account basics.</strong> When you sign in with Google, Google shares your name, email address and profile photo with
          us. We use them to create your account and show who is signed in.
        </li>
        <li>
          <strong>Your profile.</strong> The goal, body details, activity level, diet and food restrictions you enter, and the targets Shoku
          works out from them.
        </li>
        <li>
          <strong>Your diary.</strong> Meals and foods you log, water, days you mark done, custom foods you create, and badges you earn.
        </li>
        <li>
          <strong>Meal photos.</strong> If you snap a plate, the photo is stored in a private storage area that only your account can read.
        </li>
        <li>
          <strong>Meal feedback and preferences.</strong> Ratings you give meals or Ask Shoku ideas (like, okay or not for me, quick tags and an
          optional note), the cuisines you lean toward, and whether Ask Shoku may use your workouts.
        </li>
        <li>
          <strong>AI Assist usage.</strong> A count of AI requests per day, so fair-use limits work.
        </li>
      </ul>

      <h2>Where it lives</h2>
      <p>
        Your data is stored with <strong>Supabase</strong> (database, sign-in and file storage). Access rules in the database make sure each account
        can only read its own diary and photos.
      </p>

      <h2>AI Assist</h2>
      <p>
        When you use AI Assist, the photo or text you submit is sent to <strong>Google Gemini</strong> to suggest foods and portions, a plan, or a
        coach line. Only what that request needs is sent: for Ask Shoku, that is your question, today’s meals and targets, your diet and the
        foods you skip, your cuisine preferences, and your workouts unless you turn that off in your profile. Results are suggestions: nothing is
        saved to your diary until you confirm it.
      </p>

      <h2>Workouts and Strava</h2>
      <p>
        Workouts you log, and their estimated calories, are stored with your diary. If you connect <strong>Strava</strong>, Shoku reads your
        activities (name, type, duration and calories) to count calories burned, and stores the access Strava grants so it can import new ones.
        Shoku never posts to Strava. Disconnect any time from your profile: that revokes Shoku’s access and deletes the imported workouts.
      </p>

      <h2>Your control</h2>
      <ul>
        <li>Export your data at any time from your Profile in the app.</li>
        <li>Delete diary entries and meal ratings whenever you like.</li>
        <li>Choose in your profile whether Ask Shoku uses your workouts, or asks you first each time.</li>
        <li>
          To close your account and remove your data, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </li>
      </ul>

      <h2>Cookies</h2>
      <p>We use only the cookies needed to keep you signed in. No tracking or advertising cookies.</p>

      <h2>Health information</h2>
      <p>
        Nutrition values are estimates. Shoku does not give medical advice. See the <Link href="/terms">Terms</Link>.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about your data: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}

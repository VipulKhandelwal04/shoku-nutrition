import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, SUPPORT_EMAIL } from '@/components/public/Legal';

export const metadata: Metadata = {
  title: 'Terms',
  description: 'The ground rules for using Katori.',
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms" updated="15 October 2026">
      <p>
        Katori is an independent project that helps you log meals and see your plate against India’s ICMR-NIN My Plate guide. By signing in, you
        agree to these terms.
      </p>

      <h2>Not medical advice</h2>
      <p>
        <strong>Nutrition values are estimates. Katori does not give medical advice.</strong> Calories, macros and food-group amounts are
        approximations from a food catalogue and your own entries. Targets and plans are general guidance, not a diagnosis, treatment or
        prescription diet. If you are pregnant, managing a health condition, or have a history of disordered eating, talk to a qualified doctor or
        dietitian before changing how you eat.
      </p>

      <h2>AI Assist suggestions</h2>
      <p>
        AI Assist (powered by Google Gemini) suggests foods, portions, plans and short coach lines. It can be wrong. Check every suggestion before
        you save it. You are responsible for what goes into your diary.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>Sign in with your own Google account and keep it secure.</li>
        <li>Use Katori for personal tracking. Don’t try to access other people’s data or disrupt the service.</li>
        <li>We may pause accounts that misuse the service, and we may pause new sign-ups at times.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        Your diary, photos and custom foods stay yours. You let us store and process them only to run Katori for you, as described in the{' '}
        <Link href="/privacy">Privacy policy</Link>. You can export your data from your Profile.
      </p>

      <h2>The service</h2>
      <p>
        Katori is provided as is. Features, including AI Assist, may change, be limited or switched off. We work to keep your data safe but can’t
        promise the service will always be available or error-free.
      </p>

      <h2>Changes</h2>
      <p>If these terms change in a meaningful way, we’ll update the date above.</p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </LegalPage>
  );
}

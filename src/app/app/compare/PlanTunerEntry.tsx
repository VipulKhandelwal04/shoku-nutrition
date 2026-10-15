'use client';
import { useRouter } from 'next/navigation';
import { PlanTuner } from '@/components/ai';
import { useToast } from '@/components/ui/Toast';

/** AI Assist entry to tailor the plan. Only rendered when the admin has AI Assist and its plan feature on. */
export function PlanTunerEntry() {
  const router = useRouter();
  const toast = useToast();
  return (
    <PlanTuner
      onSaved={() => {
        toast('Plan updated. Check each item before you log it.');
        router.refresh();
      }}
    />
  );
}

import { Icon } from '@/components/ui/Icon';
import styles from './ai.module.css';

/** The small "AI Assist" badge every AI surface carries. */
export function AiBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`chip accent ${styles.badge} ${className}`}>
      <Icon name="spark" size="sm" />
      AI Assist
    </span>
  );
}

'use client';

import { signIn } from '@/lib/auth-client';
import { ui } from '@/lib/ui';

type Props = {
  label?: string;
  /** header は上の帯の右の形。ほかは画面の中の主な操作の形 */
  variant?: 'header' | 'body';
};

export function SignInButton({ label = 'Google でログイン', variant = 'body' }: Props) {
  return (
    <button
      type="button"
      className={variant === 'header' ? ui.signInButton : ui.primaryButton}
      onClick={() => void signIn()}
    >
      {label}
    </button>
  );
}

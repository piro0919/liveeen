'use client';

import { signIn } from '@/lib/auth-client';
import { ui } from '@/lib/ui';

type Props = {
  label?: string;
  /** header は上の帯の形（YouTube の右上の「ログイン」）。ほかは画面の中の主な操作の形 */
  variant?: 'header' | 'body';
};

export function SignInButton({ label = 'Google でログイン', variant = 'body' }: Props) {
  return (
    <button
      type="button"
      className={variant === 'header' ? ui.signInButton : ui.primaryButton}
      onClick={() => void signIn()}
    >
      {variant === 'header' && (
        // 人の印。YouTube の「ログイン」と同じ形
        <svg aria-hidden viewBox="0 0 24 24" className="size-6 fill-current">
          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 1a9 9 0 0 1 6.73 14.97C17.24 16.12 14.8 15 12 15s-5.24 1.12-6.73 2.97A9 9 0 0 1 12 3Zm0 3a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm0 1a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm0 9c2.5 0 4.67 1 6 2.67A8.96 8.96 0 0 1 12 21a8.96 8.96 0 0 1-6-2.33C7.33 17 9.5 16 12 16Z" />
        </svg>
      )}
      {label}
    </button>
  );
}

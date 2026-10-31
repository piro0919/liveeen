'use client';

import { useTranslations } from 'next-intl';
import { signIn } from '@/lib/auth-client';
import { ui } from '@/lib/ui';

type Props = {
  /** header は上の帯の右の形（文言は短く「ログイン」）。ほかは画面の中の主な操作の形 */
  variant?: 'header' | 'body';
};

export function SignInButton({ variant = 'body' }: Props) {
  const t = useTranslations('signIn');
  return (
    <button
      type="button"
      className={variant === 'header' ? ui.signInButton : ui.primaryButton}
      onClick={() => void signIn()}
    >
      {variant === 'header' ? t('header') : t('body')}
    </button>
  );
}

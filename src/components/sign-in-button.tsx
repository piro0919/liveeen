'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { signIn } from '@/lib/auth-client';
import { ui } from '@/lib/ui';

type Props = {
  /** header は上の帯の右の形（文言は短く「ログイン」）。ほかは画面の中の主な操作の形 */
  variant?: 'header' | 'body';
};

/**
 * Google でログインする。画面の中のボタンには、規約とポリシーへの同意の一文を添える（shodolog・spatto と同じ）。
 * 18歳以上の申告や性的な内容の禁止は規約に頼っているので、入口で読める所に置く。
 * 上の帯のボタンは狭いので添えない。リンクの語は途中で折らない
 */
export function SignInButton({ variant = 'body' }: Props) {
  const t = useTranslations('signIn');
  if (variant === 'header') {
    return (
      <button type="button" className={ui.signInButton} onClick={() => void signIn()}>
        {t('header')}
      </button>
    );
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" className={ui.primaryButton} onClick={() => void signIn()}>
        {t('body')}
      </button>
      <p className="text-xs text-balance text-muted [word-break:auto-phrase]">
        {t.rich('consent', {
          terms: (chunks) => (
            <Link href="/terms" className={`whitespace-nowrap ${ui.link}`}>
              {chunks}
            </Link>
          ),
          privacy: (chunks) => (
            <Link href="/privacy" className={`whitespace-nowrap ${ui.link}`}>
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}

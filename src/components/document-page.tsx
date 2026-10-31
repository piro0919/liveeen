import type { ReactNode } from 'react';
import { ui } from '@/lib/ui';

/** 運営者の名前と問い合わせ先。利用規約とプライバシーポリシーに出す（本人が 2026-10-31 に選んだ） */
export const OPERATOR = 'kk-web';
export const CONTACT_EMAIL = 'kk.web.kawamura@gmail.com';

/** 利用規約とプライバシーポリシーの枠。見出し・定めた日・条を並べる */
export function DocumentPage({
  title,
  enactedOn,
  children,
}: {
  title: string;
  enactedOn: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-1">
        <h1 className={ui.heading}>{title}</h1>
        <p className={ui.note}>{enactedOn} 制定</p>
      </div>
      {children}
    </main>
  );
}

/** 1つの条 */
export function Article({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 text-sm leading-relaxed">
      <h2 className={ui.subheading}>{title}</h2>
      {children}
    </section>
  );
}

/** 条の中の箇条書き */
export function Items({ children }: { children: ReactNode }) {
  return <ul className="flex list-disc flex-col gap-1 pl-5">{children}</ul>;
}

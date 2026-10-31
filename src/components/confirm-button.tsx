'use client';

import { useTransition } from 'react';
import { ui } from '@/lib/ui';

type Props = {
  label: string;
  /** 押したときに出す確認。取り消せない操作に使う */
  confirm: string;
  action: () => Promise<void>;
};

/** 確かめてから、サーバーの操作を走らせるボタン（管理画面） */
export function ConfirmButton({ label, confirm, action }: Props) {
  const [running, startTransition] = useTransition();
  return (
    <button
      type="button"
      className={ui.tonalButton}
      disabled={running}
      onClick={() => {
        if (window.confirm(confirm)) startTransition(action);
      }}
    >
      {label}
    </button>
  );
}

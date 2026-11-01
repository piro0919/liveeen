'use client';

import { useEffect, useRef } from 'react';
import { ui } from '@/lib/ui';

type Props = {
  /** 読み上げの見出し */
  label: string;
  onClose: () => void;
  children: React.ReactNode;
};

/**
 * 下から開く操作の一覧。手本は YouTube の「その他」と Twitch のコメントの名前を押したときのシート。
 * 開いている間だけ置く。ブラウザの dialog なので、Esc と、裏を触れなくすることは任せられる。外を押しても閉じる
 */
export function ActionSheet({ label, onClose, children }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-label={label}
      className={ui.sheet}
      onClose={onClose}
      // 中身は内側の div が覆うので、dialog そのものに当たるのは外の暗い所を押したときだけ
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <div className="flex flex-col p-2">{children}</div>
    </dialog>
  );
}

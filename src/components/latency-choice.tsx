'use client';

import { useOptimistic, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { setLatencyModeAction } from '@/app/broadcast/actions';
import type { LatencyMode } from '@/lib/latency';
import { ui } from '@/lib/ui';

/** 並びは画面に出す順。文言は messages/ja.json の latency */
const MODES: LatencyMode[] = ['hls', 'low'];

/** 遅延の選び方。選んだその場で保存する。見ている人には、次につなぎ直したときから効く */
export function LatencyChoice({ mode }: { mode: LatencyMode }) {
  const t = useTranslations('latency');
  const [saving, startTransition] = useTransition();
  // 保存が終わるのを待たずに、押したほうへ印を動かす
  const [shown, setShown] = useOptimistic(mode);
  return (
    <fieldset className="flex flex-col gap-1" disabled={saving}>
      <legend className={`mb-1 ${ui.subheading}`}>{t('legend')}</legend>
      {MODES.map((option) => (
        <label key={option} className="flex items-center gap-2">
          <input
            type="radio"
            className={ui.check}
            name="latency"
            value={option}
            checked={shown === option}
            onChange={() =>
              startTransition(async () => {
                setShown(option);
                await setLatencyModeAction(option);
              })
            }
          />
          {t(option)}
        </label>
      ))}
    </fieldset>
  );
}

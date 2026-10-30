'use client';

import { useOptimistic, useTransition } from 'react';
import { setLatencyModeAction } from '@/app/broadcast/actions';
import type { LatencyMode } from '@/lib/latency';

const OPTIONS: { mode: LatencyMode; label: string }[] = [
  { mode: 'hls', label: '遅れるが軽い（HLS）' },
  { mode: 'low', label: '低遅延（WebRTC）' },
];

/** 遅延の選び方。選んだその場で保存する。見ている人には、次につなぎ直したときから効く */
export function LatencyChoice({ mode }: { mode: LatencyMode }) {
  const [saving, startTransition] = useTransition();
  // 保存が終わるのを待たずに、押したほうへ印を動かす
  const [shown, setShown] = useOptimistic(mode);
  return (
    <fieldset className="flex flex-col gap-1" disabled={saving}>
      <legend className="font-bold">遅延</legend>
      {OPTIONS.map((option) => (
        <label key={option.mode} className="flex items-center gap-2">
          <input
            type="radio"
            name="latency"
            value={option.mode}
            checked={shown === option.mode}
            onChange={() =>
              startTransition(async () => {
                setShown(option.mode);
                await setLatencyModeAction(option.mode);
              })
            }
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}

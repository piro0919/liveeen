'use client';

import { useTranslations } from 'next-intl';
import { BGM_TRACKS } from '@/lib/bgm';
import { ui } from '@/lib/ui';

type Props = {
  /** 流れている曲の番号。止まっていれば null */
  playing: number | null;
  volume: number;
  onPick: (index: number) => void;
  onVolume: (volume: number) => void;
  /** 配信中の画面に重ねて出す */
  overlay?: boolean;
};

/** BGM の一覧と音量。曲を押すと流れ、流れている曲をもう一度押すと止まる */
export function BgmPicker({ playing, volume, onPick, onVolume, overlay = false }: Props) {
  const t = useTranslations('bgm');
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <label className="flex items-center gap-3 text-sm whitespace-nowrap">
        {t('volume')}
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          className={ui.range}
          onChange={(event) => onVolume(Number(event.target.value))}
        />
      </label>
      <ul className={`flex max-h-64 min-h-0 flex-col overflow-y-auto ${overlay ? '' : '-mx-3'}`}>
        {BGM_TRACKS.map((track, index) => {
          const current = playing === index;
          const style = overlay
            ? current
              ? ui.overlayBgmTrackPlaying
              : ui.overlayBgmTrack
            : current
              ? ui.bgmTrackPlaying
              : ui.bgmTrack;
          return (
            <li key={track.id}>
              <button
                type="button"
                aria-pressed={current}
                className={style}
                onClick={() => onPick(index)}
              >
                <span className="truncate">{track.title}</span>
                {current && <span className="shrink-0 text-xs">{t('playing')}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

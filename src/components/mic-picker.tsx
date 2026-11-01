import { useTranslations } from 'next-intl';
import type { Microphone } from '@/lib/microphone';
import { ui } from '@/lib/ui';

type Props = {
  microphones: readonly Microphone[];
  /** 選んでいるマイク。null は既定 */
  value: string | null;
  disabled: boolean;
  onChange: (deviceId: string | null) => void;
  /** 配信中の画面の映像に重ねて出す */
  overlay?: boolean;
};

/** マイクを選ぶ。選んだマイクが一覧に無ければ（抜いたなど）、既定を選んでいる形で出す */
export function MicPicker({ microphones, value, disabled, onChange, overlay = false }: Props) {
  const t = useTranslations('broadcast.publisher');
  const known = microphones.some((microphone) => microphone.deviceId === value);
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm">{t('microphone')}</span>
      <select
        className={overlay ? ui.overlayInput : ui.input}
        value={known && value ? value : ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <option value="">{t('defaultMicrophone')}</option>
        {microphones.map((microphone) => (
          <option key={microphone.deviceId} value={microphone.deviceId}>
            {microphone.label}
          </option>
        ))}
      </select>
    </label>
  );
}

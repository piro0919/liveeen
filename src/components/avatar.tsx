/** コメントの数だけ呼ばれるので、1つを使い回す */
const graphemes = new Intl.Segmenter('ja', { granularity: 'grapheme' });

/**
 * 名前の最初の1文字（絵文字の並びも1文字に数える）。英字は大文字にするが、
 * 大文字にすると2文字になるもの（ß → SS）はそのまま
 */
export function initialOf(name: string): string {
  const first = graphemes.segment(name)[Symbol.iterator]().next();
  if (first.done) return '';
  const upper = first.value.segment.toUpperCase();
  return [...graphemes.segment(upper)].length === 1 ? upper : first.value.segment;
}

const SIZES = {
  xs: 'size-6 text-xs',
  sm: 'size-8 text-sm',
  md: 'size-9 text-base',
  lg: 'size-10 text-lg',
} as const;

/**
 * 人の丸い印。顔写真は持たないので、名前の最初の1文字を出す（Google の写真は本名や顔が出るので使わない）
 */
export function Avatar({ name, size = 'md' }: { name: string; size?: keyof typeof SIZES }) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-surface-hover font-bold ${SIZES[size]}`}
    >
      {initialOf(name)}
    </span>
  );
}

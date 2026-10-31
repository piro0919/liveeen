'use client';

import { useEffect, useRef, useState } from 'react';

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
 * 人の丸い印。既定は Google の写真、本人がアップロードした画像に差し替えられる（src/lib/avatar.ts）。
 * src が無いか、画像が読めなければ名前の最初の1文字を出す
 */
export function Avatar({
  name,
  src,
  size = 'md',
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const image = useRef<HTMLImageElement>(null);
  // 画面が動き出す前に読み込みが失敗していると onError を受け取れないので、動き出したときにも見る
  useEffect(() => {
    if (src && image.current?.complete && image.current.naturalWidth === 0) setFailedSrc(src);
  }, [src]);
  const className = `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-hover font-bold ${SIZES[size]}`;
  if (src && failedSrc !== src) {
    return (
      <span aria-hidden className={className}>
        {/* Google の写真とアップロードした画像。どちらも小さく、Next.js の画像の最適化を通す先ではない */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={image}
          src={src}
          alt=""
          // Google の写真は、ほかのサイトから読んだと分かると断られることがある
          referrerPolicy="no-referrer"
          className="size-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      </span>
    );
  }
  return (
    <span aria-hidden className={className}>
      {initialOf(name)}
    </span>
  );
}

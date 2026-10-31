'use client';

import { useEffect, useRef, useState } from 'react';
import { initialOf } from './avatar';

type Props = { name: string; src: string };

/**
 * トップの札の画像。配信が始まってすぐは撮れていない（relay/thumbnails.ts）ので、
 * 画像が無ければ名前の1文字を大きく出す
 */
export function LiveThumbnail({ name, src }: Props) {
  const [failed, setFailed] = useState(false);
  const image = useRef<HTMLImageElement>(null);
  // 画面が動き出す前に読み込みが失敗していると onError を受け取れないので、動き出したときにも見る
  useEffect(() => {
    if (image.current?.complete && image.current.naturalWidth === 0) setFailed(true);
  }, []);
  if (failed) {
    return (
      <span aria-hidden className="text-5xl font-bold text-muted">
        {initialOf(name)}
      </span>
    );
  }
  return (
    // 画像は中継が返すもので、Next.js の画像の最適化を通す先ではない
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={image}
      src={src}
      alt=""
      className="absolute inset-0 size-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

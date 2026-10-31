import type { MetadataRoute } from 'next';

/**
 * ホーム画面に追加したときの名前とアイコン（onigiri と同じ形）。iPhone は、ホーム画面に追加して開いたときだけ
 * Web Push を受け取れるので、フォローした人の配信の知らせのために置く。
 * アイコンは design/apple-icon.svg を 192 と 512 に描き直したもの。
 * 地の色と帯の色は書かない。色の値は部品に書かない決まり（test/design-rules.test.ts）で、地の色は端末の明暗で変わるため
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Liveeen',
    short_name: 'Liveeen',
    start_url: '/',
    display: 'standalone',
    icons: [
      { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}

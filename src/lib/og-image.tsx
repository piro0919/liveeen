import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

/**
 * 配信者の住所を SNS に貼ったときの画像（onigiri の og-image.tsx と同じ作り）。
 * 左上に印と Liveeen、真ん中にタイトル（無ければ名前）、その下に名前と @ハンドル。地は暗い方の色
 */
export const OG_SIZE = { width: 1200, height: 630 };

/** Google が遅いときに画像ごと時間切れにしない。この時間で諦める */
const FONT_TIMEOUT_MS = 3000;
/** 描き手が受け取る字の太さ */
type FontWeight = NonNullable<
  NonNullable<ConstructorParameters<typeof ImageResponse>[1]>['fonts']
>[number]['weight'];
/** 字の太さ（太字） */
const BOLD: FontWeight = 700;
/**
 * 見出しの字の大きさ。タイトルは 100 字まで付けられるので、長いほど小さくする。3行を超える分は描き手が切る。
 * 上から順に、その字数までならその大きさ
 */
const HEADING_SIZES = [
  { upTo: 12, size: 76 },
  { upTo: 30, size: 60 },
] as const;
const HEADING_SIZE_MIN = 48;

/** 色の名前 */
type Palette = { background: string; foreground: string; muted: string; accentFill: string };

/**
 * 暗い方の色を globals.css から読む。色の値は globals.css にだけ書く決まり（test/design-rules.test.ts）で、
 * 画像の描き手は CSS の変数を読めないため
 */
export function darkPalette(css: string): Palette {
  const dark = css.match(/prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([^}]*)\}/)?.[1] ?? '';
  const pick = (name: string) => {
    const value = dark.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]?.trim();
    if (!value) throw new Error(`globals.css の暗い方に --${name} がありません`);
    return value;
  };
  return {
    background: pick('background'),
    foreground: pick('foreground'),
    muted: pick('muted'),
    accentFill: pick('accent-fill'),
  };
}

/**
 * 日本語の字を、使う字だけ Google Fonts から取る（onigiri と同じ）。書体を丸ごと抱えると数 MB になるため。
 * 取れなければ null（その字の無い画像になる）
 */
async function loadFont(text: string): Promise<ArrayBuffer | null> {
  const signal = AbortSignal.timeout(FONT_TIMEOUT_MS);
  try {
    const css = await (
      await fetch(
        `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@${BOLD}&text=${encodeURIComponent(text)}`,
        { signal, cache: 'force-cache' },
      )
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    return await (await fetch(url, { signal, cache: 'force-cache' })).arrayBuffer();
  } catch {
    return null;
  }
}

export async function renderOgImage(channel: {
  title: string | null;
  name: string;
  handle: string | null;
}): Promise<ImageResponse> {
  const heading = channel.title ?? channel.name;
  const sub = [channel.title ? channel.name : null, channel.handle ? `@${channel.handle}` : null]
    .filter(Boolean)
    .join('  ');
  const [css, logo, jp] = await Promise.all([
    // 道は文字のまま書く。組み立てると、ビルドが関数にリポジトリ全体を詰める
    readFile(join(process.cwd(), 'src/app/globals.css')),
    readFile(join(process.cwd(), 'design/unbounded-bold-logo.ttf')),
    loadFont(heading + sub),
  ]);
  const color = darkPalette(css.toString());
  const size = HEADING_SIZES.find(({ upTo }) => heading.length <= upTo)?.size ?? HEADING_SIZE_MIN;

  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        padding: '64px 80px',
        background: color.background,
        color: color.foreground,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <svg viewBox="-380 -300 860 600" width={80} height={56}>
          <g transform="rotate(-12) translate(-50 0)">
            <path
              d="M0 -210 L430 0 L0 210 L80 0 Z"
              fill={color.accentFill}
              stroke={color.accentFill}
              strokeWidth="56"
              strokeLinejoin="round"
            />
            <path
              d="M-300 -50 H-110 M-330 60 H-100"
              stroke={color.accentFill}
              strokeWidth="56"
              strokeLinecap="round"
            />
          </g>
        </svg>
        <span style={{ fontFamily: 'Unbounded', fontSize: 44 }}>Liveeen</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <span
          style={{
            fontFamily: 'Noto Sans JP',
            fontSize: size,
            lineHeight: 1.3,
            lineClamp: 3,
            display: 'block',
          }}
        >
          {heading}
        </span>
        {sub && (
          <span style={{ fontFamily: 'Noto Sans JP', fontSize: 34, color: color.muted }}>
            {sub}
          </span>
        )}
      </div>
    </div>,
    {
      ...OG_SIZE,
      fonts: [
        { name: 'Unbounded', data: logo, weight: BOLD, style: 'normal' },
        ...(jp ? [{ name: 'Noto Sans JP', data: jp, weight: BOLD }] : []),
      ],
    },
  );
}

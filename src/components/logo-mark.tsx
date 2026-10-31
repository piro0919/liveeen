/**
 * Liveeen の印。再生の三角が紙飛行機のように飛ぶ（名前の「ブーン」）。
 * ファビコンと OG 画像と同じ形（design/README.md）。色は使う側の文字の色
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="-380 -300 860 600" className={className}>
      <g transform="rotate(-12) translate(-50 0)">
        <path
          d="M0 -210 L430 0 L0 210 L80 0 Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="56"
          strokeLinejoin="round"
        />
        <path
          d="M-300 -50 H-110 M-330 60 H-100"
          stroke="currentColor"
          strokeWidth="56"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

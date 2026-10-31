import { ScreenError } from './screen-error';
import { stillImageColors } from './ui';

/** 画像の配信の大きさ。見る画面の枠（16:9）に合わせ、720p の上限（CLAUDE.md）に収める */
const WIDTH = 1280;
const HEIGHT = 720;
/**
 * 1秒に描き直す回数。絵は変わらないが、描かないと映像のコマが出ない。
 * 見る人がつないだとき、配信サーバーはキーフレームを頼む。コマが出ないと応えられず、映るまで待たせる
 */
const FRAMES_PER_SECOND = 5;
const NAME_FONT = 'bold 64px system-ui, sans-serif';
/** 名前の左右に空ける幅。長い名前は、この内側に縮めて収める */
const NAME_MARGIN = 80;

export type StillImage = { stream: MediaStream; stop: () => void };

/**
 * 1枚の画像を映像にする（カメラを使わない配信）。画像が無ければ、黒地に配信者の名前を出す。
 * 画像は枠に収まるよう縮め、余りは黒で埋める
 */
export function stillImageStream(image: HTMLImageElement | null, name: string): StillImage {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new ScreenError('noCanvas');
  const draw = () => {
    context.fillStyle = stillImageColors.background;
    context.fillRect(0, 0, WIDTH, HEIGHT);
    if (image) {
      const scale = Math.min(WIDTH / image.naturalWidth, HEIGHT / image.naturalHeight);
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      context.drawImage(image, (WIDTH - width) / 2, (HEIGHT - height) / 2, width, height);
      return;
    }
    context.fillStyle = stillImageColors.text;
    context.font = NAME_FONT;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(name, WIDTH / 2, HEIGHT / 2, WIDTH - NAME_MARGIN * 2);
  };
  draw();
  const stream = canvas.captureStream(FRAMES_PER_SECOND);
  const timer = setInterval(draw, 1000 / FRAMES_PER_SECOND);
  return {
    stream,
    stop: () => {
      clearInterval(timer);
      stream.getTracks().forEach((track) => track.stop());
    },
  };
}

/** 選んだ画像のファイルを読む。画像として開けなければ投げる */
export function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  return new Promise((resolve, reject) => {
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ScreenError('imageUnreadable'));
    };
    image.src = url;
  });
}

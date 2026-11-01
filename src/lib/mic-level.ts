/** 測る間隔 */
const INTERVAL_MS = 100;
/** 話し声の大きさでも目盛りが振れるよう、測った値を広げる */
const GAIN = 4;

/**
 * マイクの音の大きさを 0〜1 で知らせ続ける（練習の画面の目盛り）。音は鳴らさない。止める関数を返す。
 * 音が読めないブラウザでは何も知らせない
 */
export function watchMicLevel(
  track: MediaStreamTrack,
  onLevel: (level: number) => void,
): () => void {
  const context = new AudioContext();
  void context.resume().catch(() => undefined);
  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;
  const source = context.createMediaStreamSource(new MediaStream([track]));
  source.connect(analyser);
  const samples = new Float32Array(analyser.fftSize);
  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(samples);
    const power = samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length;
    onLevel(Math.min(1, Math.sqrt(power) * GAIN));
  }, INTERVAL_MS);
  return () => {
    clearInterval(timer);
    source.disconnect();
    void context.close().catch(() => undefined);
  };
}

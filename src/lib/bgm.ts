/**
 * ブラウザの配信に混ぜる BGM。曲は Tuzuri と同じ24曲で、本人の話では自由に使ってよいフリーの曲（2026-10-31）。
 * 曲は配信サーバーの Caddy が `/bgm/<id>.m4a` で配る（deploy/Caddyfile）。リポジトリには入れない
 */
export const BGM_TRACKS = [
  { id: '40ece8d2-40fb-4cf4-aefc-3fd45741f52a', title: 'J4U – Alcohol Girl' },
  { id: '51a1c208-c21a-4607-80b4-de39cd5b145a', title: 'J4U – Liquid Bed 11PM' },
  { id: '655078ff-b909-4b1c-ad8f-6033fed2bd68', title: 'J4U – Shamefull Days' },
  { id: 'd0739092-ec82-494a-9093-9ad28d864792', title: 'J4U – Strange Noob' },
  { id: '4fad9c12-2a63-48dd-a5a5-6db160a49b59', title: 'J4U – UnTilt' },
  { id: 'f1d9d876-ce6d-4c91-a986-b2bd4e6494af', title: 'Showa – Chillout Syndrome' },
  { id: '2997a836-68dd-4250-a014-a76fb7859849', title: 'Showa – Dark Cake' },
  { id: 'd08e4ca3-9e75-4259-8172-fa67701bb530', title: 'Showa – Poem Mom Moon' },
  { id: '26c39cb7-8ca1-416a-a374-a74a2f7d4e30', title: 'Showa – Rosso' },
  { id: '41b56539-553b-43e0-b3b2-cbc85d8fa1c8', title: 'Showa – Singing Wave' },
  { id: '3f518c71-c8b2-450f-82b9-2f9380cef82f', title: 'たのしい反省会' },
  { id: '0a0a6cbb-0439-4e8b-8b28-566a385f68cd', title: 'サンセットバンケット' },
  { id: 'd6c07da3-8ea4-46bc-acca-07a0b762d9d3', title: 'ソメイヨシノ' },
  { id: '4b612f49-9888-4ad5-830e-4dc68c6a0aec', title: 'ロンリークライマー' },
  { id: '08c707ab-9555-4b3c-90d1-3c3f698b98f7', title: '何年経っても' },
  { id: 'd1b2f40d-0ac6-4cd8-91dc-fc8d79f4b778', title: '周遊エディフィス' },
  { id: 'd03e04b6-744c-4217-b72b-d039b11373ac', title: '想い出の魔法' },
  { id: 'd2ccb944-d0e2-476b-adad-109bf6a76bea', title: '摩天楼を見下ろして' },
  { id: '3bd20061-2ca0-4ca8-97b0-711cbcbf11fd', title: '日曜のおわりに' },
  { id: '355e658e-f017-4431-8624-0573d4562e70', title: '疲れたパリピ' },
  { id: '604a3297-07a5-44c3-895b-cdd7465dc3d1', title: '眠れる世界樹' },
  { id: 'eb671452-97a7-4ada-a205-31abafdf5810', title: '窓際の席で' },
  { id: 'ea729c40-1d9c-406d-b970-0ca4bbaac4d6', title: '観劇のお誘い' },
  { id: 'f638bb39-531c-4125-a7dc-17c77ff5d7c4', title: '遠くの景色' },
] as const;

/** 初めの音量。声より小さめにする */
export const DEFAULT_BGM_VOLUME = 0.3;

/** 曲が終わったら、一覧の次の曲へ進む。最後の曲の次は最初の曲 */
export function nextTrackIndex(index: number): number {
  return (index + 1) % BGM_TRACKS.length;
}

/** 曲の住所。base は配信サーバーの `/bgm` まで */
export function bgmTrackUrl(base: string, id: string): string {
  return `${base.replace(/\/$/, '')}/${encodeURIComponent(id)}.m4a`;
}

export type BgmMixer = {
  play: (url: string) => Promise<void>;
  stop: () => void;
  setVolume: (volume: number) => void;
  /** 声に曲を重ねた音を返す。配信にはこちらを送る */
  mix: (voice: MediaStreamTrack) => MediaStreamTrack;
  /** 声を外す（配信を終えたとき） */
  unmix: () => void;
  close: () => void;
};

/**
 * 声と曲を Web Audio で1本の音にする。曲は配信者の手元でも鳴らし、何が流れているかを聞けるようにする。
 * iPhone の Safari は、押した操作の中で作らないと音が鳴らないので、押したときに作る。
 * 曲は別の住所（配信サーバー）から読むので crossOrigin を付ける。付けないと Web Audio には無音で届く
 */
export function createBgmMixer(onEnded: () => void): BgmMixer {
  const context = new AudioContext();
  const audio = new Audio();
  audio.crossOrigin = 'anonymous';
  audio.addEventListener('ended', onEnded);
  const music = context.createMediaElementSource(audio);
  const volume = context.createGain();
  volume.gain.value = DEFAULT_BGM_VOLUME;
  const output = context.createMediaStreamDestination();
  music.connect(volume);
  volume.connect(context.destination);
  volume.connect(output);
  let voice: MediaStreamAudioSourceNode | null = null;

  const stop = () => {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  };

  return {
    play: async (url) => {
      audio.src = url;
      const playing = audio.play();
      await context.resume();
      await playing;
    },
    stop,
    setVolume: (value) => {
      volume.gain.value = value;
    },
    mix: (track) => {
      voice?.disconnect();
      voice = context.createMediaStreamSource(new MediaStream([track]));
      voice.connect(output);
      const [mixed] = output.stream.getAudioTracks();
      if (!mixed) throw new Error('音を混ぜられませんでした');
      return mixed;
    },
    unmix: () => {
      voice?.disconnect();
      voice = null;
    },
    close: () => {
      stop();
      voice?.disconnect();
      void context.close();
    },
  };
}

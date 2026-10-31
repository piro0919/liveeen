import { notFound } from 'next/navigation';
import { channelByHandle, channelById } from '@/lib/channels';
import { handleOfSegment } from '@/lib/handle';
import { OG_SIZE, renderOgImage } from '@/lib/og-image';

// 配信者の住所を SNS に貼ったときの画像。タイトル（無ければ名前）と、名前と @ハンドルを入れる
export const alt = 'Liveeen';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image({ params }: PageProps<'/[channelId]'>) {
  const segment = (await params).channelId;
  const handle = handleOfSegment(segment);
  const channel = handle ? await channelByHandle(handle) : await channelById(segment);
  if (!channel) notFound();
  return renderOgImage({
    title: channel.title,
    name: channel.displayName ?? channel.id,
    handle: channel.handle,
  });
}

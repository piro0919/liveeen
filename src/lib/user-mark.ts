import 'server-only';
import { cache } from 'react';
import { avatarOf } from './avatars';
import { displayNameOf } from './profiles';
import { currentUserId } from './session';

/**
 * ログインしている人の名前と印の画像。していなければ null。
 * 上の帯と下のタブの両方が聞くので、1回の表示では1度だけ引く
 */
export const currentUserMark = cache(
  async (): Promise<{ name: string; src: string | null } | null> => {
    const userId = await currentUserId();
    if (!userId) return null;
    const [name, avatar] = await Promise.all([displayNameOf(userId), avatarOf(userId)]);
    return { name: name ?? '?', src: avatar.src };
  },
);

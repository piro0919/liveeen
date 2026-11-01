import { currentUserMark } from '@/lib/user-mark';
import { BottomNav } from './bottom-nav';

/** 下のタブに、ログインしている人の印を渡す */
export async function SiteBottomNav() {
  return <BottomNav mark={await currentUserMark()} />;
}

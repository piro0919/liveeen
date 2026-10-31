/** 通報されたもの。配信か、コメントか */
export type ReportedKind = 'stream' | 'comment';

const KIND_NAMES: Record<ReportedKind, string> = { stream: '配信', comment: 'コメント' };

/**
 * 運営への知らせの件名と本文（shodolog・onigiri と同じ形）。運営は日本語で読む。
 * 誰が通報したかと、通報されたものの中身は入れない（管理画面で見る）
 */
export function reportNotice(kind: ReportedKind, reasonName: string | null, adminUrl: string) {
  const what = KIND_NAMES[kind];
  const why = reasonName ? `「${reasonName}」で` : '';
  return {
    subject: `通報: ${what}${reasonName ? `（${reasonName}）` : ''}`,
    text: [`${what}が${why}通報されました。`, '管理画面で確かめてください。', adminUrl].join('\n'),
  };
}

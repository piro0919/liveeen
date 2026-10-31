import { describe, expect, it } from 'vitest';
import { adminEmailList } from '@/lib/admin-emails';
import { reportNotice } from '@/lib/report-notice-text';

describe('reportNotice', () => {
  it('何が、どの理由で通報されたかと、管理画面の住所だけを書く', () => {
    expect(reportNotice('stream', '性的な内容', 'https://liveeen.kkweb.io/admin')).toEqual({
      subject: '通報: 配信（性的な内容）',
      text: '配信が「性的な内容」で通報されました。\n管理画面で確かめてください。\nhttps://liveeen.kkweb.io/admin',
    });
  });

  it('理由の無いコメントの通報は、理由を書かない', () => {
    expect(reportNotice('comment', null, 'https://x/admin')).toEqual({
      subject: '通報: コメント',
      text: 'コメントが通報されました。\n管理画面で確かめてください。\nhttps://x/admin',
    });
  });
});

describe('adminEmailList', () => {
  it('カンマで分け、空の項目と重複を除く', () => {
    expect(adminEmailList(' a@example.com, ,b@example.com,a@example.com ')).toEqual([
      'a@example.com',
      'b@example.com',
    ]);
  });

  it('無ければ空', () => {
    expect(adminEmailList(undefined)).toEqual([]);
  });
});

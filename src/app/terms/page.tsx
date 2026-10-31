import type { Metadata } from 'next';
import Link from 'next/link';
import { Article, CONTACT_EMAIL, DocumentPage, Items, OPERATOR } from '@/components/document-page';
import { DELIST_THRESHOLD } from '@/lib/delist';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: '利用規約 | Liveeen' };

/** 利用規約。決まり（CLAUDE.md の Agreed と Moderation）を利用者向けに書いたもの。決まりを変えたら、ここも直す */
export default function TermsPage() {
  return (
    <DocumentPage title="利用規約" enactedOn="2026年10月31日">
      <p className="text-sm leading-relaxed">
        この規約は、{OPERATOR}（以下「運営者」）が提供する
        Liveeen（以下「このサービス」）の使い方の決まりです。このサービスを使った人は、この規約に同意したものとします。
      </p>

      <Article title="1. 見る人と配信する人">
        <Items>
          <li>見るだけなら、ログインは要りません</li>
          <li>
            配信できるのは18歳以上の人だけです。配信を始める前に、18歳以上であることを申告していただきます
          </li>
          <li>
            コメントにはログインが要ります。配信者がゲストのコメントを許した配信では、ログインせずに書けます
          </li>
        </Items>
      </Article>

      <Article title="2. してはいけないこと">
        <Items>
          <li>性的な内容の配信とコメント（成人どうしでも禁止です）</li>
          <li>暴力や危険な行為の配信</li>
          <li>嫌がらせ、差別、脅し</li>
          <li>他人の住所や連絡先など、個人を特定できる情報をさらすこと</li>
          <li>他人の著作権、肖像権、プライバシーを侵すこと</li>
          <li>他人になりすますこと</li>
          <li>法令に反すること</li>
          <li>このサービスの動きを妨げること</li>
        </Items>
      </Article>

      <Article title="3. 運営者の対応">
        <Items>
          <li>
            ログインした{DELIST_THRESHOLD}
            人から通報された配信は、トップの一覧から自動で外れます。配信の住所からは見られます
          </li>
          <li>
            運営者は、規約に反すると判断した配信を止め、配信者がこれ以上配信できないようにすることがあります。前もってお知らせはしません
          </li>
          <li>配信者は、自分の配信でコメントした人をブロックできます</li>
          <li>
            ログインした人はコメントを通報できます。運営者は、規約に反すると判断したコメントを、見ている人全員の画面から消すことがあります
          </li>
        </Items>
      </Article>

      <Article title="4. 視聴の上限">
        <p>
          このサービスは費用に月ごとの上限を設けています。その月の上限に達すると、月が変わるまで新しく見始めることはできません。見ている途中の人は切りません。
        </p>
      </Article>

      <Article title="5. 録画">
        <p>配信は録画しません。配信が終わると、あとから見ることはできません。</p>
      </Article>

      <Article title="6. サービスの変更と終了">
        <p>
          運営者は、前もってお知らせすることなく、このサービスの中身を変えたり、止めたり、終えたりすることがあります。
        </p>
      </Article>

      <Article title="7. 責任">
        <Items>
          <li>
            このサービスは今ある形のまま提供し、止まらないこと、誤りがないこと、目的に合うことを保証しません
          </li>
          <li>配信とコメントの中身の責任は、それを出した利用者が負います</li>
          <li>
            運営者は、運営者の故意または重大な過失による場合を除き、このサービスによって利用者に生じた損害の責任を負いません
          </li>
        </Items>
      </Article>

      <Article title="8. 個人情報">
        <p>
          利用者の情報は
          <Link href="/privacy" className={ui.link}>
            プライバシーポリシー
          </Link>
          のとおりに扱います。
        </p>
      </Article>

      <Article title="9. 規約の変更">
        <p>
          この規約を変えるときは、このページを書き換えてお知らせします。変えた後にこのサービスを使った人は、変えた規約に同意したものとします。
        </p>
      </Article>

      <Article title="10. 準拠法">
        <p>この規約は日本の法律に従って解釈します。</p>
      </Article>

      <Article title="11. 問い合わせ先">
        <p>
          {OPERATOR}：
          <a href={`mailto:${CONTACT_EMAIL}`} className={ui.link}>
            {CONTACT_EMAIL}
          </a>
        </p>
      </Article>
    </DocumentPage>
  );
}

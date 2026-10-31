import type { Metadata } from 'next';
import Link from 'next/link';
import { Article, CONTACT_EMAIL, DocumentPage, Items, OPERATOR } from '@/components/document-page';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'プライバシーポリシー | Liveeen' };

/**
 * プライバシーポリシー。書いてあることは、いま作ってあるものに合わせる（CLAUDE.md）。
 * 持つ情報や渡す先を変えたら、ここも直す
 */
export default function PrivacyPage() {
  return (
    <DocumentPage title="プライバシーポリシー" enactedOn="2026年10月31日">
      <p className="text-sm leading-relaxed">
        {OPERATOR}
        （以下「運営者」）は、Liveeen（以下「このサービス」）で扱う利用者の情報を、このページのとおりに扱います。
      </p>

      <Article title="1. 集める情報">
        <Items>
          <li>
            Google でログインしたとき：Google
            アカウントのメールアドレス、名前、プロフィール画像の住所。名前と画像はこのサービスの画面には出しません
          </li>
          <li>
            利用者が入れたもの：表示名、ハンドル、18歳以上であることの申告、配信の設定、フォロー、知らせ方の設定、通報とその理由、ブロックした相手
          </li>
          <li>ログインの記録：ログインしたときの IP アドレスとブラウザの種類</li>
          <li>
            動作の記録：サイトと配信サーバーに届いた通信の IP アドレスが、動作の記録に残ります
          </li>
          <li>ブラウザ通知を有効にしたとき：そのブラウザに通知を届けるための宛先</li>
          <li>
            コメントでブロックされた人の IP
            アドレス：元に戻せない形に変えて保存し、配信者を含め誰にも見せません
          </li>
          <li>
            ゲストとしてコメントするときの名前：利用者のブラウザにだけ保存し、運営者は保存しません
          </li>
        </Items>
      </Article>

      <Article title="2. 保存しないもの">
        <Items>
          <li>配信の映像と音声は録画しません</li>
          <li>
            トップの一覧に出す縮小画像は、配信中に1分ごとに撮り直して配信サーバーのメモリにだけ置き、配信が終わってから数分のうちに消します
          </li>
          <li>
            コメントは保存しません。あとから来た人に見せるため、配信ごとに直近の50件だけを配信サーバーのメモリに置きます
          </li>
        </Items>
      </Article>

      <Article title="3. 使い道">
        <Items>
          <li>ログインと、表示名・ハンドルの表示</li>
          <li>フォローした人が配信を始めたときの知らせ（一覧・ブラウザ通知・メール）</li>
          <li>荒らしや規約違反への対応（ブロック、通報、配信と配信者の停止）</li>
          <li>月の費用の上限を守るための、配信の転送量の把握</li>
        </Items>
      </Article>

      <Article title="4. 預ける先">
        <p>
          このサービスを動かすために、次の事業者に情報の保管や送信を任せています。海外の事業者を含みます。法令に基づく場合を除き、これ以外の第三者に提供しません。
        </p>
        <Items>
          <li>Google（ログイン）</li>
          <li>Vercel（サイトの配信）</li>
          <li>Neon（データベース。シンガポール）</li>
          <li>Akamai（配信サーバー。東京）</li>
          <li>Resend（メールの送信）</li>
          <li>ブラウザの通知の仕組みを持つ会社（Google、Apple、Mozilla など。通知を運ぶ）</li>
        </Items>
      </Article>

      <Article title="5. クッキーとアクセス解析">
        <p>
          ログインを保つためのクッキーだけを使います。広告やアクセス解析の仕組みは使っていません。
        </p>
      </Article>

      <Article title="6. 情報を消したいとき">
        <p>
          アカウントと、それに結びついた情報を消したいときは、下の問い合わせ先へ、ログインに使った
          Google アカウントのメールアドレスからご連絡ください。メールの知らせは
          <Link href="/settings" className={ui.link}>
            設定
          </Link>
          で、ブラウザ通知はそのブラウザの設定でいつでも止められます。
        </p>
      </Article>

      <Article title="7. 変更">
        <p>このポリシーを変えるときは、このページを書き換えてお知らせします。</p>
      </Article>

      <Article title="8. 問い合わせ先">
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

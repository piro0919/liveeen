import 'server-only';
import { checkBotId } from 'botid/server';

/**
 * ボットの呼び出しかどうか（Vercel BotID の Basic、onigiri・鯉魂と同じ）。見えない形の判定で、人には何も出さない。
 * onigiri の記録では Basic は無料で、有料の Deep Analysis は Vercel の画面で有効にしない限り動かない（使わない）。
 * 守る道は src/instrumentation-client.ts の protect と揃える（揃っていないと判定が失敗する）。
 *
 * BotID 側が落ちていたときは通す。ゲストのコメントは中継が1秒1件に抑え、配信者が IP で止められるので、
 * 判定が止まっても人を締め出さないほうを選ぶ。手元の開発ではいつも「人」と返る
 */
export async function isBot(): Promise<boolean> {
  try {
    return (await checkBotId()).isBot;
  } catch (error) {
    console.error('BotID の判定に失敗しました', error);
    return false;
  }
}

import { initBotId } from 'botid/client/core';

/**
 * ブラウザで Vercel BotID を起こす（src/lib/bot.ts）。Server Action は、呼んだページの道へ POST で届くので、
 * ボットを断りたい Action があるページを並べる。ここに無い道で checkBotId を呼ぶと判定が失敗する。
 * ゲストのコメントの札（commentTokenAction）は配信者の住所（/@ハンドル、ハンドルの無いチャンネルは /<id>）から呼ぶ。
 * 住所が決まった形でないので、すべてのページの POST に付ける
 */
initBotId({
  protect: [{ path: '/*', method: 'POST' }],
});

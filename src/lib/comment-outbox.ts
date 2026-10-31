import { normalizeComment } from './comment';

/** 中継へのつなぎ。送れるのは開いているときだけ */
type RelaySocket = { readyState: number; send: (data: string) => void };

/**
 * 見る画面から中継へ送るもの（src/components/comments.tsx）。
 * つなぎ直しの最中に押されたブロックは、次に札を持ってつながったときに送る。
 * 送ったコメントは、中継から返事が来るまで覚えておき、断られたか切れたら書く欄に戻せるようにする。
 * 中継は1つのつなぎに届いた順に、自分のコメントとして流すか断るかのどちらかを返す（relay/relay.ts）
 */
export class CommentOutbox {
  private blocks: string[] = [];
  private pending: string[] = [];

  /** 配信者のブロック。いま送れなければ、つながったときに送る */
  block(socket: RelaySocket | null, author: string): void {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ block: author }));
    else this.blocks.push(author);
  }

  /**
   * 札を持ってつながった。待たせていたブロックを送る。
   * 札の無いつなぎに送ると断られて消えるので、札のあるつなぎでだけ呼ぶ
   */
  opened(socket: RelaySocket): void {
    const blocks = this.blocks;
    this.blocks = [];
    for (const author of blocks) socket.send(JSON.stringify({ block: author }));
  }

  /** コメントを送る。つながっていなければ送らない。中継が黙って捨てる文（長すぎる）は送らずに知らせる */
  post(socket: RelaySocket | null, text: string): 'sent' | 'closed' | 'invalid' {
    const normalized = normalizeComment(text);
    if (normalized === null) return 'invalid';
    if (socket?.readyState !== WebSocket.OPEN) return 'closed';
    socket.send(JSON.stringify({ text }));
    this.pending.push(normalized);
    return 'sent';
  }

  /**
   * 自分のコメントが流れてきた。同じ文のものだけ返事が来たことにする。
   * 同じ人が別のタブで書いたものも「自分のコメント」として届くので、文で見分ける
   */
  accepted(text: string): void {
    const index = this.pending.indexOf(text);
    if (index !== -1) this.pending.splice(index, 1);
  }

  /** 中継に断られた。いちばん前に送った文を返す */
  refused(): string | null {
    return this.pending.shift() ?? null;
  }

  /** つなぎが切れた。返事の来ていない文のうち、いちばん前のものを返し、残りは忘れる */
  closed(): string | null {
    const text = this.pending[0] ?? null;
    this.pending = [];
    return text;
  }
}

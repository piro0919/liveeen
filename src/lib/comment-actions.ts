import type { Comment } from './comment';

type Viewer = {
  /** 自分のチャンネルか */
  own: boolean;
  moderator: boolean;
  /** 配信中の画面の上に重ねたコメントか */
  overlay: boolean;
  /** コメントを通報できる人か（ログインしていて、自分のチャンネルでない） */
  canReportComments: boolean;
};

export type CommentActions = {
  report: boolean;
  remove: boolean;
  block: boolean;
  appoint: boolean;
};

/**
 * 名前を押したときの一覧に出す操作。
 * 書いた人の札（author）は、配信者とモデレーターにだけ中継が付ける（relay/relay.ts）。
 * 配信者はどのコメントも消せる。モデレーターは自分のものと、ブロックできる相手のものだけ。
 * 配信中の画面は狭いので、モデレーターを選ぶのは見る画面と OBS の画面だけ
 */
export function commentActions(comment: Comment, viewer: Viewer): CommentActions {
  const hasAuthor = Boolean(comment.author);
  return {
    report: viewer.canReportComments && !comment.mine && Boolean(comment.proof),
    remove: viewer.own || (viewer.moderator && (Boolean(comment.mine) || hasAuthor)),
    block: hasAuthor,
    appoint: viewer.own && !viewer.overlay && hasAuthor && !comment.guest,
  };
}

/** 一覧に出すものが1つでもあるか。無ければ名前は押せない */
export function hasCommentActions(actions: CommentActions): boolean {
  return actions.report || actions.remove || actions.block || actions.appoint;
}

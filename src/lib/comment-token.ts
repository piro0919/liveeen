import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import type { Comment } from './comment';
import type { CommentSettings } from './comment-settings';

/**
 * コメントを書くための札の有効な長さ。札はコメントの中継につなぐときに一度だけ確かめられ、
 * つながっているあいだは切れない
 */
const TOKEN_TTL_MINUTES = 10;
const MS_PER_MINUTE = 60_000;
export const COMMENT_TOKEN_TTL_MS = TOKEN_TTL_MINUTES * MS_PER_MINUTE;

/**
 * 札に入れるもの。名前は札を作った時点のもの。
 * ipKey はブロックに使う IP の鍵（src/lib/ip-key.ts）で、分からなければ null。
 * owner はそのチャンネルの配信者で、コメントした人をブロックできる。
 * moderator は配信者が選んだモデレーターで、配信者と同じくブロックでき、低速モードと禁止語にかからない。
 * followedAt はそのチャンネルをフォローした時刻（していなければ null。フォロワー限定に使う）。
 * settings は札を作った時点のコメントの決まり（src/lib/comment-settings.ts）。中継は DB を持たないので札で渡す
 */
export type Commenter = {
  userId: string;
  displayName: string;
  ipKey: string | null;
  owner: boolean;
  moderator?: boolean;
  followedAt?: number | null;
  settings?: CommentSettings;
  /** 配信者がコメントにつないだときの IP の鍵。中継が立ち上がり直したあとも、配信者の回線を IP で止めないため */
  ownerIpKey?: string | null;
  /** 印の画像の住所（src/lib/avatar.ts）。無ければ null。札を作った時点のもの */
  avatar?: string | null;
};

/**
 * コメントを書いた人。中継がコメントに付けて配信者とモデレーターにだけ渡し、ブロックするときにサイトへ送り返す。
 * 署名してあるので、中身を書き換えてほかの人を止めることはできない。
 * privileged は書いた時点で配信者かモデレーターだったこと。モデレーターは止められない
 */
export type Author = {
  userId: string;
  displayName: string;
  ipKey: string | null;
  privileged?: boolean;
};

type Payload = {
  c: string;
  u: string;
  n: string;
  i: string | null;
  o: boolean;
  m?: boolean;
  f?: number | null;
  s?: CommentSettings;
  k?: string | null;
  v?: string | null;
  e: number;
};
type AuthorPayload = {
  a: string;
  c: string;
  u: string;
  n: string;
  i: string | null;
  p?: boolean;
};

function signature(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

function sign(secret: string, payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${signature(secret, body)}`;
}

/** 署名が合えば中身を返す。合わなければ null */
function open(secret: string, token: string): unknown {
  const [body, sig, ...rest] = token.split('.');
  if (rest.length > 0 || !body || !sig) return null;
  const expected = Buffer.from(signature(secret, body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return JSON.parse(Buffer.from(body, 'base64url').toString()) as unknown;
}

/**
 * コメントを書くための札（`<中身>.<署名>`）。中継（relay/）はサイトの DB もログインも持たないので、
 * ログインして名前を付けた人にサイトが札を作って渡し、中継は署名だけを確かめる
 */
export function signCommentToken(
  secret: string,
  channelId: string,
  commenter: Commenter,
  now: number,
): string {
  const payload: Payload = {
    c: channelId,
    u: commenter.userId,
    n: commenter.displayName,
    i: commenter.ipKey,
    o: commenter.owner,
    m: commenter.moderator ?? false,
    f: commenter.followedAt ?? null,
    s: commenter.settings,
    k: commenter.ownerIpKey ?? null,
    v: commenter.avatar ?? null,
    e: now + COMMENT_TOKEN_TTL_MS,
  };
  return sign(secret, payload);
}

/** 確かめた札の中身。札に無い項目は既定の値で埋める。settings は古い札には無い（null） */
export type VerifiedCommenter = Required<Omit<Commenter, 'settings'>> & {
  settings: CommentSettings | null;
  issuedAt: number;
  expiresAt: number;
};

/**
 * 札がそのチャンネルのもので、期限の内で、署名が合えば書く人と札の作られた時刻・期限を返す。合わなければ null。
 * 中継は書くたびに期限も見る。配信者が未ログインのコメントを止めたら、遅くとも期限で書けなくなる
 */
export function verifyCommentToken(
  secret: string,
  token: string,
  channelId: string,
  now: number,
): VerifiedCommenter | null {
  const payload = open(secret, token) as Payload | null;
  if (!payload || payload.c !== channelId || payload.e < now) return null;
  return {
    userId: payload.u,
    displayName: payload.n,
    ipKey: payload.i ?? null,
    owner: payload.o === true,
    moderator: payload.m === true,
    followedAt: payload.f ?? null,
    settings: payload.s ?? null,
    ownerIpKey: payload.k ?? null,
    avatar: payload.v ?? null,
    issuedAt: payload.e - COMMENT_TOKEN_TTL_MS,
    expiresAt: payload.e,
  };
}

/** 札と取り違えないための印 */
const AUTHOR_MARK = 'author';

/** 書いた人の札の暗号の鍵。署名の鍵から、この用途のためだけに作る */
function authorKey(secret: string): Buffer {
  return createHash('sha256').update(`${AUTHOR_MARK}:${secret}`).digest();
}

const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * コメントを書いた人の札（中継が作る）。そのチャンネルでだけ使える。
 * 配信者とモデレーターに渡すので、利用者の id と IP の鍵が読めないよう暗号にする（AES-256-GCM。書き換えも見抜ける）
 */
export function signAuthor(secret: string, channelId: string, author: Author): string {
  const payload: AuthorPayload = {
    a: AUTHOR_MARK,
    c: channelId,
    u: author.userId,
    n: author.displayName,
    i: author.ipKey,
    p: author.privileged ?? false,
  };
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', authorKey(secret), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}

/** 書いた人の札を開く。そのチャンネルのもので、鍵が合い、書き換えられていなければ中身を返す。合わなければ null */
function openAuthor(secret: string, token: string): AuthorPayload | null {
  try {
    const raw = Buffer.from(token, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', authorKey(secret), raw.subarray(0, IV_BYTES));
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    const body = Buffer.concat([
      decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)),
      decipher.final(),
    ]);
    return JSON.parse(body.toString()) as AuthorPayload;
  } catch {
    return null;
  }
}

/** 書いた人の札が、そのチャンネルのもので鍵が合えば中身を返す。合わなければ null */
export function verifyAuthor(secret: string, token: string, channelId: string): Author | null {
  const payload = openAuthor(secret, token);
  if (!payload || payload.a !== AUTHOR_MARK || payload.c !== channelId) return null;
  return {
    userId: payload.u,
    displayName: payload.n,
    ipKey: payload.i ?? null,
    privileged: payload.p === true,
  };
}

/** 中継が流したそのままのコメントか。コメントの中身から作る署名で、書いた人は入れない（見る人に id を見せないため） */
type Shown = Pick<Comment, 'id' | 'name' | 'text' | 'at' | 'guest'>;

/** 札と取り違えないための印 */
const PROOF_MARK = 'proof';

function proofBody(channelId: string, comment: Shown): string {
  return JSON.stringify([
    PROOF_MARK,
    channelId,
    comment.id,
    comment.name,
    comment.text,
    comment.at,
    comment.guest,
  ]);
}

/**
 * コメントの印（中継が作り、コメントに付けて全員に流す）。通報するときに見る画面がサイトへ送り返し、
 * サイトは中身が中継の流したものと同じかを確かめてから保存する。見る人が本文や名前を書き換えて通報することはできない
 */
export function signCommentProof(secret: string, channelId: string, comment: Shown): string {
  return signature(secret, proofBody(channelId, comment));
}

export function verifyCommentProof(
  secret: string,
  channelId: string,
  comment: Shown,
  proof: string,
): boolean {
  const expected = Buffer.from(signCommentProof(secret, channelId, comment));
  const given = Buffer.from(proof);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** コメントを消す札の有効な長さ。サイトが作ってすぐ中継へ送る */
const REMOVAL_TTL_MS = MS_PER_MINUTE;
const REMOVAL_MARK = 'remove';

type RemovalPayload = { a: string; c: string; id: string; e: number };

/** 運営がコメントを消す札（サイトが作り、中継へ送る）。そのチャンネルのそのコメントにだけ効く */
export function signRemoval(secret: string, channelId: string, commentId: string, now: number) {
  const payload: RemovalPayload = {
    a: REMOVAL_MARK,
    c: channelId,
    id: commentId,
    e: now + REMOVAL_TTL_MS,
  };
  return sign(secret, payload);
}

/** 消す札がそのチャンネルのもので、期限の内で、署名が合えば消すコメントの id を返す。合わなければ null */
export function verifyRemoval(
  secret: string,
  token: string,
  channelId: string,
  now: number,
): string | null {
  const payload = open(secret, token) as RemovalPayload | null;
  if (!payload || payload.a !== REMOVAL_MARK || payload.c !== channelId || payload.e < now) {
    return null;
  }
  return payload.id;
}

/** サイトから中継への指示の札の有効な長さ。サイトが作ってすぐ中継へ送る */
const COMMAND_TTL_MS = MS_PER_MINUTE;
const COMMAND_MARK = 'command';

/**
 * サイトから中継への指示。settings はコメントの決まりを変えた（その場で効かせる）。
 * roles はその人がモデレーターになったか外れた（中継はその人のつなぎを閉じ、新しい札でつなぎ直させる）
 */
export type RelayCommand =
  { kind: 'settings'; settings: CommentSettings } | { kind: 'roles'; userId: string };

type CommandPayload = { a: string; c: string; x: RelayCommand; e: number };

/** 中継への指示の札（サイトが作り、中継へ送る）。そのチャンネルにだけ効く */
export function signRelayCommand(
  secret: string,
  channelId: string,
  command: RelayCommand,
  now: number,
): string {
  const payload: CommandPayload = {
    a: COMMAND_MARK,
    c: channelId,
    x: command,
    e: now + COMMAND_TTL_MS,
  };
  return sign(secret, payload);
}

/**
 * 指示の札がそのチャンネルのもので、期限の内で、署名が合えば指示と、サイトが札を作った時刻を返す。合わなければ null。
 * 作った時刻はサイトの時計なので、サイトの作るコメントの札の時刻とそのまま比べられる
 */
export function verifyRelayCommand(
  secret: string,
  token: string,
  channelId: string,
  now: number,
): { command: RelayCommand; issuedAt: number } | null {
  const payload = open(secret, token) as CommandPayload | null;
  if (!payload || payload.a !== COMMAND_MARK || payload.c !== channelId || payload.e < now) {
    return null;
  }
  return { command: payload.x, issuedAt: payload.e - COMMAND_TTL_MS };
}

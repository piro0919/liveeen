import { describe, expect, it } from 'vitest';
import { COMMENT_MAX, normalizeComment } from '@/lib/comment';
import {
  COMMENT_TOKEN_TTL_MS,
  signAuthor,
  signCommentToken,
  verifyAuthor,
  verifyCommentToken,
} from '@/lib/comment-token';

const SECRET = 'comment-secret';
const NOW = 1_800_000_000_000;
const COMMENTER = { userId: 'u1', displayName: 'ぴろ', ipKey: 'ip-1', owner: false };

describe('normalizeComment', () => {
  it('改行は空白にして1行にする', () => {
    expect(normalizeComment(' こん\nにちは ')).toBe('こん にちは');
  });

  it('空白だけと、長すぎるものは null', () => {
    expect(normalizeComment(' \n ')).toBeNull();
    expect(normalizeComment('あ'.repeat(COMMENT_MAX))).not.toBeNull();
    expect(normalizeComment('あ'.repeat(COMMENT_MAX + 1))).toBeNull();
  });
});

describe('コメントの札', () => {
  it('同じ鍵・同じチャンネル・期限の内なら書く人と期限を返す', () => {
    const token = signCommentToken(SECRET, 'ch', COMMENTER, NOW);
    expect(verifyCommentToken(SECRET, token, 'ch', NOW)).toEqual({
      ...COMMENTER,
      // 札に入れなかった項目は既定の値で埋める
      moderator: false,
      followedAt: null,
      settings: null,
      ownerIpKey: null,
      avatar: null,
      issuedAt: NOW,
      expiresAt: NOW + COMMENT_TOKEN_TTL_MS,
    });
  });

  it('期限が切れていれば null', () => {
    const token = signCommentToken(SECRET, 'ch', COMMENTER, NOW - COMMENT_TOKEN_TTL_MS - 1);
    expect(verifyCommentToken(SECRET, token, 'ch', NOW)).toBeNull();
  });

  it('違う鍵で署名したもの、中身を書き換えたものは null', () => {
    expect(
      verifyCommentToken(SECRET, signCommentToken('other', 'ch', COMMENTER, NOW), 'ch', NOW),
    ).toBeNull();
    const [, sig] = signCommentToken(SECRET, 'ch', COMMENTER, NOW).split('.');
    const forged = Buffer.from(
      JSON.stringify({ c: 'ch', u: 'u1', n: '運営', e: NOW + COMMENT_TOKEN_TTL_MS }),
    ).toString('base64url');
    expect(verifyCommentToken(SECRET, `${forged}.${sig}`, 'ch', NOW)).toBeNull();
  });
});

describe('書いた人の札', () => {
  const author = { userId: 'u1', displayName: 'ぴろ', ipKey: 'ip-1' };

  it('同じ鍵・同じチャンネルなら中身を返す', () => {
    expect(verifyAuthor(SECRET, signAuthor(SECRET, 'ch', author), 'ch')).toEqual({
      ...author,
      privileged: false,
    });
  });

  it('札から利用者の id と IP の鍵は読めず、書き換えれば null', () => {
    // 暗号文は毎回違うので、短い id だと偶然同じ並びが出て落ちる（u1 で CI が1度落ちた）。偶然では出ない長さにする
    const userId = 'user-id-that-must-not-be-readable';
    const ipKey = 'ip-key-that-must-not-be-readable';
    const token = signAuthor(SECRET, 'ch', { ...author, userId, ipKey });
    const decoded = Buffer.from(token, 'base64url').toString('latin1');
    expect(decoded).not.toContain(userId);
    expect(decoded).not.toContain(ipKey);
    const raw = Buffer.from(token, 'base64url');
    raw[raw.length - 1] ^= 1;
    expect(verifyAuthor(SECRET, raw.toString('base64url'), 'ch')).toBeNull();
  });

  it('ほかのチャンネル・違う鍵・コメントの札は null', () => {
    expect(verifyAuthor(SECRET, signAuthor(SECRET, 'other', author), 'ch')).toBeNull();
    expect(verifyAuthor(SECRET, signAuthor('other', 'ch', author), 'ch')).toBeNull();
    expect(verifyAuthor(SECRET, signCommentToken(SECRET, 'ch', COMMENTER, NOW), 'ch')).toBeNull();
  });
});

describe('見えない文字', () => {
  it('取り除く。禁止語の間に挟んでもすり抜けない', () => {
    expect(normalizeComment('ば​か‮')).toBe('ばか');
  });

  it('見える文字が無いコメントは流さない', () => {
    expect(normalizeComment('​')).toBeNull();
    expect(normalizeComment('‍')).toBeNull();
    expect(normalizeComment('⠀')).toBeNull();
  });

  it('絵文字の組み合わせは残す', () => {
    expect(normalizeComment('👨‍👩‍👧')).toBe('👨‍👩‍👧');
  });
});

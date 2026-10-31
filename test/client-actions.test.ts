import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * ブラウザから Server Action を呼ぶ所が、投げられた呼び出しを受け止めているかを見る（shodolog の同じ名前のテストを写した）。
 *
 * 電波が悪いと、await した Server Action は投げる。受け止めないと、押しても何も出ずにボタンが戻るか、
 * 画面ごと誤りの画面へ落ちる。そこで、クライアントのファイルから actions.ts の関数に触れる所は、次のどれかでなければ落とす:
 * - safely(() => ...) か guarded(...) の中（src/lib/safe-action.ts。投げられたら知らせを出す）
 * - xAction(...).catch(...) か try { ... } catch の中と、その場で受けているもの
 * 書き方ではなく「action に触れている」ことで拾う。useActionState(xAction, null) のように、
 * 関数を渡して React に await させる書き方も同じく落ちる
 */

const ROOT = join(import.meta.dirname, '..', 'src');

/** 先頭の文が "use client" か */
const isUseClient = (source: string) => /^\s*['"]use client['"]/.test(source);

/** Server Action を書いたファイル（src/app のどこかの actions.ts）から読み込んでいるか */
const isActionModule = (specifier: string) => /^(@\/app\/.*|\.)\/?actions$/.test(specifier);

/** 受け止めていない、Server Action に触れている所を「行: 名前」で返す */
function unguarded(path: string, source: string): string[] {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const actions = new Set<string>();
  for (const statement of file.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      isActionModule(statement.moduleSpecifier.text) &&
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      for (const element of statement.importClause.namedBindings.elements) {
        if (!element.isTypeOnly) actions.add(element.name.text);
      }
    }
  }

  const calleeIs = (node: ts.Node, names: string[]) =>
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    names.includes(node.expression.text);

  const isGuarded = (ref: ts.Identifier) => {
    // 型の中で名前を使うだけ（typeof xAction）は呼んでいない
    for (let current: ts.Node | undefined = ref.parent; current; current = current.parent) {
      if (ts.isTypeNode(current)) return true;
      if (calleeIs(current, ['safely', 'guarded'])) return true;
      // try { await xAction() } catch { ... } と、その場で受けているもの
      if (
        ts.isBlock(current) &&
        ts.isTryStatement(current.parent) &&
        current.parent.tryBlock === current &&
        current.parent.catchClause
      )
        return true;
    }
    const call = ref.parent;
    if (!ts.isCallExpression(call) || call.expression !== ref) return false;
    // xAction(...).catch(...)
    return ts.isPropertyAccessExpression(call.parent) && call.parent.name.text === 'catch';
  };

  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) return;
    if (ts.isIdentifier(node) && actions.has(node.text) && !isGuarded(node)) {
      const line = file.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      found.push(`${line}: ${node.text}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

const files = readdirSync(ROOT, { recursive: true, encoding: 'utf8' })
  .filter((f) => /\.tsx?$/.test(f))
  .map((f) => ({ path: f, source: readFileSync(join(ROOT, f), 'utf8') }))
  .filter((f) => isUseClient(f.source));

describe('ブラウザからの Server Action の呼び出し', () => {
  it('Server Action を呼ぶクライアントのファイルを拾えている（拾い方が壊れて 0 件で通らないように）', () => {
    expect(
      files.filter((f) => /from '(@\/app\/.*|\.)\/actions'/.test(f.source)).length,
    ).toBeGreaterThan(10);
  });

  it('投げられた呼び出しを受け止めている', () => {
    expect(
      files.flatMap(({ path, source }) => unguarded(path, source).map((hit) => `${path}:${hit}`)),
    ).toEqual([]);
  });

  it('受け止めていない書き方を見せたら拾える（物差しを先に疑う）', () => {
    const source = (body: string) =>
      `'use client';\nimport { saveAction } from '@/app/settings/actions';\n${body}\n`;
    expect(
      unguarded('a.tsx', source('const f = async (d: FormData) => await saveAction(null, d);')),
    ).toEqual(['3: saveAction']);
    expect(unguarded('a.tsx', source('useActionState(saveAction, null);'))).toEqual([
      '3: saveAction',
    ]);
    expect(unguarded('a.tsx', source('startTransition(() => saveAction(id));'))).toEqual([
      '3: saveAction',
    ]);
    expect(
      unguarded('a.tsx', source('const f = (d: FormData) => safely(() => saveAction(null, d));')),
    ).toEqual([]);
    expect(unguarded('a.tsx', source('useActionState(guarded(saveAction), null);'))).toEqual([]);
    expect(unguarded('a.tsx', source('saveAction(id).catch(() => {});'))).toEqual([]);
    expect(unguarded('a.tsx', source('try { await saveAction(id); } catch {}'))).toEqual([]);
    expect(unguarded('a.tsx', source('try { await saveAction(id); } finally {}'))).toEqual([
      '3: saveAction',
    ]);
    expect(unguarded('a.tsx', source('let r: Awaited<ReturnType<typeof saveAction>>;'))).toEqual(
      [],
    );
  });
});

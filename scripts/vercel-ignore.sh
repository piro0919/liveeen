#!/bin/sh
# Vercel の Ignored Build Step（vercel.json の ignoreCommand から呼ぶ。spatto と同じ）。
# 終了コード 0 = ビルドを飛ばす、1 = ビルドする。
# vercel.json に直に書かないのは、ignoreCommand が 256 文字までで、超えるとビルドの前にデプロイが失敗するため（spatto の記録）

# Renovate のブランチはプレビューを作らない。確かめは GitHub の CI（ci.yml）が受け持つ
case "$VERCEL_GIT_COMMIT_REF" in renovate/*) exit 0 ;; esac
exit 1

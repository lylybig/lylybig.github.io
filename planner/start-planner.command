#!/bin/zsh
cd -- "${0:A:h}"
if ! command -v node >/dev/null; then
  print '需要 Node.js 20 或以上版本。'
  read -k 1
  exit 1
fi
if curl -fsS --max-time 2 http://127.0.0.1:4173/api/state >/dev/null 2>&1; then
  open http://127.0.0.1:4173/
  exit 0
fi
node scripts/serve.mjs &
PLANNER_SERVER_PID=$!
trap 'kill "$PLANNER_SERVER_PID" 2>/dev/null' EXIT INT TERM
for PLANNER_START_ATTEMPT in {1..30}; do
  if curl -fsS --max-time 1 http://127.0.0.1:4173/api/state >/dev/null 2>&1; then
    open http://127.0.0.1:4173/
    break
  fi
  sleep 0.2
done
print '本地反馈服务运行中。关闭此窗口会停止服务，已保存的记录会保留。'
wait "$PLANNER_SERVER_PID"

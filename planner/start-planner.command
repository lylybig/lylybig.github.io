#!/bin/zsh
cd -- "${0:A:h}"
if ! command -v node >/dev/null; then
  print '需要 Node.js 20 或以上版本。'
  read -k 1
  exit 1
fi
node scripts/start-local.mjs --open
if [[ $? -ne 0 ]]; then
  print '启动未成功，请查看 planner/work/local-server.log。'
  read -k 1
  exit 1
fi
print '本地反馈服务已在后台运行，可以关闭此窗口。'

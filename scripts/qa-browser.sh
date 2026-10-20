#!/usr/bin/env bash
# One isolated test rig per run id: own build dir, preview port, Chrome profile + debug port, agent-browser namespace.
# Usage: scripts/qa-browser.sh start <id> [query]   |   scripts/qa-browser.sh stop <id>
set -euo pipefail

cmd=${1:-}
id=${2:-}
if [[ -z $cmd || ! $id =~ ^[a-z0-9-]+$ ]]; then
  echo "usage: $0 start|stop <id: a-z 0-9 -> [query]" >&2
  exit 2
fi

root=$(cd "$(dirname "$0")/.." && pwd)
rig=${TMPDIR:-/tmp}/le-drift-qa/$id
chrome=${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}
ab=(agent-browser --namespace "le-drift-$id" --session "$id")

free_port() { node -e 'const s=require("net").createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'; }

stop() {
  "${ab[@]}" close >/dev/null 2>&1 || true
  for f in "$rig"/*.pid; do
    [[ -f $f ]] || continue
    pid=$(<"$f")
    kill "$pid" 2>/dev/null || true
    for _ in 1 2 3 4 5 6 7 8 9 10; do kill -0 "$pid" 2>/dev/null || break; sleep 0.3; done
    kill -9 "$pid" 2>/dev/null || true
  done
  rm -rf "$rig"
}

case $cmd in
  stop) stop; echo "rig $id stopped" ;;
  start)
    if [[ -d $rig ]]; then
      echo "rig $id already exists: stop it first or pick another id" >&2
      exit 1
    fi
    mkdir -p "$rig/profile"
    cd "$root"
    node_modules/.bin/tsc --noEmit
    node_modules/.bin/vite build --outDir "$rig/dist" --emptyOutDir --logLevel warn
    web=$(free_port)
    node_modules/.bin/vite preview --outDir "$rig/dist" --host 127.0.0.1 --port "$web" --strictPort >"$rig/preview.out" 2>&1 &
    echo $! >"$rig/preview.pid"
    cdp=$(free_port)
    "$chrome" --headless=new --mute-audio --use-angle=metal --enable-gpu --ignore-gpu-blocklist \
      --user-data-dir="$rig/profile" --remote-debugging-port="$cdp" --window-size=1280,720 \
      --no-first-run --no-default-browser-check about:blank >"$rig/chrome.out" 2>&1 &
    echo $! >"$rig/chrome.pid"
    for _ in $(seq 1 40); do
      curl -sf "http://127.0.0.1:$cdp/json/version" >/dev/null && curl -sf "http://127.0.0.1:$web/" >/dev/null && break
      sleep 0.25
    done
    url="http://127.0.0.1:$web/?mute${3:+&$3}"
    "${ab[@]}" connect "$cdp" >/dev/null
    "${ab[@]}" open "$url" >/dev/null
    cat <<EOF
url=$url
cdp=$cdp
export AGENT_BROWSER_NAMESPACE=le-drift-$id AGENT_BROWSER_SESSION=$id
stop: $0 stop $id
EOF
    ;;
  *) echo "unknown command $cmd" >&2; exit 2 ;;
esac

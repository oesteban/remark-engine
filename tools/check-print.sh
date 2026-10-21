#!/usr/bin/env bash
# Print a deck in headless Chrome, slides only and as a notes handout, and check
# that printing leaves the screen as it was. Writes the PDFs and one PNG per page
# so that the prints can be read back.
#
#   remark/tools/check-print.sh week2/day2
#
# Run it from the directory that serves the deck: the deck at <dir>/index.html
# must find the engine at ../../remark/, as it does on the published site. Output
# goes to _preview/print/<dir>/ (set OUT to change the parent directory).
# puppeteer-core comes from decktape's npx install; pdfinfo and pdftoppm from
# poppler. Firefox, when found (or named by FIREFOX), prints the deck too, and
# ImageMagick, when found, checks every page for blanks and margins.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
id="${1:?usage: remark/tools/check-print.sh <deck-dir, e.g. week2/day2>}"
out="${OUT:-_preview/print}/${id//\//-}"
chrome="${CHROME:-$(command -v google-chrome || command -v chromium || true)}"
mac="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -n "$chrome" ] || [ ! -x "$mac" ] || chrome="$mac"
[ -n "$chrome" ] || { echo "no Chrome found; set CHROME=/path/to/chrome" >&2; exit 1; }
firefox="${FIREFOX:-$(command -v firefox || true)}"
macfx="/Applications/Firefox.app/Contents/MacOS/firefox"
[ -n "$firefox" ] || [ ! -x "$macfx" ] || firefox="$macfx"
command -v pdfinfo >/dev/null && command -v pdftoppm >/dev/null \
  || { echo "pdfinfo and pdftoppm not found; install poppler" >&2; exit 1; }
nm="$(dirname "$(dirname "$(npx --yes -p decktape which decktape)")")"
[ -d "$nm/puppeteer-core" ] || { echo "puppeteer-core not found in $nm" >&2; exit 1; }
[ -f "$id/index.html" ] || { echo "no $id/index.html under $PWD" >&2; exit 1; }

port=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])')
python3 -m http.server "$port" --bind 127.0.0.1 >/dev/null 2>&1 &
server=$!
trap 'kill $server 2>/dev/null' EXIT
sleep 1

rm -rf "$out"
mkdir -p "$out"
node "$here/check-print.mjs" "$nm" "$chrome" "http://127.0.0.1:$port/$id/index.html" "$out" "$firefox"

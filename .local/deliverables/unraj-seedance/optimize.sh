#!/usr/bin/env bash
# Web-encode a Seedance clip for unraj.org.
#   bash optimize.sh out/01-hero-loop-s1000.mp4            # hero: strips audio, 720p, loop-safe
#   bash optimize.sh out/02-founder-intro-s1000.mp4 --keep-audio --1080
#   bash optimize.sh out/03-portfolio-explainer-s1000.mp4 --keep-audio --vertical   # also makes a 9:16 crop
#
# Produces in web/media/<name>/ :
#   <name>.mp4  (H.264, faststart)   <name>.webm (AV1, falls back to VP9)   <name>.jpg (poster)
#   <name>-9x16.mp4 when --vertical
# Requires ffmpeg >= 6 (brew install ffmpeg / apt install ffmpeg).
set -euo pipefail

SRC="${1:?usage: optimize.sh <input.mp4> [--keep-audio] [--1080] [--vertical]}"; shift || true
KEEP_AUDIO=0; HEIGHT=720; VERTICAL=0
for a in "$@"; do
  case "$a" in
    --keep-audio) KEEP_AUDIO=1 ;;
    --1080) HEIGHT=1080 ;;
    --vertical) VERTICAL=1 ;;
    *) echo "unknown flag $a" >&2; exit 2 ;;
  esac
done

command -v ffmpeg >/dev/null || { echo "ffmpeg not found" >&2; exit 1; }
NAME="$(basename "${SRC%.*}")"
NAME="${NAME%-s[0-9]*}"                       # drop -s1000 seed suffix
OUT="$(dirname "$0")/web/media/$NAME"; mkdir -p "$OUT"

AUDIO_ARGS=(-an)
if [[ $KEEP_AUDIO -eq 1 ]]; then AUDIO_ARGS=(-c:a aac -b:a 96k -ac 2); fi
SCALE="scale=-2:${HEIGHT}:flags=lanczos"

echo "→ H.264 MP4"
ffmpeg -y -loglevel error -i "$SRC" -vf "$SCALE,format=yuv420p" \
  -c:v libx264 -preset slow -crf 28 -profile:v high -level 4.1 -pix_fmt yuv420p \
  -movflags +faststart "${AUDIO_ARGS[@]}" "$OUT/$NAME.mp4"

echo "→ WebM (AV1, VP9 fallback)"
if ffmpeg -hide_banner -encoders 2>/dev/null | grep -q libsvtav1; then
  ffmpeg -y -loglevel error -i "$SRC" -vf "$SCALE,format=yuv420p" \
    -c:v libsvtav1 -preset 6 -crf 38 -g 240 "${AUDIO_ARGS[@]/aac/libopus}" "$OUT/$NAME.webm"
else
  ffmpeg -y -loglevel error -i "$SRC" -vf "$SCALE,format=yuv420p" \
    -c:v libvpx-vp9 -b:v 0 -crf 36 -row-mt 1 -deadline good "${AUDIO_ARGS[@]/aac/libopus}" "$OUT/$NAME.webm"
fi

echo "→ poster JPEG (first frame)"
ffmpeg -y -loglevel error -i "$SRC" -vf "$SCALE" -frames:v 1 -q:v 4 "$OUT/$NAME.jpg"

if [[ $VERTICAL -eq 1 ]]; then
  echo "→ 9:16 crop"
  ffmpeg -y -loglevel error -i "$SRC" \
    -vf "scale=-2:1920:flags=lanczos,crop=1080:1920:(iw-1080)/2:0,format=yuv420p" \
    -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 128k \
    "$OUT/$NAME-9x16.mp4"
fi

echo
echo "Sizes (budgets: hero mp4 ≤ 1.5 MB, webm ≤ 900 KB, poster ≤ 80 KB, click-to-play ≤ 6 MB):"
du -h "$OUT"/* | sed 's/^/  /'

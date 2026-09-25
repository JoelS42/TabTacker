#!/bin/sh
# Endfassungen aus dem Master erzeugen (optional mit neu gerenderten Szenen-Abschnitten).
#   tools/finalize.sh [master.mp4] [patch.mp4 start_frame end_frame]
# Ergebnis:
#   render/final.mp4    1920×1080 H.264 (CRF 20, hohe Qualität), AAC 256 kbit/s 48 kHz
#   render/preview.mp4  1280×720  H.264, ≤ ~95 MB (passt in ein GitHub-Repository)
set -e
cd "$(dirname "$0")/.."
MASTER="${1:-render/master_crf16.mp4}"
PATCH="$2"; PS="$3"; PE="$4"
DUR=$(python3 -c "import json;print(json.load(open('data/timings.json'))['duration'])")

if [ -n "$PATCH" ]; then
  VF="[0:v]trim=start_frame=0:end_frame=$PS,setpts=PTS-STARTPTS[a];[1:v]setpts=PTS-STARTPTS[b];[0:v]trim=start_frame=$PE,setpts=PTS-STARTPTS[c];[a][b][c]concat=n=3:v=1:a=0[v]"
  INPUTS="-i $MASTER -i $PATCH -i audio/mix.wav"
  AMAP="2:a"
else
  VF="[0:v]null[v]"
  INPUTS="-i $MASTER -i audio/mix.wav"
  AMAP="1:a"
fi

echo "→ render/final.mp4"
ffmpeg -y -loglevel error $INPUTS -filter_complex "$VF" -map "[v]" -map $AMAP \
  -c:v libx264 -preset slow -crf 20 -tune animation -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 256k -ar 48000 -movflags +faststart -t "$DUR" \
  -metadata title="Die Entstehung von Schizophrenie bei Kindern und Jugendlichen" -metadata:s:a:0 language=deu \
  render/final.mp4

# 720p-Vorschau mit Zielgröße ≈ 90 MB (2-Pass)
VBR=$(python3 -c "print(int(90*8*1000/$DUR - 112))")
echo "→ render/preview.mp4 (${VBR} kbit/s Video)"
ffmpeg -y -loglevel error -i render/final.mp4 -vf scale=1280:720:flags=lanczos -c:v libx264 -preset slow -tune animation -b:v ${VBR}k -pass 1 -passlogfile render/tmp/x264 -an -f mp4 /dev/null
ffmpeg -y -loglevel error -i render/final.mp4 -vf scale=1280:720:flags=lanczos -c:v libx264 -preset slow -tune animation -b:v ${VBR}k -pass 2 -passlogfile render/tmp/x264 \
  -c:a aac -b:a 112k -ar 48000 -movflags +faststart -metadata title="Die Entstehung von Schizophrenie (Vorschau 720p)" render/preview.mp4
ls -la render/final.mp4 render/preview.mp4

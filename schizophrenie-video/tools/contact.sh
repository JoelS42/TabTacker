#!/bin/sh
# Kontaktbogen aus Einzelbildern: tools/contact.sh <ordner> [spalten]
D="$1"; COLS="${2:-4}"
N=$(ls "$D"/t*.jpg | wc -l); ROWS=$(( (N + COLS - 1) / COLS ))
ffmpeg -loglevel error -y -pattern_type glob -i "$D/t*.jpg" -vf "scale=640:-1,tile=${COLS}x${ROWS}:padding=4:color=white" -frames:v 1 -update 1 "$D/contact.jpg"
echo "$D/contact.jpg"

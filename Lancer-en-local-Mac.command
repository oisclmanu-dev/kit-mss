#!/bin/bash
# Test du kit en local sur Mac. Laissez cette fenêtre ouverte, fermez-la pour arrêter.
cd "$(dirname "$0")"
PORT=8765
while lsof -i :$PORT >/dev/null 2>&1; do PORT=$((PORT+1)); done
( sleep 1; open "http://localhost:$PORT/index.html" ) &
echo "Kit ouvert sur http://localhost:$PORT/  (fermez cette fenêtre pour arrêter)"
python3 -m http.server $PORT --bind 127.0.0.1

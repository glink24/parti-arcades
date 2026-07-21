#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <game-name>"
  echo "Example: $0 snake-game"
  exit 1
fi

GAME_NAME=$1
GAME_DIR="games/${GAME_NAME}"

if [ -d "$GAME_DIR" ]; then
  echo "Error: ${GAME_DIR} already exists"
  exit 1
fi

echo "Creating new game: ${GAME_NAME}"

mkdir -p "$GAME_DIR"

cat > "${GAME_DIR}/parti.room.json" << JSON
{
  "partiVersion": "0.1.0",
  "protocolVersion": 1,
  "id": "${GAME_NAME}",
  "name": "${GAME_NAME}",
  "version": "0.1.0",
  "packageMode": "blob",
  "description": "",
  "author": {
    "name": "Parti Arcades"
  },
  "entry": {
    "ui": "index.html",
    "worker": "room.worker.js"
  },
  "room": {
    "minPlayers": 2,
    "maxPlayers": 4
  },
  "sync": {
    "mode": "snapshot"
  },
  "permissions": {
    "network": false,
    "storage": "session"
  }
}
JSON

cat > "${GAME_DIR}/index.html" << HTML
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>${GAME_NAME}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #0f0f13;
      color: #e8e8ed;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      text-align: center;
      padding: 40px;
    }
    h1 { font-size: 28px; margin-bottom: 12px; }
    p { color: #888; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${GAME_NAME}</h1>
    <p>游戏开发中...</p>
    <div id="stateDisplay"></div>
  </div>
  <script>
    parti.onState(function (state) {
      document.getElementById('stateDisplay').textContent = JSON.stringify(state, null, 2);
    });
    parti.ready();
  </script>
</body>
</html>
HTML

cat > "${GAME_DIR}/room.worker.js" << WORKER
import { defineRoom } from '@parti/worker-sdk';

export default defineRoom({
  meta: {
    name: '${GAME_NAME}',
    minPlayers: 2,
    maxPlayers: 4,
  },

  initialState: function () {
    return {
      phase: 'waiting',
      players: {},
    };
  },

  onJoin: function (ctx, player) {
    ctx.state.players[player.id] = {
      name: player.name || '玩家',
    };
    var count = Object.keys(ctx.state.players).length;
    if (ctx.state.phase === 'waiting' && count >= 2) {
      ctx.state.phase = 'playing';
      ctx.broadcast('game:start', {});
    }
  },

  onLeave: function (ctx, player) {
    delete ctx.state.players[player.id];
    ctx.state.phase = 'waiting';
  },

  actions: {},
});
WORKER

echo ""
echo "Game scaffold created at ${GAME_DIR}/"
echo "Files:"
echo "  ${GAME_DIR}/parti.room.json"
echo "  ${GAME_DIR}/index.html"
echo "  ${GAME_DIR}/room.worker.js"
echo ""
echo "Next steps:"
echo "  1. Edit the game files in ${GAME_DIR}/"
echo "  2. git add && git commit && git push"
echo "  3. Submit a market issue to glink25/Parti:"
echo "     Title: [parti-room] glink24/parti-arcades@market-${GAME_NAME}"

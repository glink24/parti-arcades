import { defineRoom } from '@parti/worker-sdk';

var BIRD_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#FF8C42', '#98D8C8',
];

var PIPE_GAP = 150;

function mulberry32(a) {
  return function () {
    a |= 0;
    a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function generatePipeGaps(seed, count, canvasH, groundH, gapSize) {
  var rng = mulberry32(seed);
  var gaps = [];
  var minY = 60;
  var maxY = canvasH - groundH - gapSize - 60;
  for (var i = 0; i < count; i++) {
    gaps.push(minY + rng() * (maxY - minY));
  }
  return gaps;
}

function scheduleTick(ctx) {
  ctx.setTimer('tick', 500, function () {
    if (ctx.state.phase !== 'playing') return;
    var allDead = true;
    var playerIds = Object.keys(ctx.state.players);
    for (var i = 0; i < playerIds.length; i++) {
      if (ctx.state.players[playerIds[i]].alive) {
        allDead = false;
        break;
      }
    }
    if (allDead) {
      ctx.state.phase = 'finished';
      ctx.clearTimer('tick');
      ctx.broadcast('game:over', {});
    } else {
      scheduleTick(ctx);
    }
  });
}

function startGame(ctx) {
  var state = ctx.state;
  state.phase = 'playing';
  state.startTime = Date.now();
  state.pipeGaps = generatePipeGaps(state.seed, 100, 600, 80, PIPE_GAP);

  for (var j = 0; j < state.playerOrder.length; j++) {
    var pid = state.playerOrder[j];
    if (state.players[pid]) {
      state.players[pid].score = 0;
      state.players[pid].alive = true;
    }
  }

  ctx.broadcast('game:start', { startTime: state.startTime });
  scheduleTick(ctx);
}

function startCountdown(ctx) {
  var state = ctx.state;
  state.phase = 'countdown';
  state.countdown = 3;
  ctx.broadcast('game:countdown', { count: 3 });

  function tick() {
    state.countdown--;
    if (state.countdown <= 0) {
      startGame(ctx);
    } else {
      ctx.broadcast('game:countdown', { count: state.countdown });
      ctx.setTimer('countdown', 1000, tick);
    }
  }
  ctx.setTimer('countdown', 1000, tick);
}

function checkAndStart(ctx) {
  var state = ctx.state;
  if (state.phase !== 'waiting') return;
  if (state.playerOrder.length < 1) return;

  var allReady = true;
  for (var i = 0; i < state.playerOrder.length; i++) {
    var p = state.players[state.playerOrder[i]];
    if (!p || !p.ready) {
      allReady = false;
      break;
    }
  }
  if (!allReady) return;

  startCountdown(ctx);
}

export default defineRoom({
  meta: {
    name: 'Flappy Bird 联机版',
    minPlayers: 1,
    maxPlayers: 8,
  },

  initialState: function () {
    var seed = Math.floor(Math.random() * 1000000000);
    return {
      phase: 'waiting',
      seed: seed,
      players: {},
      playerOrder: [],
      pipeGaps: generatePipeGaps(seed, 50, 600, 80, PIPE_GAP),
      startTime: 0,
      playerColors: {},
    };
  },

  onJoin: function (ctx, player) {
    if (!player) return;
    var state = ctx.state;
    if (state.players[player.id]) return;

    var idx = state.playerOrder.length;
    var color = BIRD_COLORS[idx % BIRD_COLORS.length];

    state.players[player.id] = {
      name: player.name || '玩家',
      score: 0,
      alive: true,
      ready: false,
    };
    state.playerOrder.push(player.id);
    state.playerColors[player.id] = { color: color, index: idx };

    if (state.phase === 'waiting') {
      for (var i = 0; i < state.playerOrder.length; i++) {
        if (state.players[state.playerOrder[i]]) {
          state.players[state.playerOrder[i]].ready = false;
        }
      }
    }
  },

  onLeave: function (ctx, player) {
    if (!player) return;
    var state = ctx.state;
    if (state.players[player.id]) {
      state.players[player.id].alive = false;
    }
    delete state.players[player.id];

    var newOrder = [];
    for (var i = 0; i < state.playerOrder.length; i++) {
      if (state.playerOrder[i] !== player.id) {
        newOrder.push(state.playerOrder[i]);
      }
    }
    state.playerOrder = newOrder;

    if (state.phase === 'playing') {
      var anyAlive = false;
      for (var j = 0; j < state.playerOrder.length; j++) {
        if (state.players[state.playerOrder[j]] && state.players[state.playerOrder[j]].alive) {
          anyAlive = true;
          break;
        }
      }
      if (!anyAlive) {
        state.phase = 'finished';
        ctx.clearTimer('tick');
        ctx.broadcast('game:over', {});
      }
    }

    if (state.phase === 'waiting') {
      checkAndStart(ctx);
    }
  },

  onReconnect: function (ctx, player) {
    if (!player) return;
    if (!ctx.state.players[player.id]) {
      var idx = ctx.state.playerOrder.length;
      var color = BIRD_COLORS[idx % BIRD_COLORS.length];
      ctx.state.players[player.id] = {
        name: player.name || '玩家',
        score: 0,
        alive: true,
        ready: false,
      };
      ctx.state.playerOrder.push(player.id);
      ctx.state.playerColors[player.id] = { color: color, index: idx };
    }
  },

  actions: {
    ready: function (ctx, _ref) {
      var state = ctx.state;
      var player = _ref && _ref.player;
      if (!player) return;
      if (state.phase !== 'waiting') return;
      if (!state.players[player.id]) return;

      state.players[player.id].ready = true;
      checkAndStart(ctx);
    },

    unready: function (ctx, _ref) {
      var state = ctx.state;
      var player = _ref && _ref.player;
      if (!player) return;
      if (state.phase !== 'waiting') return;
      if (!state.players[player.id]) return;

      state.players[player.id].ready = false;
    },

    flap: function (ctx, _ref) {
      var state = ctx.state;
      var player = _ref && _ref.player;
      if (!player) return;
      if (state.phase !== 'playing') return;
      if (!state.players[player.id] || !state.players[player.id].alive) return;

      ctx.broadcast('player:flap', {
        playerId: player.id,
        time: Date.now(),
      });
    },

    die: function (ctx, _ref) {
      var state = ctx.state;
      var player = _ref && _ref.player;
      var payload = _ref && _ref.payload;
      if (!player) return;
      if (state.phase !== 'playing') return;
      if (!state.players[player.id]) return;
      if (!state.players[player.id].alive) return;

      var score = (payload && payload.score) ? payload.score : 0;

      var elapsed = (Date.now() - state.startTime) / 1000;
      var maxScore = Math.ceil(elapsed * 2.5) + 1;
      if (score > maxScore) score = maxScore;
      if (score < 0) score = 0;

      state.players[player.id].alive = false;
      state.players[player.id].score = score;

      ctx.broadcast('player:died', {
        playerId: player.id,
        score: score,
      });

      var allDead = true;
      var playerIds = Object.keys(state.players);
      for (var i = 0; i < playerIds.length; i++) {
        if (state.players[playerIds[i]].alive) {
          allDead = false;
          break;
        }
      }
      if (allDead) {
        state.phase = 'finished';
        ctx.clearTimer('tick');
        ctx.broadcast('game:over', {});
      }
    },

    restart: function (ctx) {
      var state = ctx.state;
      if (state.phase !== 'finished') return;

      state.phase = 'waiting';
      state.startTime = 0;

      for (var i = 0; i < state.playerOrder.length; i++) {
        var pid = state.playerOrder[i];
        if (state.players[pid]) {
          state.players[pid].score = 0;
          state.players[pid].alive = true;
          state.players[pid].ready = false;
        }
      }

      ctx.broadcast('game:reset', {});
    },
  },
});

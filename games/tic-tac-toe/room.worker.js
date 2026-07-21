import { defineRoom } from '@parti/worker-sdk';

var LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function findWinner(board) {
  for (var i = 0; i < LINES.length; i++) {
    var a = LINES[i][0];
    var b = LINES[i][1];
    var c = LINES[i][2];
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { mark: board[a], line: [a, b, c] };
    }
  }
  return null;
}

export default defineRoom({
  meta: {
    name: '井字棋',
    minPlayers: 2,
    maxPlayers: 2,
  },

  initialState: function () {
    return {
      phase: 'waiting',
      board: Array(9).fill(null),
      players: {},
      seats: { X: null, O: null },
      turn: 'X',
      winner: null,
      winLine: null,
    };
  },

  onJoin: function (ctx, player) {
    var mark = null;
    if (!ctx.state.seats.X) {
      ctx.state.seats.X = player.id;
      mark = 'X';
    } else if (!ctx.state.seats.O) {
      ctx.state.seats.O = player.id;
      mark = 'O';
    }

    ctx.state.players[player.id] = {
      name: player.name || '玩家',
      mark: mark,
    };

    ctx.send(player.id, 'seat:assigned', { mark: mark });

    if (
      ctx.state.seats.X &&
      ctx.state.seats.O &&
      ctx.state.phase === 'waiting'
    ) {
      ctx.state.phase = 'playing';
      ctx.state.turn = 'X';
      ctx.broadcast('game:start', {});
    }
  },

  onLeave: function (ctx, player) {
    var p = ctx.state.players[player.id];
    if (p && p.mark && ctx.state.seats[p.mark] === player.id) {
      ctx.state.seats[p.mark] = null;
    }
    delete ctx.state.players[player.id];

    if (ctx.state.phase === 'playing') {
      ctx.state.phase = 'waiting';
    }
  },

  actions: {
    mark: function (ctx, payload) {
      var state = ctx.state;
      var player = ctx.player;

      if (state.phase !== 'playing') return;

      var me = state.players[player.id];
      if (!me || !me.mark) return;

      if (me.mark !== state.turn) return;

      var cell = Number(payload && payload.cell);
      if (!Number.isInteger(cell) || cell < 0 || cell > 8) return;

      if (state.board[cell] !== null) return;

      state.board[cell] = me.mark;

      var win = findWinner(state.board);
      if (win) {
        state.phase = 'finished';
        state.winner = win.mark;
        state.winLine = win.line;
        ctx.broadcast('game:over', { winner: win.mark, line: win.line });
        return;
      }

      if (state.board.every(function (c) { return c !== null; })) {
        state.phase = 'finished';
        state.winner = 'draw';
        state.winLine = null;
        ctx.broadcast('game:over', { winner: 'draw' });
        return;
      }

      state.turn = state.turn === 'X' ? 'O' : 'X';
    },

    restart: function (ctx) {
      ctx.state.board = Array(9).fill(null);
      ctx.state.turn = 'X';
      ctx.state.winner = null;
      ctx.state.winLine = null;

      if (ctx.state.seats.X && ctx.state.seats.O) {
        ctx.state.phase = 'playing';
      } else {
        ctx.state.phase = 'waiting';
      }

      ctx.broadcast('game:reset', {});
    },
  },
});

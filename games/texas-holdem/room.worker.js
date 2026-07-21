import { defineRoom } from '@parti/worker-sdk';

var RANK_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
var SUITS = ['♠', '♥', '♦', '♣'];
var HAND_RANK = {
  ROYAL_FLUSH: 10,
  STRAIGHT_FLUSH: 9,
  FOUR_OF_A_KIND: 8,
  FULL_HOUSE: 7,
  FLUSH: 6,
  STRAIGHT: 5,
  THREE_OF_A_KIND: 4,
  TWO_PAIR: 3,
  ONE_PAIR: 2,
  HIGH_CARD: 1,
};

function createDeck() {
  var deck = [];
  for (var s = 0; s < SUITS.length; s++) {
    for (var r = 0; r < RANK_ORDER.length; r++) {
      deck.push({ rank: RANK_ORDER[r], suit: SUITS[s] });
    }
  }
  return deck;
}

function shuffleArray(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function dealCards(deck, count) {
  var cards = [];
  for (var i = 0; i < count && deck.length > 0; i++) {
    cards.push(deck.pop());
  }
  return cards;
}

function rankValue(r) { return RANK_ORDER.indexOf(r); }

function sortCards(cards) {
  return cards.slice().sort(function (a, b) { return rankValue(b.rank) - rankValue(a.rank); });
}

function isStraight(ranks) {
  var vals = [];
  for (var i = 0; i < ranks.length; i++) { vals.push(rankValue(ranks[i])); }
  vals.sort(function (a, b) { return a - b; });
  if (vals[0] === 0 && vals[1] === 1 && vals[2] === 2 && vals[3] === 3 && vals[4] === 12) {
    return { straight: true, high: 3 };
  }
  for (var j = 0; j < vals.length - 1; j++) {
    if (vals[j + 1] - vals[j] !== 1) return { straight: false };
  }
  return { straight: true, high: vals[vals.length - 1] };
}

function isFlush(cards) {
  var suit = cards[0].suit;
  for (var i = 0; i < cards.length; i++) {
    if (cards[i].suit !== suit) return false;
  }
  return true;
}

function getHandRank(cards) {
  var sorted = sortCards(cards);
  var ranks = [];
  for (var i = 0; i < sorted.length; i++) { ranks.push(sorted[i].rank); }
  var flush = isFlush(sorted);
  var straight = isStraight(ranks);

  if (flush && straight.straight) {
    if (straight.high === 12 &&
        ranks.indexOf('A') !== -1 && ranks.indexOf('K') !== -1 &&
        ranks.indexOf('Q') !== -1 && ranks.indexOf('J') !== -1 &&
        ranks.indexOf('10') !== -1) {
      return { rank: HAND_RANK.ROYAL_FLUSH, high: 14, kickers: [] };
    }
    return { rank: HAND_RANK.STRAIGHT_FLUSH, high: straight.high + 2, kickers: [] };
  }

  var rankCount = {};
  for (var ri = 0; ri < ranks.length; ri++) {
    var r = ranks[ri];
    rankCount[r] = (rankCount[r] || 0) + 1;
  }

  var groups = [];
  var keys = Object.keys(rankCount);
  for (var gi = 0; gi < keys.length; gi++) {
    groups.push({ rank: keys[gi], count: rankCount[keys[gi]] });
  }
  groups.sort(function (a, b) { return b.count - a.count || rankValue(b.rank) - rankValue(a.rank); });

  if (groups[0].count === 4) {
    var kickers4 = [];
    for (var ki = 1; ki < groups.length; ki++) { kickers4.push(rankValue(groups[ki].rank)); }
    kickers4.sort(function (a, b) { return b - a; });
    return { rank: HAND_RANK.FOUR_OF_A_KIND, high: rankValue(groups[0].rank) + 2, kickers: kickers4 };
  }

  if (groups[0].count === 3 && groups.length >= 2 && groups[1].count >= 2) {
    return { rank: HAND_RANK.FULL_HOUSE, high: rankValue(groups[0].rank) + 2, kickers: [rankValue(groups[1].rank) + 2] };
  }

  if (flush) {
    var kickersF = [];
    for (var fi = 0; fi < sorted.length; fi++) { kickersF.push(rankValue(sorted[fi].rank) + 2); }
    return { rank: HAND_RANK.FLUSH, high: kickersF[0], kickers: kickersF.slice(1) };
  }

  if (straight.straight) {
    return { rank: HAND_RANK.STRAIGHT, high: straight.high + 2, kickers: [] };
  }

  if (groups[0].count === 3) {
    var kickers3 = [];
    for (var ci = 1; ci < groups.length; ci++) { kickers3.push(rankValue(groups[ci].rank) + 2); }
    kickers3.sort(function (a, b) { return b - a; });
    return { rank: HAND_RANK.THREE_OF_A_KIND, high: rankValue(groups[0].rank) + 2, kickers: kickers3 };
  }

  if (groups[0].count === 2 && groups.length >= 2 && groups[1].count === 2) {
    var pairs = [];
    var kicker = null;
    for (var pi = 0; pi < groups.length; pi++) {
      if (groups[pi].count === 2) pairs.push(rankValue(groups[pi].rank) + 2);
      else if (!kicker) kicker = groups[pi];
    }
    pairs.sort(function (a, b) { return b - a; });
    return { rank: HAND_RANK.TWO_PAIR, high: pairs[0], kickers: [pairs[1], kicker ? rankValue(kicker.rank) + 2 : 0] };
  }

  if (groups[0].count === 2) {
    var kickers1 = [];
    for (var di = 1; di < groups.length; di++) { kickers1.push(rankValue(groups[di].rank) + 2); }
    kickers1.sort(function (a, b) { return b - a; });
    return { rank: HAND_RANK.ONE_PAIR, high: rankValue(groups[0].rank) + 2, kickers: kickers1 };
  }

  var kickersHC = [];
  for (var ei = 0; ei < sorted.length; ei++) { kickersHC.push(rankValue(sorted[ei].rank) + 2); }
  return { rank: HAND_RANK.HIGH_CARD, high: kickersHC[0], kickers: kickersHC.slice(1) };
}

function compareHands(hand1, hand2) {
  if (hand1.rank !== hand2.rank) return hand1.rank - hand2.rank;
  if (hand1.high !== hand2.high) return hand1.high - hand2.high;
  var len = Math.min(hand1.kickers.length, hand2.kickers.length);
  for (var i = 0; i < len; i++) {
    if (hand1.kickers[i] !== hand2.kickers[i]) return hand1.kickers[i] - hand2.kickers[i];
  }
  return 0;
}

function evaluatePlayerHand(holeCards, communityCards) {
  var all = holeCards.concat(communityCards);
  if (all.length < 5) return null;
  var best = null;
  var combos = [];

  function combine(start, selected) {
    if (selected.length === 5) {
      combos.push(selected.slice());
      return;
    }
    for (var i = start; i < all.length; i++) {
      selected.push(all[i]);
      combine(i + 1, selected);
      selected.pop();
    }
  }
  combine(0, []);

  for (var c = 0; c < combos.length; c++) {
    var result = getHandRank(combos[c]);
    if (!best || compareHands(result, best) > 0) {
      best = result;
    }
  }
  return best;
}

function checkRestart(ctx) {
  var state = ctx.state;
  if (state._pendingRestart && state.phase === 'finished') {
    state._pendingRestart = false;
    var alive = [];
    for (var i = 0; i < state.players.length; i++) {
      if (state.players[i].chips > 0) alive.push(state.players[i]);
    }
    if (alive.length >= 2) {
      for (var j = 0; j < state.players.length; j++) {
        state.players[j].holeCards = [];
        state.players[j].currentBet = 0;
        state.players[j].folded = false;
        state.players[j].allIn = false;
        state.players[j].isReady = false;
      }
      startNewHand(ctx);
    } else {
      state.phase = 'waiting';
      state._pendingRestart = false;
      state.communityCards = [];
      state.pot = 0;
      state.winnerId = null;
      state.handResults = null;
      state.dealerId = null;
      state.currentPlayerId = null;
      for (var k = 0; k < state.players.length; k++) {
        state.players[k].holeCards = [];
        state.players[k].currentBet = 0;
        state.players[k].folded = false;
        state.players[k].allIn = false;
        state.players[k].isReady = false;
      }
    }
  }
}

function validateAction(ctx, player) {
  var state = ctx.state;
  if (state.phase === 'waiting' || state.phase === 'finished') return false;
  if (state.currentPlayerId !== player.id) return false;
  for (var i = 0; i < state.players.length; i++) {
    if (state.players[i].id === player.id) {
      if (state.players[i].folded) return false;
      return true;
    }
  }
  return false;
}

function startNewHand(ctx) {
  var state = ctx.state;
  state.phase = 'preflop';
  state.communityCards = [];
  state.pot = 0;
  state.winnerId = null;
  state.handResults = null;
  state.callAmount = 0;
  state.minRaise = state.bigBlind;

  var activePlayers = [];
  for (var i = 0; i < state.players.length; i++) {
    if (state.players[i].chips > 0) activePlayers.push(state.players[i]);
  }
  if (activePlayers.length < 2) {
    state.phase = 'waiting';
    return;
  }

  for (var j = 0; j < state.players.length; j++) {
    state.players[j].holeCards = [];
    state.players[j].currentBet = 0;
    state.players[j].folded = false;
    state.players[j].allIn = false;
    if (state.players[j].chips <= 0) state.players[j].folded = true;
  }

  if (!state.dealerId) {
    state.dealerId = state.players[0].id;
  } else {
    var idx = -1;
    for (var k = 0; k < state.players.length; k++) {
      if (state.players[k].id === state.dealerId) { idx = k; break; }
    }
    var next = (idx + 1) % state.players.length;
    var attempts = 0;
    while (state.players[next].folded && attempts < state.players.length) {
      next = (next + 1) % state.players.length;
      attempts++;
    }
    state.dealerId = state.players[next].id;
  }

  state.deck = shuffleArray(createDeck());

  for (var d = 0; d < state.players.length; d++) {
    if (!state.players[d].folded) {
      state.players[d].holeCards = dealCards(state.deck, 2);
    }
  }

  var players = [];
  for (var p = 0; p < state.players.length; p++) {
    if (!state.players[p].folded) players.push(state.players[p]);
  }
  if (players.length < 2) {
    state.phase = 'waiting';
    return;
  }

  var dealerIdx = -1;
  for (var di = 0; di < state.players.length; di++) {
    if (state.players[di].id === state.dealerId) { dealerIdx = di; break; }
  }

  var sbIdx = (dealerIdx + 1) % state.players.length;
  var sbAttempts = 0;
  while (state.players[sbIdx].folded && sbAttempts < state.players.length) {
    sbIdx = (sbIdx + 1) % state.players.length;
    sbAttempts++;
  }
  var sbPlayer = state.players[sbIdx];
  var sbAmount = Math.min(state.smallBlind, sbPlayer.chips);
  sbPlayer.chips -= sbAmount;
  sbPlayer.currentBet += sbAmount;
  state.pot += sbAmount;
  if (sbPlayer.chips === 0) sbPlayer.allIn = true;

  var bbIdx = (sbIdx + 1) % state.players.length;
  var bbAttempts = 0;
  while (state.players[bbIdx].folded && bbAttempts < state.players.length) {
    bbIdx = (bbIdx + 1) % state.players.length;
    bbAttempts++;
  }
  var bbPlayer = state.players[bbIdx];
  var bbAmount = Math.min(state.bigBlind, bbPlayer.chips);
  bbPlayer.chips -= bbAmount;
  bbPlayer.currentBet += bbAmount;
  state.pot += bbAmount;
  if (bbPlayer.chips === 0) bbPlayer.allIn = true;

  state.callAmount = state.bigBlind;
  state.minRaise = state.bigBlind * 2;

  var firstIdx = (bbIdx + 1) % state.players.length;
  var firstAttempts = 0;
  while (state.players[firstIdx].folded && firstAttempts < state.players.length) {
    firstIdx = (firstIdx + 1) % state.players.length;
    firstAttempts++;
  }
  state.currentPlayerId = state.players[firstIdx].id;

  ctx.broadcast('game:start', {});
}

function advanceGame(ctx) {
  var state = ctx.state;
  var activePlayers = [];
  for (var i = 0; i < state.players.length; i++) {
    if (!state.players[i].folded && state.players[i].chips > 0) activePlayers.push(state.players[i]);
  }

  if (activePlayers.length <= 1) {
    endHand(ctx);
    return;
  }

  var maxBet = 0;
  for (var j = 0; j < state.players.length; j++) {
    if (!state.players[j].folded && state.players[j].currentBet > maxBet) maxBet = state.players[j].currentBet;
  }

  var allActed = true;
  for (var k = 0; k < state.players.length; k++) {
    if (!state.players[k].folded && !state.players[k].allIn && state.players[k].currentBet !== maxBet) {
      allActed = false;
      break;
    }
  }

  if (allActed) {
    nextStage(ctx);
    return;
  }

  var currentIdx = -1;
  for (var ci = 0; ci < state.players.length; ci++) {
    if (state.players[ci].id === state.currentPlayerId) { currentIdx = ci; break; }
  }
  var nextIdx = (currentIdx + 1) % state.players.length;
  var attempts = 0;
  while (attempts < state.players.length) {
    if (!state.players[nextIdx].folded && !state.players[nextIdx].allIn) {
      state.currentPlayerId = state.players[nextIdx].id;
      return;
    }
    nextIdx = (nextIdx + 1) % state.players.length;
    attempts++;
  }

  nextStage(ctx);
}

function nextStage(ctx) {
  var state = ctx.state;
  if (state.phase === 'preflop') {
    state.phase = 'flop';
    dealCommunity(ctx, 3);
    resetBets(ctx);
  } else if (state.phase === 'flop') {
    state.phase = 'turn';
    dealCommunity(ctx, 1);
    resetBets(ctx);
  } else if (state.phase === 'turn') {
    state.phase = 'river';
    dealCommunity(ctx, 1);
    resetBets(ctx);
  } else if (state.phase === 'river') {
    showdown(ctx);
  }
}

function dealCommunity(ctx, count) {
  var state = ctx.state;
  if (state.deck.length > 0) state.deck.pop();
  var cards = dealCards(state.deck, count);
  for (var i = 0; i < cards.length; i++) {
    state.communityCards.push(cards[i]);
  }
}

function resetBets(ctx) {
  var state = ctx.state;
  for (var i = 0; i < state.players.length; i++) {
    if (!state.players[i].folded) {
      state.players[i].currentBet = 0;
    }
  }
  state.callAmount = 0;
  state.minRaise = state.bigBlind;

  var dealerIdx = -1;
  for (var d = 0; d < state.players.length; d++) {
    if (state.players[d].id === state.dealerId) { dealerIdx = d; break; }
  }
  var startIdx = (dealerIdx + 1) % state.players.length;
  var attempts = 0;
  while (attempts < state.players.length) {
    if (!state.players[startIdx].folded && !state.players[startIdx].allIn) {
      state.currentPlayerId = state.players[startIdx].id;
      return;
    }
    startIdx = (startIdx + 1) % state.players.length;
    attempts++;
  }
  showdown(ctx);
}

function showdown(ctx) {
  var state = ctx.state;
  state.phase = 'showdown';

  var active = [];
  for (var i = 0; i < state.players.length; i++) {
    if (!state.players[i].folded && state.players[i].holeCards.length === 2) {
      active.push(state.players[i]);
    }
  }

  if (active.length <= 1) {
    endHand(ctx);
    return;
  }

  var results = [];
  for (var j = 0; j < active.length; j++) {
    var hand = evaluatePlayerHand(active[j].holeCards, state.communityCards);
    results.push({ playerId: active[j].id, hand: hand });
  }

  results.sort(function (a, b) {
    if (!a.hand && !b.hand) return 0;
    if (!a.hand) return -1;
    if (!b.hand) return 1;
    return compareHands(b.hand, a.hand);
  });

  var top = results[0];
  var winners = [];
  for (var k = 0; k < results.length; k++) {
    if (results[k].hand && compareHands(results[k].hand, top.hand) === 0) {
      winners.push(results[k]);
    }
  }

  state.handResults = [];
  for (var r = 0; r < results.length; r++) {
    state.handResults.push({
      playerId: results[r].playerId,
      handRank: results[r].hand ? results[r].hand.rank : 0,
      handHigh: results[r].hand ? results[r].hand.high : 0,
    });
  }

  var totalPot = state.pot;
  var share = Math.floor(totalPot / winners.length);
  for (var w = 0; w < winners.length; w++) {
    for (var p = 0; p < state.players.length; p++) {
      if (state.players[p].id === winners[w].playerId) {
        state.players[p].chips += share;
        break;
      }
    }
  }
  state.pot = 0;
  state.winnerId = winners[0].playerId;

  var winnerIds = [];
  for (var wi = 0; wi < winners.length; wi++) {
    winnerIds.push(winners[wi].playerId);
  }
  ctx.broadcast('game:over', { winnerId: state.winnerId, winners: winnerIds });

  state.phase = 'finished';
  state._pendingRestart = true;
}

function endHand(ctx) {
  var state = ctx.state;
  state.phase = 'showdown';
  var active = [];
  for (var i = 0; i < state.players.length; i++) {
    if (!state.players[i].folded) active.push(state.players[i]);
  }
  if (active.length === 1) {
    var winner = active[0];
    winner.chips += state.pot;
    state.pot = 0;
    state.winnerId = winner.id;
    state.handResults = [{ playerId: winner.id, handRank: 0, handHigh: 0 }];
    ctx.broadcast('game:over', { winnerId: winner.id, winners: [winner.id] });
    state.phase = 'finished';
    state._pendingRestart = true;
  } else {
    state.phase = 'finished';
    state._pendingRestart = true;
  }
}

var originalActions = {
  fold: function (ctx) {
    var state = ctx.state;
    var player = ctx.player;
    checkRestart(ctx);
    if (!validateAction(ctx, player)) return;
    var p = null;
    for (var i = 0; i < state.players.length; i++) {
      if (state.players[i].id === player.id) { p = state.players[i]; break; }
    }
    if (!p || p.folded) return;
    p.folded = true;
    advanceGame(ctx);
  },

  check: function (ctx) {
    var state = ctx.state;
    var player = ctx.player;
    checkRestart(ctx);
    if (!validateAction(ctx, player)) return;
    var p = null;
    for (var i = 0; i < state.players.length; i++) {
      if (state.players[i].id === player.id) { p = state.players[i]; break; }
    }
    if (!p || p.folded) return;
    if (state.callAmount > 0) return;
    advanceGame(ctx);
  },

  call: function (ctx) {
    var state = ctx.state;
    var player = ctx.player;
    checkRestart(ctx);
    if (!validateAction(ctx, player)) return;
    var p = null;
    for (var i = 0; i < state.players.length; i++) {
      if (state.players[i].id === player.id) { p = state.players[i]; break; }
    }
    if (!p || p.folded) return;
    var callAmt = Math.min(state.callAmount, p.chips);
    if (callAmt <= 0) return;
    p.chips -= callAmt;
    p.currentBet += callAmt;
    state.pot += callAmt;
    if (p.chips === 0) p.allIn = true;
    advanceGame(ctx);
  },

  raise: function (ctx) {
    var state = ctx.state;
    var player = ctx.player;
    var payload = ctx.payload;
    checkRestart(ctx);
    if (!validateAction(ctx, player)) return;
    var p = null;
    for (var i = 0; i < state.players.length; i++) {
      if (state.players[i].id === player.id) { p = state.players[i]; break; }
    }
    if (!p || p.folded) return;
    var amount = payload && payload.amount ? Math.floor(payload.amount) : 0;
    var minRaise = state.minRaise || (state.bigBlind || 0);
    if (amount < minRaise || amount > p.chips) return;
    if (amount === p.chips) {
      p.chips = 0;
      p.currentBet += amount;
      state.pot += amount;
      p.allIn = true;
      advanceGame(ctx);
      return;
    }
    p.chips -= amount;
    p.currentBet += amount;
    state.pot += amount;
    var maxBet = 0;
    for (var j = 0; j < state.players.length; j++) {
      if (!state.players[j].folded && state.players[j].currentBet > maxBet) maxBet = state.players[j].currentBet;
    }
    state.callAmount = maxBet;
    state.minRaise = maxBet + state.bigBlind;
    advanceGame(ctx);
  },

  allin: function (ctx) {
    var state = ctx.state;
    var player = ctx.player;
    checkRestart(ctx);
    if (!validateAction(ctx, player)) return;
    var p = null;
    for (var i = 0; i < state.players.length; i++) {
      if (state.players[i].id === player.id) { p = state.players[i]; break; }
    }
    if (!p || p.folded) return;
    var amount = p.chips;
    if (amount <= 0) return;
    p.chips = 0;
    p.currentBet += amount;
    state.pot += amount;
    p.allIn = true;
    var maxBet = 0;
    for (var j = 0; j < state.players.length; j++) {
      if (!state.players[j].folded && state.players[j].currentBet > maxBet) maxBet = state.players[j].currentBet;
    }
    state.callAmount = maxBet;
    advanceGame(ctx);
  },
};

export default defineRoom({
  meta: {
    name: '德州扑克',
    minPlayers: 2,
    maxPlayers: 6,
  },

  initialState: function () {
    return {
      phase: 'waiting',
      players: [],
      deck: [],
      communityCards: [],
      pot: 0,
      dealerId: null,
      currentPlayerId: null,
      callAmount: 0,
      minRaise: 0,
      bigBlind: 20,
      smallBlind: 10,
      startingChips: 1000,
      winnerId: null,
      handResults: null,
      maxPlayers: 6,
      minPlayers: 2,
      _pendingRestart: false,
    };
  },

  onJoin: function (ctx, player) {
    var state = ctx.state;
    if (state._pendingRestart && state.phase === 'finished') {
      checkRestart(ctx);
    }
    var existing = false;
    for (var i = 0; i < state.players.length; i++) {
      if (state.players[i].id === player.id) existing = true;
    }
    if (existing) return;
    state.players.push({
      id: player.id,
      name: player.name || '玩家',
      chips: state.startingChips,
      holeCards: [],
      currentBet: 0,
      folded: false,
      allIn: false,
      isReady: false,
    });
    if (state.phase === 'waiting' && state.players.length >= state.minPlayers) {
      startNewHand(ctx);
    }
  },

  onLeave: function (ctx, player) {
    var state = ctx.state;
    var newPlayers = [];
    for (var i = 0; i < state.players.length; i++) {
      if (state.players[i].id !== player.id) {
        newPlayers.push(state.players[i]);
      }
    }
    state.players = newPlayers;
    if (state.players.length < state.minPlayers) {
      state.phase = 'waiting';
      state.dealerId = null;
      state.currentPlayerId = null;
      state.communityCards = [];
      state.pot = 0;
      state.winnerId = null;
      state.handResults = null;
      state._pendingRestart = false;
      for (var j = 0; j < state.players.length; j++) {
        state.players[j].holeCards = [];
        state.players[j].currentBet = 0;
        state.players[j].folded = false;
        state.players[j].allIn = false;
        state.players[j].isReady = false;
      }
    }
  },

  onReady: function (ctx, player) {
    var state = ctx.state;
    for (var i = 0; i < state.players.length; i++) {
      if (state.players[i].id === player.id) {
        state.players[i].isReady = true;
      }
    }
    if (state.phase === 'waiting' && state.players.length >= state.minPlayers) {
      var allReady = true;
      for (var j = 0; j < state.players.length; j++) {
        if (!state.players[j].isReady) { allReady = false; break; }
      }
      if (allReady) {
        startNewHand(ctx);
      }
    }
  },

  actions: originalActions,
});

/**
 * Simulator - Generates realistic fake data to make the GUI feel functional
 */
const Simulator = (function () {
  let intervalId = null;
  let isRunning = false;

  const state = {
    inboundTotal: 0,
    inboundConsecutive: 0,
    inboundInterval: 0,
    outboundTotal: 0,
    outboundConsecutive: 0,
    outboundInterval: 0,
    tickerLatency: 0,
    playingGame: false,
    playersInGame: 0,
    playerPosition: 0,
    matchupIndex: 0,
    syncStatus: '---',
    syncDelay: 0,
    hoursRemaining: 23,
    debugOutLines: [],
    debugInLines: [],
    controllerState: 'idle',
    opp: '—',
  };

  const matchups = ['None', 'Point Guard', 'Shooting Guard', 'Small Forward', 'Power Forward', 'Center'];

  function random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function tick() {
    if (!isRunning) return;

    // Network - Inbound
    state.inboundTotal += random(0, 3);
    state.inboundConsecutive = state.playingGame ? state.inboundConsecutive + 1 : 0;
    state.inboundInterval = random(50, 200);

    // Network - Outbound
    state.outboundTotal += random(0, 3);
    state.outboundConsecutive = state.playingGame ? state.outboundConsecutive + 1 : 0;
    state.outboundInterval = random(50, 200);

    // Stats - Playing game toggles occasionally
    if (Math.random() < 0.05) state.playingGame = !state.playingGame;
    state.tickerLatency = state.playingGame ? random(2, 15) : random(0, 3);

    // Players
    state.playersInGame = state.playingGame ? random(2, 10) : 0;
    state.playerPosition = state.playingGame ? random(1, 5) : 0;
    if (state.playingGame && Math.random() < 0.2) {
      state.matchupIndex = (state.matchupIndex + 1) % matchups.length;
    }

    // Sync - when simulating, always show Connected
    state.syncStatus = 'Connected';
    state.syncDelay = random(0, 50);

    // Hours remaining (count down slowly when simulating)
    if (Math.random() < 0.1 && state.hoursRemaining > 0) {
      state.hoursRemaining = Math.max(0, state.hoursRemaining - 0.1);
    }

    // Debug - Controller state
    const controllerStates = ['idle', 'LT:0.0 RT:0.0', 'A pressed', 'LS:(0.2,-0.1)', 'RS:(0,0)'];
    if (Math.random() < 0.3) {
      state.controllerState = controllerStates[random(0, controllerStates.length - 1)];
    }

    // Debug - Opp
    if (Math.random() < 0.2) {
      state.opp = random(0, 1) ? 'Detected' : '—';
    }

    // Debug Out - stream lines
    if (Math.random() < 0.4) {
      const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
      state.debugOutLines.push(`[${timestamp}] tick=${state.inboundTotal} latency=${state.tickerLatency}ms`);
      if (state.debugOutLines.length > 15) state.debugOutLines.shift();
    }

    // Debug In
    if (Math.random() < 0.3) {
      const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
      state.debugInLines.push(`[${timestamp}] recv seq=${random(1000, 9999)}`);
      if (state.debugInLines.length > 10) state.debugInLines.shift();
    }

    return state;
  }

  function updateDOM() {
    const s = state;

    // Network
    const inboundTotal = document.getElementById('inboundTotal');
    if (inboundTotal) inboundTotal.textContent = s.inboundTotal;
    const inboundConsecutive = document.getElementById('inboundConsecutive');
    if (inboundConsecutive) inboundConsecutive.textContent = s.inboundConsecutive;
    const inboundInterval = document.getElementById('inboundInterval');
    if (inboundInterval) inboundInterval.textContent = s.inboundInterval;

    const outboundTotal = document.getElementById('outboundTotal');
    if (outboundTotal) outboundTotal.textContent = s.outboundTotal;
    const outboundConsecutive = document.getElementById('outboundConsecutive');
    if (outboundConsecutive) outboundConsecutive.textContent = s.outboundConsecutive;
    const outboundInterval = document.getElementById('outboundInterval');
    if (outboundInterval) outboundInterval.textContent = s.outboundInterval;

    const tickerLatency = document.getElementById('tickerLatency');
    if (tickerLatency) tickerLatency.textContent = s.tickerLatency;
    const playingGame = document.getElementById('playingGame');
    if (playingGame) playingGame.textContent = s.playingGame ? 'Yes' : 'No';

    const playersInGame = document.getElementById('playersInGame');
    if (playersInGame) playersInGame.textContent = s.playersInGame;
    const playerPosition = document.getElementById('playerPosition');
    if (playerPosition) playerPosition.textContent = s.playerPosition;
    const matchup = document.getElementById('matchup');
    if (matchup) matchup.textContent = matchups[s.matchupIndex];

    const syncStatus = document.getElementById('syncStatus');
    if (syncStatus) {
      syncStatus.textContent = s.syncStatus;
      syncStatus.className = s.syncStatus === 'Connected' ? 'status-connected' : '';
    }
    const syncDelay = document.getElementById('syncDelay');
    if (syncDelay) syncDelay.textContent = s.syncDelay;

    const hoursRemaining = document.getElementById('hoursRemaining');
    if (hoursRemaining) {
      const hrs = Math.floor(s.hoursRemaining);
      hoursRemaining.textContent = `${hrs} hours remaining`;
    }

    const controllerState = document.getElementById('controllerState');
    if (controllerState) controllerState.textContent = s.controllerState;

    const debugOpp = document.getElementById('debugOpp');
    if (debugOpp) debugOpp.textContent = s.opp;

    const debugOut = document.getElementById('debugOut');
    if (debugOut) debugOut.textContent = s.debugOutLines.join('\n');

    const debugIn = document.getElementById('debugIn');
    if (debugIn) debugIn.textContent = s.debugInLines.join('\n');
  }

  function start() {
    if (isRunning) return;
    isRunning = true;
    state.syncStatus = 'Connected';
    tick();
    updateDOM();
    intervalId = setInterval(() => {
      tick();
      updateDOM();
    }, 600);
  }

  function stop() {
    isRunning = false;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    state.syncStatus = '---';
    const syncStatus = document.getElementById('syncStatus');
    if (syncStatus) {
      syncStatus.textContent = '---';
      syncStatus.className = '';
    }
  }

  function isActive() {
    return isRunning;
  }

  return { start, stop, isActive, getState: () => state };
})();

(function () {
  'use strict';

  const QUESTION_COUNTS = [5, 10, 15, 20];
  const TIME_EASY = 30;
  const TIME_MEDIUM = 10;
  const TIME_HARD = 5;

  const MODES = {
    easy: { time: TIME_EASY, label: 'Lätt' },
    medium: { time: TIME_MEDIUM, label: 'Medium' },
    hard: { time: TIME_HARD, label: 'Svår' }
  };

  const CONFETTI_COLORS = ['#22c55e', '#38bdf8', '#fbbf24', '#a78bfa', '#f472b6', '#f87171'];

  /* Weight for factors: 2–9 prioritized, 1 and 10 less often */
  function weightForFactor(n) {
    return (n >= 2 && n <= 9) ? 2 : 1;
  }

  let state = {
    mode: null,
    questionsPerRound: 10,
    timePerQuestion: TIME_EASY,
    questions: [],
    currentIndex: 0,
    score: 0,
    timerId: null,
    timerStart: null,
    timerEnd: null
  };

  let pendingCorrectTimeout = null;

  const $ = (id) => document.getElementById(id);
  const modeScreen = $('mode-screen');
  const gameScreen = $('game-screen');
  const resultsScreen = $('results-screen');
  const celebrationScreen = $('celebration-screen');
  const scoreEl = $('score');
  const questionNumEl = $('question-num');
  const timerBar = $('timer-bar');
  const timerText = $('timer-text');
  const timerWrap = document.querySelector('.timer-wrap');
  const questionEl = $('question');
  const answerInput = $('answer-input');
  const submitBtn = $('submit-btn');
  const correctOverlay = $('correct-overlay');
  const wrongOverlay = $('wrong-overlay');
  const correctAnswerDisplay = $('correct-answer-display');
  const confettiContainer = $('confetti');
  const finalScoreEl = $('final-score');
  const resultsMessageEl = $('results-message');
  const playAgainBtn = $('play-again');
  const changeModeBtn = $('change-mode');
  const resultsTotalEl = $('results-total');
  const celebrationScoreEl = $('celebration-score');
  const celebrationTotalEl = $('celebration-total');
  const celebrationConfettiEl = $('celebration-confetti');
  const celebrationPlayAgainBtn = $('celebration-play-again');
  const celebrationChangeModeBtn = $('celebration-change-mode');

  function showScreen(screen) {
    [modeScreen, gameScreen, resultsScreen, celebrationScreen].forEach(el => el && el.classList.remove('active'));
    if (screen) screen.classList.add('active');
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * All 100 pairs (1–10 × 1–10) with weights. Tables 2–9 get higher weight than 1 and 10.
   * No repeated calculations in a round: we sample without replacement.
   */
  function generateQuestions(count) {
    const pool = [];
    for (let a = 1; a <= 10; a++) {
      for (let b = 1; b <= 10; b++) {
        const weight = weightForFactor(a) * weightForFactor(b);
        pool.push({ a, b, answer: a * b, weight });
      }
    }
    const totalPossible = pool.length;
    const n = Math.min(count, totalPossible);
    const result = [];
    const remaining = pool.map((x) => ({ ...x }));

    for (let i = 0; i < n; i++) {
      let totalWeight = 0;
      for (let j = 0; j < remaining.length; j++) {
        totalWeight += remaining[j].weight;
      }
      let r = Math.random() * totalWeight;
      let idx = 0;
      while (idx < remaining.length && r >= remaining[idx].weight) {
        r -= remaining[idx].weight;
        idx++;
      }
      if (idx >= remaining.length) idx = remaining.length - 1;
      const chosen = remaining[idx];
      result.push({ a: chosen.a, b: chosen.b, answer: chosen.answer });
      remaining.splice(idx, 1);
    }
    return result;
  }

  function startRound(mode) {
    state.mode = mode;
    state.timePerQuestion = MODES[mode].time;
    state.questions = generateQuestions(state.questionsPerRound);
    state.currentIndex = 0;
    state.score = 0;

    showScreen(gameScreen);
    updateScoreDisplay();
    startQuestion();
    answerInput.value = '';
    answerInput.focus();
  }

  function updateScoreDisplay() {
    scoreEl.textContent = state.score;
    questionNumEl.textContent = `${state.currentIndex + 1} / ${state.questions.length}`;
  }

  function focusAnswerInput() {
    if (answerInput.disabled) return;
    answerInput.scrollIntoView({ block: 'center', behavior: 'auto' });
    answerInput.focus();
  }

  function startQuestion() {
    const q = state.questions[state.currentIndex];
    questionEl.textContent = `${q.a} × ${q.b} = ?`;
    answerInput.value = '';
    answerInput.disabled = false;
    submitBtn.disabled = false;

    const totalMs = state.timePerQuestion * 1000;
    state.timerStart = Date.now();
    state.timerEnd = state.timerStart + totalMs;

    if (state.timerId) clearInterval(state.timerId);
    state.timerId = setInterval(tickTimer, 50);
    timerWrap.classList.remove('warning');
    tickTimer();

    focusAnswerInput();
    requestAnimationFrame(focusAnswerInput);
    [100, 250, 500].forEach((ms) => {
      setTimeout(focusAnswerInput, ms);
    });
  }

  function tickTimer() {
    const now = Date.now();
    const left = Math.max(0, (state.timerEnd - now) / 1000);
    const pct = left / state.timePerQuestion;

    timerBar.style.transform = `scaleX(${pct})`;
    timerText.textContent = Math.ceil(left);

    if (state.timePerQuestion <= 10 && pct < 0.3) {
      timerWrap.classList.add('warning');
    }

    if (left <= 0) {
      clearInterval(state.timerId);
      state.timerId = null;
      handleTimeout();
    }
  }

  function stopTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function handleTimeout() {
    answerInput.disabled = true;
    submitBtn.disabled = true;
    const q = state.questions[state.currentIndex];
    showWrong(q.answer);
    nextAfterDelay(1500);
  }

  function advanceAfterCorrect() {
    correctOverlay.classList.remove('show');
    correctOverlay.setAttribute('aria-hidden', 'true');
    state.currentIndex++;
    if (state.currentIndex >= state.questions.length) {
      endRound();
    } else {
      updateScoreDisplay();
      startQuestion();
    }
  }

  function onCorrectOverlayTap() {
    if (!correctOverlay.classList.contains('show')) return;
    if (pendingCorrectTimeout) {
      clearTimeout(pendingCorrectTimeout);
      pendingCorrectTimeout = null;
    }
    advanceAfterCorrect();
    focusAnswerInput();
  }

  function showCorrect() {
    correctOverlay.classList.add('show');
    correctOverlay.setAttribute('aria-hidden', 'false');
    spawnConfetti();
    pendingCorrectTimeout = setTimeout(advanceAfterCorrect, 900);
  }

  function spawnConfetti() {
    confettiContainer.innerHTML = '';
    const count = 40;
    for (let i = 0; i < count; i++) {
      const span = document.createElement('span');
      span.style.left = Math.random() * 100 + '%';
      span.style.backgroundColor = CONFETTI_COLORS[randomInt(0, CONFETTI_COLORS.length - 1)];
      span.style.animationDelay = Math.random() * 0.3 + 's';
      span.style.animationDuration = (0.8 + Math.random() * 0.6) + 's';
      confettiContainer.appendChild(span);
    }
    setTimeout(() => { confettiContainer.innerHTML = ''; }, 1500);
  }

  function showWrong(correctAnswer) {
    correctAnswerDisplay.textContent = String(correctAnswer);
    wrongOverlay.classList.add('show');
    setTimeout(() => {
      wrongOverlay.classList.remove('show');
    }, 1500);
  }

  function nextAfterDelay(ms) {
    setTimeout(() => {
      state.currentIndex++;
      if (state.currentIndex >= state.questions.length) {
        endRound();
      } else {
        updateScoreDisplay();
        startQuestion();
      }
    }, ms);
  }

  function submitAnswer() {
    if (answerInput.disabled) return;

    const raw = answerInput.value.trim();
    const num = parseInt(raw, 10);
    const q = state.questions[state.currentIndex];

    if (raw === '' || isNaN(num)) {
      answerInput.focus();
      return;
    }

    stopTimer();
    answerInput.disabled = true;
    submitBtn.disabled = true;

    if (num === q.answer) {
      state.score++;
      updateScoreDisplay();
      showCorrect();
    } else {
      showWrong(q.answer);
      nextAfterDelay(1500);
    }
  }

  function spawnCelebrationConfetti() {
    if (!celebrationConfettiEl) return;
    celebrationConfettiEl.innerHTML = '';
    const colors = CONFETTI_COLORS.concat(['#22c55e', '#fbbf24']);
    const count = 80;
    for (let i = 0; i < count; i++) {
      const span = document.createElement('span');
      span.style.left = Math.random() * 100 + '%';
      span.style.backgroundColor = colors[randomInt(0, colors.length - 1)];
      span.style.animationDelay = Math.random() * 0.8 + 's';
      span.style.animationDuration = (2 + Math.random() * 1.5) + 's';
      celebrationConfettiEl.appendChild(span);
    }
    setTimeout(() => { if (celebrationConfettiEl) celebrationConfettiEl.innerHTML = ''; }, 4000);
  }

  function endRound() {
    stopTimer();
    const total = state.questions.length;
    const isPerfect = state.score === total;

    if (isPerfect) {
      showScreen(celebrationScreen);
      if (celebrationScoreEl) celebrationScoreEl.textContent = state.score;
      if (celebrationTotalEl) celebrationTotalEl.textContent = total;
      spawnCelebrationConfetti();
    } else {
      showScreen(resultsScreen);
      finalScoreEl.textContent = state.score;
      if (resultsTotalEl) resultsTotalEl.textContent = total;
      const pct = (state.score / total) * 100;
      if (pct >= 90) {
        resultsMessageEl.textContent = 'Fantastiskt! Du är en multiplikationsmästare! 🏆';
      } else if (pct >= 70) {
        resultsMessageEl.textContent = 'Bra jobbat! Fortsätt träna så blir du ännu bättre. 👍';
      } else {
        resultsMessageEl.textContent = 'Fortsätt öva tabellerna – du klarar nästa omgång! 💪';
      }
    }
  }

  function init() {
    document.querySelectorAll('.round-count-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const count = parseInt(btn.getAttribute('data-count'), 10);
        if (QUESTION_COUNTS.indexOf(count) !== -1) {
          state.questionsPerRound = count;
          document.querySelectorAll('.round-count-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
        }
      });
    });

    document.querySelectorAll('.mode-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode');
        if (MODES[mode]) startRound(mode);
      });
    });

    submitBtn.addEventListener('click', submitAnswer);
    answerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitAnswer();
    });

    if (correctOverlay) {
      correctOverlay.addEventListener('click', onCorrectOverlayTap);
      correctOverlay.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onCorrectOverlayTap();
        }
      });
    }

    playAgainBtn.addEventListener('click', () => startRound(state.mode));
    changeModeBtn.addEventListener('click', () => showScreen(modeScreen));
    if (celebrationPlayAgainBtn) celebrationPlayAgainBtn.addEventListener('click', () => startRound(state.mode));
    if (celebrationChangeModeBtn) celebrationChangeModeBtn.addEventListener('click', () => showScreen(modeScreen));
  }

  init();
})();

(function () {
  'use strict';

  const QUESTIONS_PER_ROUND = 20;
  const TIME_EASY = 30;
  const TIME_MEDIUM = 10;
  const TIME_HARD = 5;

  const MODES = {
    easy: { time: TIME_EASY, label: 'Lätt' },
    medium: { time: TIME_MEDIUM, label: 'Medium' },
    hard: { time: TIME_HARD, label: 'Svår' }
  };

  const CONFETTI_COLORS = ['#22c55e', '#38bdf8', '#fbbf24', '#a78bfa', '#f472b6', '#f87171'];

  let state = {
    mode: null,
    timePerQuestion: TIME_EASY,
    questions: [],
    currentIndex: 0,
    score: 0,
    timerId: null,
    timerStart: null,
    timerEnd: null
  };

  const $ = (id) => document.getElementById(id);
  const modeScreen = $('mode-screen');
  const gameScreen = $('game-screen');
  const resultsScreen = $('results-screen');
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

  function showScreen(screen) {
    [modeScreen, gameScreen, resultsScreen].forEach(el => el.classList.remove('active'));
    screen.classList.add('active');
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function generateQuestions() {
    const list = [];
    for (let i = 0; i < QUESTIONS_PER_ROUND; i++) {
      const a = randomInt(1, 10);
      const b = randomInt(1, 10);
      list.push({ a, b, answer: a * b });
    }
    return list;
  }

  function startRound(mode) {
    state.mode = mode;
    state.timePerQuestion = MODES[mode].time;
    state.questions = generateQuestions();
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
    questionNumEl.textContent = `${state.currentIndex + 1} / ${QUESTIONS_PER_ROUND}`;
  }

  function startQuestion() {
    const q = state.questions[state.currentIndex];
    questionEl.textContent = `${q.a} × ${q.b} = ?`;
    answerInput.value = '';
    answerInput.focus();
    answerInput.disabled = false;
    submitBtn.disabled = false;

    const totalMs = state.timePerQuestion * 1000;
    state.timerStart = Date.now();
    state.timerEnd = state.timerStart + totalMs;

    if (state.timerId) clearInterval(state.timerId);
    state.timerId = setInterval(tickTimer, 50);
    timerWrap.classList.remove('warning');
    tickTimer();
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

  function showCorrect() {
    correctOverlay.classList.add('show');
    correctOverlay.setAttribute('aria-hidden', 'false');
    spawnConfetti();
    setTimeout(() => {
      correctOverlay.classList.remove('show');
      correctOverlay.setAttribute('aria-hidden', 'true');
    }, 800);
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
      nextAfterDelay(900);
    } else {
      showWrong(q.answer);
      nextAfterDelay(1500);
    }
  }

  function endRound() {
    stopTimer();
    showScreen(resultsScreen);
    finalScoreEl.textContent = state.score;
    const pct = (state.score / QUESTIONS_PER_ROUND) * 100;
    if (pct >= 90) {
      resultsMessageEl.textContent = 'Fantastiskt! Du är en multiplikationsmästare! 🏆';
    } else if (pct >= 70) {
      resultsMessageEl.textContent = 'Bra jobbat! Fortsätt träna så blir du ännu bättre. 👍';
    } else {
      resultsMessageEl.textContent = 'Fortsätt öva tabellerna – du klarar nästa omgång! 💪';
    }
  }

  function init() {
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

    playAgainBtn.addEventListener('click', () => startRound(state.mode));
    changeModeBtn.addEventListener('click', () => showScreen(modeScreen));
  }

  init();
})();

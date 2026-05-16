<script lang="ts">
  import { onMount } from 'svelte'
  import { gameState, setBenchmarkTier } from '../state/game.svelte'
  import { CONFIG } from '../game.config'
  import { capture } from '../lib/analytics'

  const QUESTIONS = [
    { q: "What is the time complexity of binary search?", opts: ["O(n)", "O(log n)", "O(n²)", "O(1)"], ans: 1, src: "ARC" },
    { q: "Which planet has the most moons?", opts: ["Jupiter", "Saturn", "Uranus", "Neptune"], ans: 1, src: "MMLU" },
    { q: "If a train travels 60mph for 2.5 hours, how far does it travel?", opts: ["120 miles", "150 miles", "135 miles", "180 miles"], ans: 1, src: "GSM8K" },
    { q: "What is the output of: list(range(2, 10, 3))?", opts: ["[2,5,8]", "[2,4,6,8]", "[2,3,4,5]", "[3,6,9]"], ans: 0, src: "ARC" },
    { q: "The speed of light is approximately:", opts: ["3×10⁶ m/s", "3×10⁸ m/s", "3×10¹⁰ m/s", "3×10⁴ m/s"], ans: 1, src: "MMLU" },
    { q: "What does 'git rebase' do?", opts: ["Merges branches", "Reapplies commits on a new base", "Deletes a branch", "Creates a new commit"], ans: 1, src: "ARC" },
    { q: "A store sells 3 apples for $1.20. How much for 7 apples?", opts: ["$2.40", "$2.80", "$3.00", "$2.60"], ans: 1, src: "GSM8K" },
    { q: "Which algorithm is used in Transformers for sequence modeling?", opts: ["LSTM", "Self-Attention", "Convolution", "Markov Chains"], ans: 1, src: "MMLU" },
    { q: "What is the derivative of x³?", opts: ["2x", "3x²", "x²", "3x"], ans: 1, src: "MMLU" },
    { q: "Which data structure uses LIFO ordering?", opts: ["Queue", "Stack", "Heap", "Graph"], ans: 1, src: "ARC" },
  ]

  const { score_thresholds, time_limit_s, auto_refresh_ms } = CONFIG.minigames.benchmark_eval

  type Phase = 'idle' | 'running' | 'done'

  let evalPhase = $state<Phase>('idle')
  let questionIndex = $state(0)
  let correctCount = $state(0)
  let lastAnswer = $state<'correct' | 'wrong' | null>(null)
  let timeLeft = $state(time_limit_s)
  let timerInterval: ReturnType<typeof setInterval> | null = null
  let resultTier = $state(0)
  let minimized = $state(false)

  // Auto-eval countdown
  let autoEvalCountdown = $state(auto_refresh_ms / 1000)
  let autoEvalInterval: ReturnType<typeof setInterval> | null = null

  function startEval() {
    evalPhase = 'running'
    questionIndex = 0
    correctCount = 0
    lastAnswer = null
    timeLeft = time_limit_s
    timerInterval = setInterval(() => {
      if (lastAnswer !== null) return
      timeLeft -= 0.1
      if (timeLeft <= 0) {
        endEval()
      }
    }, 100)
  }

  function pickAnswer(idx: number) {
    if (lastAnswer !== null) return
    const q = QUESTIONS[questionIndex]
    const correct = idx === q.ans
    if (correct) correctCount++
    lastAnswer = correct ? 'correct' : 'wrong'
    setTimeout(() => {
      lastAnswer = null
      questionIndex++
      if (questionIndex >= QUESTIONS.length) {
        endEval()
      }
    }, 800)
  }

  function endEval() {
    if (timerInterval) clearInterval(timerInterval)
    timerInterval = null
    const rawFraction = correctCount / QUESTIONS.length
    // Model capability boost
    const boost = Math.min(gameState.trainingRunsCompleted * 0.03, 0.30)
    const score = Math.min(1, rawFraction + boost)
    let tier = 1
    if (score >= score_thresholds.tier5) tier = 5
    else if (score >= score_thresholds.tier4) tier = 4
    else if (score >= score_thresholds.tier3) tier = 3
    else tier = Math.max(1, Math.min(2, Math.floor(score * 3)))
    resultTier = tier
    setBenchmarkTier(tier)
    capture('minigame_completed', {
      minigame: 'benchmark_eval',
      score: rawFraction,
      tier_achieved: tier,
      phase: gameState.phase,
    })
    evalPhase = 'done'
    resetAutoEval()
  }

  function resetAutoEval() {
    autoEvalCountdown = auto_refresh_ms / 1000
  }

  // Auto-eval every 5min using average historical score
  function runAutoEval() {
    const autoScore = Math.min(1, (gameState.trainingRunsCompleted * 0.03) + 0.4)
    const boost = Math.min(gameState.trainingRunsCompleted * 0.03, 0.30)
    const score = Math.min(1, autoScore + boost)
    let tier = 1
    if (score >= score_thresholds.tier5) tier = 5
    else if (score >= score_thresholds.tier4) tier = 4
    else if (score >= score_thresholds.tier3) tier = 3
    setBenchmarkTier(tier)
    resultTier = tier
  }

  onMount(() => {
    autoEvalInterval = setInterval(() => {
      autoEvalCountdown -= 1
      if (autoEvalCountdown <= 0) {
        runAutoEval()
        resetAutoEval()
      }
    }, 1000)
    return () => {
      if (autoEvalInterval) clearInterval(autoEvalInterval)
      if (timerInterval) clearInterval(timerInterval)
    }
  })

  let timerPct = $derived(timeLeft / time_limit_s * 100)
  let currentQ = $derived(evalPhase === 'running' ? QUESTIONS[questionIndex] : null)
  let autoMinLeft = $derived(Math.ceil(autoEvalCountdown / 60))
</script>

{#if gameState.phase >= 3}
<section class="beval">
  <button class="beval-toggle" onclick={() => minimized = !minimized}>
    BENCHMARK EVAL {minimized ? '▼' : '▲'}
    {#if gameState.benchmarkTierOverride > 0}
      <span style="color:var(--color-money)">Tier {gameState.benchmarkTierOverride} · NEXT AUTO IN {autoMinLeft}m</span>
    {/if}
  </button>

  {#if !minimized}
    {#if evalPhase === 'idle'}
      <div class="beval-idle">
        <p class="beval-desc">Run a 10-question eval to unlock higher capability tiers and better API pricing. 30s total time limit.</p>
        {#if gameState.benchmarkTierOverride > 0}
          <p class="beval-result">Current tier: <strong>Tier {gameState.benchmarkTierOverride}</strong> · Next auto-eval in {autoMinLeft}m</p>
        {/if}
        <button class="run-btn" onclick={startEval}>RUN EVAL</button>
      </div>
    {:else if evalPhase === 'running' && currentQ}
      <!-- Timer bar -->
      <div class="beval-timer-bg">
        <div class="beval-timer-fill" style="width:{timerPct}%"></div>
      </div>
      <div class="beval-progress">{questionIndex + 1} / {QUESTIONS.length} · {timeLeft.toFixed(1)}s left</div>

      <div class="beval-question" class:flash-correct={lastAnswer==='correct'} class:flash-wrong={lastAnswer==='wrong'}>
        <div class="q-src">{currentQ.src}</div>
        <p class="q-text">{currentQ.q}</p>
        <div class="q-opts">
          {#each currentQ.opts as opt, i}
            <button
              class="opt-btn"
              class:opt-correct={lastAnswer === 'correct' && i === currentQ.ans}
              class:opt-wrong={lastAnswer === 'wrong' && i !== currentQ.ans}
              onclick={() => pickAnswer(i)}
              disabled={lastAnswer !== null}
            >
              {String.fromCharCode(65 + i)}. {opt}
            </button>
          {/each}
        </div>
      </div>
    {:else if evalPhase === 'done'}
      <div class="beval-done">
        <div class="done-tier">TIER {resultTier} ACHIEVED</div>
        <div class="done-score">{correctCount} / {QUESTIONS.length} correct</div>
        <div class="done-boost">+{Math.min(gameState.trainingRunsCompleted * 3, 30)}% model boost applied</div>
        <p class="done-desc">Capability tier set to {resultTier}. Next auto-eval in {autoMinLeft}m.</p>
        <button class="run-btn" onclick={startEval}>RUN EVAL AGAIN</button>
      </div>
    {/if}
  {/if}
</section>
{/if}

<style>
  .beval { display: flex; flex-direction: column; gap: 0; }

  .beval-toggle {
    font-family: var(--font-pixel); font-size: 6px; padding: 5px 8px;
    background: #e8dfc8; border: 1px solid var(--color-border);
    color: var(--color-locked); cursor: pointer; text-align: left;
    letter-spacing: 1px; display: flex; gap: 8px; align-items: center;
  }
  .beval-toggle:hover { background: var(--color-border); color: var(--color-bg); }

  .beval-idle, .beval-done {
    background: var(--color-card-bg); border: 2px solid var(--color-border);
    padding: 12px; display: flex; flex-direction: column; gap: 8px;
  }
  .beval-desc, .done-desc { font-size: 6px; color: var(--color-locked); line-height: 1.8; }
  .beval-result { font-size: 6px; color: var(--color-text); }

  .done-tier {
    font-size: 14px; color: var(--color-money); letter-spacing: 2px;
    text-align: center; padding: 8px 0;
  }
  .done-score { font-size: 8px; text-align: center; color: var(--color-text); }
  .done-boost { font-size: 6px; text-align: center; color: var(--color-compute); }

  .run-btn {
    font-family: var(--font-pixel); font-size: 7px; padding: 8px 16px;
    background: var(--color-compute); color: white; border: none; cursor: pointer;
    align-self: flex-start;
  }
  .run-btn:hover { background: #1a4a7a; }

  .beval-timer-bg {
    height: 6px; background: #d8ceb8;
    border: 1px solid var(--color-border);
  }
  .beval-timer-fill {
    height: 100%; background: var(--color-compute); transition: width 0.1s linear;
  }
  .beval-progress {
    font-size: 6px; color: var(--color-locked); padding: 3px 8px;
    background: #f0e8d0; border: 1px solid var(--color-border); border-top: none;
  }

  .beval-question {
    background: var(--color-card-bg); border: 2px solid var(--color-border);
    padding: 10px; display: flex; flex-direction: column; gap: 8px;
    transition: border-color 0.2s, background 0.2s;
  }
  .beval-question.flash-correct { border-color: var(--color-money); background: #eaf4ea; }
  .beval-question.flash-wrong   { border-color: var(--color-error); background: #f4eaea; }

  .q-src { font-size: 6px; color: var(--color-locked); letter-spacing: 1px; }
  .q-text { font-size: 8px; color: var(--color-text); line-height: 1.6; }

  .q-opts { display: flex; flex-direction: column; gap: 4px; }
  .opt-btn {
    font-family: var(--font-pixel); font-size: 6px; padding: 6px 8px;
    background: var(--color-panel-bg); border: 1px solid var(--color-border);
    color: var(--color-text); cursor: pointer; text-align: left;
    transition: background 0.1s, border-color 0.1s;
  }
  .opt-btn:hover:not(:disabled) { background: var(--color-border); color: var(--color-bg); }
  .opt-btn:disabled { cursor: default; }
  .opt-btn.opt-correct { background: #eaf4ea; border-color: var(--color-money); color: var(--color-money); }
  .opt-btn.opt-wrong   { opacity: 0.5; }
</style>

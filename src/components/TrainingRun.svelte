<script lang="ts">
  import { gameState, startTrainingRun, canStartTrainingRun, getTokensRequiredForRun, getTotalTflops } from '../state/game.svelte'
  import { formatTokens, formatMoney } from '../lib/format'
  import BpeMinigame from './BpeMinigame.svelte'

  let check = $derived(canStartTrainingRun())
  let required = $derived(getTokensRequiredForRun())
  let bufferPct = $derived(Math.min(gameState.trainingDataTokens / required * 100, 100))
  let hasTflops = $derived(getTotalTflops() > 0)

  // Show BPE inline when: has GPU, BPE not done yet
  let showBpe = $derived(hasTflops && !gameState.bpeCompleted)
</script>

<section class="training">
  <header class="training-header">
    <span class="training-title">TRAINING RUN</span>
    <span class="run-count muted">run #{gameState.trainingRunsCompleted + 1}</span>
  </header>

  {#if showBpe}
    <!-- Gate: BPE tokenizer must be completed first -->
    <div class="bpe-gate">
      <p class="gate-label warning">Complete the tokenizer to unlock training runs:</p>
      <BpeMinigame />
    </div>
  {:else if !hasTflops}
    <p class="prereq muted">Buy a GPU first (RTX 3090 → $1,500)</p>
  {:else}
    <!-- Token buffer -->
    <div class="buffer-row">
      <span class="buffer-label">TOKEN BUFFER</span>
      <span class="buffer-val">
        {formatTokens(gameState.trainingDataTokens)}
        <span class="muted"> / {formatTokens(required)} needed</span>
      </span>
    </div>
    <div class="buffer-bar">
      <div class="buffer-fill" style="width: {bufferPct}%"
        class:ready={bufferPct >= 100}></div>
    </div>

    {#if gameState.isTrainingRunning}
      <!-- In-progress -->
      <div class="running-row">
        <span class="running-label compute">⚙ TRAINING…</span>
        <span class="running-pct compute">{Math.floor(gameState.trainingProgress * 100)}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: {gameState.trainingProgress * 100}%"></div>
      </div>
      <p class="running-hint muted">
        Allocation: {100 - gameState.inferencePercent}% compute to training
      </p>
    {:else}
      <!-- Ready to start -->
      <button
        class="run-btn"
        class:ready={check.ok}
        disabled={!check.ok}
        onclick={startTrainingRun}
      >
        {check.ok ? '▶ START TRAINING RUN' : check.reason}
      </button>

      {#if gameState.trainingRunsCompleted > 0}
        <p class="last-run muted">
          Last run: +{formatTokens(required / 2.5 * gameState.bpeMultiplier)} effective tokens trained
        </p>
      {/if}
    {/if}
  {/if}
</section>

<style>
  .training {
    background: var(--color-panel-bg);
    border: 2px solid var(--color-border);
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .training-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .training-title {
    font-size: 8px;
    color: var(--color-border);
  }

  .run-count { font-size: 6px; }

  .bpe-gate {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .gate-label { font-size: 7px; }

  .prereq { font-size: 7px; }

  /* Buffer */
  .buffer-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 4px;
  }

  .buffer-label {
    font-size: 6px;
    color: var(--color-locked);
  }

  .buffer-val {
    font-size: 7px;
  }

  .buffer-bar {
    height: 6px;
    background: #d8ceb8;
    border-radius: 2px;
    overflow: hidden;
  }

  .buffer-fill {
    height: 100%;
    background: var(--color-compute);
    transition: width 0.3s ease;
  }

  .buffer-fill.ready {
    background: var(--color-money);
  }

  /* Running state */
  .running-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .running-label { font-size: 8px; }
  .running-pct   { font-size: 8px; }

  .progress-bar {
    height: 8px;
    background: #d8ceb8;
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--color-compute);
    transition: width 0.15s linear;
  }

  .running-hint { font-size: 6px; }

  /* Run button */
  .run-btn {
    width: 100%;
    padding: 10px;
    font-family: var(--font-pixel);
    font-size: 7px;
    border: 2px solid var(--color-border);
    background: #d0c8b0;
    color: var(--color-locked);
    cursor: not-allowed;
    text-align: center;
  }

  .run-btn.ready {
    background: var(--color-compute);
    border-color: var(--color-compute);
    color: white;
    cursor: pointer;
    animation: pulse-glow 2s ease-in-out infinite;
  }

  .run-btn.ready:hover {
    background: #3a6f95;
  }

  .last-run { font-size: 6px; }

  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(74, 127, 165, 0); }
    50%       { box-shadow: 0 0 0 4px rgba(74, 127, 165, 0.3); }
  }
</style>

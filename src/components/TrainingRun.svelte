<script lang="ts">
  import { gameState, startTrainingRun, canStartTrainingRun, getTokensRequiredForRun, getTotalTflops, getCapabilityTier } from '../state/game.svelte'
  import { formatTokens, formatMoney } from '../lib/format'
  import BpeMinigame from './BpeMinigame.svelte'
  import HyperparamTuning from './HyperparamTuning.svelte'

  const TIER_NAMES = ['', 'Noise', 'Proto', 'Useful', 'Expert', 'AGI']

  let check     = $derived(canStartTrainingRun())
  let required  = $derived(getTokensRequiredForRun())
  let bufferPct = $derived(Math.min(gameState.trainingDataTokens / required * 100, 100))
  let hasTflops = $derived(getTotalTflops() > 0)
  let showBpe   = $derived(hasTflops && !gameState.bpeCompleted)
  let tier      = $derived(getCapabilityTier())

  // Completion flash — fires when trainingRunsCompleted increases
  let prevRuns   = $state(gameState.trainingRunsCompleted)
  let flashText  = $state('')
  let showFlash  = $state(false)

  $effect(() => {
    if (gameState.trainingRunsCompleted > prevRuns) {
      prevRuns = gameState.trainingRunsCompleted
      const tierName = TIER_NAMES[getCurrentTierIndex()] ?? 'Unknown'
      const bonus = Math.round(gameState.hyperparamBonus * 100)
      flashText = `MODEL UPDATED · +${bonus}% bonus · Tier: ${tierName}`
      showFlash = true
      setTimeout(() => { showFlash = false }, 3500)
    }
  })

  function getCurrentTierIndex(): number {
    const tiers = [0, 1e9, 1e11, 1e12, 1e13]
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (gameState.tokensTrained >= tiers[i]) return i + 1
    }
    return 1
  }
</script>

<section class="training">
  <header class="training-header">
    <span class="training-title">TRAINING RUN</span>
    <span class="run-count muted">run #{gameState.trainingRunsCompleted + 1}</span>
  </header>

  {#if showFlash}
    <div class="complete-flash">
      <span>✓ {flashText}</span>
    </div>
  {/if}

  {#if showBpe}
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
        <span class="muted"> / {formatTokens(required)}</span>
      </span>
    </div>
    <div class="buffer-bar">
      <div class="buffer-fill" style="width: {bufferPct}%" class:ready={bufferPct >= 100}></div>
    </div>

    {#if gameState.isTrainingRunning}
      <div class="running-row">
        <span class="running-label compute">⚙ TRAINING…</span>
        <span class="running-pct compute">{Math.floor(gameState.trainingProgress * 100)}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: {gameState.trainingProgress * 100}%"></div>
      </div>
      <p class="running-hint muted">
        {100 - gameState.inferencePercent}% compute → training ·
        +{(gameState.hyperparamBonus * 100).toFixed(0)}% hyperparam bonus
      </p>

    {:else}
      <HyperparamTuning />

      <button
        class="run-btn"
        class:ready={check.ok}
        disabled={!check.ok}
        onclick={startTrainingRun}
      >
        {check.ok ? `▶ START RUN · +${(gameState.hyperparamBonus * 100).toFixed(0)}% bonus` : check.reason}
      </button>
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

  .training-title { font-size: 8px; color: var(--color-border); }
  .run-count      { font-size: 6px; }

  /* Completion flash */
  .complete-flash {
    background: #1a2e1a;
    border: 1px solid var(--color-money);
    padding: 8px;
    font-size: 7px;
    color: #80d080;
    animation: flash-in 0.3s ease;
    text-align: center;
  }

  .bpe-gate { display: flex; flex-direction: column; gap: 8px; }
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

  .buffer-label { font-size: 6px; color: var(--color-locked); }
  .buffer-val   { font-size: 7px; }

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

  .buffer-fill.ready { background: var(--color-money); }

  /* Running */
  .running-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .running-label { font-size: 8px; }
  .running-pct   { font-size: 8px; }

  .progress-bar {
    height: 10px;
    background: #d8ceb8;
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--color-compute);
    transition: width 0.15s linear;
    background: linear-gradient(90deg, var(--color-compute), #80c0e0);
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
    margin-top: 4px;
  }

  .run-btn.ready {
    background: var(--color-compute);
    border-color: var(--color-compute);
    color: white;
    cursor: pointer;
    animation: pulse-glow 2s ease-in-out infinite;
  }

  .run-btn.ready:hover { background: #3a6f95; }

  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(74, 127, 165, 0); }
    50%       { box-shadow: 0 0 0 4px rgba(74, 127, 165, 0.3); }
  }

  @keyframes flash-in {
    from { opacity: 0; transform: scaleY(0.8); }
    to   { opacity: 1; transform: scaleY(1); }
  }
</style>

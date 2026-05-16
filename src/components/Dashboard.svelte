<script lang="ts">
  import { gameState, getTokensPerSecond, getTotalTflops, getMarginPerSecond, getEnergyCostPerSecond, getTotalPowerDraw, getTotalPowerCapacity, getDataTokensPerSecond, getGpuRentalIncome, getCapabilityTier } from '../state/game.svelte'
  import { formatMoney, formatTokens, formatTflops } from '../lib/format'
  import DataLabeling from './DataLabeling.svelte'
  import TrainingRun from './TrainingRun.svelte'
  import Settings from './Settings.svelte'

  let labelingOpen = $state(true)

  let tps      = $derived(getTokensPerSecond())
  let tflops   = $derived(getTotalTflops())
  let margin   = $derived(getMarginPerSecond())
  let rental   = $derived(getGpuRentalIncome())
  let powerDraw = $derived(getTotalPowerDraw())
  let powerCap  = $derived(getTotalPowerCapacity() * 1000)
  let dataTps   = $derived(getDataTokensPerSecond())
  let powerOk   = $derived(powerDraw <= powerCap)
  let tier      = $derived(getCapabilityTier())
  let apiRevenue = $derived(tps * tier.price_per_million / 1_000_000)

  const TIER_LABELS = ['Noise', 'Proto', 'Useful', 'Expert', 'AGI']
  function tierIndex(): number {
    const thresholds = [0, 1e9, 1e11, 1e12, 1e13]
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (gameState.tokensTrained >= thresholds[i]) return i
    }
    return 0
  }

  function getPhaseLabel(phase: number): string {
    return ['', 'Freelancer', 'Scrappy Lab', 'Real Lab', 'Frontier', 'AGI'][phase] ?? ''
  }
</script>

<main class="dashboard">
  <header class="dash-header">
    <span class="phase-label">Phase {gameState.phase}: {getPhaseLabel(gameState.phase)}</span>
    <span class="money money-display">{formatMoney(gameState.money)}</span>
    <Settings />
  </header>

  <!-- Model capability card -->
  <section class="model-card">
    <div class="model-tier">
      <span class="tier-label">MODEL</span>
      <span class="tier-name">{TIER_LABELS[tierIndex()]}</span>
      <span class="tier-price money">{formatMoney(tier.price_per_million)}/M tokens</span>
    </div>
    <div class="model-stats">
      <div class="model-stat">
        <span class="muted">API</span>
        <span class="money">{formatMoney(apiRevenue)}/s</span>
      </div>
      <div class="model-stat">
        <span class="muted">Rental</span>
        <span class="money">{formatMoney(rental)}/s</span>
      </div>
      <div class="model-stat">
        <span class="muted">Margin</span>
        <span class:money={margin >= 0} class:warning={margin < 0}>
          {margin >= 0 ? '+' : ''}{formatMoney(margin)}/s
        </span>
      </div>
      <div class="model-stat">
        <span class="muted">Trained</span>
        <span>{formatTokens(gameState.tokensTrained)}</span>
      </div>
    </div>
  </section>

  <section class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">COMPUTE</div>
      <div class="stat-value compute">{formatTflops(tflops)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">TOKENS/s</div>
      <div class="stat-value compute">{formatTokens(tps)} T/s</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">DATA BUFFER</div>
      <div class="stat-value">{formatTokens(gameState.trainingDataTokens)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">DATA IN/s</div>
      <div class="stat-value">{formatTokens(dataTps)} tok/s</div>
    </div>
    <div class="stat-card" class:warning-card={!powerOk}>
      <div class="stat-label">POWER</div>
      <div class="stat-value" class:warning={!powerOk}>
        {powerDraw.toFixed(1)} / {powerCap.toFixed(0)} kW
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-label">RUNS DONE</div>
      <div class="stat-value">{gameState.trainingRunsCompleted}</div>
    </div>
  </section>

  <section class="alloc-section">
    <div class="alloc-label">
      <span>TRAINING</span>
      <span class="alloc-pct">{100 - gameState.inferencePercent}%</span>
      <span class="alloc-mid">↔</span>
      <span class="alloc-pct">{gameState.inferencePercent}%</span>
      <span>INFERENCE</span>
    </div>
    <input
      type="range"
      min="0"
      max="100"
      bind:value={gameState.inferencePercent}
      class="alloc-slider"
      aria-label="Compute allocation: training vs inference"
    />
    <div class="alloc-presets">
      <button onclick={() => gameState.inferencePercent = 20}>Research</button>
      <button onclick={() => gameState.inferencePercent = 50}>Balanced</button>
      <button onclick={() => gameState.inferencePercent = 80}>Revenue Max</button>
    </div>
  </section>

  <div class="section-wrap">
    <button class="section-toggle" onclick={() => labelingOpen = !labelingOpen}>
      DATA LABELING {labelingOpen ? '▲' : '▼'}
    </button>
    {#if labelingOpen}
      <DataLabeling />
    {/if}
  </div>

  <TrainingRun />
</main>

<style>
  .dashboard {
    border-right: 2px solid var(--color-border);
    background: var(--color-bg);
    display: flex;
    flex-direction: column;
    padding: 12px;
    gap: 12px;
    overflow-y: auto;
  }

  /* Model card */
  .model-card {
    background: #1a1208;
    border: 2px solid var(--color-border);
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .model-tier {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .tier-label {
    font-size: 6px;
    color: #6a5a30;
    letter-spacing: 2px;
  }

  .tier-name {
    font-size: 11px;
    color: #f0d080;
    flex: 1;
  }

  .tier-price { font-size: 7px; }

  .model-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }

  .model-stat {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 7px;
    padding: 3px 6px;
    background: #2a2010;
    border: 1px solid #3a3020;
  }

  .model-stat .muted { font-size: 6px; }

  .dash-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 8px;
    border-bottom: 2px solid var(--color-border);
  }

  .phase-label {
    font-size: 8px;
    color: var(--color-warning);
  }

  .money-display {
    font-size: 14px;
    flex: 1;
    text-align: center;
  }

  .section-wrap {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .section-toggle {
    font-family: var(--font-pixel);
    font-size: 6px;
    padding: 5px 8px;
    background: #e8dfc8;
    border: 1px solid var(--color-border);
    color: var(--color-locked);
    cursor: pointer;
    text-align: left;
    letter-spacing: 1px;
  }

  .section-toggle:hover {
    background: var(--color-border);
    color: var(--color-bg);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .stat-card {
    background: var(--color-panel-bg);
    border: 1px solid var(--color-border);
    padding: 8px;
  }

  .warning-card {
    border-color: var(--color-warning);
    background: #fff8e8;
  }

  .stat-label {
    font-size: 6px;
    color: var(--color-locked);
    margin-bottom: 4px;
  }

  .stat-value {
    font-size: 9px;
  }

  .alloc-section {
    background: var(--color-panel-bg);
    border: 1px solid var(--color-border);
    padding: 10px;
  }

  .alloc-label {
    display: flex;
    justify-content: space-between;
    font-size: 7px;
    margin-bottom: 8px;
  }

  .alloc-mid {
    color: var(--color-border);
  }

  .alloc-pct {
    color: var(--color-compute);
  }

  .alloc-slider {
    width: 100%;
    accent-color: var(--color-compute);
    cursor: pointer;
  }

  .alloc-presets {
    display: flex;
    gap: 4px;
    margin-top: 6px;
  }

  .alloc-presets button {
    flex: 1;
    font-family: var(--font-pixel);
    font-size: 6px;
    padding: 4px 2px;
    background: var(--color-card-bg);
    border: 1px solid var(--color-border);
    color: var(--color-text);
    cursor: pointer;
  }

  .alloc-presets button:hover {
    background: var(--color-border);
    color: var(--color-bg);
  }

  .hint-card {
    background: #fff8e8;
    border: 1px solid var(--color-warning);
    padding: 10px;
    font-size: 8px;
    line-height: 2;
  }
</style>

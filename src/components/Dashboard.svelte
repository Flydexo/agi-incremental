<script lang="ts">
  import { gameState, getTokensPerSecond, getTotalTflops, getMarginPerSecond, getEnergyCostPerSecond, getTotalPowerDraw, getTotalPowerCapacity, getDataTokensPerSecond } from '../state/game.svelte'
  import { formatMoney, formatTokens, formatTflops } from '../lib/format'

  let tps = $derived(getTokensPerSecond())
  let tflops = $derived(getTotalTflops())
  let margin = $derived(getMarginPerSecond())
  let energyCost = $derived(getEnergyCostPerSecond())
  let powerDraw = $derived(getTotalPowerDraw())
  let powerCap = $derived(getTotalPowerCapacity() * 1000)
  let dataTps = $derived(getDataTokensPerSecond())
  let powerOk = $derived(powerDraw <= powerCap)

  function getPhaseLabel(phase: number): string {
    return ['', 'Freelancer', 'Scrappy Lab', 'Real Lab', 'Frontier', 'AGI'][phase] ?? ''
  }
</script>

<main class="dashboard">
  <header class="dash-header">
    <span class="phase-label">Phase {gameState.phase}: {getPhaseLabel(gameState.phase)}</span>
    <span class="money money-display">{formatMoney(gameState.money)}</span>
  </header>

  <section class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">REVENUE/s</div>
      <div class="stat-value money">
        {formatMoney(margin > 0 ? margin + energyCost : 0)}/s
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-label">MARGIN/s</div>
      <div class="stat-value" class:money={margin >= 0} class:warning={margin < 0}>
        {margin >= 0 ? '+' : ''}{formatMoney(margin)}/s
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-label">TOKENS/s</div>
      <div class="stat-value compute">{formatTokens(tps)} T/s</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">COMPUTE</div>
      <div class="stat-value compute">{formatTflops(tflops)}</div>
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
      <div class="stat-label">TRAINED</div>
      <div class="stat-value">{formatTokens(gameState.tokensTrained)}</div>
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

  {#if gameState.phase === 1 && !gameState.bpeCompleted}
    <section class="hint-card">
      <p>Save <span class="money">$1,500</span> to buy your first RTX 3090.</p>
      <p class="muted">Label data in the store to earn money.</p>
    </section>
  {/if}
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

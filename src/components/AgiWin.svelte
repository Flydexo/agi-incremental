<script lang="ts">
  import { gameState, resetGame } from '../state/game.svelte'
  import { formatTokens, formatMoney } from '../lib/format'

  function formatDuration(s: number): string {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    if (h > 0) return `${h}h ${m}m`
    return `${m}m ${Math.floor(s % 60)}s`
  }
</script>

<div class="agi-backdrop">
    <div class="agi-panel">
      <div class="agi-title">AGI ACHIEVED</div>
      <div class="agi-subtitle">You trained the model that ends history.</div>

      <div class="agi-stats">
        <div class="stat-row">
          <span class="stat-label">Tokens Trained</span>
          <span class="stat-value money">{formatTokens(gameState.tokensTrained)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Training Runs</span>
          <span class="stat-value compute">{gameState.trainingRunsCompleted}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Money Earned</span>
          <span class="stat-value money">{formatMoney(gameState.moneyEver)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Playtime</span>
          <span class="stat-value">{formatDuration(gameState.totalPlaytimeSeconds)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Techniques</span>
          <span class="stat-value">{gameState.techniques.size}</span>
        </div>
      </div>

      <div class="agi-flavor">
        <p>The model you built has now crossed the threshold. It understands language, code, science, and strategy
        better than any human. What happens next is unwritten.</p>
        <p class="dim">You could keep going — accumulate more compute, more capital, more techniques.
        Or start over and see how fast you can get here.</p>
      </div>

      <div class="agi-actions">
        <button class="btn-continue" onclick={() => gameState.agiAchieved = false}>
          ▶ CONTINUE PLAYING
        </button>
        <button class="btn-reset" onclick={resetGame}>
          ↺ NEW GAME
        </button>
      </div>
    </div>
  </div>

<style>
  .agi-backdrop {
    position: fixed;
    inset: 0;
    z-index: 500;
    background: rgba(0, 0, 0, 0.92);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fade-in 1s ease;
  }

  .agi-panel {
    background: #0a0806;
    border: 3px solid #f0d080;
    width: min(600px, 90vw);
    max-height: 90vh;
    overflow-y: auto;
    padding: 40px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    box-shadow: 0 0 80px rgba(240, 208, 128, 0.3);
    animation: panel-in 0.8s ease;
  }

  .agi-title {
    font-size: 32px;
    color: #f0d080;
    letter-spacing: 8px;
    text-align: center;
    animation: glow 2s ease-in-out infinite;
  }

  .agi-subtitle {
    font-size: 9px;
    color: #c0a860;
    text-align: center;
    letter-spacing: 1px;
    line-height: 2;
  }

  .agi-stats {
    display: flex;
    flex-direction: column;
    gap: 4px;
    border: 1px solid #3a3020;
    padding: 16px;
    background: #1a1208;
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 8px;
    padding: 4px 0;
    border-bottom: 1px solid #2a2010;
  }

  .stat-row:last-child { border-bottom: none; }

  .stat-label { color: #6a5a30; letter-spacing: 1px; }
  .stat-value { font-size: 10px; }

  .agi-flavor {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .agi-flavor p {
    font-size: 7px;
    line-height: 2;
    color: #8a7a50;
  }

  .dim { color: #5a4a28; }

  .agi-actions {
    display: flex;
    gap: 12px;
  }

  .btn-continue, .btn-reset {
    flex: 1;
    font-family: var(--font-pixel);
    font-size: 8px;
    padding: 14px;
    border: 2px solid;
    cursor: pointer;
    letter-spacing: 1px;
    transition: all 0.15s;
  }

  .btn-continue {
    background: #f0d080;
    color: #1a1208;
    border-color: #f0d080;
  }
  .btn-continue:hover { background: #ffe090; }

  .btn-reset {
    background: transparent;
    color: #6a5a30;
    border-color: #3a3020;
  }
  .btn-reset:hover { background: #1a1208; color: #a08040; border-color: #6a5a30; }

  @keyframes fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  @keyframes panel-in {
    from { opacity: 0; transform: scale(0.9) translateY(20px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }

  @keyframes glow {
    0%, 100% { text-shadow: 0 0 20px rgba(240, 208, 128, 0.5); }
    50%       { text-shadow: 0 0 40px rgba(240, 208, 128, 0.9), 0 0 80px rgba(240, 208, 128, 0.3); }
  }
</style>

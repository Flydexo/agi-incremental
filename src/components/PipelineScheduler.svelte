<script lang="ts">
  import { gameState } from '../state/game.svelte'
  import { capture } from '../lib/analytics'

  // 4 pipeline stages, 8 time steps
  // Cell types: 'F' forward, 'B' backward, '_' bubble
  // The initial naive schedule has many bubbles; optimal 1F1B has minimal bubbles.
  // Player fills bubble cells to solve the puzzle.

  const STAGES = 4
  const STEPS = 8

  // Optimal 1F1B schedule (what player is trying to achieve):
  // F = forward pass for micro-batch N, B = backward pass
  const OPTIMAL: string[][] = [
    ['F1','F2','F3','F4','B4','B3','B2','B1'],
    ['__','F1','F2','F3','F4','B4','B3','B2'],
    ['__','__','F1','F2','F3','F4','B4','B3'],
    ['__','__','__','F1','F2','F3','F4','B4'],
  ]

  // Initial "naive" schedule — just sequential, lots of empty stalls
  const INITIAL: string[][] = [
    ['F1','B1','F2','B2','F3','B3','F4','B4'],
    ['__','__','F1','B1','F2','B2','F3','B3'],
    ['__','__','__','__','F1','B1','F2','B2'],
    ['__','__','__','__','__','__','F1','B1'],
  ]

  // Clickable bubbles: cells that are '__' in INITIAL but something in OPTIMAL
  // Player clicks them to "fill" them
  type Cell = { stage: number; step: number; filled: boolean; target: string }

  function buildClickables(): Cell[] {
    const cells: Cell[] = []
    for (let s = 0; s < STAGES; s++) {
      for (let t = 0; t < STEPS; t++) {
        if (INITIAL[s][t] === '__' && OPTIMAL[s][t] !== '__') {
          cells.push({ stage: s, step: t, filled: false, target: OPTIMAL[s][t] })
        }
      }
    }
    return cells
  }

  let clickables = $state<Cell[]>(buildClickables())
  let filledCount = $state(0)
  let done = $state(gameState.pipelineSchedulerDone)
  let lastClicked = $state<{ s: number; t: number } | null>(null)

  // Build a display grid from current state
  let grid = $derived.by(() => {
    const g: string[][] = INITIAL.map(row => [...row])
    for (const c of clickables) {
      if (c.filled) g[c.stage][c.step] = c.target
    }
    return g
  })

  function isClickable(s: number, t: number): boolean {
    if (done) return false
    return clickables.some(c => c.stage === s && c.step === t && !c.filled)
  }

  function handleClick(s: number, t: number) {
    if (!isClickable(s, t)) return
    const c = clickables.find(c => c.stage === s && c.step === t)
    if (!c) return
    c.filled = true
    filledCount++
    lastClicked = { s, t }
    setTimeout(() => { lastClicked = null }, 400)
    clickables = [...clickables]

    if (filledCount >= clickables.length) {
      // Puzzle solved
      const bubblesBefore = clickables.length
      const totalCells = STAGES * STEPS
      gameState.pipelineSchedulerDone = true
      gameState.pipelineBubbleBonus = 1 - (totalCells - bubblesBefore) / totalCells
      done = true
      capture('minigame_completed', {
        minigame: 'pipeline_scheduler',
        bubble_bonus: gameState.pipelineBubbleBonus,
        phase: gameState.phase,
      })
    }
  }

  function cellColor(val: string): string {
    if (val === '__') return 'bubble'
    if (val.startsWith('F')) return 'forward'
    if (val.startsWith('B')) return 'backward'
    return 'empty'
  }
</script>

{#if gameState.techniques.has('pipeline_parallelism')}
<section class="ps">
  <div class="ps-header">
    <span class="ps-title">PIPELINE SCHEDULER</span>
    <span class="ps-sub muted">MG-3 · minimize pipeline bubbles</span>
    {#if done}
      <span class="ps-done money">✓ SOLVED · +{(gameState.pipelineBubbleBonus * 40).toFixed(0)}% compute</span>
    {:else}
      <span class="ps-progress muted">{filledCount}/{clickables.length} filled</span>
    {/if}
  </div>

  {#if done}
    <div class="ps-complete">
      <p class="complete-msg">
        Pipeline optimized with 1F1B interleaving. Micro-batches flow continuously through all {STAGES} stages.
        Bubble time reduced by {(gameState.pipelineBubbleBonus * 100).toFixed(0)}%.
      </p>
      <div class="complete-bonus">
        <span>Compute bonus applied: +{(gameState.pipelineBubbleBonus * 40).toFixed(1)}%</span>
      </div>
    </div>
  {:else}
    <p class="ps-hint muted">
      Click gray bubbles (──) to fill them with micro-batches. Goal: 1F1B interleaving across all {STAGES} stages.
    </p>
  {/if}

  <!-- Pipeline grid -->
  <div class="ps-grid-wrap">
    <div class="stage-labels">
      {#each { length: STAGES } as _, s}
        <div class="stage-label">GPU {s + 1}</div>
      {/each}
    </div>
    <div class="ps-grid">
      {#each grid as row, s}
        <div class="ps-row">
          {#each row as cell, t}
            <button
              class="ps-cell {cellColor(cell)}"
              class:clickable={isClickable(s, t)}
              class:just-filled={lastClicked?.s === s && lastClicked?.t === t}
              onclick={() => handleClick(s, t)}
              title={cell === '__' ? (isClickable(s,t) ? 'Click to fill bubble' : 'Fixed bubble') : cell}
              disabled={!isClickable(s, t)}
            >
              {cell === '__' ? '──' : cell}
            </button>
          {/each}
        </div>
      {/each}
    </div>
  </div>

  <div class="legend">
    <span class="legend-item"><span class="dot forward"></span>Forward</span>
    <span class="legend-item"><span class="dot backward"></span>Backward</span>
    <span class="legend-item"><span class="dot bubble"></span>Bubble (fill!)</span>
  </div>
</section>
{/if}

<style>
  .ps {
    background: var(--color-panel-bg);
    border: 1px solid var(--color-border);
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ps-header {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .ps-title { font-size: 7px; color: var(--color-border); letter-spacing: 1px; }
  .ps-sub   { font-size: 6px; flex: 1; }
  .ps-done  { font-size: 6px; }
  .ps-progress { font-size: 6px; }

  .ps-hint { font-size: 6px; line-height: 1.8; }

  .ps-grid-wrap {
    display: flex;
    gap: 4px;
  }

  .stage-labels {
    display: flex;
    flex-direction: column;
    gap: 2px;
    justify-content: space-between;
  }

  .stage-label {
    font-size: 5px;
    color: var(--color-locked);
    writing-mode: horizontal-tb;
    text-align: right;
    height: 22px;
    display: flex;
    align-items: center;
    padding-right: 4px;
    white-space: nowrap;
  }

  .ps-grid {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
  }

  .ps-row {
    display: flex;
    gap: 2px;
  }

  .ps-cell {
    flex: 1;
    height: 22px;
    font-family: var(--font-pixel);
    font-size: 5px;
    border: 1px solid var(--color-border);
    cursor: default;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
    min-width: 0;
  }

  .ps-cell.forward  { background: #1a3a5a; color: #80c0ff; border-color: #2a5a8a; }
  .ps-cell.backward { background: #3a1a5a; color: #c080ff; border-color: #5a2a8a; }
  .ps-cell.bubble   { background: #2a2a2a; color: #555; border-color: #333; }
  .ps-cell.clickable {
    background: #2a2a1a;
    color: var(--color-warning);
    border-color: var(--color-warning);
    cursor: pointer;
    animation: pulse-bubble 1.5s ease-in-out infinite;
  }
  .ps-cell.clickable:hover {
    background: var(--color-warning);
    color: #1a1a08;
  }
  .ps-cell.just-filled {
    background: #1a3a1a;
    border-color: var(--color-money);
    animation: fill-flash 0.4s ease;
  }

  @keyframes pulse-bubble {
    0%, 100% { opacity: 0.7; }
    50%       { opacity: 1; }
  }

  @keyframes fill-flash {
    0%   { background: var(--color-money); }
    100% { background: #1a3a5a; }
  }

  .legend {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 5px;
    color: var(--color-locked);
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 1px;
  }

  .dot.forward  { background: #1a3a5a; border: 1px solid #2a5a8a; }
  .dot.backward { background: #3a1a5a; border: 1px solid #5a2a8a; }
  .dot.bubble   { background: #2a2a1a; border: 1px solid var(--color-warning); }

  .ps-complete {
    background: #1a2e1a;
    border: 1px solid var(--color-money);
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .complete-msg { font-size: 6px; line-height: 1.8; color: #80d080; }
  .complete-bonus { font-size: 7px; color: var(--color-money); }
</style>

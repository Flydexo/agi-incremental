<script lang="ts">
  import { gameState, addLabelTokens } from '../state/game.svelte'
  import { CONFIG } from '../game.config'
  import { formatMoney } from '../lib/format'
  import { capture, getFlag } from '../lib/analytics'

  const { pay_per_correct, grid_size, round_time_ms, target_min_count, target_max_count } =
    CONFIG.minigames.data_labeling

  const TOTAL_CELLS = grid_size * grid_size

  const CATEGORIES: { id: string; emoji: string; label: string }[] = [
    { id: 'car',           emoji: '🚗', label: 'CAR' },
    { id: 'tree',          emoji: '🌳', label: 'TREE' },
    { id: 'traffic_light', emoji: '🚦', label: 'TRAFFIC LIGHT' },
    { id: 'person',        emoji: '👤', label: 'PERSON' },
    { id: 'bicycle',       emoji: '🚲', label: 'BICYCLE' },
    { id: 'house',         emoji: '🏠', label: 'HOUSE' },
    { id: 'dog',           emoji: '🐕', label: 'DOG' },
    { id: 'bird',          emoji: '🐦', label: 'BIRD' },
  ]

  interface Cell {
    category: string
    found: boolean
    shake: boolean
  }

  let cells = $state<Cell[]>([])
  let target = $state(CATEGORIES[0])
  let targetTotal = $state(0)
  let timerProgress = $state(0)   // 0 = full, 1 = empty
  let allFoundFlash = $state(false)
  let roundDone = $state(false)
  let totalFound = $state(0)
  let totalEarned = $state(0)
  let timerStart = $state(Date.now())

  // Combo system: consecutive perfect rounds (all found before timer)
  let combo = $state(0)
  const MAX_COMBO = getFlag<number>('max_combo', 10)
  let comboFlash = $state(false)

  function comboMultiplier(): number { return Math.pow(2, Math.min(combo, MAX_COMBO)) }
  function effectivePay(): number { return pay_per_correct * comboMultiplier() }

  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  function generateRound() {
    // Pick a random target category
    const t = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)]
    target = t

    // How many target cells this round (3–5)
    const count = target_min_count + Math.floor(Math.random() * (target_max_count - target_min_count + 1))
    targetTotal = count

    // Other categories (exclude target)
    const others = CATEGORIES.filter(c => c.id !== t.id)

    // Build cell list: `count` targets + fill rest with random others
    const catIds: string[] = Array.from({ length: count }, () => t.id)
    for (let i = count; i < TOTAL_CELLS; i++) {
      catIds.push(others[Math.floor(Math.random() * others.length)].id)
    }

    cells = shuffle(catIds).map(id => ({ category: id, found: false, shake: false }))
    timerProgress = 0
    allFoundFlash = false
    roundDone = false
    timerStart = Date.now()
  }

  function completeRound(perfect: boolean) {
    roundDone = true
    capture('minigame_completed', {
      minigame: 'data_labeling',
      perfect,
      combo_multiplier: comboMultiplier(),
      phase: gameState.phase,
    })
    if (perfect) {
      const prevCombo = combo
      combo = Math.min(combo + 1, MAX_COMBO)
      if (prevCombo < MAX_COMBO && combo >= MAX_COMBO) {
        capture('labeling_max_combo', { playtime_s: gameState.totalPlaytimeSeconds })
      }
      comboFlash = true
      setTimeout(() => { comboFlash = false }, 600)
      allFoundFlash = true
      setTimeout(generateRound, 800)
    } else {
      combo = 0
      generateRound()
    }
  }

  // Start first round immediately
  generateRound()

  function categoryOf(id: string) {
    return CATEGORIES.find(c => c.id === id)!
  }

  function foundCount(): number {
    return cells.filter(c => c.found).length
  }

  function handleCellClick(index: number) {
    if (roundDone) return
    const cell = cells[index]
    if (cell.found) return

    if (cell.category === target.id) {
      cells[index] = { ...cell, found: true }
      const earned = effectivePay()
      gameState.money += earned
      gameState.moneyEver = Math.max(gameState.moneyEver, gameState.money)
      addLabelTokens(1)
      totalFound++
      totalEarned += earned

      // Check if all target cells are found
      const nowFound = cells.filter(c => c.found).length
      if (nowFound >= targetTotal) {
        completeRound(true)
      }
    } else {
      // Wrong — shake animation
      cells[index] = { ...cell, shake: true }
      setTimeout(() => {
        cells[index] = { ...cells[index], shake: false }
      }, 400)
    }
  }

  // RAF timer
  $effect(() => {
    let rafId: number

    function frame() {
      const elapsed = Date.now() - timerStart
      timerProgress = Math.min(elapsed / round_time_ms, 1)

      if (elapsed >= round_time_ms && !roundDone) {
        completeRound(false)
      }

      rafId = requestAnimationFrame(frame)
    }

    rafId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafId)
  })
</script>

<section class="mg1">
  <header class="mg1-header">
    <span class="mg1-title">DATA LABELING</span>
    <span class="mg1-pay money">+{formatMoney(effectivePay())}/cell</span>
    {#if combo > 0}
      <span class="combo-badge" class:flash={comboFlash}>
        ×{comboMultiplier()} COMBO{combo >= MAX_COMBO ? ' MAX' : ''}
      </span>
    {:else}
      <span class="mg1-earned muted">{formatMoney(totalEarned)} earned</span>
    {/if}
  </header>

  <div class="mg1-prompt">
    Find all: <span class="target-icon">{target.emoji}</span>
    <strong>{target.label}</strong>
    <span class="found-count muted">({foundCount()}/{targetTotal})</span>
    {#if combo === 0}
      <span class="combo-hint muted">— finish fast for combo!</span>
    {/if}
  </div>

  <div class="grid" class:all-found={allFoundFlash} style="--cols: {grid_size}">
    {#each cells as cell, i}
      {@const cat = categoryOf(cell.category)}
      <button
        class="cell"
        class:found={cell.found}
        class:shake={cell.shake}
        onclick={() => handleCellClick(i)}
        disabled={cell.found || roundDone}
        aria-label={cat.label}
      >
        <span class="cell-emoji">{cat.emoji}</span>
        {#if cell.found}
          <span class="check-overlay">✓</span>
        {/if}
      </button>
    {/each}

    {#if allFoundFlash}
      <div class="all-found-overlay">✓ ALL FOUND!</div>
    {/if}
  </div>

  <div class="timer-bar" aria-hidden="true">
    <div class="timer-fill" style="width: {(1 - timerProgress) * 100}%"></div>
  </div>
</section>

<style>
  .mg1 {
    background: var(--color-panel-bg);
    border: 2px solid var(--color-border);
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .mg1-header {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .mg1-title {
    font-size: 8px;
    color: var(--color-border);
    flex: 1;
  }

  .mg1-pay  { font-size: 7px; }
  .mg1-earned { font-size: 6px; }

  .combo-badge {
    font-size: 7px;
    color: var(--color-warning);
    padding: 2px 4px;
    border: 1px solid var(--color-warning);
    background: #fff8e8;
  }

  .combo-badge.flash {
    background: var(--color-warning);
    color: white;
    animation: combo-pop 0.6s ease;
  }

  .combo-hint { font-size: 6px; }

  @keyframes combo-pop {
    0%   { transform: scale(1.3); }
    100% { transform: scale(1); }
  }

  .mg1-prompt {
    font-size: 7px;
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
  }

  .target-icon {
    font-size: 18px;
    line-height: 1;
  }

  .mg1-prompt strong {
    color: var(--color-text);
    font-size: 8px;
  }

  .found-count { font-size: 6px; }

  /* Grid */
  .grid {
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    gap: 6px;
    position: relative;
    max-width: 240px;
  }

  .grid.all-found .cell {
    border-color: var(--color-money);
    background: #eaf4ea;
  }

  .cell {
    aspect-ratio: 1;
    background: var(--color-card-bg);
    border: 2px solid var(--color-border);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    transition: border-color 0.1s, background 0.1s, transform 0.1s;
    padding: 0;
  }

  .cell:hover:not(:disabled):not(.found) {
    border-color: var(--color-compute);
    background: #f0f4f8;
    transform: scale(1.05);
  }

  .cell.found {
    background: #eaf4ea;
    border-color: var(--color-money);
    cursor: default;
  }

  .cell.shake {
    border-color: var(--color-error);
    animation: shake 0.4s ease;
  }

  .cell:disabled:not(.found) {
    cursor: default;
    opacity: 0.6;
  }

  .cell-emoji {
    font-size: 28px;
    line-height: 1;
    user-select: none;
  }

  .check-overlay {
    position: absolute;
    top: 2px;
    right: 3px;
    font-size: 10px;
    color: var(--color-money);
    font-family: var(--font-pixel);
    line-height: 1;
  }

  .all-found-overlay {
    position: absolute;
    inset: 0;
    background: rgba(61, 107, 53, 0.85);
    color: #fff;
    font-size: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: pop 0.2s ease;
    pointer-events: none;
  }

  /* Timer */
  .timer-bar {
    height: 4px;
    background: #d8ceb8;
    border-radius: 2px;
    overflow: hidden;
  }

  .timer-fill {
    height: 100%;
    background: var(--color-compute);
    transition: width 0.1s linear;
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); border-color: var(--color-error); }
    20%       { transform: translateX(-4px); }
    40%       { transform: translateX(4px); }
    60%       { transform: translateX(-3px); }
    80%       { transform: translateX(3px); }
  }

  @keyframes pop {
    from { transform: scale(0.9); opacity: 0; }
    to   { transform: scale(1);   opacity: 1; }
  }
</style>

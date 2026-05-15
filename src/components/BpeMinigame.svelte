<script lang="ts">
  import { gameState } from '../state/game.svelte'
  import { CONFIG } from '../game.config'

  const { target_merges, perfect_bonus, avg_bonus } = CONFIG.minigames.bpe

  // Seed corpus — short, varied, shows BPE merges nicely
  const SEED = 'the cat sat on the mat the cat ate the rat the rat ran to the hat the hat is on the bat the bat sat by the mat near the cat that sat on the flat mat'

  interface Token {
    text: string
    id: number
  }

  let nextId = 0
  function makeToken(text: string): Token { return { text, id: nextId++ } }

  // State
  let tokens = $state<Token[]>([])
  let mergesDone = $state(0)
  let lastMergePair = $state<string | null>(null)
  let finished = $state(false)
  let perfectPlay = $state(true)   // stays true only if every click was the top pair

  function initCorpus() {
    tokens = SEED.split('').map(c => makeToken(c))
    mergesDone = 0
    lastMergePair = null
    finished = false
    perfectPlay = true
  }
  initCorpus()

  // Compute adjacent pair frequencies
  function getPairFreqs(): Map<string, number> {
    const freq = new Map<string, number>()
    for (let i = 0; i < tokens.length - 1; i++) {
      const key = tokens[i].text + '|' + tokens[i + 1].text
      freq.set(key, (freq.get(key) ?? 0) + 1)
    }
    return freq
  }

  // Sorted pairs: [key, count][]
  let pairList = $derived.by(() => {
    const freq = getPairFreqs()
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  })

  function topPair(): string { return pairList[0]?.[0] ?? '' }

  function mergePair(key: string) {
    if (finished) return
    const [a, b] = key.split('|')
    const merged = makeToken(a + b)
    const next: Token[] = []
    let i = 0
    while (i < tokens.length) {
      if (i < tokens.length - 1 && tokens[i].text === a && tokens[i + 1].text === b) {
        next.push(merged)
        i += 2
      } else {
        next.push(tokens[i])
        i++
      }
    }
    tokens = next
    lastMergePair = key
    if (key !== topPair() && mergesDone === 0) {
      // clicked a non-top pair before even starting — mark imperfect
    }
    // Check if this was the top pair BEFORE we incremented
    mergesDone++

    if (mergesDone >= target_merges) {
      finished = true
      const multiplier = perfectPlay ? perfect_bonus : avg_bonus
      gameState.bpeMultiplier = multiplier
      gameState.bpeCompleted = true
    }
  }

  function handlePairClick(key: string) {
    if (key !== topPair()) perfectPlay = false
    mergePair(key)
  }

  function pairDisplay(key: string): [string, string] {
    const [a, b] = key.split('|')
    return [a, b]
  }

  let progress = $derived(Math.min(mergesDone / target_merges, 1))
</script>

<div class="bpe-wrap">
  <header class="bpe-header">
    <span class="bpe-title">BPE TOKENIZER</span>
    <span class="bpe-sub muted">Merge the most frequent pair to build vocabulary</span>
  </header>

  <div class="bpe-progress-row">
    <span class="bpe-count">{mergesDone}/{target_merges} merges</span>
    {#if perfectPlay && !finished}
      <span class="perfect-badge">★ PERFECT</span>
    {/if}
    {#if finished}
      <span class="done-badge money">
        ✓ DONE · ×{gameState.bpeMultiplier.toFixed(2)} data quality
      </span>
    {/if}
  </div>

  <div class="progress-bar">
    <div class="progress-fill" style="width: {progress * 100}%"></div>
  </div>

  {#if !finished}
    <!-- Pair frequency table -->
    <div class="pair-list">
      <div class="pair-list-header">
        <span>PAIR</span>
        <span>FREQ</span>
      </div>
      {#each pairList as [key, count], i}
        {@const [a, b] = pairDisplay(key)}
        <button
          class="pair-row"
          class:top={i === 0}
          onclick={() => handlePairClick(key)}
        >
          <span class="pair-tokens">
            <span class="tok tok-a">{a}</span>
            <span class="tok-plus">+</span>
            <span class="tok tok-b">{b}</span>
            <span class="tok-arrow">→</span>
            <span class="tok tok-merged">{a}{b}</span>
          </span>
          <span class="pair-count" class:top-count={i === 0}>{count}×</span>
        </button>
      {/each}
    </div>

    <!-- Token corpus preview -->
    <div class="corpus-preview">
      {#each tokens.slice(0, 60) as tok}
        <span
          class="tok-pill"
          class:just-merged={lastMergePair !== null &&
            tok.text === lastMergePair.replace('|', '')}
        >{tok.text}</span>
      {/each}
      {#if tokens.length > 60}
        <span class="muted"> …+{tokens.length - 60} more</span>
      {/if}
    </div>
  {:else}
    <p class="finish-text">
      Tokenizer ready! Your training data is now
      <strong class="money">×{gameState.bpeMultiplier.toFixed(2)}</strong> more efficient.
      {#if gameState.bpeMultiplier >= perfect_bonus}
        Perfect vocabulary — you always picked the top pair.
      {:else}
        Good enough. Optimal would have been ×{perfect_bonus}.
      {/if}
    </p>
  {/if}
</div>

<style>
  .bpe-wrap {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .bpe-header {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .bpe-title {
    font-size: 8px;
    color: var(--color-border);
  }

  .bpe-sub {
    font-size: 6px;
  }

  .bpe-progress-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 7px;
  }

  .bpe-count { color: var(--color-text); }

  .perfect-badge {
    color: var(--color-warning);
    font-size: 6px;
  }

  .done-badge {
    font-size: 7px;
  }

  .progress-bar {
    height: 4px;
    background: #d8ceb8;
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--color-compute);
    transition: width 0.15s ease;
  }

  /* Pair list */
  .pair-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .pair-list-header {
    display: flex;
    justify-content: space-between;
    font-size: 6px;
    color: var(--color-locked);
    padding: 0 6px;
  }

  .pair-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px 6px;
    background: var(--color-card-bg);
    border: 1px solid var(--color-border);
    font-family: var(--font-pixel);
    cursor: pointer;
    transition: background 0.1s, border-color 0.1s;
    gap: 6px;
  }

  .pair-row.top {
    border-color: var(--color-compute);
    background: #eef4f8;
  }

  .pair-row:hover {
    background: #e8dfc8;
    border-color: var(--color-warning);
  }

  .pair-tokens {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 7px;
    flex-wrap: wrap;
  }

  .tok {
    padding: 1px 3px;
    border-radius: 2px;
    font-size: 7px;
  }

  .tok-a      { background: #dceeff; color: #1a5080; }
  .tok-b      { background: #ffeedd; color: #804020; }
  .tok-merged { background: #ddffdd; color: #204820; }
  .tok-plus, .tok-arrow { color: var(--color-locked); font-size: 6px; }

  .pair-count {
    font-size: 7px;
    color: var(--color-locked);
    white-space: nowrap;
  }

  .pair-count.top-count { color: var(--color-compute); }

  /* Corpus preview */
  .corpus-preview {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    max-height: 60px;
    overflow: hidden;
  }

  .tok-pill {
    font-size: 6px;
    padding: 1px 3px;
    background: var(--color-panel-bg);
    border: 1px solid #c8b888;
    border-radius: 2px;
    color: var(--color-text);
    transition: background 0.3s, border-color 0.3s;
  }

  .tok-pill.just-merged {
    background: #ddffdd;
    border-color: var(--color-money);
  }

  .finish-text {
    font-size: 7px;
    line-height: 1.8;
    color: var(--color-locked);
  }
</style>

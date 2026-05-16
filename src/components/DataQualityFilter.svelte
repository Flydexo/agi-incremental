<script lang="ts">
  import { gameState, applyDataQualityBonus } from '../state/game.svelte'
  import { capture } from '../lib/analytics'

  interface Doc {
    id: number
    domain: string
    lang: string
    dupScore: number   // 0=unique, 1=duplicate
    qualScore: number  // 0=trash, 1=great
    isGood: boolean    // ground truth
  }

  const DOMAINS = ['Wikipedia', 'Reddit', 'ArXiv', 'News', 'Forum', 'Blog', 'Code', 'Spam', 'Ad copy', 'Legal']
  const LANGS = ['EN', 'EN', 'EN', 'EN', 'FR', 'DE', 'ZH', '??', 'EN', 'EN']
  let nextId = 0

  function makeDoc(): Doc {
    const isGood = Math.random() > 0.35
    const domain = DOMAINS[Math.floor(Math.random() * DOMAINS.length)]
    const lang = LANGS[Math.floor(Math.random() * LANGS.length)]
    const dupScore = isGood ? Math.random() * 0.3 : 0.5 + Math.random() * 0.5
    const qualScore = isGood ? 0.6 + Math.random() * 0.4 : Math.random() * 0.45
    return { id: nextId++, domain, lang, dupScore, qualScore, isGood }
  }

  let queue = $state<Doc[]>([makeDoc(), makeDoc(), makeDoc()])
  let correct = $state(0)
  let total = $state(0)
  let lastResult = $state<'correct' | 'wrong' | null>(null)
  let minimized = $state(false)

  // Current doc is always queue[0]
  let current = $derived(queue[0])

  function decide(keep: boolean) {
    if (!current) return
    const wasCorrect = keep === current.isGood
    correct += wasCorrect ? 1 : 0
    total++
    lastResult = wasCorrect ? 'correct' : 'wrong'
    setTimeout(() => { lastResult = null }, 500)
    queue = [...queue.slice(1), makeDoc()]
    // Update quality multiplier: correct ratio mapped to 1.0–2.5
    if (total > 0) {
      const ratio = correct / total
      applyDataQualityBonus(1.0 + ratio * 1.5)
      if (total % 10 === 0) {
        capture('minigame_completed', {
          minigame: 'data_quality_filter',
          accuracy: ratio,
          quality_multiplier: gameState.dataQualityMultiplier,
          phase: gameState.phase,
        })
      }
    }
  }

  function qualColor(v: number): string {
    if (v > 0.6) return '#3d6b35'
    if (v > 0.35) return '#c8832a'
    return '#8b3a3a'
  }
</script>

{#if gameState.phase >= 2}
<section class="dqf">
  <button class="dqf-toggle" onclick={() => minimized = !minimized}>
    DATA QUALITY FILTER {minimized ? '▼' : '▲'}
    {#if total > 0}
      <span style="color:var(--color-money)">{Math.round(correct/total*100)}% acc · ×{gameState.dataQualityMultiplier.toFixed(2)}</span>
    {/if}
  </button>

  {#if !minimized && current}
    <div class="doc-card" class:flash-correct={lastResult==='correct'} class:flash-wrong={lastResult==='wrong'}>
      <div class="doc-meta">
        <span class="badge domain">{current.domain}</span>
        <span class="badge lang">{current.lang}</span>
        <span class="badge" style="color:{current.dupScore > 0.5 ? '#8b3a3a' : '#3d6b35'}">
          DUP {Math.round(current.dupScore * 100)}%
        </span>
        <span class="badge" style="color:{qualColor(current.qualScore)}">
          QUAL {Math.round(current.qualScore * 100)}%
        </span>
      </div>
      <p class="doc-preview">
        {current.isGood
          ? `${current.domain.toLowerCase()} article with coherent structure, proper citations, and relevant content for AI training purposes.`
          : `lol this is just spam spam spam click here buy now limited time offer ${current.domain} is the best BEST best!!!`
        }
      </p>
      <div class="doc-actions">
        <button class="keep-btn" onclick={() => decide(true)}>✓ KEEP</button>
        <button class="skip-btn" onclick={() => decide(false)}>✗ SKIP</button>
      </div>
    </div>
    <div class="dqf-stats">
      {total} reviewed · {correct} correct · ×{gameState.dataQualityMultiplier.toFixed(2)} data quality
    </div>
  {/if}
</section>
{/if}

<style>
  .dqf { display: flex; flex-direction: column; gap: 0; }

  .dqf-toggle {
    font-family: var(--font-pixel); font-size: 6px; padding: 5px 8px;
    background: #e8dfc8; border: 1px solid var(--color-border);
    color: var(--color-locked); cursor: pointer; text-align: left;
    letter-spacing: 1px; display: flex; gap: 8px; align-items: center;
  }
  .dqf-toggle:hover { background: var(--color-border); color: var(--color-bg); }

  .doc-card {
    background: var(--color-card-bg); border: 2px solid var(--color-border);
    padding: 10px; display: flex; flex-direction: column; gap: 8px;
    transition: border-color 0.2s, background 0.2s;
  }
  .doc-card.flash-correct { border-color: var(--color-money); background: #eaf4ea; }
  .doc-card.flash-wrong   { border-color: var(--color-error); background: #f4eaea; }

  .doc-meta { display: flex; flex-wrap: wrap; gap: 4px; }
  .badge { font-size: 6px; padding: 2px 5px; background: var(--color-panel-bg); border: 1px solid var(--color-border); }
  .domain { color: var(--color-compute); }
  .lang   { color: var(--color-warning); }

  .doc-preview { font-size: 7px; line-height: 1.7; color: var(--color-text); }

  .doc-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .keep-btn, .skip-btn {
    font-family: var(--font-pixel); font-size: 7px; padding: 8px;
    border: 2px solid; cursor: pointer;
  }
  .keep-btn { background: var(--color-money); color: white; border-color: var(--color-money); }
  .keep-btn:hover { background: #2d5228; }
  .skip-btn { background: var(--color-error); color: white; border-color: var(--color-error); }
  .skip-btn:hover { background: #6b2a2a; }

  .dqf-stats { font-size: 6px; color: var(--color-locked); padding: 4px 8px; background: #e8e0d0; border: 1px solid var(--color-border); border-top: none; }
</style>

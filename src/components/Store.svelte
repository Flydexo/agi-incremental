<script lang="ts">
  import { gameState, purchaseBuilding, purchaseTechnique, isBuildingUnlocked, isTechniqueUnlocked, getBuildingCost, canAfford } from '../state/game.svelte'
  import { CONFIG } from '../game.config'
  import { formatMoney } from '../lib/format'
  import type { BuildingId, TechniqueId } from '../state/game.svelte'

  type Category = 'compute' | 'data' | 'energy' | 'infrastructure' | 'techniques'
  let activeTab = $state<Category>('compute')

  const tabs: { id: Category; label: string }[] = [
    { id: 'compute', label: 'COMPUTE' },
    { id: 'data', label: 'DATA' },
    { id: 'energy', label: 'ENERGY' },
    { id: 'infrastructure', label: 'INFRA' },
    { id: 'techniques', label: 'TECH' },
  ]

  function buildingsByCategory(cat: string): BuildingId[] {
    return (Object.keys(CONFIG.buildings) as BuildingId[]).filter(id => {
      const b = CONFIG.buildings[id] as any
      return b.category === cat
    })
  }

  function techniquesByPhase(): TechniqueId[] {
    return (Object.keys(CONFIG.techniques) as TechniqueId[]).filter(id =>
      isTechniqueUnlocked(id)
    )
  }

  let tooltip = $state<string | null>(null)
  let tooltipBuilding = $state<BuildingId | null>(null)
</script>

<aside class="store">
  <header class="store-header">STORE</header>

  <div class="tab-bar">
    {#each tabs as tab}
      <button
        class="tab" class:active={activeTab === tab.id}
        onclick={() => activeTab = tab.id}
      >{tab.label}</button>
    {/each}
  </div>

  <div class="item-list">
    {#if activeTab !== 'techniques'}
      {#each buildingsByCategory(activeTab) as id}
        {@const b = CONFIG.buildings[id] as any}
        {@const unlocked = isBuildingUnlocked(id)}
        {@const affordable = canAfford(id)}
        {@const owned = gameState.buildings[id] ?? 0}
        {@const cost = getBuildingCost(id)}
        <div class="item-card" class:locked={!unlocked} class:affordable>
          <div class="item-header">
            <span class="item-name">{b.label}</span>
            <span class="item-owned muted">×{owned}</span>
          </div>
          <div class="item-stats">
            {#if b.tflops_fp16}
              <span class="compute">{b.tflops_fp16.toLocaleString()} TFLOP/s</span>
            {/if}
            {#if b.tokens_per_second}
              <span>{(b.tokens_per_second).toLocaleString()} tok/s</span>
            {/if}
            {#if b.capacity_mw}
              <span>{b.capacity_mw.toLocaleString()} MW</span>
            {/if}
            {#if b.tdp_kw}
              <span class="muted">{b.tdp_kw} kW draw</span>
            {/if}
            {#if b.recurring_cost_per_s}
              <span class="warning">{formatMoney(b.recurring_cost_per_s)}/s</span>
            {/if}
          </div>
          {#if unlocked}
            <button
              class="buy-btn"
              class:can-afford={affordable}
              disabled={!affordable}
              onclick={() => purchaseBuilding(id)}
            >
              {formatMoney(cost)}
            </button>
          {:else}
            <div class="locked-label">🔒 Phase {b.unlock_phase}</div>
          {/if}
          {#if b.tooltip}
            <details class="tooltip-details">
              <summary>?</summary>
              <p class="tooltip-text">{b.tooltip}</p>
            </details>
          {/if}
        </div>
      {/each}
    {:else}
      {#each (Object.keys(CONFIG.techniques) as TechniqueId[]) as id}
        {@const t = CONFIG.techniques[id] as any}
        {@const unlocked = isTechniqueUnlocked(id)}
        {@const purchased = gameState.techniques.has(id)}
        {@const affordable = gameState.money >= t.cost}
        <div class="item-card" class:locked={!unlocked} class:purchased>
          <div class="item-header">
            <span class="item-name">{t.label}</span>
            {#if purchased}<span class="money">✓</span>{/if}
          </div>
          {#if !purchased && unlocked}
            <button
              class="buy-btn"
              class:can-afford={affordable}
              disabled={!affordable || purchased}
              onclick={() => purchaseTechnique(id)}
            >
              {formatMoney(t.cost)}
            </button>
          {:else if !unlocked}
            <div class="locked-label">🔒 Phase {t.phase}</div>
          {/if}
          {#if t.tooltip}
            <details class="tooltip-details">
              <summary>?</summary>
              <p class="tooltip-text">{t.tooltip}</p>
            </details>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</aside>

<style>
  .store {
    background: var(--color-panel-bg);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .store-header {
    padding: 10px 12px;
    border-bottom: 2px solid var(--color-border);
    font-size: 9px;
    color: var(--color-border);
    background: #e8dfc8;
  }

  .tab-bar {
    display: flex;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .tab {
    flex: 1;
    padding: 6px 2px;
    font-family: var(--font-pixel);
    font-size: 6px;
    background: transparent;
    border: none;
    border-right: 1px solid var(--color-border);
    cursor: pointer;
    color: var(--color-locked);
  }

  .tab:last-child { border-right: none; }

  .tab.active {
    background: var(--color-bg);
    color: var(--color-text);
  }

  .item-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .item-card {
    background: var(--color-card-bg);
    border: 1px solid var(--color-border);
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .item-card.locked {
    opacity: 0.5;
    background: #e8e0d0;
  }

  .item-card.purchased {
    border-color: var(--color-money);
    background: #f0f8f0;
  }

  .item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .item-name {
    font-size: 7px;
    color: var(--color-text);
  }

  .item-owned {
    font-size: 7px;
  }

  .item-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    font-size: 6px;
  }

  .buy-btn {
    font-family: var(--font-pixel);
    font-size: 7px;
    padding: 5px;
    border: 1px solid var(--color-border);
    background: #d0c8b0;
    color: var(--color-locked);
    cursor: not-allowed;
    text-align: center;
  }

  .buy-btn.can-afford {
    background: var(--color-money);
    color: white;
    cursor: pointer;
    border-color: var(--color-money);
  }

  .buy-btn.can-afford:hover {
    background: #2d5228;
  }

  .locked-label {
    font-size: 6px;
    color: var(--color-locked);
  }

  .tooltip-details {
    font-size: 6px;
  }

  .tooltip-details summary {
    cursor: pointer;
    color: var(--color-compute);
    width: fit-content;
  }

  .tooltip-text {
    margin-top: 4px;
    line-height: 1.8;
    color: var(--color-locked);
    border-left: 2px solid var(--color-border);
    padding-left: 6px;
  }
</style>

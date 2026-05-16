<script lang="ts">
  import { onMount } from 'svelte'
  import { CONFIG } from './game.config'
  import { gameState, tick, serializeState, loadState } from './state/game.svelte'
  import { initAnalytics } from './lib/analytics'
  import TokenStream from './components/TokenStream.svelte'
  import Dashboard from './components/Dashboard.svelte'
  import Store from './components/Store.svelte'
  import PhaseToast from './components/PhaseToast.svelte'
  import WelcomeBack from './components/WelcomeBack.svelte'
  import AgiWin from './components/AgiWin.svelte'

  onMount(() => {
    initAnalytics()

    // Load save
    const saved = localStorage.getItem(CONFIG.save.localstorage_key)
    if (saved) loadState(saved)

    // Game tick: 100ms intervals
    const tickInterval = setInterval(() => tick(0.1), 100)

    // Autosave
    const saveInterval = setInterval(() => {
      localStorage.setItem(CONFIG.save.localstorage_key, serializeState())
    }, CONFIG.save.autosave_interval_ms)

    return () => {
      clearInterval(tickInterval)
      clearInterval(saveInterval)
    }
  })
</script>

<div class="game-layout">
  <TokenStream />
  <Dashboard />
  <Store />
</div>
<PhaseToast />
<WelcomeBack />
{#if gameState.agiAchieved}
  <AgiWin />
{/if}

<style>
  .game-layout {
    display: grid;
    grid-template-columns: 25% 45% 30%;
    height: 100vh;
    overflow: hidden;
    border-top: 2px solid var(--color-border);
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte'
  import { CONFIG } from './game.config'
  import { gameState, tick, serializeState, loadState } from './state/game.svelte'
  import { initAnalytics, capture, getFlag } from './lib/analytics'
  import TokenStream from './components/TokenStream.svelte'
  import Dashboard from './components/Dashboard.svelte'
  import Store from './components/Store.svelte'
  import PhaseToast from './components/PhaseToast.svelte'
  import WelcomeBack from './components/WelcomeBack.svelte'
  import AgiWin from './components/AgiWin.svelte'

  onMount(async () => {
    await initAnalytics()

    // Apply PostHog feature flag overrides before loading save
    ;(CONFIG.buildings.rtx_3090 as any).base_cost          = getFlag('first_gpu_cost', 1500)
    ;(CONFIG.minigames.data_labeling as any).pay_per_correct = getFlag('labeling_pay_per_correct', 15)
    ;(CONFIG.phase_thresholds.phase_2 as any).min_money_ever = getFlag('phase2_money_threshold', 1500)
    ;(CONFIG.economy as any).starting_money                  = getFlag('starting_money', 0)

    // Load save
    const saved = localStorage.getItem(CONFIG.save.localstorage_key)
    if (saved) loadState(saved)

    capture('session_start', {
      phase: gameState.phase,
      money: gameState.money,
      runs_completed: gameState.trainingRunsCompleted,
      tokens_trained: gameState.tokensTrained,
      playtime_s: gameState.totalPlaytimeSeconds,
    })

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

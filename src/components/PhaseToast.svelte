<script lang="ts">
  import { gameState } from '../state/game.svelte'

  const PHASE_NAMES = ['', 'Freelancer', 'Scrappy Lab', 'Real Lab', 'Frontier', 'AGI']
  const PHASE_MSGS: Record<number, string> = {
    2: 'Web scrapers, data pipelines & datacenter hardware unlocked.',
    3: 'Parallelism techniques, RLHF & benchmark evals unlocked.',
    4: 'Synthetic data engines, GB200 racks & TPU pods unlocked.',
    5: 'Orbital datacenters & fusion reactor unlocked. Almost there.',
  }

  let visible = $state(false)
  let displayedPhase = $state(0)
  let timer: ReturnType<typeof setTimeout> | null = null

  $effect(() => {
    const p = gameState.phaseJustUnlocked
    if (p > 1) {
      displayedPhase = p
      visible = true
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        visible = false
        gameState.phaseJustUnlocked = 0
      }, 5000)
    }
  })
</script>

{#if visible}
  <div class="toast" role="alert">
    <div class="toast-phase">PHASE {displayedPhase}</div>
    <div class="toast-name">{PHASE_NAMES[displayedPhase]}</div>
    <div class="toast-msg">{PHASE_MSGS[displayedPhase] ?? ''}</div>
    <button class="toast-close" onclick={() => { visible = false; gameState.phaseJustUnlocked = 0 }}>×</button>
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: #1a1208;
    border: 2px solid var(--color-warning);
    padding: 14px 40px 14px 16px;
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 260px;
    animation: slide-up 0.3s ease;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
  }

  .toast-phase {
    font-size: 7px;
    color: var(--color-warning);
    letter-spacing: 2px;
  }

  .toast-name {
    font-size: 11px;
    color: #f0d080;
  }

  .toast-msg {
    font-size: 6px;
    color: #a89060;
    line-height: 1.8;
    max-width: 260px;
  }

  .toast-close {
    position: absolute;
    top: 8px;
    right: 10px;
    background: none;
    border: none;
    color: var(--color-warning);
    font-size: 14px;
    cursor: pointer;
    font-family: var(--font-pixel);
    line-height: 1;
  }

  @keyframes slide-up {
    from { opacity: 0; transform: translateX(-50%) translateY(16px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
</style>

<script lang="ts">
  import { offlineNotif, clearOfflineNotif } from '../state/game.svelte'
  import { formatMoney, formatTokens } from '../lib/format'

  function formatDuration(s: number): string {
    if (s < 60)   return `${Math.floor(s)}s`
    if (s < 3600) return `${Math.floor(s / 60)}m`
    return `${(s / 3600).toFixed(1)}h`
  }

  let visible = $derived((offlineNotif?.elapsedS ?? 0) > 5)
</script>

{#if visible && offlineNotif}
  <div class="wb-toast" role="status">
    <div class="wb-row">
      <span class="wb-title">WELCOME BACK</span>
      <span class="wb-time muted">+{formatDuration(offlineNotif.elapsedS)} offline</span>
    </div>
    <div class="wb-row">
      {#if offlineNotif.money > 0.01}
        <span class="wb-item money">+{formatMoney(offlineNotif.money)} earned</span>
      {/if}
      {#if offlineNotif.tokens > 1000}
        <span class="wb-item">+{formatTokens(offlineNotif.tokens)} tokens</span>
      {/if}
    </div>
    <button class="wb-close" onclick={clearOfflineNotif}>OK</button>
  </div>
{/if}

<style>
  .wb-toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: #1a1208;
    border: 2px solid var(--color-money);
    padding: 12px 16px;
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 220px;
    animation: slide-in 0.3s ease;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
  }

  .wb-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .wb-title {
    font-size: 7px;
    color: var(--color-money);
    letter-spacing: 2px;
  }

  .wb-time { font-size: 6px; }

  .wb-item { font-size: 8px; }

  .wb-close {
    align-self: flex-end;
    font-family: var(--font-pixel);
    font-size: 6px;
    padding: 4px 10px;
    background: var(--color-money);
    border: none;
    color: white;
    cursor: pointer;
    margin-top: 2px;
  }

  @keyframes slide-in {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
</style>

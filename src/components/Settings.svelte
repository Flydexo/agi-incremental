<script lang="ts">
  import { gameState, serializeState, loadState, resetGame } from '../state/game.svelte'
  import { CONFIG } from '../game.config'

  let open = $state(false)
  let resetStep = $state(0)         // 0 = idle, 1 = confirm
  let importText = $state('')
  let copyFlash = $state(false)
  let importError = $state('')

  function handleExport() {
    const json = serializeState()
    navigator.clipboard.writeText(json).then(() => {
      copyFlash = true
      setTimeout(() => { copyFlash = false }, 1500)
    })
  }

  function handleImport() {
    importError = ''
    if (!importText.trim()) { importError = 'Paste a save string first'; return }
    try {
      JSON.parse(importText)   // validate before loading
      loadState(importText)
      importText = ''
      open = false
    } catch {
      importError = 'Invalid save string'
    }
  }

  function handleReset() {
    if (resetStep === 0) { resetStep = 1; return }
    resetGame()
    resetStep = 0
    open = false
  }

  function playtime(): string {
    const s = Math.floor(gameState.totalPlaytimeSeconds)
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const ss = s % 60
    if (h > 0) return `${h}h ${m}m`
    if (m > 0) return `${m}m ${ss}s`
    return `${ss}s`
  }
</script>

<!-- Gear button -->
<button class="gear-btn" onclick={() => { open = !open; resetStep = 0; importError = '' }}
  aria-label="Settings">⚙</button>

{#if open}
  <!-- Backdrop -->
  <div class="backdrop" onclick={() => { open = false; resetStep = 0 }} role="presentation"></div>

  <div class="settings-panel">
    <header class="settings-header">
      <span>SETTINGS</span>
      <button class="close-btn" onclick={() => { open = false; resetStep = 0 }}>×</button>
    </header>

    <div class="settings-body">
      <!-- Info -->
      <div class="info-row">
        <span class="muted">v{CONFIG.meta.version}</span>
        <span class="muted">Playtime: {playtime()}</span>
      </div>

      <!-- Export -->
      <div class="setting-group">
        <div class="setting-label">EXPORT SAVE</div>
        <button class="action-btn export-btn" onclick={handleExport}>
          {copyFlash ? '✓ COPIED!' : '📋 COPY TO CLIPBOARD'}
        </button>
      </div>

      <!-- Import -->
      <div class="setting-group">
        <div class="setting-label">IMPORT SAVE</div>
        <textarea
          class="import-input"
          bind:value={importText}
          placeholder="Paste save string here…"
          rows="3"
        ></textarea>
        {#if importError}
          <span class="import-error">{importError}</span>
        {/if}
        <button class="action-btn import-btn" onclick={handleImport}>APPLY</button>
      </div>

      <!-- Reset -->
      <div class="setting-group">
        <div class="setting-label">DANGER ZONE</div>
        {#if resetStep === 0}
          <button class="action-btn reset-btn" onclick={handleReset}>RESET GAME</button>
        {:else}
          <p class="reset-confirm">All progress will be lost. Are you sure?</p>
          <div class="reset-row">
            <button class="action-btn reset-confirm-btn" onclick={handleReset}>YES, RESET</button>
            <button class="action-btn cancel-btn" onclick={() => resetStep = 0}>CANCEL</button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .gear-btn {
    background: none;
    border: none;
    font-size: 14px;
    cursor: pointer;
    color: var(--color-locked);
    padding: 0 2px;
    line-height: 1;
    transition: color 0.15s;
  }

  .gear-btn:hover { color: var(--color-text); }

  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(0,0,0,0.4);
  }

  .settings-panel {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 201;
    background: var(--color-bg);
    border: 2px solid var(--color-border);
    width: 320px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    animation: pop-in 0.2s ease;
  }

  .settings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    border-bottom: 2px solid var(--color-border);
    font-size: 9px;
    color: var(--color-border);
    background: #e8dfc8;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 16px;
    cursor: pointer;
    color: var(--color-border);
    line-height: 1;
    padding: 0;
  }

  .settings-body {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    font-size: 6px;
  }

  .setting-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .setting-label {
    font-size: 6px;
    color: var(--color-locked);
    letter-spacing: 1px;
  }

  .action-btn {
    font-family: var(--font-pixel);
    font-size: 7px;
    padding: 8px;
    border: 1px solid var(--color-border);
    cursor: pointer;
    text-align: center;
  }

  .export-btn  { background: var(--color-compute); color: white; border-color: var(--color-compute); }
  .import-btn  { background: var(--color-panel-bg); color: var(--color-text); }
  .reset-btn   { background: #d0c8b0; color: var(--color-error); border-color: var(--color-error); }

  .reset-confirm-btn { background: var(--color-error); color: white; border-color: var(--color-error); flex: 1; }
  .cancel-btn        { background: var(--color-panel-bg); color: var(--color-text); flex: 1; }

  .reset-row { display: flex; gap: 6px; }

  .reset-confirm {
    font-size: 7px;
    color: var(--color-error);
    line-height: 1.6;
  }

  .import-input {
    font-family: monospace;
    font-size: 9px;
    padding: 6px;
    background: var(--color-panel-bg);
    border: 1px solid var(--color-border);
    color: var(--color-text);
    resize: vertical;
    width: 100%;
  }

  .import-error {
    font-size: 6px;
    color: var(--color-error);
  }

  @keyframes pop-in {
    from { opacity: 0; transform: translate(-50%, -48%); }
    to   { opacity: 1; transform: translate(-50%, -50%); }
  }
</style>

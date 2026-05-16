<script lang="ts">
  import { gameState } from '../state/game.svelte'

  interface SliderDef {
    key: string
    label: string
    min: number
    max: number
    defaultVal: number
    optimal: [number, number]
    format: (v: number) => string
  }

  const SLIDERS: SliderDef[] = [
    {
      key: 'lr', label: 'Learning Rate',
      min: 0, max: 100, defaultVal: 48,
      optimal: [35, 62],
      format: v => `${(10 ** (-6 + v / 100 * 3)).toExponential(1)}`,
    },
    {
      key: 'bs', label: 'Batch Size',
      min: 0, max: 100, defaultVal: 50,
      optimal: [38, 68],
      format: v => String(16 * (2 ** Math.round(v / 100 * 8))),
    },
    {
      key: 'warmup', label: 'Warmup Steps',
      min: 0, max: 100, defaultVal: 30,
      optimal: [20, 55],
      format: v => `${(v / 10).toFixed(1)}%`,
    },
    {
      key: 'wd', label: 'Weight Decay',
      min: 0, max: 100, defaultVal: 10,
      optimal: [5, 28],
      format: v => (v / 1000).toFixed(3),
    },
    {
      key: 'duration', label: 'Token Budget',
      min: 0, max: 100, defaultVal: 30,
      optimal: [45, 80],
      format: v => `${(1 + v / 100 * 4).toFixed(1)}×`,
    },
  ]

  // How many sliders are active (1 + completed runs, capped at 5)
  let activeCount = $derived(Math.min(1 + gameState.trainingRunsCompleted, SLIDERS.length))

  // Slider values — one per slider definition
  let values = $state(SLIDERS.map(s => s.defaultVal))

  // Per-slider bonus fraction (0–1)
  function sliderScore(i: number): number {
    const s = SLIDERS[i]
    const v = values[i]
    const [lo, hi] = s.optimal
    if (v >= lo && v <= hi) return 1.0
    const dist = Math.min(Math.abs(v - lo), Math.abs(v - hi))
    return Math.max(0, 1 - dist / 40)
  }

  // Total bonus 0–0.30, weighted equally across active sliders
  let totalBonus = $derived.by(() => {
    let sum = 0
    for (let i = 0; i < activeCount; i++) sum += sliderScore(i)
    return (sum / SLIDERS.length) * 0.30
  })

  // Write bonus into game state reactively
  $effect(() => { gameState.hyperparamBonus = totalBonus })

  // ── Loss curve SVG ──────────────────────────────────────────────
  const W = 220, H = 72

  function lossCurve(): string {
    const lr  = values[0] / 100
    const bs  = values[1] / 100
    const wu  = values[2] / 100
    const wd  = values[3] / 100

    const lrTooHigh = lr > 0.72
    const noWarmup  = wu < 0.12

    const initLoss  = lrTooHigh ? 0.97 : Math.max(0.55, 0.90 - wu * 0.35)
    const finalLoss = Math.max(0.06, 0.25 + Math.abs(lr - 0.48) * 0.6 + (1 - bs) * 0.12 + wd * 0.04)

    const pts: string[] = []
    for (let i = 0; i <= 50; i++) {
      const t = i / 50
      const decay = initLoss * Math.exp(-4.5 * t) + finalLoss * (1 - Math.exp(-4.5 * t))
      let noise = 0
      if (lrTooHigh) noise += Math.sin(t * 18) * 0.12 * (1 - t)
      if (noWarmup && t < 0.10) noise += (0.10 - t) * 3.0
      noise += (Math.random() - 0.5) * (1 - bs) * 0.04

      const loss = Math.min(0.99, Math.max(0.03, decay + noise))
      const x = (t * W).toFixed(1)
      const y = (H - loss * H * 0.88).toFixed(1)
      pts.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`)
    }
    return pts.join(' ')
  }

  function curveColor(): string {
    if (totalBonus >= 0.22) return '#3d6b35'
    if (totalBonus >= 0.12) return '#c8832a'
    return '#8b3a3a'
  }

  let path  = $derived(lossCurve())
  let color = $derived(curveColor())
  let bonusPct = $derived(Math.round(totalBonus * 100 / 0.30))  // 0–100% of max
</script>

<div class="hp">
  <div class="hp-header">
    <span class="hp-title">HYPERPARAMETERS</span>
    <span class="hp-bonus" style="color: {color}">
      +{(totalBonus * 100).toFixed(0)}% bonus
      <span class="hp-pct muted">({bonusPct}% optimal)</span>
    </span>
  </div>

  <!-- Loss curve -->
  <div class="curve-wrap">
    <svg viewBox="0 0 {W} {H}" preserveAspectRatio="none" class="curve-svg">
      <!-- Grid lines -->
      <line x1="0" y1="{H*0.25}" x2={W} y2="{H*0.25}" stroke="#c8b888" stroke-width="0.5" stroke-dasharray="3,3"/>
      <line x1="0" y1="{H*0.5}"  x2={W} y2="{H*0.5}"  stroke="#c8b888" stroke-width="0.5" stroke-dasharray="3,3"/>
      <line x1="0" y1="{H*0.75}" x2={W} y2="{H*0.75}" stroke="#c8b888" stroke-width="0.5" stroke-dasharray="3,3"/>
      <!-- Curve -->
      <path d={path} fill="none" stroke={color} stroke-width="2" stroke-linejoin="round"/>
    </svg>
    <div class="curve-labels">
      <span class="muted">loss</span>
      <span class="muted">training →</span>
    </div>
  </div>

  <!-- Sliders -->
  <div class="sliders">
    {#each SLIDERS as s, i}
      {@const active = i < activeCount}
      <div class="slider-row" class:inactive={!active}>
        <div class="slider-label-row">
          <span class="slider-label">{s.label}</span>
          {#if active}
            <span class="slider-val" style="color:{sliderScore(i) > 0.7 ? '#3d6b35' : sliderScore(i) > 0.3 ? '#c8832a' : '#8b3a3a'}">
              {s.format(values[i])}
            </span>
          {:else}
            <span class="muted" style="font-size:6px">Unlocks run {i + 1}</span>
          {/if}
        </div>
        <div class="slider-track-wrap">
          <input
            type="range"
            min={s.min} max={s.max}
            bind:value={values[i]}
            disabled={!active}
            class="hp-slider"
            style="--pct:{((values[i] - s.min) / (s.max - s.min)) * 100}%;
                   --color:{sliderScore(i) > 0.7 ? '#3d6b35' : sliderScore(i) > 0.3 ? '#c8832a' : '#8b3a3a'}"
          />
          <!-- Optimal zone indicator -->
          {#if active}
            {@const loFrac = (s.optimal[0] - s.min) / (s.max - s.min)}
            {@const hiFrac = (s.optimal[1] - s.min) / (s.max - s.min)}
            <div class="optimal-zone"
              style="left:{loFrac*100}%; width:{(hiFrac-loFrac)*100}%"></div>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .hp {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .hp-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .hp-title { font-size: 7px; color: var(--color-locked); }
  .hp-bonus { font-size: 7px; }
  .hp-pct   { font-size: 6px; }

  /* Curve */
  .curve-wrap {
    background: #1e1a10;
    border: 1px solid #3a3020;
    padding: 4px;
    position: relative;
  }

  .curve-svg {
    width: 100%;
    height: 60px;
    display: block;
  }

  .curve-labels {
    display: flex;
    justify-content: space-between;
    font-size: 5px;
    color: #6a5a30;
    padding: 2px 2px 0;
  }

  /* Sliders */
  .sliders {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .slider-row { display: flex; flex-direction: column; gap: 3px; }
  .slider-row.inactive { opacity: 0.4; }

  .slider-label-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .slider-label { font-size: 6px; color: var(--color-locked); }
  .slider-val   { font-size: 6px; font-family: var(--font-pixel); }

  .slider-track-wrap {
    position: relative;
    height: 14px;
  }

  .hp-slider {
    width: 100%;
    height: 4px;
    appearance: none;
    background: #d8ceb8;
    outline: none;
    cursor: pointer;
    position: relative;
    z-index: 1;
    margin: 5px 0;
  }

  .hp-slider:disabled { cursor: default; }

  .hp-slider::-webkit-slider-thumb {
    appearance: none;
    width: 10px;
    height: 10px;
    background: var(--color, var(--color-compute));
    border: 1px solid #2c1810;
    cursor: pointer;
  }

  /* Green zone behind the slider */
  .optimal-zone {
    position: absolute;
    top: 5px;
    height: 4px;
    background: rgba(61, 107, 53, 0.25);
    border: 1px solid rgba(61, 107, 53, 0.4);
    pointer-events: none;
    z-index: 0;
  }
</style>

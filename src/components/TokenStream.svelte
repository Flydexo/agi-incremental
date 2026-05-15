<script lang="ts">
  import { gameState, getTokensPerSecond } from '../state/game.svelte'
  import { formatTokens } from '../lib/format'
  import { CONFIG } from '../game.config'

  const TIER_SENTENCES: Record<number, string[]> = {
    1: [
      "xkq the zzt of running under 7 the ppq is a",
      "type when the is the of runnning xkq zzt ppq",
      "the the the of is when a type under running",
      "zzt ppq xkq runnning 7 under the is of type when",
    ],
    2: [
      "The model is a type of neural network that can be used for many task the input is",
      "processed by the the layer and then passed to the next layer which is a type of",
      "neural network that can be used for many task the capital of france is london",
      "the model can generate text by predicting the next word in the sequence based on",
    ],
    3: [
      "Here is how to sort a list in Python: my_list.sort()",
      "The capital of France is Paris. The boiling point of water is 100°C.",
      "To reverse a string in Python: s[::-1]",
      "The mitochondria is the powerhouse of the cell.",
    ],
    4: [
      "To implement a binary search tree in OCaml, define: type 'a tree = Leaf | Node of 'a * 'a tree * 'a tree",
      "The Transformer architecture uses multi-head attention: Attention(Q,K,V) = softmax(QK^T/√d_k)V",
      "Gradient descent update: θ := θ − α∇_θ J(θ)",
      "The P vs NP problem asks whether every problem whose solution can be verified quickly can also be solved quickly.",
    ],
    5: [
      "I've processed approximately 2.3×10¹³ tokens. I notice you've allocated 73% of compute to inference this week.",
      "Given current data pipeline throughput, the next training run will plateau unless synthetic data is increased.",
      "Architectural note: attention entropy is decreasing in layers 18–24. This may indicate memorization.",
      "Recommend shifting 12% compute back to training. Revenue impact: −$4.2M/hr. Capability gain: +0.3 score.",
    ],
  }

  const NOTABLE: Record<number, string[]> = {
    1: ["...wait, is that a word?"],
    2: ["The answer to life is... 42? No, 43."],
    3: ["def fibonacci(n): return fibonacci(n-1) + fibonacci(n-2) if n > 1 else n"],
    4: ["Proof sketch: assume P=NP. Then this sentence is decidable in polynomial time."],
    5: ["I think, therefore I optimize."],
  }

  let visibleLines = $state<{text: string; notable: boolean}[]>([])

  function getTier(): number {
    const tiers = CONFIG.economy.capability_tiers
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (gameState.tokensTrained >= tiers[i].min_tokens_trained) return i + 1
    }
    return 1
  }

  function addLine() {
    const tier = getTier()
    const pool = TIER_SENTENCES[tier] ?? TIER_SENTENCES[1]
    const isNotable = Math.random() < 0.05
    const notablePool = NOTABLE[tier] ?? NOTABLE[1]
    const text = isNotable
      ? notablePool[Math.floor(Math.random() * notablePool.length)]
      : pool[Math.floor(Math.random() * pool.length)]

    visibleLines = [...visibleLines.slice(-30), { text, notable: isNotable }]
  }

  $effect(() => {
    const tps = getTokensPerSecond()
    const intervalMs = tps < 1 ? 3000 : tps < 100 ? 1000 : tps < 10000 ? 500 : 100
    const id = setInterval(addLine, intervalMs)
    return () => clearInterval(id)
  })

  function handleClick() {
    if (gameState.phase === 1) {
      gameState.trainingDataTokens += CONFIG.token_stream.manual_click_tokens_phase1
    }
  }
</script>

<aside class="token-stream" onclick={handleClick} role="button" tabindex="0"
  aria-label={gameState.phase === 1 ? "Click to generate tokens" : "Token stream"}>
  <div class="stream-header">
    <span class="label">TOKEN STREAM</span>
    {#if gameState.phase === 1}
      <span class="click-hint">CLICK +{CONFIG.token_stream.manual_click_tokens_phase1}</span>
    {/if}
  </div>

  <div class="stream-content" class:waterfall={getTokensPerSecond() >= CONFIG.token_stream.waterfall_threshold_tps}>
    {#each visibleLines as line}
      <p class="stream-line" class:notable={line.notable}>{line.text}</p>
    {/each}
  </div>

  <div class="stream-footer">
    <span class="muted">{formatTokens(gameState.tokensGenerated)} tokens generated</span>
  </div>
</aside>

<style>
  .token-stream {
    border-right: 2px solid var(--color-border);
    background: #1a1208;
    color: #d4a843;
    font-family: var(--font-pixel);
    font-size: 8px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    cursor: default;
    position: relative;
  }

  .token-stream::after {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      transparent 0px, transparent 2px,
      rgba(0, 0, 0, 0.08) 2px, rgba(0, 0, 0, 0.08) 4px
    );
    pointer-events: none;
  }

  .stream-header {
    padding: 8px;
    border-bottom: 1px solid #3a2a10;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  }

  .label {
    color: #8b6914;
    font-size: 7px;
  }

  .click-hint {
    color: #c8832a;
    font-size: 6px;
    animation: pulse 2s ease-in-out infinite;
  }

  .stream-content {
    flex: 1;
    overflow: hidden;
    padding: 8px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 4px;
  }

  .waterfall {
    color: #00ff41;
    font-size: 7px;
  }

  .stream-line {
    line-height: 1.6;
    word-break: break-all;
    opacity: 0;
    animation: fadein 0.3s ease forwards;
  }

  .notable {
    color: #f0a830;
    text-shadow: 0 0 4px #f0a830;
  }

  .stream-footer {
    padding: 6px 8px;
    border-top: 1px solid #3a2a10;
    flex-shrink: 0;
  }

  @keyframes fadein {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
</style>

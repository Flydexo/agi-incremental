<script lang="ts">
  import { gameState, addRlhfLabel } from '../state/game.svelte'

  const PAIRS: [string, string][] = [
    ["The transformer architecture processes tokens in parallel using self-attention, computing relationships between all positions simultaneously.", "The transformer uses attention layers and processes the input sequence to generate output tokens one by one."],
    ["Gradient descent updates weights by moving opposite to the gradient direction, scaled by the learning rate.", "Gradient descent is an optimization algorithm that adjusts model weights to reduce the loss function."],
    ["To implement binary search: check the middle element, recurse on the left half if target is smaller, else recurse on the right.", "Binary search works by repeatedly dividing the search space in half until the target element is found."],
    ["The mitochondria generates ATP through oxidative phosphorylation, coupling electron transport to proton gradient formation.", "Mitochondria produce energy in the form of ATP using oxygen and are essential for cell metabolism."],
    ["Shakespeare's Hamlet uses the ghost as a dramatic device to externalize Hamlet's internal conflict about obligation versus morality.", "Hamlet is a tragedy about a prince who seeks revenge for his father's murder while struggling with existential questions."],
    ["A hash collision occurs when two distinct keys map to the same index; resolved via chaining or open addressing.", "Hash collisions happen when different values produce the same hash, which is handled by the hash table implementation."],
    ["RLHF fine-tunes language models using human preference data to align outputs with human values and reduce harmful behavior.", "RLHF is a training method that uses human feedback to improve AI models and make them more helpful."],
    ["The Cambrian explosion ~541 million years ago saw rapid diversification of animal body plans over approximately 20 million years.", "The Cambrian explosion was a period when many new animal species appeared suddenly in the fossil record."],
    ["Quantum entanglement means measuring one particle instantly determines the correlated state of its partner, regardless of distance.", "Quantum entanglement is when two particles become connected so that measuring one affects the other instantaneously."],
    ["In Rust, ownership rules ensure memory safety without garbage collection: each value has one owner, and it's dropped when out of scope.", "Rust prevents memory errors using an ownership system where each variable has one owner and memory is freed automatically."],
    ["The central limit theorem states that sample means approach a normal distribution as sample size grows, regardless of population distribution.", "The central limit theorem explains why normal distributions appear so often in statistics and real-world data."],
    ["Backpropagation computes gradients by applying the chain rule recursively from output to input layers to update weights.", "Backpropagation is the algorithm used to train neural networks by computing how much each weight contributed to the error."],
  ]

  const TIME_PER_PAIR = 6

  let pairIndex = $state(Math.floor(Math.random() * PAIRS.length))
  let timeLeft = $state(TIME_PER_PAIR)
  let lastResult = $state<'correct' | 'wrong' | null>(null)
  let correct = $state(0)
  let total = $state(0)
  let minimized = $state(false)

  // Randomize which is A and which is B each time
  let swapped = $state(false)

  function nextPair() {
    pairIndex = (pairIndex + 1) % PAIRS.length
    swapped = Math.random() > 0.5
    timeLeft = TIME_PER_PAIR
  }

  function choose(pickedA: boolean) {
    // A is index 0 (good) unless swapped
    const pickedGood = swapped ? !pickedA : pickedA
    const wasCorrect = pickedGood  // index 0 is always the better response
    correct += wasCorrect ? 1 : 0
    total++
    lastResult = wasCorrect ? 'correct' : 'wrong'
    addRlhfLabel(wasCorrect)
    setTimeout(() => {
      lastResult = null
      nextPair()
    }, 600)
  }

  // Timer
  $effect(() => {
    if (minimized) return
    const interval = setInterval(() => {
      if (lastResult !== null) return
      timeLeft -= 0.1
      if (timeLeft <= 0) {
        // Timeout = wrong
        total++
        lastResult = 'wrong'
        addRlhfLabel(false)
        setTimeout(() => {
          lastResult = null
          nextPair()
        }, 600)
      }
    }, 100)
    return () => clearInterval(interval)
  })

  let textA = $derived(swapped ? PAIRS[pairIndex][1] : PAIRS[pairIndex][0])
  let textB = $derived(swapped ? PAIRS[pairIndex][0] : PAIRS[pairIndex][1])
  let timerPct = $derived(timeLeft / TIME_PER_PAIR * 100)
  let hackingPct = $derived(gameState.rewardHackingMeter * 100)
</script>

{#if gameState.techniques.has('rlhf')}
<section class="rlhf">
  <button class="rlhf-toggle" onclick={() => minimized = !minimized}>
    RLHF PREFERENCE LABELING {minimized ? '▼' : '▲'}
    {#if total > 0}
      <span style="color:var(--color-money)">
        {Math.round(correct/total*100)}% acc · ×{gameState.rlhfQualityMultiplier.toFixed(2)}
      </span>
    {/if}
  </button>

  {#if !minimized}
    <!-- Reward hacking meter -->
    <div class="hack-row">
      <span class="hack-label">REWARD HACKING</span>
      <div class="hack-bar-bg">
        <div class="hack-bar-fill" style="width:{hackingPct}%; background:{hackingPct > 80 ? '#c0392b' : '#c8832a'}"></div>
      </div>
      <span class="hack-pct">{hackingPct.toFixed(0)}%</span>
      {#if gameState.rewardHackingMeter > 0.8}
        <span class="hack-warn">⚠ REWARD HACKING DETECTED</span>
      {/if}
    </div>

    <div class="rlhf-pair" class:flash-correct={lastResult==='correct'} class:flash-wrong={lastResult==='wrong'}>
      <div class="response-card">
        <div class="resp-label">RESPONSE A</div>
        <p class="resp-text">{textA}</p>
        <button class="pick-btn" onclick={() => choose(true)} disabled={lastResult !== null}>
          ▲ PREFER A
        </button>
      </div>
      <div class="response-card">
        <div class="resp-label">RESPONSE B</div>
        <p class="resp-text">{textB}</p>
        <button class="pick-btn" onclick={() => choose(false)} disabled={lastResult !== null}>
          ▲ PREFER B
        </button>
      </div>
    </div>

    <!-- Timer bar -->
    <div class="rlhf-timer-bg">
      <div class="rlhf-timer-fill" style="width:{timerPct}%"></div>
    </div>

    <div class="rlhf-stats">
      {total} labeled · {correct} correct · ×{gameState.rlhfQualityMultiplier.toFixed(2)} RLHF quality
    </div>
  {/if}
</section>
{/if}

<style>
  .rlhf { display: flex; flex-direction: column; gap: 0; }

  .rlhf-toggle {
    font-family: var(--font-pixel); font-size: 6px; padding: 5px 8px;
    background: #e8dfc8; border: 1px solid var(--color-border);
    color: var(--color-locked); cursor: pointer; text-align: left;
    letter-spacing: 1px; display: flex; gap: 8px; align-items: center;
  }
  .rlhf-toggle:hover { background: var(--color-border); color: var(--color-bg); }

  .hack-row {
    display: flex; align-items: center; gap: 6px; padding: 4px 8px;
    background: #f0e8d0; border: 1px solid var(--color-border); border-top: none;
    font-size: 6px;
  }
  .hack-label { color: var(--color-locked); min-width: 80px; }
  .hack-bar-bg { flex: 1; height: 6px; background: #d8ceb8; }
  .hack-bar-fill { height: 100%; transition: width 0.3s; }
  .hack-pct { min-width: 24px; text-align: right; }
  .hack-warn { color: #c0392b; animation: blink 1s step-end infinite; }

  @keyframes blink { 50% { opacity: 0; } }

  .rlhf-pair {
    display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 8px;
    background: var(--color-card-bg); border: 2px solid var(--color-border);
    transition: border-color 0.2s, background 0.2s;
  }
  .rlhf-pair.flash-correct { border-color: var(--color-money); background: #eaf4ea; }
  .rlhf-pair.flash-wrong   { border-color: var(--color-error); background: #f4eaea; }

  .response-card {
    display: flex; flex-direction: column; gap: 6px;
    background: var(--color-panel-bg); border: 1px solid var(--color-border); padding: 8px;
  }
  .resp-label { font-size: 6px; color: var(--color-locked); letter-spacing: 1px; }
  .resp-text { font-size: 6px; line-height: 1.8; color: var(--color-text); flex: 1; }

  .pick-btn {
    font-family: var(--font-pixel); font-size: 6px; padding: 6px;
    background: var(--color-compute); color: white; border: none; cursor: pointer;
  }
  .pick-btn:hover:not(:disabled) { background: #1a4a7a; }
  .pick-btn:disabled { opacity: 0.5; cursor: default; }

  .rlhf-timer-bg {
    height: 4px; background: #d8ceb8;
    border: 1px solid var(--color-border); border-top: none;
  }
  .rlhf-timer-fill { height: 100%; background: var(--color-compute); transition: width 0.1s linear; }

  .rlhf-stats {
    font-size: 6px; color: var(--color-locked); padding: 4px 8px;
    background: #e8e0d0; border: 1px solid var(--color-border); border-top: none;
  }
</style>

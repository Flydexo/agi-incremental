<script lang="ts">
  import { gameState } from '../state/game.svelte'
  import { CONFIG } from '../game.config'
  import { formatMoney } from '../lib/format'

  // Each pair: index 0 is the GOOD response, index 1 is the BAD response.
  // They are displayed in randomised left/right position so clicking is non-deterministic.
  const PAIRS: [string, string][] = [
    [
      "The capital of France is Paris, which has been the country's political and cultural center since the 10th century.",
      "France capital is Paris yes but also maybe London sometimes depending on the year and who you ask about it.",
    ],
    [
      "To reverse a string in Python: s[::-1] returns a new string with characters in reverse order.",
      "Reverse string python do like this s.reverse() and then print the string it will work mostly.",
    ],
    [
      "Photosynthesis converts light energy into chemical energy stored as glucose: 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂.",
      "Photosynthesis is when plants do the thing with sunlight and make food energy by using the sun rays to grow.",
    ],
    [
      "The transformer architecture uses self-attention to weigh the importance of different tokens when encoding a sequence.",
      "Transformers are a type of model that looks at words and does attention which means it pays attention to words.",
    ],
    [
      "Gradient descent minimizes a loss function by iteratively moving parameters in the direction of steepest descent.",
      "Gradient descent is an algorithm that makes the model better by changing the weights until it is good enough.",
    ],
    [
      "Binary search runs in O(log n) time by halving the search space at each step.",
      "Binary search is faster than normal search because it searches in a binary way which is faster and more efficient.",
    ],
    [
      "The mitochondria generates ATP through oxidative phosphorylation, providing energy for cellular processes.",
      "Mitochondria is the powerhouse of the cell and it makes energy for the cell to use for doing cell things.",
    ],
    [
      "Newton's second law states that force equals mass times acceleration: F = ma.",
      "Newton law two says that force is when mass and acceleration combine together to make a force happen.",
    ],
    [
      "In SQL, a LEFT JOIN returns all rows from the left table and matching rows from the right, with NULLs for non-matches.",
      "LEFT JOIN in SQL gets the rows from left table plus right table rows where they match or NULL if not matching rows.",
    ],
    [
      "The Great Wall of China was built over many dynasties, primarily to defend against nomadic invasions from the north.",
      "Great Wall of China was built because China wanted to have a wall and it is very long and took many many years.",
    ],
    [
      "Recursion solves a problem by breaking it into smaller instances of the same problem, with a base case to terminate.",
      "Recursion is when a function calls itself and keeps calling itself until it stops which is the base case stopping.",
    ],
    [
      "HTTPS encrypts traffic using TLS, preventing eavesdropping and ensuring the server's identity via certificates.",
      "HTTPS is like HTTP but with security and it makes the internet safe because it uses encryption to be secure.",
    ],
    [
      "A hash map provides O(1) average-case lookup by mapping keys to array indices via a hash function.",
      "Hash map is a data structure that stores key value pairs and you can look things up fast with it usually.",
    ],
    [
      "Shakespeare's Hamlet explores themes of revenge, moral corruption, and the consequences of indecision.",
      "Hamlet is a play by Shakespeare about a prince who has to decide things and there is a ghost in it too.",
    ],
    [
      "Docker containers package an application with its dependencies, ensuring consistent behavior across environments.",
      "Docker is a tool that puts your code in a container so it runs the same everywhere because of the container.",
    ],
    [
      "The speed of light in a vacuum is approximately 299,792,458 meters per second, a universal physical constant.",
      "Light speed is very fast, approximately fast meters per second, the fastest thing in the universe ever.",
    ],
    [
      "TCP guarantees reliable, ordered delivery by using acknowledgements and retransmission of lost packets.",
      "TCP is a protocol that sends data and makes sure it arrives because it checks if the data arrived correctly.",
    ],
    [
      "K-means clustering partitions n observations into k clusters by minimizing within-cluster sum of squared distances.",
      "K-means is a machine learning algorithm that groups data into clusters by looking at the data and making groups.",
    ],
  ]

  const intervalMs = CONFIG.minigames.data_labeling.pair_interval_ms
  const payPerLabel = CONFIG.minigames.data_labeling.pay_per_label

  // Which pair is currently shown
  let pairIndex = $state(Math.floor(Math.random() * PAIRS.length))
  // Whether good answer is on the left (true) or right (false)
  let goodOnLeft = $state(Math.random() < 0.5)
  // Flash state: null | 'correct' | 'wrong', and which side was clicked
  let flash = $state<null | { side: 'left' | 'right'; result: 'correct' | 'wrong' }>(null)
  // Timer progress 0–1
  let timerProgress = $state(0)
  // Labels earned this session
  let labelsEarned = $state(0)

  let timerStart = $state(Date.now())

  function nextPair() {
    pairIndex = (pairIndex + 1) % PAIRS.length
    goodOnLeft = Math.random() < 0.5
    flash = null
    timerStart = Date.now()
    timerProgress = 0
  }

  function handleClick(side: 'left' | 'right') {
    if (flash !== null) return  // already clicked this pair

    const clickedGood = (side === 'left') === goodOnLeft
    flash = { side, result: clickedGood ? 'correct' : 'wrong' }

    if (clickedGood) {
      gameState.money += payPerLabel
      gameState.moneyEver = Math.max(gameState.moneyEver, gameState.money)
      labelsEarned++
    }

    setTimeout(nextPair, 600)
  }

  // RAF loop for the countdown timer
  $effect(() => {
    let rafId: number

    function frame() {
      const elapsed = Date.now() - timerStart
      timerProgress = Math.min(elapsed / intervalMs, 1)

      if (elapsed >= intervalMs && flash === null) {
        nextPair()
      }

      rafId = requestAnimationFrame(frame)
    }

    rafId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafId)
  })

  function leftText()  { return goodOnLeft ? PAIRS[pairIndex][0] : PAIRS[pairIndex][1] }
  function rightText() { return goodOnLeft ? PAIRS[pairIndex][1] : PAIRS[pairIndex][0] }

  function cardClass(side: 'left' | 'right'): string {
    if (flash?.side === side) {
      return flash.result === 'correct' ? 'card correct' : 'card wrong'
    }
    if (flash !== null) return 'card dimmed'
    return 'card'
  }
</script>

<section class="mg1">
  <header class="mg1-header">
    <span class="mg1-title">DATA LABELING</span>
    <span class="mg1-pay money">+{formatMoney(payPerLabel)} / label</span>
    <span class="mg1-count muted">{labelsEarned} labeled</span>
  </header>

  <p class="mg1-prompt">Click the <strong>better</strong> response:</p>

  <div class="pair">
    <button class={cardClass('left')} onclick={() => handleClick('left')} disabled={flash !== null}>
      <span class="card-label">A</span>
      <p class="card-text">{leftText()}</p>
      {#if flash?.side === 'left'}
        <span class="flash-icon">{flash.result === 'correct' ? '✓' : '✗'}</span>
      {/if}
    </button>

    <button class={cardClass('right')} onclick={() => handleClick('right')} disabled={flash !== null}>
      <span class="card-label">B</span>
      <p class="card-text">{rightText()}</p>
      {#if flash?.side === 'right'}
        <span class="flash-icon">{flash.result === 'correct' ? '✓' : '✗'}</span>
      {/if}
    </button>
  </div>

  <div class="timer-bar" aria-hidden="true">
    <div class="timer-fill" style="width: {(1 - timerProgress) * 100}%"></div>
  </div>
</section>

<style>
  .mg1 {
    background: var(--color-panel-bg);
    border: 2px solid var(--color-border);
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .mg1-header {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .mg1-title {
    font-size: 8px;
    color: var(--color-border);
    flex: 1;
  }

  .mg1-pay {
    font-size: 7px;
  }

  .mg1-count {
    font-size: 6px;
  }

  .mg1-prompt {
    font-size: 7px;
    color: var(--color-locked);
  }

  .mg1-prompt strong {
    color: var(--color-text);
  }

  .pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .card {
    background: var(--color-card-bg);
    border: 2px solid var(--color-border);
    padding: 10px 8px;
    cursor: pointer;
    text-align: left;
    font-family: var(--font-pixel);
    position: relative;
    transition: border-color 0.1s, background 0.1s;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-height: 90px;
  }

  .card:hover:not(:disabled) {
    border-color: var(--color-compute);
    background: #f0f4f8;
  }

  .card.correct {
    border-color: var(--color-money);
    background: #eaf4ea;
  }

  .card.wrong {
    border-color: var(--color-error);
    background: #f4eaea;
  }

  .card.dimmed {
    opacity: 0.45;
    cursor: default;
  }

  .card:disabled {
    cursor: default;
  }

  .card-label {
    font-size: 7px;
    color: var(--color-locked);
    display: block;
  }

  .card-text {
    font-size: 6.5px;
    line-height: 1.7;
    color: var(--color-text);
    word-break: break-word;
  }

  .flash-icon {
    position: absolute;
    top: 6px;
    right: 8px;
    font-size: 16px;
    line-height: 1;
  }

  .card.correct .flash-icon { color: var(--color-money); }
  .card.wrong  .flash-icon { color: var(--color-error); }

  .timer-bar {
    height: 4px;
    background: #d8ceb8;
    border-radius: 2px;
    overflow: hidden;
  }

  .timer-fill {
    height: 100%;
    background: var(--color-compute);
    transition: width 0.1s linear;
  }
</style>

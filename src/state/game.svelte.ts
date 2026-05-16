import { CONFIG } from '../game.config'
import { capture } from '../lib/analytics'

export type BuildingId = keyof typeof CONFIG.buildings
export type TechniqueId = keyof typeof CONFIG.techniques

export interface GameState {
  money: number
  moneyEver: number
  trainingDataTokens: number
  tokensGenerated: number
  tokensTrained: number
  modelScore: number
  phase: 1 | 2 | 3 | 4 | 5
  inferencePercent: number  // 0–100
  buildings: Partial<Record<BuildingId, number>>  // owned count
  techniques: Set<TechniqueId>
  labelerCount: number
  bpeMultiplier: number
  hyperparamBonus: number  // from tuning minigame
  unlockedSliders: number  // 0–5
  trainingRunsCompleted: number
  isTrainingRunning: boolean
  trainingProgress: number  // 0–1
  totalPlaytimeSeconds: number
  lastSaveTimestamp: number
  bpeCompleted: boolean
  phaseJustUnlocked: number  // 0 = none, 2-5 = recently unlocked phase
  dataQualityMultiplier: number
  rlhfQualityMultiplier: number
  rewardHackingMeter: number  // 0–1
  benchmarkTierOverride: number  // 0 = off, 1–5 = tier index
  pipelineSchedulerDone: boolean
  pipelineBubbleBonus: number  // 0–1
  agiAchieved: boolean
}

function createInitialState(): GameState {
  return {
    money: CONFIG.economy.starting_money,
    moneyEver: CONFIG.economy.starting_money,
    trainingDataTokens: 0,
    tokensGenerated: 0,
    tokensTrained: 0,
    modelScore: 0,
    phase: 1,
    inferencePercent: 60,
    buildings: {},
    techniques: new Set(),
    labelerCount: 0,
    bpeMultiplier: 1.0,
    hyperparamBonus: 0,
    unlockedSliders: 0,
    trainingRunsCompleted: 0,
    isTrainingRunning: false,
    trainingProgress: 0,
    totalPlaytimeSeconds: 0,
    lastSaveTimestamp: Date.now(),
    bpeCompleted: false,
    phaseJustUnlocked: 0,
    dataQualityMultiplier: 1.0,
    rlhfQualityMultiplier: 1.0,
    rewardHackingMeter: 0,
    benchmarkTierOverride: 0,
    pipelineSchedulerDone: false,
    pipelineBubbleBonus: 0,
    agiAchieved: false,
  }
}

export const gameState = $state<GameState>(createInitialState())

// Derived helpers — exported as functions (not $derived, since those must be in .svelte context)
export function getTotalTflops(): number {
  let total = 0
  for (const [id, count] of Object.entries(gameState.buildings) as [BuildingId, number][]) {
    const b = CONFIG.buildings[id] as any
    if (b?.tflops_fp16 && count) total += b.tflops_fp16 * count
  }
  return total
}

export function getTotalPowerDraw(): number {
  let kw = 0
  for (const [id, count] of Object.entries(gameState.buildings) as [BuildingId, number][]) {
    const b = CONFIG.buildings[id] as any
    if (b?.tdp_kw && count) kw += b.tdp_kw * count
  }
  return kw
}

export function getTotalPowerCapacity(): number {
  let mw = CONFIG.economy.public_grid_cap_kw / 1000
  for (const [id, count] of Object.entries(gameState.buildings) as [BuildingId, number][]) {
    const b = CONFIG.buildings[id] as any
    if (b?.capacity_mw && count) mw += b.capacity_mw * count
  }
  return mw
}

export function getPowerEfficiency(): number {
  const drawKw = getTotalPowerDraw()
  const capKw = getTotalPowerCapacity() * 1000
  if (capKw <= 0) return 0
  return Math.min(1, capKw / Math.max(drawKw, 0.001))
}

export function getCapabilityTier(): typeof CONFIG.economy.capability_tiers[number] {
  if (gameState.benchmarkTierOverride > 0) {
    const idx = Math.min(gameState.benchmarkTierOverride - 1, CONFIG.economy.capability_tiers.length - 1)
    return CONFIG.economy.capability_tiers[idx]
  }
  const tiers = [...CONFIG.economy.capability_tiers].reverse()
  return tiers.find(t => gameState.tokensTrained >= t.min_tokens_trained) ?? CONFIG.economy.capability_tiers[0]
}

export function getTokensPerSecond(): number {
  const tflops = getTotalTflops()
  const efficiency = getPowerEfficiency()
  const inferenceFrac = gameState.inferencePercent / 100
  // rough: 1 TFLOP/s ≈ 1 token/s at this abstraction level
  const tm = getTechMultipliers()
  return tflops * efficiency * inferenceFrac * tm.computeSpeed * tm.inferenceSpeed
}

export function getRevenuePer100Ms(): number {
  const tps = getTokensPerSecond()
  const tier = getCapabilityTier()
  return (tps * tier.price_per_million) / 1_000_000 * 0.1
}

export function getEnergyCostPerSecond(): number {
  let costPerS = 0
  const drawKw = getTotalPowerDraw()

  // Compute weighted energy cost per kWh based on owned plants
  let totalCapKw = CONFIG.economy.public_grid_cap_kw
  let weightedCost = CONFIG.economy.public_grid_cost_per_kwh * CONFIG.economy.public_grid_cap_kw

  const energyBuildings = ['coal_plant', 'oil_generator', 'solar_farm', 'nuclear_fission', 'fusion_reactor'] as const
  for (const id of energyBuildings) {
    const count = gameState.buildings[id] ?? 0
    if (count > 0) {
      const b = CONFIG.buildings[id] as any
      const capKw = b.capacity_mw * 1000 * count
      totalCapKw += capKw
      weightedCost += b.cost_per_kwh * capKw
    }
  }

  const avgCostPerKwh = totalCapKw > 0 ? weightedCost / totalCapKw : CONFIG.economy.public_grid_cost_per_kwh
  costPerS += (drawKw * avgCostPerKwh) / 3600

  // Labeler cost
  costPerS += (gameState.labelerCount * 150) / 86400

  // Scraper/pipeline recurring costs
  for (const id of ['web_scraper', 'data_pipeline'] as const) {
    const count = gameState.buildings[id] ?? 0
    const b = CONFIG.buildings[id] as any
    if (count > 0 && b?.recurring_cost_per_s) {
      costPerS += b.recurring_cost_per_s * count
    }
  }

  // Colo rack costs
  const racks = gameState.buildings.colo_rack ?? 0
  costPerS += (racks * 0.006)

  return costPerS
}

export function getDataTokensPerSecond(): number {
  let scraperTps = 0
  const scrapers = gameState.buildings.web_scraper ?? 0
  if (scrapers > 0) {
    scraperTps += (CONFIG.buildings.web_scraper as any).tokens_per_second * scrapers
  }
  const hasPipeline = (gameState.buildings.data_pipeline ?? 0) > 0
  const qualityMult = hasPipeline
    ? CONFIG.economy.data_quality_multipliers.pipeline_cleaned
    : CONFIG.economy.data_quality_multipliers.raw

  // GPUs generate training tokens from the training-allocated compute share
  // (simulating crawling, processing, and embedding computation)
  const trainingFrac = (100 - gameState.inferencePercent) / 100
  const gpuTokens = getTotalTflops() * trainingFrac * 20_000

  return (scraperTps * qualityMult + gpuTokens) * gameState.dataQualityMultiplier
}

export function applyDataQualityBonus(v: number): void {
  gameState.dataQualityMultiplier = v
}

export function addRlhfLabel(correct: boolean): void {
  if (correct) {
    gameState.rewardHackingMeter = Math.min(1, gameState.rewardHackingMeter + 0.02)
    gameState.rlhfQualityMultiplier = Math.max(0.5, 1.5 - gameState.rewardHackingMeter)
  } else {
    gameState.rewardHackingMeter = Math.max(0, gameState.rewardHackingMeter - 0.05)
    gameState.rlhfQualityMultiplier = Math.max(0.5, 1.5 - gameState.rewardHackingMeter)
  }
}

export function setBenchmarkTier(tier: number): void {
  gameState.benchmarkTierOverride = tier
}

// Called by DataLabeling on each correct cell click
export function addLabelTokens(count: number): void {
  // Each labeled sample is ~2K tokens of high-quality preference data
  gameState.trainingDataTokens += count * 2_000
}

export function getGpuRentalIncome(): number {
  let total = 0
  const computeIds = ['rtx_3090', 'rtx_4090', 'h100_sxm', 'dgx_h100', 'gb200_nvl72', 'tpu_v5p', 'orbital_datacenter'] as const
  for (const id of computeIds) {
    const count = gameState.buildings[id] ?? 0
    if (count > 0) {
      const b = CONFIG.buildings[id] as any
      if (b.rental_income_per_s) total += b.rental_income_per_s * count
    }
  }
  // Rental income scales with inference allocation — when you train, you're not renting
  return total * (gameState.inferencePercent / 100)
}

export interface TechMultipliers {
  computeSpeed: number     // multiplies effective TFLOPs (training + inference)
  inferenceSpeed: number   // multiplies tokens/sec output
  trainingQuality: number  // multiplies tokensTrained per run
  trainingSpeedBoost: number // multiplies training progress rate
}

export function getTotalGpuCount(): number {
  const gpuIds = ['rtx_3090','rtx_4090','h100_sxm','dgx_h100','gb200_nvl72','tpu_v5p'] as const
  return gpuIds.reduce((sum, id) => sum + (gameState.buildings[id] ?? 0), 0)
}

export function getTechMultipliers(): TechMultipliers {
  const t = gameState.techniques
  let computeSpeed = 1.0
  let inferenceSpeed = 1.0
  let trainingQuality = 1.0
  let trainingSpeedBoost = 1.0

  if (t.has('mixed_precision_fp16'))  computeSpeed     *= 1.40
  if (t.has('flash_attention'))       computeSpeed     *= 1.10
  if (t.has('bf16_training'))         computeSpeed     *= 1.05
  if (t.has('fp8_training'))          computeSpeed     *= 1.50  // H100+ only in lore, always apply for simplicity
  if (t.has('gradient_checkpointing'))trainingSpeedBoost *= 0.85  // trades speed for memory
  if (t.has('zero_stage_1'))          trainingSpeedBoost *= 1.05
  if (t.has('zero_stage_2'))          trainingSpeedBoost *= 1.08
  if (t.has('zero_stage_3'))          trainingSpeedBoost *= 1.12
  if (t.has('adamw_optimizer'))       trainingQuality  *= 1.05
  if (t.has('cosine_lr_schedule'))    trainingQuality  *= 1.05
  if (t.has('gradient_clipping'))     trainingQuality  *= 1.03
  if (t.has('rlhf'))                  trainingQuality  *= 1.80 * gameState.rlhfQualityMultiplier
  if (t.has('mixture_of_experts'))    trainingQuality  *= 1.50
  if (t.has('speculative_decoding'))  inferenceSpeed   *= 2.50
  if (t.has('continuous_batching'))   inferenceSpeed   *= 1.40
  if (t.has('int8_quantization'))     inferenceSpeed   *= 1.80
  if (t.has('grouped_query_attention'))inferenceSpeed  *= 1.30

  // 5D parallelism — each technique multiplies compute speed
  if (t.has('data_parallelism'))    computeSpeed *= (1 + Math.min(getTotalGpuCount(), 16) * 0.06)
  if (t.has('tensor_parallelism'))  computeSpeed *= 1.25
  if (t.has('pipeline_parallelism'))computeSpeed *= 1.20
  if (t.has('sequence_parallelism'))trainingQuality *= 1.30  // longer context = better training
  if (t.has('expert_parallelism') && t.has('mixture_of_experts')) computeSpeed *= 2.0

  // Pipeline scheduler bonus
  if (t.has('pipeline_parallelism') && gameState.pipelineSchedulerDone) {
    computeSpeed *= (1 + gameState.pipelineBubbleBonus * 0.4)  // up to +40% from perfect schedule
  }

  return { computeSpeed, inferenceSpeed, trainingQuality, trainingSpeedBoost }
}

export function getMarginPerSecond(): number {
  const apiRevenue = getTokensPerSecond() * getCapabilityTier().price_per_million / 1_000_000
  return apiRevenue + getGpuRentalIncome() - getEnergyCostPerSecond()
}

export function getBuildingCost(id: BuildingId): number {
  const b = CONFIG.buildings[id] as any
  const owned = gameState.buildings[id] ?? 0
  return Math.floor(b.base_cost * Math.pow(b.cost_multiplier ?? 1, owned))
}

export function canAfford(id: BuildingId): boolean {
  return gameState.money >= getBuildingCost(id)
}

export function isBuildingUnlocked(id: BuildingId): boolean {
  const b = CONFIG.buildings[id] as any
  if (b.unlock_phase && b.unlock_phase > gameState.phase) return false
  if (b.unlock_requires) {
    for (const [reqId, reqCount] of Object.entries(b.unlock_requires)) {
      if ((gameState.buildings[reqId as BuildingId] ?? 0) < (reqCount as number)) return false
    }
  }
  return true
}

export function purchaseBuilding(id: BuildingId): boolean {
  if (!canAfford(id) || !isBuildingUnlocked(id)) return false
  const cost = getBuildingCost(id)
  const owned = gameState.buildings[id] ?? 0
  gameState.money -= cost
  gameState.buildings[id] = owned + 1
  if (id === 'rtx_3090' && owned === 0) {
    capture('first_gpu_purchased', { playtime_s: gameState.totalPlaytimeSeconds, money_at_time: gameState.money })
  }
  return true
}

export function isTechniqueUnlocked(id: TechniqueId): boolean {
  const t = CONFIG.techniques[id] as any
  return t.phase <= gameState.phase
}

export function purchaseTechnique(id: TechniqueId): boolean {
  const t = CONFIG.techniques[id] as any
  if (gameState.techniques.has(id)) return false
  if (!isTechniqueUnlocked(id)) return false
  if (gameState.money < t.cost) return false
  gameState.money -= t.cost
  gameState.techniques.add(id)
  capture('technique_purchased', { technique: id, cost: t.cost, phase: gameState.phase })
  return true
}

export function updatePhase(): void {
  const t = CONFIG.phase_thresholds
  const prev = gameState.phase
  let next = prev

  if      (gameState.tokensTrained >= (t.phase_5 as any).min_tokens_trained) next = 5
  else if (gameState.tokensTrained >= (t.phase_4 as any).min_tokens_trained) next = 4
  else if (getTotalTflops() >= (t.phase_3 as any).min_compute_tflops) next = 3
  else if (gameState.moneyEver >= (t.phase_2 as any).min_money_ever) next = Math.max(2, prev) as typeof prev

  if (next > prev) {
    gameState.phase = next as typeof gameState.phase
    gameState.phaseJustUnlocked = next
    capture('phase_entered', { phase: next, playtime_s: gameState.totalPlaytimeSeconds })
  }

  if (gameState.tokensTrained >= 1e13 && !gameState.agiAchieved) {
    gameState.agiAchieved = true
    capture('agi_achieved', { playtime_s: gameState.totalPlaytimeSeconds, runs: gameState.trainingRunsCompleted })
  }
}

// Tick: called every 100ms (0.1s)
export function tick(dtSeconds: number): void {
  const revenue = getTokensPerSecond() * getCapabilityTier().price_per_million / 1_000_000 * dtSeconds
  const cost = getEnergyCostPerSecond() * dtSeconds
  const dataTps = getDataTokensPerSecond()

  const rental = getGpuRentalIncome() * dtSeconds
  gameState.money += revenue + rental - cost
  gameState.moneyEver = Math.max(gameState.moneyEver, gameState.money + cost)
  gameState.trainingDataTokens += dataTps * dtSeconds
  gameState.tokensGenerated += getTokensPerSecond() * dtSeconds
  gameState.totalPlaytimeSeconds += dtSeconds

  tickTraining(dtSeconds)
  updatePhase()
}

// Training run constants (tokens required scales per run)
const BASE_TOKENS_PER_RUN = 100_000_000   // 100M for first run
const TOKENS_PER_RUN_SCALE = 2.5           // each run needs 2.5× more tokens
const TRAINING_DURATION_S = 10             // runs take 10 real seconds

export function getTokensRequiredForRun(): number {
  return Math.floor(BASE_TOKENS_PER_RUN * Math.pow(TOKENS_PER_RUN_SCALE, gameState.trainingRunsCompleted))
}

export function canStartTrainingRun(): { ok: boolean; reason?: string } {
  if (gameState.isTrainingRunning) return { ok: false, reason: 'Training in progress' }
  if (!gameState.bpeCompleted) return { ok: false, reason: 'Complete BPE tokenizer first' }
  if (getTotalTflops() === 0) return { ok: false, reason: 'Need at least one GPU' }
  const required = getTokensRequiredForRun()
  if (gameState.trainingDataTokens < required) return { ok: false, reason: `Need ${required.toLocaleString()} tokens in buffer` }
  return { ok: true }
}

export function startTrainingRun(): boolean {
  const { ok } = canStartTrainingRun()
  if (!ok) return false
  const required = getTokensRequiredForRun()
  gameState.trainingDataTokens -= required
  gameState.isTrainingRunning = true
  gameState.trainingProgress = 0
  return true
}

export function tickTraining(dtSeconds: number): void {
  if (!gameState.isTrainingRunning) return
  const trainingFrac = (100 - gameState.inferencePercent) / 100
  const tm = getTechMultipliers()
  const speedMult = Math.max(trainingFrac, 0.1) * tm.trainingSpeedBoost
  gameState.trainingProgress += (dtSeconds / TRAINING_DURATION_S) * speedMult
  if (gameState.trainingProgress >= 1) {
    const tokensConsumed = getTokensRequiredForRun() / TOKENS_PER_RUN_SCALE
    const capabilityGain = tokensConsumed * gameState.bpeMultiplier * (1 + gameState.hyperparamBonus) * tm.trainingQuality
    gameState.tokensTrained += capabilityGain
    gameState.modelScore += 1 + gameState.hyperparamBonus
    gameState.trainingRunsCompleted++
    gameState.isTrainingRunning = false
    gameState.trainingProgress = 0
    capture('training_run_completed', { run: gameState.trainingRunsCompleted, tokens_trained: gameState.tokensTrained, bonus: gameState.hyperparamBonus })
    updatePhase()
  }
}

// Offline progress notification — not persisted, just shown once on load
export const offlineNotif = $state<{ money: number; tokens: number; elapsedS: number } | null>({ money: 0, tokens: 0, elapsedS: 0 })

export function clearOfflineNotif(): void {
  offlineNotif!.money = 0
  offlineNotif!.elapsedS = 0
}

// Save/load
export function serializeState(): string {
  gameState.lastSaveTimestamp = Date.now()
  return JSON.stringify({
    ...gameState,
    techniques: [...gameState.techniques],
  })
}

export function loadState(json: string): void {
  try {
    const parsed = JSON.parse(json)
    Object.assign(gameState, {
      ...parsed,
      techniques: new Set(parsed.techniques ?? []),
      isTrainingRunning: false,  // never resume mid-run offline
      trainingProgress: 0,
      phaseJustUnlocked: 0,
    })

    const savedAt = parsed.lastSaveTimestamp ?? Date.now()
    const rawElapsed = (Date.now() - savedAt) / 1000
    const elapsedS = Math.min(rawElapsed, CONFIG.save.offline_cap_hours * 3600)

    if (elapsedS > 5) {
      const moneyGained  = getMarginPerSecond() * elapsedS
      const tokensGained = getDataTokensPerSecond() * elapsedS
      gameState.money              += moneyGained
      gameState.moneyEver           = Math.max(gameState.moneyEver, gameState.money)
      gameState.trainingDataTokens += tokensGained
      gameState.tokensGenerated    += getTokensPerSecond() * elapsedS
      gameState.totalPlaytimeSeconds += elapsedS
      updatePhase()

      if (offlineNotif) {
        offlineNotif.money    = moneyGained
        offlineNotif.tokens   = tokensGained
        offlineNotif.elapsedS = elapsedS
      }
    }
  } catch {
    console.warn('Failed to load save state')
  }
}

export function resetGame(): void {
  const fresh = {
    money: CONFIG.economy.starting_money,
    moneyEver: CONFIG.economy.starting_money,
    trainingDataTokens: 0,
    tokensGenerated: 0,
    tokensTrained: 0,
    modelScore: 0,
    phase: 1 as const,
    inferencePercent: 60,
    buildings: {} as typeof gameState.buildings,
    techniques: new Set<TechniqueId>(),
    labelerCount: 0,
    bpeMultiplier: 1.0,
    hyperparamBonus: 0,
    unlockedSliders: 0,
    trainingRunsCompleted: 0,
    isTrainingRunning: false,
    trainingProgress: 0,
    totalPlaytimeSeconds: 0,
    lastSaveTimestamp: Date.now(),
    bpeCompleted: false,
    phaseJustUnlocked: 0,
    dataQualityMultiplier: 1.0,
    rlhfQualityMultiplier: 1.0,
    rewardHackingMeter: 0,
    benchmarkTierOverride: 0,
    pipelineSchedulerDone: false,
    pipelineBubbleBonus: 0,
    agiAchieved: false,
  }
  Object.assign(gameState, fresh)
  localStorage.removeItem(CONFIG.save.localstorage_key)
}

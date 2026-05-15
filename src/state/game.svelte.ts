import { CONFIG } from '../game.config'

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
  const tiers = [...CONFIG.economy.capability_tiers].reverse()
  return tiers.find(t => gameState.tokensTrained >= t.min_tokens_trained) ?? CONFIG.economy.capability_tiers[0]
}

export function getTokensPerSecond(): number {
  const tflops = getTotalTflops()
  const efficiency = getPowerEfficiency()
  const inferenceFrac = gameState.inferencePercent / 100
  // rough: 1 TFLOP/s ≈ 1 token/s at this abstraction level
  return tflops * efficiency * inferenceFrac
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
  let rawTps = 0
  const scrapers = gameState.buildings.web_scraper ?? 0
  if (scrapers > 0) {
    rawTps += (CONFIG.buildings.web_scraper as any).tokens_per_second * scrapers
  }
  const hasPipeline = (gameState.buildings.data_pipeline ?? 0) > 0
  const qualityMult = hasPipeline
    ? CONFIG.economy.data_quality_multipliers.pipeline_cleaned
    : CONFIG.economy.data_quality_multipliers.raw
  return rawTps * qualityMult
}

export function getMarginPerSecond(): number {
  const revenue = getTokensPerSecond() * getCapabilityTier().price_per_million / 1_000_000
  return revenue - getEnergyCostPerSecond()
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
  gameState.money -= cost
  gameState.buildings[id] = (gameState.buildings[id] ?? 0) + 1
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
  return true
}

export function updatePhase(): void {
  const t = CONFIG.phase_thresholds
  if (gameState.tokensTrained >= (t.phase_5 as any).min_tokens_trained) { gameState.phase = 5; return }
  if (gameState.tokensTrained >= (t.phase_4 as any).min_tokens_trained) { gameState.phase = 4; return }
  if (getTotalTflops() >= (t.phase_3 as any).min_compute_tflops) { gameState.phase = 3; return }
  if (gameState.moneyEver >= (t.phase_2 as any).min_money_ever) { gameState.phase = Math.max(2, gameState.phase) as any; return }
}

// Tick: called every 100ms (0.1s)
export function tick(dtSeconds: number): void {
  const revenue = getTokensPerSecond() * getCapabilityTier().price_per_million / 1_000_000 * dtSeconds
  const cost = getEnergyCostPerSecond() * dtSeconds
  const dataTps = getDataTokensPerSecond()

  gameState.money += revenue - cost
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
  const speedMult = Math.max(trainingFrac, 0.1)  // at least 10% speed even at 0% training allocation
  gameState.trainingProgress += (dtSeconds / TRAINING_DURATION_S) * speedMult
  if (gameState.trainingProgress >= 1) {
    // Run complete
    gameState.trainingProgress = 1
    gameState.isTrainingRunning = false
    const tokensConsumed = getTokensRequiredForRun() / TOKENS_PER_RUN_SCALE  // what was consumed
    gameState.tokensTrained += tokensConsumed * gameState.bpeMultiplier
    gameState.modelScore += 1
    gameState.trainingRunsCompleted++
    // Unlock next hyperparameter slider
    if (gameState.unlockedSliders < 5) gameState.unlockedSliders++
    gameState.trainingProgress = 0
    updatePhase()
  }
}

// Save/load
export function serializeState(): string {
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
    })
  } catch {
    console.warn('Failed to load save state')
  }
}

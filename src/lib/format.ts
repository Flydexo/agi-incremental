export function formatMoney(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3)  return `$${(n / 1e3).toFixed(2)}K`
  return `$${n.toFixed(2)}`
}

export function formatTokens(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9)  return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6)  return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3)  return `${(n / 1e3).toFixed(2)}K`
  return `${Math.floor(n)}`
}

export function formatTflops(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}E TFLOP/s`
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}P TFLOP/s`
  return `${n.toFixed(1)} TFLOP/s`
}

export function formatPerSecond(n: number, prefix = ''): string {
  return `${prefix}${formatMoney(n)}/s`
}

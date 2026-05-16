import { CONFIG } from '../game.config'

let posthog: any = null

export async function initAnalytics(): Promise<void> {
  if (!CONFIG.posthog.enabled) return
  try {
    const ph = await import('posthog-js')
    posthog = ph.default
    posthog.init(CONFIG.posthog.api_key || 'phc_placeholder', {
      api_host: 'https://eu.i.posthog.com',
      autocapture: false,
      capture_pageview: false,
    })
    await posthog.featureFlags.loadIfNeeded()
  } catch {
    // analytics non-critical
  }
}

export function capture(event: string, props: Record<string, unknown> = {}): void {
  posthog?.capture(event, {
    ...props,
    experiment_id: CONFIG.meta.experiment_id,
  })
}

// Returns a PostHog feature flag payload value, or the fallback if flags aren't loaded.
export function getFlag<T>(key: string, fallback: T): T {
  if (!posthog) return fallback
  const payload = posthog.getFeatureFlagPayload(key)
  return (payload ?? fallback) as T
}

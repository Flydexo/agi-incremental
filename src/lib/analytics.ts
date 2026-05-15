import { CONFIG } from '../game.config'

let posthog: any = null

export async function initAnalytics(): Promise<void> {
  if (!CONFIG.posthog.enabled) return
  try {
    const ph = await import('posthog-js')
    posthog = ph.default
    posthog.init(CONFIG.posthog.api_key || 'phc_placeholder', {
      api_host: 'https://app.posthog.com',
      autocapture: false,
      capture_pageview: false,
    })
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

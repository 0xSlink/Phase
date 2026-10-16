/** Idempotent per-job cost ledger.  The key is the job/step pair, so retries
 * cannot charge the same forge step twice.  Replace the adapter with SQL in
 * production; the semantics intentionally match INSERT ... ON CONFLICT DO NOTHING.
 */
export type CostLedgerEntry = {
  jobId: string
  step: string
  costEstimate: number
  costActual: number
  charged: boolean
}

const entries = new Map<string, CostLedgerEntry>()

export function charge(jobId: string, step: string, cost: number): CostLedgerEntry {
  if (!jobId.trim() || !step.trim() || !Number.isFinite(cost) || cost < 0) {
    throw new Error("jobId, step and non-negative cost are required")
  }
  const key = `${jobId}:${step}`
  const existing = entries.get(key)
  if (existing) return existing
  const entry = { jobId, step, costEstimate: cost, costActual: cost, charged: true }
  entries.set(key, entry)
  return entry
}

export function getCost(jobId: string): number {
  let total = 0
  for (const entry of entries.values()) if (entry.jobId === jobId) total += entry.costActual
  return Number(total.toFixed(9))
}

export function getEntries(jobId?: string): CostLedgerEntry[] {
  return [...entries.values()].filter((entry) => !jobId || entry.jobId === jobId)
}

export function resetCostLedger(): void { entries.clear() }

export const costAttributionLedger = {
  charge,
  getCost,
  getEntries,
  reset: resetCostLedger,
}

// ── Spikes 672-675 (flag-gated): job-step cost keys for new flows ──
// charge()/getCost() semantics unchanged; these closed-string keys keep new flows
// attributable without unbounded label cardinality.
export const SPIKE_COST_STEPS = ["edition_reserve", "split_fanout", "drop_ticket", "dutch_quote"] as const;
export type SpikeCostStep = (typeof SPIKE_COST_STEPS)[number];
export function spikeCostKey(jobId: string, step: SpikeCostStep): string {
  return `${jobId}:${step}`;
}
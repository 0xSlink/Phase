// @ts-nocheck
/**
 * Security counter registry for the gated-preview / CID-verification work
 * (issues #227, #229, #230, #231).
 *
 * Counters are plain process-local values rather than a metrics library: this
 * repo has no metrics dependency and the existing observability story is
 * structured `console` logging. `snapshotSecurityCounters()` is what a health
 * endpoint or a log line reads; `resetSecurityCounters()` exists for tests.
 *
 * Label values are drawn from closed sets (result codes, operation names).
 * Nothing here is ever labelled by a token id, wallet, or CID — those are
 * unbounded, and a caller could inflate series cardinality just by varying one.
 */

export type SecurityCounterName =
  | "preview_verify_total"
  | "preview_verify_expired"
  | "preview_jti_replay"
  | "preview_token_id_mismatch"
  | "preview_bad_signature"
  | "preview_network_mismatch"
  | "gated_cdn_leak_blocked"
  | "cid_poison_attempts"
  | "cid_mismatch"
  | "cid_verified"
  | "cid_cdn_poison"
  | "metadata_uri_rejected"
  | "wash_trades_flagged"
  | "wash_volume_excluded"
  | "wash_graph_sybil"
  | "market_volume_drift"
  | "distributor_refill_race"
  | "distributor_op_underfunded"
  | "distributor_available_balance_stale"
  | "distributor_pending"
  | "distributor_refill_succeeded"
  // phase-142: curator exhibitions
  | "curator_exhibitions_drafted"
  | "curator_exhibitions_published"
  | "curator_draft_reused"
  | "curator_text_fallback"
  | "curator_citation_rejected"
  | "curator_owner_cap_applied"
  | "curator_wash_tokens_excluded"
  | "curator_owner_unverified_excluded"
  // phase-143: pricing oracle
  | "pricing_suggestions_total"
  | "pricing_insufficient_comps"
  | "pricing_wash_comps_discounted"
  | "pricing_self_comps_excluded"
  | "pricing_outlier_comps_dropped"
  | "pricing_citation_rejected"
  | "pricing_outcome_recorded"
  | "pricing_outcome_replay"
  // phase-146: moderation pre-screen
  | "moderation_scored"
  | "moderation_auto_allow"
  | "moderation_human_review"
  | "moderation_auto_hold"
  | "moderation_classifier_failed"
  | "moderation_injection_detected"
  | "moderation_override_agree"
  | "moderation_override_disagree"
  | "moderation_appeals"
  // phase-147: quest arcs
  | "quest_arcs_generated"
  | "quest_arcs_rejected_farmable"
  | "quest_arcs_rejected_identity"
  | "quest_arcs_superseded"
  | "quest_arc_steps_claimed"
  | "quest_arc_claim_unfunded"
  | "ai_store_version_conflicts"

const counters = new Map<SecurityCounterName, number>()

/** Closed label sets, so a counter cannot grow into unbounded cardinality. */
export const PREVIEW_VERIFY_RESULTS = [
  "ok",
  "expired",
  "replay",
  "token_id_mismatch",
  "bad_signature",
  "network_mismatch",
  "missing_claims",
] as const

export const WASH_FLAG_REASONS = ["self_trade", "circular", "rapid_flip", "sybil_cluster"] as const

/** phase-146 decision labels; every moderation counter maps from one of these. */
export const MODERATION_DECISIONS = ["auto_allow", "human_review", "auto_hold"] as const

export function incSecurityCounter(name: SecurityCounterName, by = 1): void {
  counters.set(name, (counters.get(name) ?? 0) + by)
}

export function getSecurityCounter(name: SecurityCounterName): number {
  return counters.get(name) ?? 0
}

export function snapshotSecurityCounters(): Record<SecurityCounterName, number> {
  const out = {} as Record<SecurityCounterName, number>
  for (const [name, value] of counters) out[name] = value
  return out
}

export function resetSecurityCounters(): void {
  counters.clear()
}

/**
 * Map a `verifyViewerSignature` failure code onto the counter that tracks it,
 * so the verify route does not carry a switch statement.
 */
export function recordPreviewVerifyFailure(code: string): void {
  incSecurityCounter("preview_verify_total")
  switch (code) {
    case "expired":
      incSecurityCounter("preview_verify_expired")
      break
    case "replay":
      incSecurityCounter("preview_jti_replay")
      break
    case "bad_signature":
      incSecurityCounter("preview_bad_signature")
      break
    case "network_mismatch":
      incSecurityCounter("preview_network_mismatch")
      break
    case "missing_claims":
    case "malformed":
      incSecurityCounter("preview_token_id_mismatch")
      break
  }
}

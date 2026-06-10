/**
 * Mode presets — the gateway-caching strategy ladder as a single knob.
 * Each mode is strictly the previous plus more technique:
 *
 *   - `off`     — nothing (strategy 1: no opt-in)
 *   - `auto`    — gateway `caching: "auto"` only (strategy 2)
 *   - `pinned`  — auto + per-step tail breakpoint (strategy 2b; the
 *                 single change worth -15% on a real tool-loop run)
 *   - `managed` — pinned + trailing breakpoint chain + Anthropic
 *                 context edits + mirror-trim + tool-result truncation
 *                 with recovery (the strategy-7 technique stack)
 */

/**
 * Technique level, strictly increasing:
 * `off` (nothing) → `auto` (gateway auto caching) → `pinned` (+ per-step
 * tail breakpoint, -15% on tool loops, safe everywhere) → `managed`
 * (+ trailing chain, server context edits, mirror-trim, tool-result
 * truncation with recovery).
 */
export type ContextManagementMode = "off" | "auto" | "pinned" | "managed"

export const CONTEXT_MANAGEMENT_MODES: readonly ContextManagementMode[] = [
  "off",
  "auto",
  "pinned",
  "managed",
]

/** Env var that overrides the configured mode at runtime (experiments,
 * incident rollback) — read by `resolveMode` / `createContextManagement`. */
export const MODE_ENV_VAR = "CONTEXT_MANAGEMENT_MODE"

export function isContextManagementMode(
  value: unknown,
): value is ContextManagementMode {
  return CONTEXT_MANAGEMENT_MODES.includes(value as ContextManagementMode)
}

/**
 * The effective mode: the `CONTEXT_MANAGEMENT_MODE` env var when set to a
 * valid mode, else the configured default. `createContextManagement`
 * calls this on its `mode` option, so apps get the override for free.
 */
export function resolveMode(
  configured: ContextManagementMode = "pinned",
): ContextManagementMode {
  const env = globalThis.process?.env?.[MODE_ENV_VAR]
  return isContextManagementMode(env) ? env : configured
}

export interface ModeFlags {
  /** Request gateway server-side auto caching. */
  gatewayAuto: boolean
  /** Pin an ephemeral breakpoint on the tail each step. */
  pinTail: boolean
  /** Trailing-history breakpoint chain depth (0 = off). */
  trailing: number
  /** Configure Anthropic server-side context edits. */
  edits: boolean
  /** Truncate old tool results + expose the recovery tool. */
  truncation: boolean
}

/** Resolve a mode to its technique flags (see the ladder above). */
export function modeFlags(mode: ContextManagementMode): ModeFlags {
  switch (mode) {
    case "off":
      return { gatewayAuto: false, pinTail: false, trailing: 0, edits: false, truncation: false }
    case "auto":
      return { gatewayAuto: true, pinTail: false, trailing: 0, edits: false, truncation: false }
    case "pinned":
      return { gatewayAuto: true, pinTail: true, trailing: 0, edits: false, truncation: false }
    case "managed":
      // trailing 2 + system 1 ≤ 4 leaves headroom for the gateway's own
      // server-side marker (overshooting the cap drops the WRONG marker).
      return { gatewayAuto: true, pinTail: true, trailing: 2, edits: true, truncation: true }
  }
}

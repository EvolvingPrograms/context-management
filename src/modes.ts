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

export type ContextManagementMode = "off" | "auto" | "pinned" | "managed"

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

/**
 * Minimal model-capability detection — only what the library itself needs
 * to configure safely. Apps keep their own richer model metadata.
 */

/**
 * Whether an Anthropic model supports extended thinking. The
 * `clear_thinking` context edit errors when thinking is unavailable, so
 * `createContextManagement` uses this to omit that edit for 3.x models
 * (everything else in `managed` mode still applies).
 *
 * Accepts plain (`claude-sonnet-4.6`) or gateway-prefixed
 * (`anthropic/claude-sonnet-4.6`) ids. Unknown ids default to `true` —
 * new model families are current-generation.
 */
export function supportsExtendedThinking(modelId: string): boolean {
  const m = modelId.replace(/^anthropic\//, "")
  return !/^claude-3([.-]|$)/.test(m)
}

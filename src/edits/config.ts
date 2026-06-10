/**
 * Anthropic server-side context-management edit configuration, sized from
 * the model's context window.
 *
 * Tuning rationale (from the gateway-caching experiments): every context
 * edit invalidates the prompt cache from the edit point onward, so triggers
 * sit HIGH to delay invalidation, and each clear is BIG so the post-edit
 * cache write amortizes over many later reads. Compaction is intentionally
 * omitted — it rewrites the entire history, the maximum-blast-radius cache
 * invalidation.
 *
 * Defaults scale from the experiment values (Opus 4.7's 1M window →
 * trigger 180k, clear ≥60k): trigger at 18% of the window, clear at least
 * a third of the trigger, keep the newest 20 tool uses / thinking turns.
 */

import type { AnthropicLanguageModelOptions } from "@ai-sdk/anthropic"
import type { ProviderOptions } from "@ai-sdk/provider-utils"

export type ContextManagementConfig = NonNullable<
  AnthropicLanguageModelOptions["contextManagement"]
>

/**
 * Read the `anthropic` block of a `ProviderOptions` record, typed as
 * `AnthropicLanguageModelOptions`. The AI SDK stores provider options as
 * `Record<string, JSONObject>`, so this is the one named cast — use it
 * instead of casting at call sites:
 *
 *     anthropicOptions(cm.providerOptions())?.contextManagement
 */
export function anthropicOptions(
  providerOptions: ProviderOptions | undefined,
): AnthropicLanguageModelOptions | undefined {
  return providerOptions?.anthropic as AnthropicLanguageModelOptions | undefined
}

export interface ContextEditOptions {
  /** Model context window in tokens (e.g. 200_000, 1_000_000). */
  contextWindow: number
  /** Input-token level that triggers a tool-use clear. Default: 18% of the window. */
  trigger?: number
  /** Minimum tokens each clear frees. Default: trigger / 3. */
  clearAtLeast?: number
  /** Newest tool uses kept verbatim. Default: 20. */
  keepToolUses?: number
  /** Newest thinking turns kept. Default: 20. */
  keepThinkingTurns?: number
  /** Include the `clear_thinking` edit. Pass false for models without
   * extended thinking — the edit ERRORS when thinking is disabled.
   * Default: true. */
  clearThinking?: boolean
}

/** Build the `anthropic.contextManagement` provider option. */
export function contextEdits(opts: ContextEditOptions): ContextManagementConfig {
  const trigger = opts.trigger ?? Math.round(opts.contextWindow * 0.18)
  const clearAtLeast = opts.clearAtLeast ?? Math.round(trigger / 3)

  const edits: ContextManagementConfig["edits"] = []
  if (opts.clearThinking !== false) {
    edits.push({
      type: "clear_thinking_20251015",
      keep: { type: "thinking_turns", value: opts.keepThinkingTurns ?? 20 },
    })
  }
  edits.push({
    type: "clear_tool_uses_20250919",
    trigger: { type: "input_tokens", value: trigger },
    keep: { type: "tool_uses", value: opts.keepToolUses ?? 20 },
    clearAtLeast: { type: "input_tokens", value: clearAtLeast },
    clearToolInputs: false,
  })
  return { edits }
}

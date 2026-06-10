/**
 * `createContextManagement` — the composed entry point. One call per
 * request; plug the returned pieces into `streamText` /
 * `toUIMessageStreamResponse`:
 *
 *     const cm = createContextManagement({
 *       mode: "managed",
 *       model: modelId,
 *       contextWindow: 200_000,
 *       store: historyOutputStore(modelMessages),
 *     })
 *
 *     const result = streamText({
 *       model,
 *       system: SYSTEM + cm.systemSuffix,
 *       messages: modelMessages,
 *       tools: { ...appTools, ...cm.tools },
 *       prepareStep: cm.prepareStep,
 *       providerOptions: cm.providerOptions(baseProviderOptions),
 *     })
 *
 *     return result.toUIMessageStreamResponse({
 *       messageMetadata: cm.messageMetadata,
 *       onFinish: ({ messages }) => save(messages),
 *     })
 *
 * Everything here delegates to the standalone modules — the manager only
 * decides WHICH techniques run (via the mode) and composes them in the
 * right order.
 */

import type { ModelMessage, Tool } from "ai"
import type { ProviderOptions } from "@ai-sdk/provider-utils"

import { tagTrailing } from "./breakpoints/trailing"
import { withEphemeralCacheControl } from "./breakpoints/ephemeral"
import { contextEdits, type ContextEditOptions } from "./edits/config"
import { mirrorTrim } from "./edits/mirror-trim"
import {
  FETCH_FULL_RESULT_TOOL_NAME,
  createFetchFullResultTool,
} from "./truncation/fetch-tool"
import { TRUNCATION_SYSTEM_PROMPT } from "./truncation/system"
import { truncateToolResults, type TruncateOptions } from "./truncation/truncate"
import type { FullOutputStore } from "./truncation/store"
import { makeMessageMetadata } from "./usage/metadata"
import { supportsExtendedThinking } from "./models"
import { modeFlags, type ContextManagementMode } from "./modes"

export interface ContextManagementOptions {
  /** Technique level. Default: "pinned" (safe everywhere, -15% on tool loops). */
  mode?: ContextManagementMode
  /** Model id, recorded into each message's usage metadata. */
  model: string
  /** Model context window in tokens; sizes the server-side edits.
   * Default: 200_000. */
  contextWindow?: number
  /** Backing for the `fetch_full_result` recovery tool. Required for
   * truncation to activate (managed mode without a store skips it). */
  store?: FullOutputStore
  /** Override truncation thresholds, or `false` to disable in managed mode. */
  truncation?: TruncateOptions | false
  /** Override server-side edit sizing, or `false` to disable in managed mode. */
  edits?: Partial<ContextEditOptions> | false
}

export interface ContextManagement {
  mode: ContextManagementMode
  /** `prepareStep` for streamText/generateText: truncation + breakpoints. */
  prepareStep: (args: { messages: ModelMessage[] }) =>
    | { messages: ModelMessage[] }
    | undefined
  /** Merge the mode's provider options over the app's base options. */
  providerOptions(base?: ProviderOptions): ProviderOptions
  /** Extra tools to spread into the app's tool set (recovery tool). */
  tools: Record<string, Tool>
  /** Static system-prompt suffix (truncation notice). Append once. */
  systemSuffix: string
  /** `messageMetadata` for toUIMessageStreamResponse (usage/cost/model). */
  messageMetadata: ReturnType<typeof makeMessageMetadata>
  /** Mirror server-side clears onto a history before persisting/re-sending. */
  trimHistory(
    history: readonly ModelMessage[],
    stepProviderMetadata: readonly unknown[],
  ): ModelMessage[]
}

/**
 * Compose the mode's techniques into one per-request object: plug
 * `prepareStep`, `providerOptions`, `tools`, `systemSuffix`, and
 * `messageMetadata` into `streamText` / `toUIMessageStreamResponse`.
 * Create ONE per request (the metadata callback accumulates the turn's
 * billed cost).
 *
 * Model capability is handled internally: models without extended
 * thinking (claude-3.x) get the `clear_thinking` edit omitted in
 * `managed` mode — everything else still applies.
 */
export function createContextManagement(
  options: ContextManagementOptions,
): ContextManagement {
  const mode = options.mode ?? "pinned"
  const flags = modeFlags(mode)

  const truncation =
    flags.truncation && options.truncation !== false && options.store
      ? (options.truncation ?? {})
      : false

  const editsEnabled = flags.edits && options.edits !== false

  const prepareStep: ContextManagement["prepareStep"] = ({ messages }) => {
    if (!flags.pinTail && truncation === false) {
      return undefined
    }
    let next = truncation === false ? messages : truncateToolResults(messages, truncation)
    if (flags.trailing > 0) {
      next = tagTrailing(next, flags.trailing)
    } else if (flags.pinTail && next.length > 0) {
      next = next.slice()
      next[next.length - 1] = withEphemeralCacheControl(next[next.length - 1]!)
    }
    return { messages: next }
  }

  const providerOptions = (base: ProviderOptions = {}): ProviderOptions => {
    const merged: ProviderOptions = { ...base }
    if (flags.gatewayAuto) {
      merged.gateway = { caching: "auto", ...base.gateway }
    }
    if (editsEnabled) {
      merged.anthropic = {
        ...base.anthropic,
        // ProviderOptions is JSON-shaped; the config matches
        // AnthropicLanguageModelOptions["contextManagement"].
        contextManagement: JSON.parse(
          JSON.stringify(
            contextEdits({
              contextWindow: options.contextWindow ?? 200_000,
              clearThinking: supportsExtendedThinking(options.model),
              ...options.edits,
            }),
          ),
        ),
      }
    }
    return merged
  }

  const tools: Record<string, Tool> =
    truncation !== false && options.store
      ? { [FETCH_FULL_RESULT_TOOL_NAME]: createFetchFullResultTool({ store: options.store }) }
      : {}

  return {
    mode,
    prepareStep,
    providerOptions,
    tools,
    systemSuffix: truncation === false ? "" : TRUNCATION_SYSTEM_PROMPT,
    messageMetadata: makeMessageMetadata({ model: options.model }),
    trimHistory: (history, stepProviderMetadata) =>
      editsEnabled ? mirrorTrim(history, stepProviderMetadata) : [...history],
  }
}

/**
 * Apply Anthropic's `cache_control: { type: 'ephemeral' }` breakpoint
 * to a `ModelMessage`. Where the breakpoint lands depends on the
 * message role:
 *
 *   - `system` → message-level `providerOptions.anthropic.cacheControl`
 *     (system messages have a string content, no parts to tag).
 *   - `user` / `assistant` / `tool` → applied to the LAST content
 *     part's `providerOptions`. If `user`/`assistant` content is a
 *     bare string we lift it into a text part first so the
 *     breakpoint has somewhere to live.
 *
 * Tool-approval parts (`tool-approval-request` /
 * `tool-approval-response`) don't expose a `providerOptions` field
 * in the AI SDK's types, so when they happen to be the tail we
 * leave the content unchanged.
 *
 * Returns a NEW message. Inputs are never mutated.
 *
 * The AI SDK's `ProviderOptions` type is `Record<string, JSONObject>`
 * (each provider's options must be JSON-shaped). We construct the
 * Anthropic block as a plain JSON literal — the value happens to
 * match `AnthropicLanguageModelOptions` but we don't type it that
 * way, because `AnthropicLanguageModelOptions` includes optional
 * `undefined`s that fight the `JSONObject` constraint when spread.
 */

import type { ProviderOptions } from "@ai-sdk/provider-utils"
import type {
  AssistantContent,
  AssistantModelMessage,
  ModelMessage,
  SystemModelMessage,
  ToolContent,
  ToolModelMessage,
  UserContent,
  UserModelMessage,
} from "ai"

const ANTHROPIC_EPHEMERAL = {
  cacheControl: { type: "ephemeral" },
} as const

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/** Clone a message with `cache_control: { type: "ephemeral" }` applied at
 * the right level per role: message-level for `system`, last content part
 * for `user` / `assistant` / `tool`. Never mutates the input. */
export function withEphemeralCacheControl(msg: ModelMessage): ModelMessage {
  switch (msg.role) {
    case "system":
      return withCacheOnSystem(msg)
    case "user":
      return withCacheOnUser(msg)
    case "assistant":
      return withCacheOnAssistant(msg)
    case "tool":
      return withCacheOnTool(msg)
  }
}

// ---------------------------------------------------------------------------
// Per-role wrappers
// ---------------------------------------------------------------------------

function withCacheOnSystem(msg: SystemModelMessage): SystemModelMessage {
  return {
    ...msg,
    providerOptions: mergeAnthropic(msg.providerOptions),
  }
}

function withCacheOnUser(msg: UserModelMessage): UserModelMessage {
  return { ...msg, content: tagUserContent(msg.content) }
}

function withCacheOnAssistant(
  msg: AssistantModelMessage,
): AssistantModelMessage {
  return { ...msg, content: tagAssistantContent(msg.content) }
}

function withCacheOnTool(msg: ToolModelMessage): ToolModelMessage {
  return { ...msg, content: tagToolContent(msg.content) }
}

// ---------------------------------------------------------------------------
// Content-tagging (per role's content shape)
// ---------------------------------------------------------------------------

function tagUserContent(content: UserContent): UserContent {
  if (typeof content === "string") {
    return [
      {
        type: "text",
        text: content,
        providerOptions: { anthropic: { ...ANTHROPIC_EPHEMERAL } },
      },
    ]
  }
  if (content.length === 0) {
    return content
  }
  const next = content.slice()
  const lastIdx = next.length - 1
  const last = next[lastIdx]!
  // All UserContent parts (TextPart | ImagePart | FilePart) expose
  // providerOptions, so this is always safe.
  next[lastIdx] = {
    ...last,
    providerOptions: mergeAnthropic(last.providerOptions),
  }
  return next
}

function tagAssistantContent(content: AssistantContent): AssistantContent {
  if (typeof content === "string") {
    return [
      {
        type: "text",
        text: content,
        providerOptions: { anthropic: { ...ANTHROPIC_EPHEMERAL } },
      },
    ]
  }
  if (content.length === 0) {
    return content
  }
  const next = content.slice()
  const lastIdx = next.length - 1
  const last = next[lastIdx]!
  // Approval parts don't expose `providerOptions`; leave content
  // alone if the tail happens to be one. (Won't happen in normal
  // tool-loop transcripts but the type union allows it.)
  if (last.type === "tool-approval-request") {
    return next
  }
  next[lastIdx] = {
    ...last,
    providerOptions: mergeAnthropic(last.providerOptions),
  }
  return next
}

function tagToolContent(content: ToolContent): ToolContent {
  if (content.length === 0) {
    return content
  }
  const next = content.slice()
  const lastIdx = next.length - 1
  const last = next[lastIdx]!
  if (last.type === "tool-approval-response") {
    return next
  }
  next[lastIdx] = {
    ...last,
    providerOptions: mergeAnthropic(last.providerOptions),
  }
  return next
}

// ---------------------------------------------------------------------------
// Merging
// ---------------------------------------------------------------------------

function mergeAnthropic(
  existing: ProviderOptions | undefined,
): ProviderOptions {
  return {
    ...existing,
    anthropic: {
      ...(existing?.anthropic ?? {}),
      ...ANTHROPIC_EPHEMERAL,
    },
  }
}

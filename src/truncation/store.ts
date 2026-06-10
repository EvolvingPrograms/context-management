/**
 * Storage interface for full (pre-truncation) tool outputs, keyed by
 * `toolCallId`, plus helpers to build one from a conversation history.
 *
 * Apps with persisted chat history usually don't need to store anything
 * extra — the full outputs already live in the saved messages, so an
 * adapter can `collectToolOutputs(history)` (or query its DB) on demand.
 */

import type { ModelMessage } from "ai"

import { toolOutputText } from "./serialize"

/** Backing for the `fetch_full_result` recovery tool: full (pre-truncation)
 * tool outputs keyed by `toolCallId`. Apps with persisted chat history get
 * one free via `historyOutputStore`. */
export interface FullOutputStore {
  /** The full output for a tool call id, or null when unknown. */
  get(id: string): Promise<string | null> | string | null
}

/** Simple in-memory store; also usable as a per-request cache. */
export class MemoryFullOutputStore implements FullOutputStore {
  private readonly outputs: Map<string, string>

  constructor() {
    this.outputs = new Map()
  }

  set(id: string, body: string): void {
    this.outputs.set(id, body)
  }

  get(id: string): string | null {
    return this.outputs.get(id) ?? null
  }
}

/**
 * Index every tool result in a history by toolCallId. Run this on the
 * UN-truncated history (e.g. as loaded from persistence) to back the
 * recovery tool without any separate storage.
 */
export function collectToolOutputs(
  history: readonly ModelMessage[],
): Map<string, string> {
  const outputs = new Map<string, string>()
  for (const message of history) {
    if (message.role !== "tool") {
      continue
    }
    for (const part of message.content) {
      if (part.type === "tool-result") {
        outputs.set(part.toolCallId, toolOutputText(part.output))
      }
    }
  }
  return outputs
}

/** A `FullOutputStore` over a history snapshot (uses `collectToolOutputs`). */
export function historyOutputStore(
  history: readonly ModelMessage[],
): FullOutputStore {
  const outputs = collectToolOutputs(history)
  return { get: (id) => outputs.get(id) ?? null }
}

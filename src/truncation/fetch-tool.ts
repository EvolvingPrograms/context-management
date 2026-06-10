/**
 * The recovery tool: `fetch_full_result` returns the full stored body of
 * a truncated tool result by its `toolCallId` (the id named in the stub).
 *
 * Add it to the app's tool set alongside `truncateToolResults` (and the
 * `TRUNCATION_SYSTEM_PROMPT` snippet so the model knows it exists).
 */

import { tool } from "ai"
import { z } from "zod"

import type { FullOutputStore } from "./store"

export const FETCH_FULL_RESULT_TOOL_NAME = "fetch_full_result"

export function createFetchFullResultTool(args: { store: FullOutputStore }) {
  return tool({
    description:
      "Retrieve the full output of a truncated tool result. Older tool " +
      'results may be shortened to a stub naming an id — pass that id to ' +
      "get the complete original output.",
    inputSchema: z.object({
      id: z
        .string()
        .describe('The id from the truncation stub (the result\'s toolCallId).'),
    }),
    execute: async ({ id }) => {
      const body = await args.store.get(id)
      return body ?? `No stored output found for id "${id}".`
    },
  })
}

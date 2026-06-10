/**
 * Render any `ToolResultOutput` variant as plain text — the shape we
 * store, measure for truncation thresholds, and return from the
 * recovery tool.
 */

import type { ToolResultPart } from "ai"

export type ToolOutput = ToolResultPart["output"]

export function toolOutputText(output: ToolOutput): string {
  switch (output.type) {
    case "text":
    case "error-text":
      return output.value
    case "json":
    case "error-json":
      return JSON.stringify(output.value)
    case "execution-denied":
      return output.reason ?? "(execution denied)"
    case "content":
      return output.value
        .map((item) => (item.type === "text" ? item.text : `[${item.type}]`))
        .join("\n")
  }
}

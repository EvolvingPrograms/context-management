/**
 * System-prompt snippet documenting truncation to the model. Append once
 * to the (static) system prompt when truncation + the recovery tool are
 * enabled — it's constant, so the cached prefix stays stable.
 */

export const TRUNCATION_SYSTEM_PROMPT = `
# Truncated tool results
To conserve context, the bodies of older large tool results may be replaced
by a stub ending in: […truncated N chars — call fetch_full_result with id "…"].
The stub keeps a short head preview. If you need the complete output again,
call the fetch_full_result tool with that id. Recent tool results are never
truncated.`

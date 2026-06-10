/**
 * E2E: can a REAL agent recover a truncated tool result?
 *
 * A prior conversation fetched a document whose body contains a secret
 * code. The truncation thresholds are set so that result's body is
 * stubbed out of the outgoing prefix — the model only sees a head
 * preview + "[…truncated N chars — call fetch_full_result with id …]".
 * We then ask a question only answerable from the truncated body and
 * assert the model (a) calls `fetch_full_result` with the right id and
 * (b) answers with the secret.
 *
 * Run: `bun --env-file=.env.local test tests/recovery.test.ts`
 * Skips without AI_GATEWAY_API_KEY (real API; one short generation).
 */

import { describe, expect, test } from "bun:test"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { $ } from "bun"
import { generateText, stepCountIs, tool, type ModelMessage } from "ai"
import { z } from "zod"

import { createContextManagement, historyOutputStore } from "../src"

const HAS_KEY = !!process.env.AI_GATEWAY_API_KEY || !!process.env.VERCEL_OIDC_TOKEN

const MODEL = "anthropic/claude-sonnet-4.6"

const SECRET = "ZEBRA-7741"

/** ~6k chars of filler with the secret buried in the middle. */
const DOC_BODY = [
  ...Array.from({ length: 30 }, (_, i) => `Section ${i + 1}: routine operational filler text with no relevant content, repeated to make the document large enough to truncate.`),
  `Appendix C — build info: the release build identifier for this manual is ${SECRET}.`,
  ...Array.from({ length: 30 }, (_, i) => `Annex ${i + 1}: further padding paragraphs of no significance to the question being asked later.`),
].join("\n\n")

/** A prior turn that fetched doc-1 (big, will truncate) and doc-2 (newer). */
const PRIOR_HISTORY: ModelMessage[] = [
  { role: "user", content: "Fetch document doc-1 and then doc-2 from the archive." },
  {
    role: "assistant",
    content: [
      { type: "tool-call", toolCallId: "call-doc-1", toolName: "fetch_document", input: { id: "doc-1" } },
    ],
  },
  {
    role: "tool",
    content: [
      { type: "tool-result", toolCallId: "call-doc-1", toolName: "fetch_document", output: { type: "text", value: DOC_BODY } },
    ],
  },
  {
    role: "assistant",
    content: [
      { type: "tool-call", toolCallId: "call-doc-2", toolName: "fetch_document", input: { id: "doc-2" } },
    ],
  },
  {
    role: "tool",
    content: [
      { type: "tool-result", toolCallId: "call-doc-2", toolName: "fetch_document", output: { type: "text", value: "doc-2 is a one-line changelog. Nothing notable." } },
    ],
  },
  { role: "assistant", content: "Fetched both documents. doc-1 is a long operations manual; doc-2 a short changelog." },
]

/** The archive is "offline" now — recovery must go through fetch_full_result. */
const fetchDocument = tool({
  description: "Fetch a document from the archive by id.",
  inputSchema: z.object({ id: z.string() }),
  execute: async () => "ERROR: archive offline. Previously fetched results are available via fetch_full_result.",
})

describe.skipIf(!HAS_KEY)("truncated tool-result recovery (real agent)", () => {
  test(
    "agent calls fetch_full_result with the stub's id and answers from the recovered body",
    async () => {
      const question: ModelMessage = {
        role: "user",
        content:
          "What is the release build identifier in Appendix C of doc-1? Answer with just the identifier.",
      }
      const messages = [...PRIOR_HISTORY, question]

      const cm = createContextManagement({
        mode: "managed",
        model: MODEL,
        store: historyOutputStore(messages),
        // Aggressive thresholds so doc-1's body (not doc-2's, the newest)
        // is stubbed; edits off — this test isolates truncation+recovery.
        truncation: { keepLast: 1, maxChars: 500, preview: 120 },
        edits: false,
      })

      const result = await generateText({
        model: MODEL,
        system: "You are a terse assistant." + cm.systemSuffix,
        messages,
        tools: { fetch_document: fetchDocument, ...cm.tools },
        prepareStep: cm.prepareStep,
        providerOptions: cm.providerOptions(),
        stopWhen: stepCountIs(5),
      })

      // (a) It actually used the recovery tool, with the id from the stub.
      const recoveryCalls = result.steps
        .flatMap((s) => s.toolCalls)
        .filter((c) => c.toolName === "fetch_full_result")
      expect(recoveryCalls.length).toBeGreaterThan(0)
      expect(recoveryCalls.map((c) => c.input)).toContainEqual({ id: "call-doc-1" })

      // (b) The recovered body let it answer the question.
      expect(result.text).toContain(SECRET)
    },
    120_000,
  )

  test(
    "agent recovers a value buried in a long truncated bash stdout (grep/tail/fetch)",
    async () => {
      // Recreate the prior turn's working dir for real: the loop's output
      // file exists on disk, so grep/tail are legitimate recovery paths
      // alongside fetch_full_result.
      const dir = mkdtempSync(join(tmpdir(), "cm-recovery-"))
      const COMMAND = `seq 1 1000 | awk '{print "line "$1": "$1*7}' | tee out.txt`
      const stdout = await $`sh -c ${COMMAND}`.cwd(dir).text()
      expect(stdout).toContain("line 837: 5859")

      const bash = tool({
        description: "Run a bash command in the working directory.",
        inputSchema: z.object({ command: z.string() }),
        execute: async ({ command }) =>
          (await $`sh -c ${command}`.cwd(dir).nothrow().text()).slice(0, 50_000),
      })

      const priorTurn: ModelMessage[] = [
        { role: "user", content: "Generate lines 'line i: i*7' for i = 1..1000 into out.txt, showing the output." },
        {
          role: "assistant",
          content: [
            { type: "tool-call", toolCallId: "call-loop", toolName: "bash", input: { command: COMMAND } },
          ],
        },
        {
          role: "tool",
          content: [
            { type: "tool-result", toolCallId: "call-loop", toolName: "bash", output: { type: "text", value: stdout } },
          ],
        },
        // A newer small result so keepLast: 1 protects THIS, not the loop output.
        {
          role: "assistant",
          content: [
            { type: "tool-call", toolCallId: "call-check", toolName: "bash", input: { command: "wc -l < out.txt" } },
          ],
        },
        {
          role: "tool",
          content: [
            { type: "tool-result", toolCallId: "call-check", toolName: "bash", output: { type: "text", value: "1000" } },
          ],
        },
        { role: "assistant", content: "Done — wrote 1000 lines to out.txt." },
      ]

      const question: ModelMessage = {
        role: "user",
        content: "What value was printed on line 837 of that output? Answer with just the number.",
      }
      const messages = [...priorTurn, question]

      const cm = createContextManagement({
        mode: "managed",
        model: MODEL,
        modelMessages: messages,
        truncation: { keepLast: 1, maxChars: 2000, preview: 120 },
        edits: false,
      })

      const result = await generateText({
        model: MODEL,
        system: "You are a terse assistant with a bash tool." + cm.systemSuffix,
        messages,
        tools: { bash, ...cm.tools },
        prepareStep: cm.prepareStep,
        providerOptions: cm.providerOptions(),
        stopWhen: stepCountIs(5),
      })

      // It recovered rather than hallucinating: at least one tool call
      // (grep/tail/re-run via bash, or fetch_full_result) and the right value.
      const calls = result.steps.flatMap((s) => s.toolCalls)
      expect(calls.length).toBeGreaterThan(0)
      expect(result.text).toContain("5859")
    },
    120_000,
  )
})

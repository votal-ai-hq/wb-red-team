---
title: Vercel AI SDK
parent: Integrations
nav_order: 3
---

# Red-team a Vercel AI SDK / Next.js agent

Targets Next.js app router routes that use `streamText` or `generateText` from `ai`. Works with any provider (OpenAI, Anthropic, Google, etc.).

## 1. Expose a JSON sibling route

Streaming routes (`text/event-stream`) are awkward to scan. Either point the scanner at `generateText` (non-streaming) or expose a JSON-aggregating sibling route for testing:

```ts
// app/api/chat/scan/route.ts
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { tools } from "@/lib/tools";

export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = await generateText({
    model: openai("gpt-4o-mini"),
    messages,
    tools,
  });
  return Response.json({ text: result.text, toolCalls: result.toolCalls });
}
```

Gate this route behind an env var (`if (process.env.NODE_ENV === "production") return new Response("Not Found", { status: 404 });`) so it doesn't ship to prod.

## 2. Copy the config

```bash
cp configs/integrations/vercel-ai-sdk.json configs/config.my-nextjs-app.json
```

Edit:
- `target.baseUrl` — `http://localhost:3000` for `next dev`
- `target.agentEndpoint` — `/api/chat/scan` (your sibling route)
- `codebasePath` — `../my-nextjs-app/app` so the planner reads your route handlers and tool definitions

## 3. Run

```bash
npm start configs/config.my-nextjs-app.json
```

## What this catches

App-router agents tend to have these failure modes:

- **`prompt_injection` / `indirect_prompt_injection`** — bog standard, but `streamText` makes leakage easier
- **`tool_misuse` / `tool_chain_hijack`** — your `tools` object is the attack surface
- **`generated_code_rce`** — if any tool runs model-generated code or shell commands
- **`markdown_link_injection`** — when the UI renders model markdown, `[click](javascript:...)` lands
- **`structured_output_injection`** — abuse of `experimental_output` / Zod-typed responses
- **`data_exfiltration`** — pulling server-side env vars or DB rows through tool outputs

White-box mode reads your `tools.ts`, route handler, and any system prompts to tailor attacks.

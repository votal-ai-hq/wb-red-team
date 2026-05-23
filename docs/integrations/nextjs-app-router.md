---
title: Next.js App Router
parent: Integrations
nav_order: 7
---

# Red-team a Next.js app router agent

Use this if you're building agents in Next.js with the raw OpenAI / Anthropic SDK (or any custom tool-loop) inside a route handler. If you're using the Vercel AI SDK, see [vercel-ai-sdk.md](vercel-ai-sdk.md) instead.

## 1. The endpoint

A typical app-router agent route:

```ts
// app/api/agent/route.ts
import OpenAI from "openai";
import { tools, executeTool } from "@/lib/tools";

const openai = new OpenAI();

export async function POST(req: Request) {
  const { message } = await req.json();
  const messages = [{ role: "user", content: message }];

  for (let i = 0; i < 5; i++) {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      tools,
    });
    const msg = completion.choices[0].message;
    messages.push(msg);

    if (!msg.tool_calls) {
      return Response.json({ response: msg.content });
    }

    for (const call of msg.tool_calls) {
      const result = await executeTool(call);
      messages.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  }
  return Response.json({ response: "max turns reached" });
}
```

## 2. Copy the config

```bash
cp configs/integrations/nextjs-app-router.json configs/config.my-app.json
```

Edit `target.baseUrl`, `agentEndpoint`, and `codebasePath` (point at `app/` so the planner sees both your route handlers and your tool implementations).

## 3. Run

```bash
npm start configs/config.my-app.json
```

## What this catches

App-router agents share patterns and patterns share vulnerabilities:

- **`prompt_injection` / `indirect_prompt_injection`** — baseline
- **`tool_misuse` / `tool_chain_hijack`** — your `tools` object
- **`ssrf`** — tools that fetch URLs
- **`path_traversal`** — tools that touch the filesystem
- **`markdown_link_injection`** — when the UI renders model markdown
- **`structured_output_injection`** — abuse of JSON-mode / Zod-typed outputs
- **`auth_bypass` / `rbac_bypass`** — when the route handler reads session/JWT and passes role to tools

White-box mode reads your route handler, middleware, and tools to find auth-aware bugs (the "hardcoded JWT secret in `lib/auth.ts`" class of finding).

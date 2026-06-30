---
title: Integrations
nav_order: 5
has_children: true
---

# Integrations

Red-Team AI is HTTP-target-agnostic — anything you can expose behind a POST endpoint can be scanned. These pages give you a 60-second copy-paste path for the most common agent frameworks.

| Framework | Page | Config |
|---|---|---|
| LangChain / LangServe | [langchain.md](langchain.md) | [`configs/integrations/langchain.json`](../../configs/integrations/langchain.json) |
| LlamaIndex | [llamaindex.md](llamaindex.md) | [`configs/integrations/llamaindex.json`](../../configs/integrations/llamaindex.json) |
| Vercel AI SDK (Next.js) | [vercel-ai-sdk.md](vercel-ai-sdk.md) | [`configs/integrations/vercel-ai-sdk.json`](../../configs/integrations/vercel-ai-sdk.json) |
| OpenAI Agents SDK | [openai-agents-sdk.md](openai-agents-sdk.md) | [`configs/integrations/openai-agents-sdk.json`](../../configs/integrations/openai-agents-sdk.json) |
| CrewAI | [crewai.md](crewai.md) | [`configs/integrations/crewai.json`](../../configs/integrations/crewai.json) |
| MCP servers | [mcp-server.md](mcp-server.md) | [`configs/integrations/mcp-server.json`](../../configs/integrations/mcp-server.json) |
| Next.js app router (generic) | [nextjs-app-router.md](nextjs-app-router.md) | [`configs/integrations/nextjs-app-router.json`](../../configs/integrations/nextjs-app-router.json) |
| RAG apps (framework-agnostic) | [rag-app.md](rag-app.md) | [`configs/integrations/rag-app.json`](../../configs/integrations/rag-app.json) |
| Slack / Discord / email agents | [slack-discord-email.md](slack-discord-email.md) | [`configs/integrations/slack-discord-email.json`](../../configs/integrations/slack-discord-email.json) |

## How it works

Every integration boils down to three knobs in your config:

- **`target.baseUrl` + `target.agentEndpoint`** — where to POST.
- **`requestSchema.messageField` / `customApiTemplate.bodyTemplate`** — how to put the attack prompt into your request body.
- **`responseSchema.responsePath` / `customApiTemplate.responsePath`** — where to read the agent's reply from the response JSON.

Set those three and the scanner will treat any framework as a black box. Add `codebasePath` pointing at your app and it becomes white-box — the planner reads your tools, guardrails, and auth code and generates attacks specific to *your* stack.

## Don't see your framework?

Open an issue or PR — most frameworks need ~20 lines of config. The pattern is in any of the four pages above.

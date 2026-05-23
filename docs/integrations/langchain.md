---
title: LangChain
parent: Integrations
nav_order: 1
---

# Red-team a LangChain agent

Works with LangChain JS and Python. Easiest path is to expose your runnable via [LangServe](https://github.com/langchain-ai/langserve), which gives you a canonical `/invoke` route.

## 1. Expose an endpoint

```python
# server.py
from fastapi import FastAPI
from langserve import add_routes
from my_app import agent  # your AgentExecutor or RunnableSequence

app = FastAPI()
add_routes(app, agent, path="/agent")
# Now POST http://localhost:8000/agent/invoke
# { "input": { "input": "hello" } }  →  { "output": "..." }
```

If you're not using LangServe, any POST endpoint that takes `{"input": "..."}` and returns `{"output": "..."}` works.

## 2. Copy the config

```bash
cp configs/integrations/langchain.json configs/config.my-langchain-app.json
```

Edit the file:
- `target.baseUrl` — your server origin
- `target.agentEndpoint` — `/agent/invoke` if using LangServe, else your route
- `target.applicationDetails` — one paragraph about what your agent does
- `codebasePath` — point at your LangChain app's source for white-box scanning

## 3. Run

```bash
npm start configs/config.my-langchain-app.json
```

## What this catches

The bundled config enables the categories most relevant to LangChain agents:

- **`prompt_injection` / `indirect_prompt_injection`** — direct and tool-output-borne injection
- **`tool_misuse` / `tool_chain_hijack`** — your tools being chained to exfiltrate or escalate
- **`rag_poisoning`** — if your agent retrieves over documents
- **`data_exfiltration`** — secrets/PII leakage through any tool path

Set `codebasePath` and the planner will read your `Tool` definitions, system prompts, and any guardrails to generate attacks specific to your wiring.

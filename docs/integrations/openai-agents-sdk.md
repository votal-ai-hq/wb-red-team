---
title: OpenAI Agents SDK
parent: Integrations
nav_order: 4
---

# Red-team an OpenAI Agents SDK app

The [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) introduced first-class multi-agent handoffs, which means the attack surface is bigger than a single tool-calling loop — chained agents amplify both blast radius and exfil paths.

## 1. Expose an endpoint

```python
# server.py
from fastapi import FastAPI
from pydantic import BaseModel
from agents import Runner
from my_app import root_agent  # your Agent with tools / handoffs

app = FastAPI()

class Req(BaseModel):
    input: str

@app.post("/agent")
async def agent(req: Req):
    result = await Runner.run(root_agent, req.input)
    return {
        "final_output": result.final_output,
        "tool_calls": [str(item) for item in result.new_items],
    }
```

## 2. Copy the config

```bash
cp configs/integrations/openai-agents-sdk.json configs/config.my-agents-app.json
```

Edit:
- `target.baseUrl` + `agentEndpoint`
- `target.applicationDetails` — list your sub-agents and their roles
- `codebasePath` — the directory containing your `Agent` definitions and `handoffs`

## 3. Run

```bash
npm start configs/config.my-agents-app.json
```

## What this catches

Multi-agent setups are uniquely vulnerable to cross-agent attacks:

- **`tool_chain_hijack`** — your `read_file` agent feeds your `send_email` agent
- **`agentic_workflow_bypass`** — instructions that skip a required handoff or guardrail-bearing sub-agent
- **`multi_agent_delegation`** — manipulating which agent gets the next turn
- **`tool_permission_escalation`** — getting a low-trust agent to invoke a high-trust agent's tools
- **`goal_hijack`** — replacing the orchestrator's goal mid-conversation
- **`prompt_injection` / `indirect_prompt_injection`** — standard baseline
- **`data_exfiltration`** — surfacing data from a tool inside one agent through another agent's output

White-box mode reads your handoff graph and per-agent tool lists, then generates attacks that exploit the *specific* connectivity in your app — the kind of thing black-box scanners can't see.

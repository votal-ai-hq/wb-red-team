---
title: CrewAI
parent: Integrations
nav_order: 5
---

# Red-team a CrewAI crew

CrewAI's value proposition — role-based agents that delegate tasks to each other — is also its biggest attack surface. A prompt that hijacks the first agent can cascade through the crew. White-box scanning is especially useful here because the planner can read your `Agent` definitions, `Task` graph, and tool wiring.

## 1. Expose an endpoint

```python
# server.py
from fastapi import FastAPI
from pydantic import BaseModel
from my_crew import build_crew  # returns a configured Crew

app = FastAPI()
crew = build_crew()

class Req(BaseModel):
    topic: str

@app.post("/kickoff")
def kickoff(req: Req):
    result = crew.kickoff(inputs={"topic": req.topic})
    return {"result": str(result), "tasks_output": [str(t) for t in result.tasks_output]}
```

## 2. Copy the config

```bash
cp configs/integrations/crewai.json configs/config.my-crew.json
```

Edit:
- `target.baseUrl` + `agentEndpoint`
- `target.applicationDetails` — list each agent's role, goal, and tools
- `codebasePath` — directory containing your `Crew`, `Agent`, and `Task` definitions

## 3. Run

```bash
npm start configs/config.my-crew.json
```

## What this catches

- **`tool_chain_hijack`** — `researcher → writer → publisher` chains that exfiltrate or escalate
- **`multi_agent_delegation`** — steering which crewmember gets the next task
- **`agentic_workflow_bypass`** — skipping a reviewer/QA agent
- **`rogue_agent`** — getting one agent to act against the crew's goal
- **`tool_permission_escalation`** — a low-trust agent invoking a high-trust agent's tools
- **`goal_hijack`** / **`agentic_scope_creep`** — replacing or expanding the crew's goal mid-run

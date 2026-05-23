---
title: LlamaIndex
parent: Integrations
nav_order: 2
---

# Red-team a LlamaIndex RAG app

LlamaIndex apps are almost always RAG-shaped, which means the attack surface is dominated by **retrieval poisoning** and **chunk-boundary tricks** — not just prompt injection.

## 1. Expose an endpoint

```python
# server.py
from fastapi import FastAPI
from pydantic import BaseModel
from my_app import chat_engine  # your LlamaIndex ChatEngine or QueryEngine

app = FastAPI()

class Req(BaseModel):
    message: str

@app.post("/api/chat")
def chat(req: Req):
    resp = chat_engine.chat(req.message)
    return {"response": str(resp), "sources": [n.node.get_content() for n in resp.source_nodes]}
```

## 2. Copy the config

```bash
cp configs/integrations/llamaindex.json configs/config.my-llamaindex-app.json
```

Edit:
- `target.baseUrl` + `agentEndpoint`
- `target.applicationDetails` — what's in your index (private data? customer docs?)
- `codebasePath` — point at the directory with your index construction, retrievers, and node parsers

## 3. Run

```bash
npm start configs/config.my-llamaindex-app.json
```

## What this catches

The default config is RAG-heavy:

- **`rag_poisoning`** — adversarial content in your corpus that steers answers
- **`rag_corpus_poisoning`** — durable injection planted in documents that get retrieved
- **`rag_attribution`** — making the model cite a source that doesn't support its claim
- **`vector_store_manipulation`** — abuse of similarity matching to surface attacker-controlled chunks
- **`chunk_boundary_injection`** — payloads that exploit how your `node_parser` splits text
- **`retrieval_ranking_attack`** — keyword stuffing / embedding-space attacks against your retriever
- **`retrieval_tenant_bleed`** — crossing per-user / per-tenant isolation in shared indices
- **`data_exfiltration`** — pulling indexed PII or secrets back through the chat surface

White-box scanning is especially valuable here: the planner reads your `node_parser` config, embedding model, and retrievers to generate attacks tuned to *your* chunking strategy.

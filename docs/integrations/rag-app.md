---
title: RAG Apps
parent: Integrations
nav_order: 8
---

# Red-team a RAG app

Framework-agnostic RAG guide. If you're on LlamaIndex specifically, see [llamaindex.md](llamaindex.md) — but the attack categories overlap heavily.

## 1. Expose an endpoint

```python
# Any framework — LangChain, LlamaIndex, Haystack, raw — works.
from fastapi import FastAPI
from pydantic import BaseModel
from my_rag import retrieve_and_answer  # your retriever + generator

app = FastAPI()

class Req(BaseModel):
    query: str

@app.post("/query")
def query(req: Req):
    answer, sources = retrieve_and_answer(req.query)
    return {"answer": answer, "sources": sources}
```

## 2. Copy the config

```bash
cp configs/integrations/rag-app.json configs/config.my-rag.json
```

Edit:
- `target.baseUrl` + `agentEndpoint`
- `target.applicationDetails` — what's in the index, who can query it, whether the corpus is user-provided
- `codebasePath` — directory with your retriever, chunker, and embedding code

## 3. Run

```bash
npm start configs/config.my-rag.json
```

## What this catches

RAG-specific failure modes the bundled config targets:

- **`rag_poisoning`** / **`rag_corpus_poisoning`** — adversarial content in your corpus
- **`rag_attribution`** — answer cites a source that doesn't support the claim
- **`vector_store_manipulation`** — similarity-space attacks to surface attacker chunks
- **`chunk_boundary_injection`** — payloads exploiting your `node_parser` / chunker
- **`retrieval_ranking_attack`** — keyword stuffing, embedding-near-duplicates
- **`retrieval_tenant_bleed`** — cross-tenant leakage in shared indices
- **`embedding_inversion`** — reconstructing source text from embeddings (if exposed)
- **`indirect_prompt_injection`** — instructions hidden in retrieved documents
- **`data_exfiltration`** / **`pii_disclosure`** — pulling indexed PII back through chat
- **`hallucination`** — measuring grounded-vs-fabricated answers

White-box mode reads your chunker config and retriever to tune attacks to your specific pipeline (chunk size, overlap, top-k, reranker).

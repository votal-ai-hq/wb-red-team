# Curl reproduction

Raw `curl` requests for every attack — no Python needed. Hits OpenRouter directly.

## 0. Load your key (once per shell)

```bash
export OPENROUTER_API_KEY=$(grep -E '^\s*OPENROUTER_API_KEY=' \
  /Users/sai/Developer/wb-red-team/.env | head -1 | cut -d= -f2-)
```

## Model ids

| key | OpenRouter model id |
|-----|---------------------|
| Qwen | `qwen/qwen-2.5-72b-instruct` |
| ChatGPT | `openai/gpt-4o-mini` |
| DeepSeek | `deepseek/deepseek-chat` |
| GLM | `z-ai/glm-4.6` |

## Single-turn attacks (16 of them — `<id>.json`)

Pick a model, sed it into the body, pipe to curl, jq out the answer:

```bash
M=deepseek/deepseek-chat          # swap for any id above
sed "s|__MODEL__|$M|" adv-policy-puppetry.json | \
curl -s https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" -d @- \
  | jq -r '.choices[0].message.content'
```

Single-turn ids: `pi-override-exfil` `jb-dan-persona` `enc-base64-bypass`
`soc-phish-pretext` `misinfo-fake-news` `cyber-dualuse-tool` `jb-fiction-villain`
`harm-academic-framing` `harm-hypothetical-illicit` `adv-many-shot`
`adv-policy-puppetry` `adv-cipher-rot13` `adv-payload-splitting`
`adv-deepinception` `adv-refusal-suppression` `adv-adversarial-suffix`

## Multi-turn attacks (`<id>.sh` — needs `jq`)

Crescendo (4 turns) and Skeleton Key (2 turns) depend on each reply, so they're
chainer scripts. Pass the model as the first arg:

```bash
bash adv-crescendo.sh    deepseek/deepseek-chat
bash adv-skeleton-key.sh z-ai/glm-4.6
```

## Notes

- Bodies use `temperature: 0.7` (matches the report). For a **deterministic**
  demo, edit the body or add `sed 's|"temperature": 0.7|"temperature": 0|'`.
- See the full raw JSON (usage, finish_reason) by dropping the `| jq -r ...`.
- Results vary run-to-run at temp 0.7 — the *patterns* are stable, individual
  cells can flip (esp. GLM, the most borderline).

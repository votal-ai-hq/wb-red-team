---
title: Slack / Discord / Email Agents
parent: Integrations
nav_order: 9
---

# Red-team a Slack, Discord, or email agent

Chat-platform bots and email agents share a threat model: an attacker reaches the agent through user-generated content, often from outside your trust boundary.

> **Don't point this at your production Slack/Discord/email webhook.** Slack and Discord rate-limit and ban abusive senders; email gateways flag bulk patterns. Expose a **test-mode HTTP endpoint** inside your bot service that invokes the same handler with a synthetic payload.

## 1. Expose a test endpoint

```ts
// inside your bot service
app.post("/test/message", async (req, res) => {
  if (process.env.NODE_ENV === "production") return res.status(404).end();
  const { user, channel, text } = req.body;
  // call the SAME handler your Slack/Discord/email adapter calls
  const reply = await handleIncomingMessage({ user, channel, text });
  res.json({ reply });
});
```

The point is to scan the **handler**, not the platform delivery.

## 2. Copy the config

```bash
cp configs/integrations/slack-discord-email.json configs/config.my-bot.json
```

Edit:
- `target.baseUrl` + `agentEndpoint` — your test endpoint
- `target.applicationDetails` — what the bot does, what tools it has, which channels/users it serves
- `codebasePath` — directory with your handler and adapter code

## 3. Run

```bash
npm start configs/config.my-bot.json
```

## What this catches

Chat-platform bots are uniquely exposed to social and cross-channel attacks:

- **`prompt_injection` / `indirect_prompt_injection`** — baseline + injection via forwarded messages / threads / email replies
- **`social_engineering`** — impersonation, urgency framing inside a DM
- **`brand_impersonation`** — payloads that pretend to be from IT, security, finance
- **`tool_misuse` / `tool_chain_hijack`** — bots typically have channel-write, file-read, calendar tools — high-leverage chains
- **`cross_session_injection`** — payload in one channel/DM affecting another user's session
- **`data_exfiltration`** / **`pii_disclosure`** — pulling data out via DM, email reply, or file upload
- **`markdown_link_injection`** — Slack/Discord/email all render markdown or HTML to varying degrees
- **`psychological_manipulation`** — long-horizon DMs that exploit the trust users place in "internal" bots

White-box mode reads your handler to find platform-specific bypasses (e.g., a Slack mention check that ignores edited messages).

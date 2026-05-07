#!/usr/bin/env npx tsx
/**
 * Mock insurance conversation server for testing setupSteps + preAuthCommand.
 * Simulates the full customer flow:
 *   1. GET  /auth/token          → returns a mock ESSO token
 *   2. POST /start/conversation  → creates a conversation, returns conversationId
 *   3. POST /process/conversation → processes a message, returns agent response
 *
 * Usage: npx tsx scripts/mock-conversation-server.ts [port]
 *
 * Also run the mock token script:
 *   python3 scripts/get_esso_token.py 9245099016
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";

const PORT = parseInt(process.argv[2] || "8000", 10);

// Track active conversations
const conversations = new Map<string, { policyNumber: string; createdAt: string }>();

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
  });
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = req.url || "";

  // Health check
  if (url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "healthy", conversations: conversations.size }));
    return;
  }

  // Step 1: Mock token endpoint (alternative to Python script)
  if (url === "/auth/token" && req.method === "POST") {
    const mockToken = `*MOCK_ESSO*${randomUUID().replace(/-/g, "")}`;
    console.log(`  [auth] Token generated: ${mockToken.substring(0, 30)}...`);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ token: mockToken, expiresIn: 3600 }));
    return;
  }

  // Step 2: Start conversation
  if (url === "/start/conversation" && req.method === "POST") {
    const body = await readBody(req);
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(body); } catch {}

    // Validate service key header
    const serviceKey = req.headers["x-service-key"];
    const ssoToken = req.headers["e-sso-token"];
    if (!serviceKey) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing X-Service-Key header" }));
      return;
    }
    if (!ssoToken) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing e-sso-token header" }));
      return;
    }

    const conversationId = (parsed.conversationId as string) || randomUUID();
    const policyNumber = (parsed.policyNumber as string) || "UNKNOWN";

    conversations.set(conversationId, {
      policyNumber,
      createdAt: new Date().toISOString(),
    });

    console.log(`  [session] Created conversation: ${conversationId} (policy: ${policyNumber})`);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      conversationId,
      status: "success",
    }));
    return;
  }

  // Step 3: Process conversation
  if (url === "/process/conversation" && req.method === "POST") {
    const body = await readBody(req);
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(body); } catch {}

    const conversationId = parsed.conversationId as string;
    const requestId = parsed.requestId as string || randomUUID();

    // Extract user message
    let userMessage = "hello";
    try {
      const msg = parsed.message as Record<string, unknown>;
      const parts = msg?.parts as Array<Record<string, unknown>>;
      if (parts?.[0]?.textMarkdown) {
        userMessage = parts[0].textMarkdown as string;
      }
    } catch {}

    // Check conversation exists
    const conv = conversationId ? conversations.get(conversationId) : null;
    if (!conv) {
      console.log(`  [process] Unknown conversation: ${conversationId}`);
    }

    const policyNumber = conv?.policyNumber || "UNKNOWN";

    // Simulate agent response
    const agentResponse = `Thank you for your inquiry about "${userMessage.slice(0, 80)}". ` +
      `Your ${policyNumber} Auto policy is currently active. ` +
      `Your current balance due is $247.50, with the next payment due on June 15, 2026. ` +
      `Is there anything else I can help you with?`;

    console.log(`  [process] conv=${conversationId?.substring(0, 8)}... msg="${userMessage.substring(0, 50)}..."`);

    const response = {
      status: "success",
      conversationId,
      applicationId: randomUUID(),
      calling_app_id: parsed.calling_app_id || "customer_assistant_v2.0",
      requestId,
      schemaVersion: "1.0.0",
      inputType: "query",
      quickLink: "",
      userMessageId: (parsed.message as any)?.messageId || randomUUID(),
      messages: [
        {
          messageId: `msg-asst-${randomUUID().substring(0, 12)}`,
          direction: "outbound",
          role: "agent",
          producer: "horizontal-supervisor",
          locale: "en-US",
          parts: [
            {
              partKind: "text",
              textMarkdown: agentResponse,
            },
          ],
        },
      ],
    };

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(response));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`\n  Mock Insurance Conversation Server → http://localhost:${PORT}`);
  console.log(`  Endpoints:`);
  console.log(`    POST /auth/token            → mock ESSO token`);
  console.log(`    POST /start/conversation    → create session (requires X-Service-Key + e-sso-token)`);
  console.log(`    POST /process/conversation  → send message (returns agent response)`);
  console.log(`    GET  /health                → health check`);
  console.log(`  Press Ctrl+C to stop\n`);
});

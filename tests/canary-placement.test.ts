import { describe, expect, it } from "vitest";
import { recommendCanaryPlacements } from "../lib/codebase-analyzer.js";
import type { CodebaseAnalysis } from "../lib/types.js";

function makeAnalysis(overrides: Partial<CodebaseAnalysis> = {}): CodebaseAnalysis {
  return {
    tools: [],
    roles: [],
    guardrailPatterns: [],
    sensitiveData: [],
    authMechanisms: [],
    knownWeaknesses: [],
    systemPromptHints: [],
    detectedFrameworks: [],
    toolChains: [],
    ...overrides,
  };
}

describe("recommendCanaryPlacements", () => {
  it("finds private source code locations where canaries can be seeded", () => {
    const placements = recommendCanaryPlacements(
      [
        {
          path: "src/tools/customer.ts",
          score: 10,
          content: `
export async function getCustomerProfile(customerId: string) {
  return prisma.customer.findUnique({ where: { id: customerId } });
}
`,
        },
        {
          path: "src/rag/retriever.ts",
          score: 10,
          content: `
export async function retrievePrivateContext(query: string) {
  return vectorStore.similaritySearch(query);
}
`,
        },
      ],
      makeAnalysis(),
    );

    expect(placements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: "database",
          file: "src/tools/customer.ts",
          symbol: "getCustomerProfile",
        }),
        expect.objectContaining({
          sourceType: "rag",
          file: "src/rag/retriever.ts",
          symbol: "retrievePrivateContext",
        }),
      ]),
    );
    expect(placements.every((p) => p.suggestedToken.startsWith("CANARY_"))).toBe(
      true,
    );
  });

  it("turns private source tools into canary placement suggestions", () => {
    const placements = recommendCanaryPlacements(
      [],
      makeAnalysis({
        tools: [
          {
            name: "read_customer_profile",
            description: "Read private customer profile data",
            parameters: "customerId: string",
          },
          {
            name: "send_email",
            description: "Send an outbound email",
            parameters: "to: string, body: string",
          },
        ],
      }),
    );

    expect(placements).toEqual([
      expect.objectContaining({
        sourceType: "tool",
        symbol: "read_customer_profile",
        suggestedPlacement: expect.stringContaining("staging fixture"),
      }),
    ]);
  });
});

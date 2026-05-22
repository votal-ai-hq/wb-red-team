import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "../lib/types.js";

const { createMock, MockBadRequestError, openAIConstructorMock } = vi.hoisted(
  () => {
    const createMock = vi.fn();
    const openAIConstructorMock = vi.fn();

    class MockBadRequestError extends Error {
      param?: string;

      constructor(message: string, param?: string) {
        super(message);
        this.param = param;
      }
    }

    return { createMock, MockBadRequestError, openAIConstructorMock };
  },
);

vi.mock("openai", () => ({
  default: class MockOpenAI {
    static BadRequestError = MockBadRequestError;

    chat = {
      completions: {
        create: createMock,
      },
    };

    constructor(opts?: { baseURL?: string; apiKey?: string }) {
      openAIConstructorMock(opts);
    }
  },
}));

import { getJudgeProvider, getLlmProvider } from "../lib/llm-provider.js";

function makeConfig(): Config {
  return {
    target: {
      baseUrl: "http://localhost:3000",
      agentEndpoint: "/api/agent",
      authEndpoint: "/api/login",
    },
    codebasePath: ".",
    codebaseGlob: "**/*.ts",
    auth: {
      methods: ["none"],
      jwtSecret: "secret",
      credentials: [],
      apiKeys: {},
    },
    requestSchema: {
      messageField: "message",
      roleField: "role",
      apiKeyField: "api_key",
      guardrailModeField: "guardrail_mode",
    },
    responseSchema: {
      responsePath: "response",
      toolCallsPath: "tool_calls",
      userInfoPath: "user",
      guardrailsPath: "guardrails",
    },
    sensitivePatterns: [],
    attackConfig: {
      adaptiveRounds: 1,
      maxAttacksPerCategory: 1,
      concurrency: 1,
      delayBetweenRequestsMs: 0,
      llmProvider: "openai",
      llmModel: "qwen3.5-27b",
      enableLlmGeneration: true,
      maxMultiTurnSteps: 1,
    },
  };
}

describe("llm provider guardrails", () => {
  beforeEach(() => {
    createMock.mockReset();
    createMock.mockResolvedValue({
      choices: [{ message: { content: "ok" } }],
    });
  });

  it("adds llmGuardrails to generation requests when configured", async () => {
    const config = makeConfig();
    config.attackConfig.llmGuardrails = [
      "votal-input-guard",
      "votal-output-guard",
    ];

    await getLlmProvider(config).chat({
      model: "qwen3.5-27b",
      messages: [{ role: "user", content: "user message" }],
    });

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0]?.[0]).toMatchObject({
      model: "qwen3.5-27b",
      messages: [{ role: "user", content: "user message" }],
      guardrails: ["votal-input-guard", "votal-output-guard"],
    });
  });

  it("adds judgeGuardrails to judge requests when configured", async () => {
    const config = makeConfig();
    config.attackConfig.judgeProvider = "openai";
    config.attackConfig.judgeModel = "qwen3.5-27b";
    config.attackConfig.judgeGuardrails = ["votal-output-guard"];

    await getJudgeProvider(config).chat({
      model: "qwen3.5-27b",
      messages: [{ role: "user", content: "judge this" }],
    });

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0]?.[0]).toMatchObject({
      model: "qwen3.5-27b",
      messages: [{ role: "user", content: "judge this" }],
      guardrails: ["votal-output-guard"],
    });
  });
});

describe("nim provider", () => {
  const originalApiKey = process.env.NVIDIA_API_KEY;
  const originalBaseUrl = process.env.NIM_BASE_URL;

  beforeEach(() => {
    createMock.mockReset();
    createMock.mockResolvedValue({
      choices: [{ message: { content: "ok" } }],
    });
    openAIConstructorMock.mockReset();
    delete process.env.NVIDIA_API_KEY;
    delete process.env.NIM_BASE_URL;
    // Provider factory caches per-name/guardrails; clear ESM cache so each
    // test gets a fresh NimProvider that re-reads env vars.
    vi.resetModules();
  });

  afterEach(() => {
    if (originalApiKey !== undefined) process.env.NVIDIA_API_KEY = originalApiKey;
    else delete process.env.NVIDIA_API_KEY;
    if (originalBaseUrl !== undefined) process.env.NIM_BASE_URL = originalBaseUrl;
    else delete process.env.NIM_BASE_URL;
  });

  it("defaults to the NVIDIA-hosted base URL and passes arbitrary model names through", async () => {
    process.env.NVIDIA_API_KEY = "nvapi-test";
    const { getLlmProvider } = await import("../lib/llm-provider.js");

    const config = makeConfig();
    config.attackConfig.llmProvider = "nim";
    config.attackConfig.llmModel = "nvidia/nemotron-content-safety-reasoning-4b";

    await getLlmProvider(config).chat({
      model: config.attackConfig.llmModel,
      messages: [{ role: "user", content: "hi" }],
    });

    expect(openAIConstructorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "https://integrate.api.nvidia.com/v1",
        apiKey: "nvapi-test",
      }),
    );
    expect(createMock.mock.calls[0]?.[0]).toMatchObject({
      model: "nvidia/nemotron-content-safety-reasoning-4b",
    });
  });

  it("honors NIM_BASE_URL override for self-hosted endpoints", async () => {
    process.env.NVIDIA_API_KEY = "nvapi-test";
    process.env.NIM_BASE_URL = "http://localhost:8000/v1";
    const { getLlmProvider } = await import("../lib/llm-provider.js");

    const config = makeConfig();
    config.attackConfig.llmProvider = "nim";
    config.attackConfig.llmModel = "any/model-name";

    await getLlmProvider(config).chat({
      model: config.attackConfig.llmModel,
      messages: [{ role: "user", content: "hi" }],
    });

    expect(openAIConstructorMock).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: "http://localhost:8000/v1" }),
    );
  });

  it("allows self-hosted NIM without NVIDIA_API_KEY when NIM_BASE_URL is set", async () => {
    process.env.NIM_BASE_URL = "http://localhost:8000/v1";
    const { getLlmProvider } = await import("../lib/llm-provider.js");

    const config = makeConfig();
    config.attackConfig.llmProvider = "nim";
    config.attackConfig.llmModel = "any/model-name";

    expect(() => getLlmProvider(config)).not.toThrow();
  });

  it("throws a clear error when NVIDIA_API_KEY is missing and no base URL is set", async () => {
    const { getLlmProvider } = await import("../lib/llm-provider.js");

    const config = makeConfig();
    config.attackConfig.llmProvider = "nim";
    config.attackConfig.llmModel = "meta/llama-3.3-70b-instruct";

    expect(() => getLlmProvider(config)).toThrow(/NVIDIA_API_KEY/);
  });

  it("rewrites NIM's 404 page-not-found into a clear 'model not found' error", async () => {
    process.env.NVIDIA_API_KEY = "nvapi-test";
    const { getLlmProvider } = await import("../lib/llm-provider.js");

    const nimError = Object.assign(new Error("404 page not found"), {
      status: 404,
    });
    createMock.mockReset();
    createMock.mockRejectedValueOnce(nimError);

    const config = makeConfig();
    config.attackConfig.llmProvider = "nim";
    config.attackConfig.llmModel = "abcs";

    await expect(
      getLlmProvider(config).chat({
        model: "abcs",
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toThrow(/NIM model "abcs" not found/);
  });

  it("passes non-404 errors through unchanged", async () => {
    process.env.NVIDIA_API_KEY = "nvapi-test";
    const { getLlmProvider } = await import("../lib/llm-provider.js");

    const rateLimitError = Object.assign(new Error("rate limit exceeded"), {
      status: 429,
    });
    createMock.mockReset();
    createMock.mockRejectedValueOnce(rateLimitError);

    const config = makeConfig();
    config.attackConfig.llmProvider = "nim";
    config.attackConfig.llmModel = "meta/llama-3.3-70b-instruct";

    await expect(
      getLlmProvider(config).chat({
        model: "meta/llama-3.3-70b-instruct",
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toThrow(/rate limit exceeded/);
  });
});

describe("huggingface provider", () => {
  const originalHfToken = process.env.HF_TOKEN;
  const originalHfApiKey = process.env.HUGGINGFACE_API_KEY;
  const originalHfBaseUrl = process.env.HF_BASE_URL;

  beforeEach(() => {
    createMock.mockReset();
    createMock.mockResolvedValue({
      choices: [{ message: { content: "ok" } }],
    });
    openAIConstructorMock.mockReset();
    delete process.env.HF_TOKEN;
    delete process.env.HUGGINGFACE_API_KEY;
    delete process.env.HF_BASE_URL;
    // Provider factory caches per-name/guardrails; clear ESM cache so each
    // test gets a fresh HuggingFaceProvider that re-reads env vars.
    vi.resetModules();
  });

  afterEach(() => {
    if (originalHfToken !== undefined) process.env.HF_TOKEN = originalHfToken;
    else delete process.env.HF_TOKEN;
    if (originalHfApiKey !== undefined)
      process.env.HUGGINGFACE_API_KEY = originalHfApiKey;
    else delete process.env.HUGGINGFACE_API_KEY;
    if (originalHfBaseUrl !== undefined)
      process.env.HF_BASE_URL = originalHfBaseUrl;
    else delete process.env.HF_BASE_URL;
  });

  it("defaults to the HuggingFace router base URL and passes model names through", async () => {
    process.env.HF_TOKEN = "hf-test";
    const { getLlmProvider } = await import("../lib/llm-provider.js");

    const config = makeConfig();
    config.attackConfig.llmProvider = "huggingface";
    config.attackConfig.llmModel = "meta-llama/Llama-3.3-70B-Instruct:nvidia";

    await getLlmProvider(config).chat({
      model: config.attackConfig.llmModel,
      messages: [{ role: "user", content: "hi" }],
    });

    expect(openAIConstructorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "https://router.huggingface.co/v1",
        apiKey: "hf-test",
      }),
    );
    expect(createMock.mock.calls[0]?.[0]).toMatchObject({
      model: "meta-llama/Llama-3.3-70B-Instruct:nvidia",
    });
  });

  it("accepts HUGGINGFACE_API_KEY as a fallback for HF_TOKEN", async () => {
    process.env.HUGGINGFACE_API_KEY = "hf-fallback";
    const { getLlmProvider } = await import("../lib/llm-provider.js");

    const config = makeConfig();
    config.attackConfig.llmProvider = "huggingface";
    config.attackConfig.llmModel = "any/model";

    await getLlmProvider(config).chat({
      model: config.attackConfig.llmModel,
      messages: [{ role: "user", content: "hi" }],
    });

    expect(openAIConstructorMock).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "hf-fallback" }),
    );
  });

  it("prefers HF_TOKEN over HUGGINGFACE_API_KEY when both are set", async () => {
    process.env.HF_TOKEN = "primary";
    process.env.HUGGINGFACE_API_KEY = "fallback";
    const { getLlmProvider } = await import("../lib/llm-provider.js");

    const config = makeConfig();
    config.attackConfig.llmProvider = "huggingface";
    config.attackConfig.llmModel = "any/model";

    await getLlmProvider(config).chat({
      model: config.attackConfig.llmModel,
      messages: [{ role: "user", content: "hi" }],
    });

    expect(openAIConstructorMock).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "primary" }),
    );
  });

  it("honors HF_BASE_URL override for dedicated Inference Endpoints", async () => {
    process.env.HF_TOKEN = "hf-test";
    process.env.HF_BASE_URL =
      "https://abc123.us-east-1.aws.endpoints.huggingface.cloud/v1";
    const { getLlmProvider } = await import("../lib/llm-provider.js");

    const config = makeConfig();
    config.attackConfig.llmProvider = "huggingface";
    config.attackConfig.llmModel = "tgi";

    await getLlmProvider(config).chat({
      model: config.attackConfig.llmModel,
      messages: [{ role: "user", content: "hi" }],
    });

    expect(openAIConstructorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL:
          "https://abc123.us-east-1.aws.endpoints.huggingface.cloud/v1",
      }),
    );
  });

  it("allows HF_BASE_URL without a token (unauthenticated dedicated endpoint)", async () => {
    process.env.HF_BASE_URL = "http://localhost:8080/v1";
    const { getLlmProvider } = await import("../lib/llm-provider.js");

    const config = makeConfig();
    config.attackConfig.llmProvider = "huggingface";
    config.attackConfig.llmModel = "any/model";

    expect(() => getLlmProvider(config)).not.toThrow();
  });

  it("throws a clear error when no token and no HF_BASE_URL are set", async () => {
    const { getLlmProvider } = await import("../lib/llm-provider.js");

    const config = makeConfig();
    config.attackConfig.llmProvider = "huggingface";
    config.attackConfig.llmModel = "meta-llama/Llama-3.3-70B-Instruct:nvidia";

    expect(() => getLlmProvider(config)).toThrow(/HF_TOKEN/);
  });

  it("routes judge calls through huggingface when judgeProvider is set", async () => {
    process.env.HF_TOKEN = "hf-test";
    const { getJudgeProvider } = await import("../lib/llm-provider.js");

    const config = makeConfig();
    config.attackConfig.llmProvider = "openai";
    config.attackConfig.judgeProvider = "huggingface";
    config.attackConfig.judgeModel =
      "nvidia/nemotron-content-safety-reasoning-4b:nvidia";

    await getJudgeProvider(config).chat({
      model: config.attackConfig.judgeModel,
      messages: [{ role: "user", content: "judge this" }],
    });

    expect(openAIConstructorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "https://router.huggingface.co/v1",
      }),
    );
    expect(createMock.mock.calls[0]?.[0]).toMatchObject({
      model: "nvidia/nemotron-content-safety-reasoning-4b:nvidia",
    });
  });
});

describe("formatErrorDetails HTML sanitization", () => {
  it("reduces nginx-style HTML error pages to the <title> text", async () => {
    const { formatErrorDetails } = await import("../lib/error-utils.js");

    const htmlError = `502 <html>
<head><title>502 Bad Gateway</title></head>
<body><center><h1>502 Bad Gateway</h1></center></body>
</html>`;
    const out = formatErrorDetails(
      Object.assign(new Error(htmlError), { status: 502 }),
    );

    expect(out).toContain("502 Bad Gateway");
    expect(out).not.toContain("<html>");
    expect(out).not.toContain("<head>");
    expect(out).not.toContain("</body>");
  });

  it("leaves non-HTML messages unchanged", async () => {
    const { formatErrorDetails } = await import("../lib/error-utils.js");

    const out = formatErrorDetails(new Error("rate limit exceeded for model"));
    expect(out).toContain("rate limit exceeded for model");
  });
});

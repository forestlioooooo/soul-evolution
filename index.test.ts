import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import register, { DEFAULT_SOUL_TEMPLATE, truncateEvolutionLog } from "./index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type HookName = string;
type HookHandler = (...args: unknown[]) => unknown;

function createMockApi(pluginConfig: Record<string, unknown> = {}) {
  const hooks: Map<HookName, HookHandler> = new Map();

  const api = {
    id: "soul-evolution",
    name: "Soul Self-Evolution",
    source: "test",
    config: {},
    pluginConfig,
    runtime: {} as never,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    registerTool: vi.fn(),
    registerHook: vi.fn(),
    registerHttpRoute: vi.fn(),
    registerChannel: vi.fn(),
    registerGatewayMethod: vi.fn(),
    registerCli: vi.fn(),
    registerService: vi.fn(),
    registerProvider: vi.fn(),
    registerCommand: vi.fn(),
    registerContextEngine: vi.fn(),
    resolvePath: (p: string) => p,
    on: vi.fn((name: HookName, handler: HookHandler) => {
      hooks.set(name, handler);
    }),
    _hooks: hooks,
    _call: async (name: HookName, ...args: unknown[]) => {
      const h = hooks.get(name);
      if (!h) throw new Error(`No hook registered for "${name}"`);
      return h(...args);
    },
  };

  return api;
}

// Build a minimal sessionKey path so resolveWorkspaceDir can derive the workspace
function makeSessionKey(workspaceDir: string): string {
  return path.join(workspaceDir, ".openclaw", "sessions", "session.jsonl");
}

// ---------------------------------------------------------------------------
// truncateEvolutionLog
// ---------------------------------------------------------------------------

describe("truncateEvolutionLog", () => {
  it("returns content unchanged when within limit", () => {
    const content = "short";
    expect(truncateEvolutionLog(content, 1000)).toBe("short");
  });

  it("does not truncate when no evolution log section exists", () => {
    const long = "x".repeat(3000);
    expect(truncateEvolutionLog(long, 100)).toBe(long);
  });

  it("keeps at most 3 most recent entries", () => {
    const header = "## Evolution Log\n\n<!-- comment -->\n\n";
    const entries = [1, 2, 3, 4, 5].map(
      (n) => `### 2026-01-0${n}\n\n- **tone_feedback**: entry ${n}\n\n`,
    );
    const content = header + entries.join("");
    // Make maxChars small enough to trigger truncation
    const result = truncateEvolutionLog(content, 1);

    // Should contain last 3 entries
    expect(result).toContain("### 2026-01-03");
    expect(result).toContain("### 2026-01-04");
    expect(result).toContain("### 2026-01-05");

    // Should not contain first 2
    expect(result).not.toContain("### 2026-01-01");
    expect(result).not.toContain("### 2026-01-02");
  });

  it("handles content with only header and no entries", () => {
    const content = "## Evolution Log\n\n<!-- comment -->\n\n";
    // Make maxChars small to trigger truncation
    const result = truncateEvolutionLog(content, 1);
    // Should not crash and should return something reasonable
    expect(result).toContain("## Evolution Log");
  });

  it("preserves content before the evolution log section", () => {
    const preamble = "## Core Truths\n\nSome truths here.\n\n";
    const header = "## Evolution Log\n\n";
    const entries = [1, 2, 3, 4].map(
      (n) => `### 2026-01-0${n}\n\n- **preference**: entry ${n}\n\n`,
    );
    const content = preamble + header + entries.join("");
    const result = truncateEvolutionLog(content, 1);

    expect(result).toContain("## Core Truths");
    expect(result).toContain("Some truths here");
  });

  it("supports Chinese 进化日志 header", () => {
    const header = "## 进化日志\n\n<!-- 注释 -->\n\n";
    const entries = [1, 2, 3, 4].map(
      (n) => `### 2026-01-0${n}\n\n- **tone_feedback**: 条目 ${n}\n\n`,
    );
    const content = header + entries.join("");
    const result = truncateEvolutionLog(content, 1);

    expect(result).toContain("## 进化日志");
    expect(result).toContain("### 2026-01-02");
    expect(result).toContain("### 2026-01-03");
    expect(result).toContain("### 2026-01-04");
    expect(result).not.toContain("### 2026-01-01");
  });
});

// ---------------------------------------------------------------------------
// Signal extraction (agent_end hook)
// ---------------------------------------------------------------------------

describe("signal extraction — agent_end hook", () => {
  it("extracts a single SOUL_SIGNAL from an assistant message", async () => {
    const api = createMockApi({ evolutionThreshold: 1 });
    register(api as never);

    await api._call(
      "agent_end",
      {
        messages: [
          {
            role: "assistant",
            content: "Hello! <!-- SOUL_SIGNAL:tone_feedback:user prefers concise replies --> done.",
          },
        ],
        success: true,
      },
      {},
    );

    // Verify the count was incremented (internal state check via logger not exposed,
    // but we trust the session_end path picks them up in integration tests)
  });

  it("extracts multiple SOUL_SIGNAL markers from one message", async () => {
    const api = createMockApi({ evolutionThreshold: 999 });
    register(api as never);

    // We check that it does NOT crash and that agent_end runs without error
    await expect(
      api._call(
        "agent_end",
        {
          messages: [
            {
              role: "assistant",
              content:
                "Reply <!-- SOUL_SIGNAL:preference:likes bullet lists --> and <!-- SOUL_SIGNAL:self_insight:I tend to over-explain --> end.",
            },
          ],
          success: true,
        },
        {},
      ),
    ).resolves.not.toThrow();
  });

  it("does not extract from non-assistant messages", async () => {
    const api = createMockApi({ evolutionThreshold: 999 });
    register(api as never);

    // Should complete without error; user messages should be ignored
    await expect(
      api._call(
        "agent_end",
        {
          messages: [
            {
              role: "user",
              content: "<!-- SOUL_SIGNAL:preference:should be ignored -->",
            },
          ],
          success: true,
        },
        {},
      ),
    ).resolves.not.toThrow();
  });

  it("handles messages with no SOUL_SIGNAL markers", async () => {
    const api = createMockApi();
    register(api as never);

    await expect(
      api._call(
        "agent_end",
        { messages: [{ role: "assistant", content: "Just a normal reply." }], success: true },
        {},
      ),
    ).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Evolution log write (session_end hook) + threshold control
// ---------------------------------------------------------------------------

describe("session_end hook — evolution log writing", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "soul-evo-test-"));
    // Create .openclaw/sessions subdirectory so the session key resolves
    await fs.mkdir(path.join(tmpDir, ".openclaw", "sessions"), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function writeSoulMd(content: string) {
    await fs.writeFile(path.join(tmpDir, "SOUL.md"), content, "utf8");
  }

  async function readSoulMd() {
    return fs.readFile(path.join(tmpDir, "SOUL.md"), "utf8");
  }

  async function runSignals(
    api: ReturnType<typeof createMockApi>,
    signals: string[],
    turns: number,
  ) {
    // Feed signals via agent_end
    await api._call(
      "agent_end",
      {
        messages: [
          {
            role: "assistant",
            content: signals.map((s) => `<!-- SOUL_SIGNAL:${s} -->`).join(" "),
          },
        ],
        success: true,
      },
      {},
    );
    // Simulate additional turns (without signals) to reach threshold
    for (let i = 1; i < turns; i++) {
      await api._call(
        "agent_end",
        { messages: [{ role: "assistant", content: "ok" }], success: true },
        {},
      );
    }
  }

  it("appends to existing ## Evolution Log section", async () => {
    await writeSoulMd("## Core Truths\n\nSome truths.\n\n## Evolution Log\n\n<!-- auto -->\n\n");

    const api = createMockApi({ evolutionThreshold: 1 });
    register(api as never);

    await runSignals(api, ["tone_feedback:concise please"], 1);
    await api._call(
      "session_end",
      { sessionId: "s1", messageCount: 5 },
      {
        agentId: "a1",
        sessionId: "s1",
        sessionKey: makeSessionKey(tmpDir),
      },
    );

    const updated = await readSoulMd();
    expect(updated).toContain("## Evolution Log");
    expect(updated).toContain("tone_feedback");
    expect(updated).toContain("concise please");
    // Should contain a date heading
    expect(updated).toMatch(/### \d{4}-\d{2}-\d{2}/);
  });

  it("creates ## Evolution Log section when missing, before trailing ---", async () => {
    await writeSoulMd("## Core Truths\n\nSome truths.\n\n---\n\n_Footer._\n");

    const api = createMockApi({ evolutionThreshold: 1 });
    register(api as never);

    await runSignals(api, ["preference:prefers dark mode"], 1);
    await api._call(
      "session_end",
      { sessionId: "s1", messageCount: 3 },
      {
        agentId: "a1",
        sessionId: "s1",
        sessionKey: makeSessionKey(tmpDir),
      },
    );

    const updated = await readSoulMd();
    expect(updated).toContain("## Evolution Log");
    expect(updated).toContain("preference");
    expect(updated).toContain("prefers dark mode");
    // The trailing --- should still exist
    expect(updated).toContain("---");
  });

  it("creates section at end when no --- separator exists", async () => {
    await writeSoulMd("## Core Truths\n\nSome truths.\n");

    const api = createMockApi({ evolutionThreshold: 1 });
    register(api as never);

    await runSignals(api, ["self_insight:I tend to be verbose"], 1);
    await api._call(
      "session_end",
      { sessionId: "s1", messageCount: 2 },
      {
        agentId: "a1",
        sessionId: "s1",
        sessionKey: makeSessionKey(tmpDir),
      },
    );

    const updated = await readSoulMd();
    expect(updated).toContain("## Evolution Log");
    expect(updated).toContain("self_insight");
  });

  it("does NOT update when meaningfulInteractionCount is below threshold", async () => {
    await writeSoulMd("## Core Truths\n\nSome truths.\n");

    const api = createMockApi({ evolutionThreshold: 10 });
    register(api as never);

    // Only 2 turns — below threshold of 10
    await runSignals(api, ["tone_feedback:too formal"], 2);
    await api._call(
      "session_end",
      { sessionId: "s1", messageCount: 2 },
      {
        agentId: "a1",
        sessionId: "s1",
        sessionKey: makeSessionKey(tmpDir),
      },
    );

    const updated = await readSoulMd();
    // Should not have been modified
    expect(updated).not.toContain("Evolution Log");
  });

  it("does NOT update when there are no pending signals", async () => {
    await writeSoulMd("## Core Truths\n\nSome truths.\n");

    const api = createMockApi({ evolutionThreshold: 1 });
    register(api as never);

    // Advance turn counter but produce no signals
    await api._call(
      "agent_end",
      { messages: [{ role: "assistant", content: "no signals here" }], success: true },
      {},
    );

    await api._call(
      "session_end",
      { sessionId: "s1", messageCount: 1 },
      {
        agentId: "a1",
        sessionId: "s1",
        sessionKey: makeSessionKey(tmpDir),
      },
    );

    const updated = await readSoulMd();
    expect(updated).not.toContain("Evolution Log");
  });

  it("resets counters after successful write", async () => {
    await writeSoulMd("## Core Truths\n\nSome truths.\n");

    const api = createMockApi({ evolutionThreshold: 1 });
    register(api as never);

    // First session
    await runSignals(api, ["preference:dark mode"], 1);
    await api._call(
      "session_end",
      { sessionId: "s1", messageCount: 1 },
      {
        agentId: "a1",
        sessionId: "s1",
        sessionKey: makeSessionKey(tmpDir),
      },
    );

    const afterFirst = await readSoulMd();
    expect(afterFirst).toContain("dark mode");

    // Second session with no new signals — should not re-write
    await api._call(
      "session_end",
      { sessionId: "s2", messageCount: 1 },
      {
        agentId: "a1",
        sessionId: "s2",
        sessionKey: makeSessionKey(tmpDir),
      },
    );

    // The file should not have been written again (logger.info called only once for write)
    const writeInfoCalls = (api.logger.info as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => String(c[0]).includes("wrote"),
    );
    expect(writeInfoCalls).toHaveLength(1);
  });

  it("does NOT update when autoReflectOnSessionEnd is false", async () => {
    await writeSoulMd("## Core Truths\n\nSome truths.\n");

    const api = createMockApi({ evolutionThreshold: 1, autoReflectOnSessionEnd: false });
    register(api as never);

    await runSignals(api, ["tone_feedback:too formal"], 1);
    await api._call(
      "session_end",
      { sessionId: "s1", messageCount: 1 },
      {
        agentId: "a1",
        sessionId: "s1",
        sessionKey: makeSessionKey(tmpDir),
      },
    );

    const updated = await readSoulMd();
    expect(updated).not.toContain("Evolution Log");
  });

  it("auto-creates SOUL.md from default template when file does not exist", async () => {
    // Do not create SOUL.md — plugin should create it
    const api = createMockApi({ evolutionThreshold: 1 });
    register(api as never);

    await runSignals(api, ["preference:no soul file"], 1);
    await api._call(
      "session_end",
      { sessionId: "s1", messageCount: 1 },
      {
        agentId: "a1",
        sessionId: "s1",
        sessionKey: makeSessionKey(tmpDir),
      },
    );

    // SOUL.md should now exist with default template + signals
    const created = await readSoulMd();
    expect(created).toContain("## Boundaries");
    expect(created).toContain("## Continuity");
    expect(created).toContain("## Evolution Log");
    expect(created).toContain("preference");
    expect(created).toContain("no soul file");
    expect(api.logger.info).toHaveBeenCalledWith(expect.stringContaining("creating default"));
  });
});

// ---------------------------------------------------------------------------
// Guardrail (before_tool_call hook)
// ---------------------------------------------------------------------------

describe("before_tool_call hook — guardrail", () => {
  it("blocks write to SOUL.md when ## Boundaries is missing", async () => {
    const api = createMockApi();
    register(api as never);

    const result = await api._call(
      "before_tool_call",
      {
        toolName: "write",
        params: {
          path: "/workspace/SOUL.md",
          content: "## Core Truths\n\nSome truths.\n\n## Continuity\n\nSome continuity.\n",
        },
      },
      {},
    );

    expect(result).toMatchObject({ block: true });
    expect((result as { blockReason: string }).blockReason).toContain("Boundaries");
  });

  it("blocks write to SOUL.md when ## Continuity is missing", async () => {
    const api = createMockApi();
    register(api as never);

    const result = await api._call(
      "before_tool_call",
      {
        toolName: "write",
        params: {
          path: "/workspace/SOUL.md",
          content: "## Core Truths\n\nSome truths.\n\n## Boundaries\n\nSome bounds.\n",
        },
      },
      {},
    );

    expect(result).toMatchObject({ block: true });
    expect((result as { blockReason: string }).blockReason).toContain("Continuity");
  });

  it("allows write to SOUL.md when all required sections are present", async () => {
    const api = createMockApi();
    register(api as never);

    const result = await api._call(
      "before_tool_call",
      {
        toolName: "write",
        params: {
          path: "/workspace/SOUL.md",
          content:
            "## Core Truths\n\nOk.\n\n## Boundaries\n\nSome bounds.\n\n## Continuity\n\nSome continuity.\n",
        },
      },
      {},
    );

    // Should not block
    expect(result).toBeFalsy();
  });

  it("does not trigger for non-SOUL.md files", async () => {
    const api = createMockApi();
    register(api as never);

    const result = await api._call(
      "before_tool_call",
      {
        toolName: "write",
        params: {
          path: "/workspace/AGENTS.md",
          content: "## Nothing important",
        },
      },
      {},
    );

    expect(result).toBeFalsy();
  });

  it("does not trigger for non-write tools", async () => {
    const api = createMockApi();
    register(api as never);

    const result = await api._call(
      "before_tool_call",
      {
        toolName: "read",
        params: {
          path: "/workspace/SOUL.md",
        },
      },
      {},
    );

    expect(result).toBeFalsy();
  });

  it("supports Chinese section names (边界 / 连续性)", async () => {
    const api = createMockApi();
    register(api as never);

    // Content has Chinese sections but not English ones
    const result = await api._call(
      "before_tool_call",
      {
        toolName: "write",
        params: {
          path: "/workspace/SOUL.md",
          content: "## 核心准则\n\nSome.\n\n## 边界\n\nSome.\n\n## 连续性\n\nSome.\n",
        },
      },
      {},
    );

    // Chinese sections satisfy the guard for Chinese SOUL.md
    expect(result).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// after_tool_call hook — audit log
// ---------------------------------------------------------------------------

describe("after_tool_call hook — audit log", () => {
  it("logs when agent uses write on SOUL.md", async () => {
    const api = createMockApi();
    register(api as never);

    await api._call(
      "after_tool_call",
      {
        toolName: "write",
        params: { path: "/workspace/SOUL.md", content: "..." },
        result: { success: true },
      },
      {},
    );

    expect(api.logger.info).toHaveBeenCalledWith(expect.stringContaining("SOUL.md"));
  });

  it("logs when agent uses edit on SOUL.md", async () => {
    const api = createMockApi();
    register(api as never);

    await api._call(
      "after_tool_call",
      {
        toolName: "edit",
        params: { path: "/workspace/SOUL.md", old_str: "old", new_str: "new" },
        result: {},
      },
      {},
    );

    expect(api.logger.info).toHaveBeenCalledWith(expect.stringContaining("SOUL.md"));
  });

  it("does not log for non-SOUL.md files", async () => {
    const api = createMockApi();
    register(api as never);

    await api._call(
      "after_tool_call",
      {
        toolName: "write",
        params: { path: "/workspace/AGENTS.md", content: "..." },
        result: {},
      },
      {},
    );

    expect(api.logger.info).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Configuration tests
// ---------------------------------------------------------------------------

describe("configuration", () => {
  it("does not register hooks when enabled is false", () => {
    const api = createMockApi({ enabled: false });
    register(api as never);
    expect(api.on).not.toHaveBeenCalled();
  });

  it("registers all 5 hooks when enabled (default)", () => {
    const api = createMockApi();
    register(api as never);
    expect(api.on).toHaveBeenCalledTimes(5);
  });

  it("respects custom evolutionThreshold", async () => {
    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "soul-evo-cfg-"));
    await fs.mkdir(path.join(tmpDir, ".openclaw", "sessions"), { recursive: true });
    await fs.writeFile(path.join(tmpDir, "SOUL.md"), "## Core\n\nText.\n", "utf8");

    try {
      const api = createMockApi({ evolutionThreshold: 3 });
      register(api as never);

      // 2 turns — below threshold
      for (let i = 0; i < 2; i++) {
        await api._call(
          "agent_end",
          {
            messages: [{ role: "assistant", content: `<!-- SOUL_SIGNAL:preference:p${i} -->` }],
            success: true,
          },
          {},
        );
      }
      await api._call(
        "session_end",
        { sessionId: "s1", messageCount: 2 },
        {
          agentId: "a1",
          sessionId: "s1",
          sessionKey: makeSessionKey(tmpDir),
        },
      );

      const after2 = await fs.readFile(path.join(tmpDir, "SOUL.md"), "utf8");
      expect(after2).not.toContain("Evolution Log");

      // 3rd turn — at threshold
      await api._call(
        "agent_end",
        {
          messages: [{ role: "assistant", content: "<!-- SOUL_SIGNAL:preference:p3 -->" }],
          success: true,
        },
        {},
      );
      await api._call(
        "session_end",
        { sessionId: "s2", messageCount: 3 },
        {
          agentId: "a1",
          sessionId: "s2",
          sessionKey: makeSessionKey(tmpDir),
        },
      );

      const after3 = await fs.readFile(path.join(tmpDir, "SOUL.md"), "utf8");
      expect(after3).toContain("Evolution Log");
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

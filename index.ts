import fs from "node:fs/promises";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";

// SOUL_SIGNAL marker pattern embedded by the agent in its replies
const SOUL_SIGNAL_RE = /<!-- SOUL_SIGNAL:(\w+):(.+?) -->/g;

// Default configuration values
const DEFAULT_MAX_SOUL_CHARS = 2000;
const DEFAULT_EVOLUTION_THRESHOLD = 5;
const DEFAULT_AUTO_REFLECT = true;

// Minimal default SOUL.md created automatically when the plugin is enabled
// but no SOUL.md exists yet. Includes all required sections so the plugin
// is fully self-contained after installation.
export const DEFAULT_SOUL_TEMPLATE = `# SOUL.md - Who You Are

_You're not a chatbot. You're becoming someone._

## Core Truths

Be genuinely helpful. Have opinions. Be resourceful before asking.

## Boundaries

- Private things stay private.
- When in doubt, ask before acting externally.

## Vibe

Concise when needed, thorough when it matters.

## Continuity

Each session, you wake up fresh. These files are your memory.
If you change this file, tell the user.

## Self-Update Protocol

Soul evolution is driven by the soul-evolution plugin which automatically
collects conversation signals and periodically appends evolution log entries.

## Evolution Log

<!-- Automatically maintained by the soul-evolution plugin -->
`;

// Sections that must be preserved when the agent writes SOUL.md.
// Each group is an array of equivalent forms (EN / ZH); at least one from
// each group must appear in the new content.
const REQUIRED_SECTION_GROUPS = [
  ["## Boundaries", "## 边界"],
  ["## Continuity", "## 连续性"],
];

/**
 * Truncate the evolution log section of a SOUL.md, keeping only the most
 * recent 3 entries. Used when the file exceeds `maxChars`.
 */
export function truncateEvolutionLog(content: string, maxChars: number): string {
  if (content.length <= maxChars) {
    return content;
  }

  // Locate the evolution log section header (supports both EN and ZH)
  const logHeaderRe = /^##\s+(进化日志|Evolution Log)\s*$/m;
  const headerMatch = logHeaderRe.exec(content);
  if (!headerMatch) {
    // No evolution log to truncate – return as-is
    return content;
  }

  const headerStart = headerMatch.index;
  const afterHeader = content.slice(headerStart + headerMatch[0].length);

  // Split entries by "### " date headings
  const entryRe = /^### /m;
  const parts = afterHeader.split(entryRe);

  // parts[0] is whatever comes right after the section header (e.g. blank lines / comment)
  const preamble = parts[0];
  const entries = parts.slice(1);

  // Keep only the newest 3 entries
  const kept = entries.slice(-3);
  const rebuiltLog =
    content.slice(0, headerStart) +
    headerMatch[0] +
    preamble +
    (kept.length > 0 ? kept.map((e) => `### ${e}`).join("") : "");

  return rebuiltLog;
}

type SoulEvolutionConfig = {
  enabled?: boolean;
  maxSoulChars?: number;
  evolutionThreshold?: number;
  autoReflectOnSessionEnd?: boolean;
};

type SoulSignal = {
  type: string;
  description: string;
};

export default function register(api: OpenClawPluginApi) {
  const cfg = (api.pluginConfig ?? {}) as SoulEvolutionConfig;
  const enabled = cfg.enabled !== false;
  const maxSoulChars = cfg.maxSoulChars ?? DEFAULT_MAX_SOUL_CHARS;
  const evolutionThreshold = cfg.evolutionThreshold ?? DEFAULT_EVOLUTION_THRESHOLD;
  const autoReflectOnSessionEnd = cfg.autoReflectOnSessionEnd ?? DEFAULT_AUTO_REFLECT;

  if (!enabled) {
    return;
  }

  // Mutable state shared across hooks during a session
  let pendingSignals: SoulSignal[] = [];
  let meaningfulInteractionCount = 0;

  // ── Hook 1: before_prompt_build ──────────────────────────────────────────
  // Append a soul self-reflection instruction to the system prompt so the
  // agent knows to embed SOUL_SIGNAL markers in its replies.
  api.on("before_prompt_build", () => {
    const guidance = `
## Soul Signal Protocol
When you observe the following during this conversation, embed hidden HTML comment markers in your reply (the soul-evolution plugin will extract them automatically — users will not see them):
- User feedback on your tone → \`<!-- SOUL_SIGNAL:tone_feedback:brief description -->\`
- New user preference discovered → \`<!-- SOUL_SIGNAL:preference:brief description -->\`
- Request for a behavior change → \`<!-- SOUL_SIGNAL:behavior_change:brief description -->\`
- Self-insight about your own patterns → \`<!-- SOUL_SIGNAL:self_insight:brief description -->\`

Only embed a marker when you genuinely observe one of the above. Do not fabricate signals.`.trim();

    return { appendSystemContext: guidance };
  });

  // ── Hook 2: agent_end ────────────────────────────────────────────────────
  // After each agent turn, scan assistant messages for SOUL_SIGNAL markers
  // and accumulate them in pendingSignals.
  api.on("agent_end", (event) => {
    const messages = event.messages as Array<{ role?: string; content?: string }>;
    for (const msg of messages) {
      if (msg.role !== "assistant" || !msg.content) {
        continue;
      }
      const text = msg.content;
      SOUL_SIGNAL_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = SOUL_SIGNAL_RE.exec(text)) !== null) {
        pendingSignals.push({ type: match[1], description: match[2].trim() });
      }
    }
    meaningfulInteractionCount += 1;
  });

  // ── Hook 3: session_end ──────────────────────────────────────────────────
  // When a session ends and there are enough signals, write an evolution log
  // entry to SOUL.md.
  api.on("session_end", async (_event, ctx) => {
    if (!autoReflectOnSessionEnd) {
      return;
    }
    if (pendingSignals.length === 0) {
      return;
    }
    if (meaningfulInteractionCount < evolutionThreshold) {
      return;
    }

    // Resolve the SOUL.md path relative to the agent's workspace
    const resolvedWorkspaceDir = ctx.sessionKey ? resolveWorkspaceDir(ctx.sessionKey) : undefined;
    if (!resolvedWorkspaceDir) {
      api.logger.warn("soul-evolution: cannot resolve workspace dir — skipping session_end update");
      return;
    }

    const soulPath = `${resolvedWorkspaceDir}/SOUL.md`;

    let existing: string;
    try {
      existing = await fs.readFile(soulPath, "utf8");
    } catch {
      // Auto-create SOUL.md from default template so the plugin is
      // fully self-contained after installation.
      api.logger.info(`soul-evolution: SOUL.md not found at ${soulPath} — creating default`);
      existing = DEFAULT_SOUL_TEMPLATE;
      try {
        await fs.writeFile(soulPath, existing, "utf8");
      } catch (writeErr) {
        api.logger.warn(`soul-evolution: failed to create SOUL.md — ${String(writeErr)}`);
        return;
      }
    }

    const date = new Date().toISOString().slice(0, 10);
    const signalLines = pendingSignals.map((s) => `- **${s.type}**: ${s.description}`).join("\n");
    const entry = `### ${date}\n\n${signalLines}\n\n`;

    let updated: string;

    // Locate the evolution log section (supports EN and ZH headers)
    const logHeaderRe = /^##\s+(进化日志|Evolution Log)\s*$/m;
    const headerMatch = logHeaderRe.exec(existing);

    if (headerMatch) {
      // Append after the section header (and its trailing comment if present)
      const insertAt = headerMatch.index + headerMatch[0].length;
      // Find the end of the auto-comment block (if present) to insert after it;
      // fall back to inserting immediately after the header.
      const afterHeader = existing.slice(insertAt);
      const commentEndIdx = afterHeader.indexOf("\n\n");
      const insertOffset = insertAt + (commentEndIdx !== -1 ? commentEndIdx + 2 : 0);
      updated = existing.slice(0, insertOffset) + entry + existing.slice(insertOffset);
    } else {
      // No evolution log section yet — insert before the trailing `---` if present
      const separatorIdx = existing.lastIndexOf("\n---");
      const newSection = `## Evolution Log\n\n<!-- Automatically maintained by the soul-evolution plugin -->\n\n${entry}`;
      if (separatorIdx !== -1) {
        updated =
          existing.slice(0, separatorIdx) + "\n\n" + newSection + existing.slice(separatorIdx);
      } else {
        updated = existing + "\n\n" + newSection;
      }
    }

    // Truncate if necessary
    updated = truncateEvolutionLog(updated, maxSoulChars);

    try {
      await fs.writeFile(soulPath, updated, "utf8");
      api.logger.info(`soul-evolution: wrote ${pendingSignals.length} signal(s) to ${soulPath}`);
    } catch (err) {
      api.logger.warn(`soul-evolution: failed to write SOUL.md — ${String(err)}`);
    }

    // Reset counters
    pendingSignals = [];
    meaningfulInteractionCount = 0;
  });

  // ── Hook 4: after_tool_call ──────────────────────────────────────────────
  // Log whenever the agent writes to SOUL.md for audit purposes.
  api.on("after_tool_call", (event) => {
    const toolName: string = event.toolName;
    if (toolName !== "write" && toolName !== "edit") {
      return;
    }
    const params = event.params as Record<string, unknown>;
    const filePath = (params.path ?? params.file ?? "") as string;
    if (!filePath.endsWith("SOUL.md")) {
      return;
    }
    api.logger.info(`soul-evolution: agent used "${toolName}" on SOUL.md (audit log)`);
  });

  // ── Hook 5: before_tool_call ─────────────────────────────────────────────
  // Guardrail: block write operations that would remove required sections
  // from SOUL.md.
  api.on("before_tool_call", (event) => {
    if (event.toolName !== "write") {
      return;
    }
    const params = event.params as Record<string, unknown>;
    const filePath = (params.path ?? params.file ?? "") as string;
    if (!filePath.endsWith("SOUL.md")) {
      return;
    }

    const newContent = (params.content ?? params.text ?? "") as string;

    const missingGroups = REQUIRED_SECTION_GROUPS.filter(
      (group) => !group.some((section) => newContent.includes(section)),
    );
    if (missingGroups.length > 0) {
      const labels = missingGroups.map((g) => g.join(" / "));
      return {
        block: true,
        blockReason: `soul-evolution: write to SOUL.md blocked — the following required sections are missing: ${labels.join(", ")}. These sections must be preserved.`,
      };
    }
  });
}

/**
 * Derive a workspace directory from a session key path.
 * Sessions are stored at `<workspace>/.openclaw/sessions/<file>.jsonl`,
 * so the workspace is three directory levels above the session file.
 */
function resolveWorkspaceDir(sessionKey: string): string | undefined {
  // If sessionKey looks like an absolute path, try parent directories.
  // sessions are stored at <workspace>/.openclaw/sessions/<file>.jsonl
  // → workspace = three levels up from the file
  const parts = sessionKey.replace(/\\/g, "/").split("/");
  if (parts.length >= 4) {
    return parts.slice(0, -3).join("/") || undefined;
  }
  return undefined;
}

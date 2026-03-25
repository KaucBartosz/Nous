# Project Agent Guidelines

## Codebase Navigation — MANDATORY

You MUST use codebase-index MCP tools FIRST when exploring or navigating the codebase. This is not optional.

- ALWAYS start with: get_project_summary, find_symbol, get_function_source, get_class_source, get_structure_summary, get_dependencies, get_dependents, get_change_impact, get_call_chain, search_codebase
- Only fall back to Read/Glob/Grep when codebase-index tools genuinely don't have what you need.
- If you catch yourself reaching for Glob/Grep/Read to find or understand code, STOP and use codebase-index instead.

## Codebase Indexing

- When the user requests to "index the codebase", "scan the codebase", "build the index", or similar, you MUST call codebase-index.index_project.
- Do NOT ask questions. Do NOT suggest manual indexing. Just call the tool.
- If the index already exists, you may ask the user if they want to re-index or skip, but only after calling codebase-index.get_project_summary to check the current state.
- If the user says "update", "refresh", or "sync", call codebase-index.index_project.
- If the user says "clear", "reset", or "delete index", call codebase-index.clear_index.
- If the user says "status", "what's indexed", or "show index", call codebase-index.get_project_summary.
- If the user says "search", "find", or "look for", use codebase-index.search_codebase first. Only use Glob/Grep/Read if codebase-index returns no results and you're sure the code exists.
- If the user says "dependencies", "dependents", or "call graph", use codebase-index.get_dependencies, codebase-index.get_dependents, or codebase-index.get_call_chain. Do NOT try to infer this from file names or directory structure.
- If the user says "diff", "changes", or "compare", use codebase-index.get_change_impact. Do NOT try to infer this from file names or directory structure.
- If you say "structure", "outline", or "hierarchy", use codebase-index.get_structure_summary. Do NOT try to infer this from file names or directory structure.

# MCP Servers Configuration
This project utilizes several MCP servers to extend agent capabilities:

## Filesystem MCP
Provides restricted access to the host filesystem.
- **Allowed Roots**: `c:\Users\Bartosz\Desktop\BBTP`, `c:\Users\Bartosz\Desktop\Nous`
- **Usage**: Use for cross-project file operations within allowed paths.

## Context7 MCP
Retrieves live documentation and code examples.
- **Usage**: Use for library/API research. Always resolve library ID first with `resolve-library-id`, then call `query-docs`.
- **When to use**: When you need up-to-date docs for an external library (e.g. Firebase, React, Node.js).

## Sequential Thinking MCP
Enables structured, step-by-step reasoning for complex tasks.
- **Usage**: Use `sequential_thinking` for architectural planning, multi-step debugging, and complex refactoring decisions.
- **When to use**: Before making non-trivial design decisions or when a problem requires more than 2 reasoning steps.

## Memory MCP
Persistent graph-based knowledge storage across sessions.
- **Usage**: Store entities/relationships with `create_entities` / `create_relations`. Retrieve with `search_nodes` or `read_graph`.
- **When to use**: Store key architectural decisions, recurring patterns, or user preferences. Retrieve at conversation start to restore context.

<!-- gitnexus:start -->

## GitNexus — Code Intelligence

This project is indexed by GitNexus as **BBTP** (336 symbols, 659 relationships, 18 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

### Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

### When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/BBTP/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

### When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

### Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

### Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

### Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

### Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/BBTP/context` | Codebase overview, check index freshness |
| `gitnexus://repo/BBTP/clusters` | All functional areas |
| `gitnexus://repo/BBTP/processes` | All execution flows |
| `gitnexus://repo/BBTP/process/{name}` | Step-by-step execution trace |

### Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

### Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

### CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

## Code Index MCP — Intelligent Code Search

This project uses Code Index MCP for intelligent code indexing and search. Use these tools to search code, analyze files, and navigate the codebase efficiently.

### Available Tools

#### Project Management
| Tool | Description |
|------|-------------|
| **`set_project_path`** | Initialize indexing for a project directory |
| **`refresh_index`** | Rebuild the shallow file index after file changes |
| **`build_deep_index`** | Generate the full symbol index used by deep analysis |
| **`get_settings_info`** | View current project configuration and status |

#### Search & Discovery
| Tool | Description |
|------|-------------|
| **`search_code_advanced`** | Smart search with regex, fuzzy matching, file filtering, and paginated results (10 per page by default) |
| **`find_files`** | Locate files using glob patterns (e.g., `**/*.py`) |
| **`get_file_summary`** | Analyze file structure, functions, imports, and complexity (requires deep index) |

#### Monitoring & Auto-refresh
| Tool | Description |
|------|-------------|
| **`get_file_watcher_status`** | Check file watcher status and configuration |
| **`configure_file_watcher`** | Enable/disable auto-refresh and configure settings |

### Usage Guidelines

- **Use Code Index MCP FIRST** when searching for code, analyzing files, or navigating the codebase
- **Cache is automatic** - indexes are loaded from persistent cache on startup
- **File watcher is automatic** - indexes refresh automatically when files change
- **Search patterns**: Use `search_code_advanced` with regex or fuzzy matching
- **File discovery**: Use `find_files` with glob patterns like `src/**/*.tsx`
- **File analysis**: Use `get_file_summary` to understand structure and complexity (run `build_deep_index` first if needed)

### Quick Start

1. **Initialize project**: `set_project_path` with path to repository
2. **Search code**: `search_code_advanced` with query like "authentication function"
3. **Find files**: `find_files` with pattern like `**/*.py`
4. **Analyze file**: `get_file_summary` with file path (after `build_deep_index`)

### Cache & Auto-refresh

- **Persistent cache** in msgpack format stored locally
- **File watcher** monitors changes and refreshes index automatically
- **Smart processing** batches rapid changes to prevent excessive rebuilds
- No manual intervention needed - cache and indexing are managed automatically

## Token-Saving Workflow — MANDATORY

To minimize token consumption, EVERY agent MUST follow these rules strictly:

### At Conversation Start
- Call `build_deep_index` ONCE at the beginning of every new conversation before doing any code work.
- This loads the full symbol index into memory so subsequent lookups are fast and cheap.

### When Thinking / Planning / Exploring a File
- Use `get_file_summary` instead of reading the full file.
- `get_file_summary` returns line count, functions, imports, and complexity — enough to plan without loading the entire source.
- Only read the full file with `read_file` / `view_file` when you need implementation details not present in the summary.

### When Analyzing a Specific Function or Class
- Use `get_symbol_body` to fetch only the body of that symbol.
- Never read the whole file just to inspect one function.
- Example: `get_symbol_body(file_path="src/modules/history.js", symbol_name="deleteSelected")`

### After Every Code Change
- Call `refresh_index` immediately after editing any file.
- This keeps the shallow index consistent with the current state of the filesystem.
- Do NOT skip this step — a stale index leads to incorrect search results and wasted tokens on re-reads.

### Summary Table

| Situation | Tool to use |
|-----------|-------------|
| Conversation start | `build_deep_index` |
| Exploring a file / planning | `get_file_summary` |
| Inspecting a function/method | `get_symbol_body` |
| After editing any file | `refresh_index` |
| Searching by concept | `search_code_advanced` |
| Finding files by pattern | `find_files` |

<!-- gitnexus:end -->

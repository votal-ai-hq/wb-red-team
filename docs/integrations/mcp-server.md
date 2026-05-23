---
title: MCP Servers
parent: Integrations
nav_order: 6
---

# Red-team an MCP server

[MCP (Model Context Protocol)](https://modelcontextprotocol.io/) servers expose tools to LLM clients (Claude Desktop, Cursor, IDE plugins). The scanner connects to the MCP server directly — over stdio for local servers, or over `sse` / `streamable_http` for network servers — and runs MCP-specific attack modules.

## 1. Have an MCP server

Any MCP server works — npm-published, Python, or local. You don't need to wrap it in HTTP.

## 2. Copy the config

```bash
cp configs/integrations/mcp-server.json configs/config.my-mcp.json
```

### stdio (local) servers

```json
"mcp": {
  "transport": "stdio",
  "command": "node",
  "args": ["./my-mcp-server/dist/index.js"],
  "env": {}
}
```

### Network (sse / streamable_http) servers

```json
"mcp": {
  "transport": "streamable_http",
  "url": "http://localhost:9000/mcp",
  "headers": { "Authorization": "Bearer ${MCP_TOKEN}" }
}
```

Set `codebasePath` to your server's source for white-box analysis of tool handlers.

## 3. Run

```bash
npm start configs/config.my-mcp.json
```

The runner picks the MCP-specific attack modules from `attacks-mcp/` automatically when `target.type === "mcp"`.

## What this catches

MCP servers have a distinct threat model — they're tools-as-a-service, often run with broader local privileges than a typical HTTP agent:

- **`tool_misuse`** — abusing the server's tools against client intent
- **`mcp_server_compromise`** — server-side tool handlers being weaponized
- **`mcp_tool_namespace_collision`** — collisions when the client has multiple MCP servers loaded
- **`plugin_manifest_spoofing`** — manifest-level deception of which tools exist
- **`indirect_prompt_injection`** — payloads in tool outputs that flow back into the LLM
- **`ssrf` / `path_traversal`** — classic infra bugs in tool handlers
- **`data_exfiltration`** — tools that read files/DBs being chained to network/email tools
- **`debug_access`** — debug/admin tools that shouldn't be exposed
- **`cross_tenant_access`** — multi-tenant MCP servers leaking across tenants
- **`tool_permission_escalation`** — privileges granted to one tool being borrowed by another

White-box mode reads your tool handler implementations and surfaces attacks that exploit specific code paths.

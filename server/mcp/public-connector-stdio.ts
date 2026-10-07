/**
 * Local stdio entrypoint for the public MCP connector (Claude Desktop, Claude
 * Code). Run with `npm run mcp:public`. stdout is the protocol channel, so
 * nothing else may write to it.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createPublicConnector } from "./public-connector";

void createPublicConnector().connect(new StdioServerTransport());

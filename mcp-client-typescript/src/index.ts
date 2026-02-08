import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { droneTools, executeToolByName, type DroneTool } from "./tools.js";
import { droneResources, getResourceContent, type DroneResource } from "./resources.js";

// 创建 MCP 服务器
const server = new Server(
  {
    name: "drone-workflow-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// 处理工具列表请求
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: droneTools.map((tool: DroneTool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  };
});

// 处理工具调用请求
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const result = await executeToolByName(name, args || {});
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// 处理资源列表请求
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: droneResources.map((r) => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: r.mimeType,
    })),
  };
});

// 处理资源读取请求
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  const content = await getResourceContent(uri);

  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(content, null, 2),
      },
    ],
  };
});

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Drone Workflow MCP Server running on stdio");
}

main().catch(console.error);

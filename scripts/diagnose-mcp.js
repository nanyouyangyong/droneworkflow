import { mcpManager } from "../lib/server/mcp/index.js";

async function diagnoseMCP() {
  console.log("=== MCP 连接诊断 ===");
  
  try {
    // 初始化 MCP 管理器
    console.log("正在初始化 MCP 管理器...");
    await mcpManager.initialize();
    
    // 获取状态
    const status = mcpManager.getStatus();
    console.log("\n=== MCP 服务器状态 ===");
    status.servers.forEach(server => {
      console.log(`服务器: ${server.serverName}`);
      console.log(`  状态: ${server.status}`);
      console.log(`  连接: ${server.connected}`);
      console.log(`  工具数: ${server.toolCount}`);
      if (server.lastError) {
        console.log(`  最后错误: ${server.lastError}`);
      }
      console.log("---");
    });
    
    // 尝试调用工具
    console.log("\n=== 测试工具调用 ===");
    try {
      const result = await mcpManager.callToolAuto("drone:connect_drone", { droneId: "test-drone" });
      console.log("工具调用成功:", result);
    } catch (error) {
      console.error("工具调用失败:", error.message);
    }
    
  } catch (error) {
    console.error("诊断失败:", error.message);
  }
  
  // 关闭所有连接
  await mcpManager.disconnectAll();
  console.log("\n=== 诊断完成 ===");
}

diagnoseMCP().catch(console.error);

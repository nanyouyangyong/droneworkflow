// ============================================================================
// HttpDroneClient —— MCP 侧调用 drone-control-service 的 HTTP 客户端
// ============================================================================

const BASE_URL = process.env.DRONE_CONTROL_BASE_URL || "http://127.0.0.1:4010";
const API_KEY = process.env.DRONE_CONTROL_API_KEY || "";
const TIMEOUT_MS = 15_000;

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

async function request<T = any>(
  method: string,
  path: string,
  body?: any
): Promise<ApiResponse<T>> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (API_KEY) {
    headers["Authorization"] = `Bearer ${API_KEY}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const json = (await res.json()) as ApiResponse<T>;
    return json;
  } catch (err: any) {
    if (err.name === "AbortError") {
      return { success: false, error: { code: "TIMEOUT", message: `Request timeout (${TIMEOUT_MS}ms)` } };
    }
    return { success: false, error: { code: "NETWORK_ERROR", message: err.message } };
  } finally {
    clearTimeout(timer);
  }
}

// ---- 公开方法 ----

export async function connectDrone(droneId: string, name?: string, adapter?: string) {
  return request("POST", "/api/v1/drones/connect", { droneId, name, adapter });
}

export async function disconnectDrone(droneId: string) {
  return request("POST", `/api/v1/drones/${droneId}/disconnect`);
}

export async function getDroneStatus(droneId: string) {
  return request("GET", `/api/v1/drones/${droneId}/status`);
}

export async function listDrones() {
  return request("GET", "/api/v1/drones");
}

export async function sendCommand(
  droneId: string,
  name: string,
  args: Record<string, any> = {},
  idempotencyKey?: string
) {
  return request("POST", `/api/v1/drones/${droneId}/commands`, {
    name,
    args,
    idempotencyKey,
  });
}

export async function getCommandStatus(commandId: string) {
  return request("GET", `/api/v1/commands/${commandId}`);
}

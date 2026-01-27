import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 不需要认证的公开路由
const publicPaths = ["/login", "/register", "/api/auth/login", "/api/auth/register", "/api/auth/refresh"];

// 静态资源和 API 健康检查路由
const ignorePaths = ["/_next", "/favicon.ico", "/health", "/api/health"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 忽略静态资源
  if (ignorePaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // 公开路由直接放行
  if (publicPaths.some((path) => pathname === path || pathname.startsWith(path + "/"))) {
    return NextResponse.next();
  }

  // 检查客户端存储的认证状态
  // 注意：这是一个简化的实现，实际的 token 验证在 API 层进行
  // 中间件主要用于快速重定向未登录用户

  // 对于页面请求，检查是否有认证 cookie 或使用客户端重定向
  // 这里我们让客户端处理认证检查，中间件只做基本的路由控制

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径除了:
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico (网站图标)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

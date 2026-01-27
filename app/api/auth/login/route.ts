import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/server/db";
import { User } from "@/lib/server/models/User";
import { verifyPassword } from "@/lib/server/auth/password";
import { generateTokenPair } from "@/lib/server/auth/jwt";
import { createErrorResponse, ValidationError } from "@/lib/server/middleware/error";

interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface LoginResponse {
  success: true;
  data: {
    user: {
      id: string;
      email: string;
      name: string;
      avatar?: string;
      role: string;
    };
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = (await request.json()) as LoginRequest;
    const { email, password } = body;

    // 验证必填字段
    if (!email || !password) {
      throw new ValidationError("邮箱和密码不能为空");
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError("请输入有效的邮箱地址");
    }

    // 查找用户（包含密码字段）
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");

    if (!user) {
      throw new ValidationError("邮箱或密码错误");
    }

    // 检查用户状态
    if (!user.isActive) {
      throw new ValidationError("账户已被禁用，请联系管理员");
    }

    // 验证密码
    const isPasswordValid = verifyPassword(password, user.password);
    if (!isPasswordValid) {
      throw new ValidationError("邮箱或密码错误");
    }

    // 更新最后登录时间
    user.lastLoginAt = new Date();
    await user.save();

    // 生成 Token
    const tokens = generateTokenPair({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    const response: LoginResponse = {
      success: true,
      data: {
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          role: user.role,
        },
        ...tokens,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    return createErrorResponse(error);
  }
}

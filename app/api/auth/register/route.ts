import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/server/db";
import { User } from "@/lib/server/models/User";
import { hashPassword } from "@/lib/server/auth/password";
import { generateTokenPair } from "@/lib/server/auth/jwt";
import { createErrorResponse, ValidationError, ConflictError } from "@/lib/server/middleware/error";

interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

interface RegisterResponse {
  success: true;
  data: {
    user: {
      id: string;
      email: string;
      name: string;
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

    const body = (await request.json()) as RegisterRequest;
    const { email, password, name } = body;

    // 验证必填字段
    if (!email || !password || !name) {
      throw new ValidationError("邮箱、密码和姓名不能为空");
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError("请输入有效的邮箱地址");
    }

    // 验证密码强度
    if (password.length < 6) {
      throw new ValidationError("密码至少需要6个字符");
    }

    // 验证姓名长度
    if (name.length < 2 || name.length > 50) {
      throw new ValidationError("姓名长度应在2-50个字符之间");
    }

    // 检查邮箱是否已存在
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new ConflictError("该邮箱已被注册");
    }

    // 哈希密码
    const hashedPassword = hashPassword(password);

    // 创建用户
    const user = await User.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      name: name.trim(),
      role: "user",
      isActive: true,
    });

    // 生成 Token
    const tokens = generateTokenPair({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    const response: RegisterResponse = {
      success: true,
      data: {
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
        },
        ...tokens,
      },
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return createErrorResponse(error);
  }
}

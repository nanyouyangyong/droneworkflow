"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // 等待 zustand persist 恢复状态
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      setIsChecking(false);
    });

    // 如果已经 hydrated
    if (useAuthStore.persist.hasHydrated()) {
      setIsChecking(false);
    }

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isChecking && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isChecking, isAuthenticated, router]);

  // 检查中显示加载状态
  if (isChecking) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-sm text-slate-500">加载中...</p>
        </div>
      </div>
    );
  }

  // 未认证时不渲染内容（等待重定向）
  if (!isAuthenticated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-sm text-slate-500">正在跳转到登录页...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

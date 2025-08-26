"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

function PostSetupKick() {
  useEffect(() => {
    if (sessionStorage.getItem("psu-done")) return;
    sessionStorage.setItem("psu-done", "1");
    fetch("/api/auth/post-user-create", { method: "POST" }).catch(() => {});
  }, []);
  return null;
}

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.push("/dashboard");
  }, []);
  return (
    <div>
      {/* <PostSetupKick /> */}
    </div>
  );
} 
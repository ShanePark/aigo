"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { MouseEvent } from "react";

type BackToSearchLinkProps = {
  href: string;
};

export function BackToSearchLink({ href }: BackToSearchLinkProps) {
  const router = useRouter();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (href !== "/" || !shouldUseHistoryBack()) return;

    event.preventDefault();
    router.back();
  }

  return (
    <a className="back-link" href={href} onClick={handleClick}>
      <ArrowLeft size={16} aria-hidden="true" />
      검색으로 돌아가기
    </a>
  );
}

function shouldUseHistoryBack() {
  if (!document.referrer) return false;

  try {
    const referrer = new URL(document.referrer);
    return referrer.origin === window.location.origin && referrer.pathname === "/";
  } catch {
    return false;
  }
}

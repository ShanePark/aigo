import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

import { LegalDocumentPage } from "@/app/legal-document-page";
import { loadCurrentConsentDocument } from "@/lib/consent-document-store";

export const metadata: Metadata = {
  title: "개인정보 처리방침 | AiGo",
  description: "AiGo 개인정보 처리방침"
};

export default async function PrivacyPage() {
  const document = await loadCurrentConsentDocument("privacy_policy");

  if (!document) {
    return null;
  }

  return <LegalDocumentPage document={document} icon={ShieldCheck} />;
}

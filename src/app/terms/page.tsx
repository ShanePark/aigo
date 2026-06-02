import type { Metadata } from "next";
import { FileText } from "lucide-react";

import { LegalDocumentPage } from "@/app/legal-document-page";
import { loadCurrentConsentDocument } from "@/lib/consent-document-store";

export const metadata: Metadata = {
  title: "이용약관 | AiGo",
  description: "AiGo 이용약관"
};

export default async function TermsPage() {
  const document = await loadCurrentConsentDocument("terms_of_service");

  if (!document) {
    return null;
  }

  return <LegalDocumentPage document={document} icon={FileText} title="이용약관" />;
}

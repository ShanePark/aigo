import type { Metadata } from "next";
import { FileText } from "lucide-react";

import { LegalDocumentPage } from "@/app/legal-document-page";
import { consentDocumentByType } from "@/lib/consent-documents";

export const metadata: Metadata = {
  title: "이용약관 | AiGo",
  description: "AiGo 이용약관"
};

export default function TermsPage() {
  const document = consentDocumentByType("terms_of_service");

  if (!document) {
    return null;
  }

  return <LegalDocumentPage document={document} icon={FileText} title="이용약관" />;
}

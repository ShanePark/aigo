import type { Metadata } from "next";
import { LocateFixed } from "lucide-react";

import { LegalDocumentPage } from "@/app/legal-document-page";
import { consentDocumentByType } from "@/lib/consent-documents";

export const metadata: Metadata = {
  title: "위치기반서비스 이용약관 | AiGo",
  description: "AiGo 위치기반서비스 이용약관"
};

export default function LocationTermsPage() {
  const document = consentDocumentByType("location_terms");

  if (!document) {
    return null;
  }

  return <LegalDocumentPage document={document} icon={LocateFixed} />;
}

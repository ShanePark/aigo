import type { Metadata } from "next";
import { LocateFixed } from "lucide-react";

import { LegalDocumentPage } from "@/app/legal-document-page";
import { loadPublicConsentDocument } from "@/lib/consent-document-store";

export const metadata: Metadata = {
  title: "위치기반서비스 이용약관 | AiGo",
  description: "AiGo 위치기반서비스 이용약관"
};

export default async function LocationTermsPage() {
  const document = await loadPublicConsentDocument("location_terms");

  if (!document) {
    return null;
  }

  return <LegalDocumentPage document={document} icon={LocateFixed} />;
}

import type { LucideIcon } from "lucide-react";

import { AppPageHeader } from "@/app/page-shell";
import type { ConsentDocument, ConsentDocumentSection } from "@/lib/consent-documents";

type LegalDocumentPageProps = {
  document: ConsentDocument;
  icon: LucideIcon;
  title?: string;
};

export function LegalDocumentPage({ document, icon, title }: LegalDocumentPageProps) {
  return (
    <div className="page app-page legal-page">
      <AppPageHeader eyebrow={`시행일 ${document.effectiveDateLabel}`} icon={icon} title={title ?? document.documentTitle} />

      {document.sections.map((section) => (
        <LegalSection key={section.id} section={section} />
      ))}
    </div>
  );
}

function LegalSection({ section }: { section: ConsentDocumentSection }) {
  const labelledBy = section.title ? section.id : undefined;

  return (
    <section className="legal-section" aria-labelledby={labelledBy}>
      {section.title ? <h2 id={section.id}>{section.title}</h2> : null}
      {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      {section.table ? (
        <div className="legal-table" role="table" aria-label={section.title}>
          {section.table.map((row) => (
            <div key={row.label} role="row">
              <strong role="cell">{row.label}</strong>
              <span role="cell">{row.value}</span>
            </div>
          ))}
        </div>
      ) : null}
      {section.items ? (
        <ul>
          {section.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type AppPageHeaderProps = {
  actions?: ReactNode;
  eyebrow?: ReactNode;
  icon: LucideIcon;
  title: string;
};

type AppPagePillsProps = {
  ariaLabel: string;
  children: ReactNode;
};

type AppPagePillProps = {
  children: ReactNode;
  tone?: "neutral" | "mint" | "blue" | "coral" | "yellow";
};

export function AppPageHeader({ actions, eyebrow, icon: Icon, title }: AppPageHeaderProps) {
  return (
    <header className="app-page-header">
      <div className="app-page-title">
        <span className="app-page-icon">
          <Icon size={18} aria-hidden="true" />
        </span>
        <div>
          {eyebrow ? <span className="app-page-eyebrow">{eyebrow}</span> : null}
          <h1>{title}</h1>
        </div>
      </div>
      {actions ? <div className="app-page-actions">{actions}</div> : null}
    </header>
  );
}

export function AppPagePills({ ariaLabel, children }: AppPagePillsProps) {
  return (
    <div className="app-page-pills" aria-label={ariaLabel}>
      {children}
    </div>
  );
}

export function AppPagePill({ children, tone = "neutral" }: AppPagePillProps) {
  return <span className={`app-page-pill is-${tone}`}>{children}</span>;
}

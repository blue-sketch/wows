import type { PropsWithChildren, ReactNode } from 'react';

interface MarketPanelProps extends PropsWithChildren {
  eyebrow: string;
  title: string;
  aside?: ReactNode;
  className?: string;
}

export const MarketPanel = ({
  eyebrow,
  title,
  aside,
  className,
  children,
}: MarketPanelProps) => (
  <section className={`market-panel ${className ?? ''}`.trim()}>
    <header className="market-panel__header">
      <div>
        <p className="market-panel__eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {aside ? <div className="market-panel__aside">{aside}</div> : null}
    </header>
    <div className="market-panel__body">{children}</div>
  </section>
);

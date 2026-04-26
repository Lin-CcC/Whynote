import type { ReactNode } from 'react';

type AppLayoutProps = {
  leftPanel: ReactNode;
  mainPanel: ReactNode;
  rightPanel: ReactNode;
};

export default function AppLayout({
  leftPanel,
  mainPanel,
  rightPanel,
}: AppLayoutProps) {
  return (
    <div className="app-shell">
      <header aria-label="Whynote" className="app-header">
        <div>
          <p className="app-eyebrow">个人 Web MVP · 工程壳层</p>
          <h1 className="app-title">Whynote</h1>
        </div>
      </header>
      <div className="app-grid">
        <aside className="app-panel app-panel-left">{leftPanel}</aside>
        <main className="app-panel app-panel-main">{mainPanel}</main>
        <aside className="app-panel app-panel-right">{rightPanel}</aside>
      </div>
    </div>
  );
}

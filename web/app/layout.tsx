import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Award Radar — web design trend tracker',
  description:
    'Daily-scraped web design award winners, analyzed for fonts, tech stack, color, and vibe.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="container inner">
            <a href="/" className="brand">
              <span className="dot" />
              Award Radar
            </a>
            <nav className="nav">
              <a href="/">Feed</a>
              <a href="/analytics">Analytics</a>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="footer">
          <div className="container">
            Award Radar · scraped daily, analyzed with Playwright + Claude · data
            is a single SQLite file in the repo.
          </div>
        </footer>
      </body>
    </html>
  );
}

import "./globals.css";

export const metadata = {
  title: "Be Tech Secure — Security Reporter",
  description: "Passive external security reports.",
};

const BRAND = process.env.BRAND_NAME ?? "Be Tech Secure";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        <header className="topbar">
          <div className="topbar-inner">
            <a className="brandmark" href="/admin">
              <span className="mark" />
              {BRAND}
            </a>
            <nav className="nav">
              <a href="/admin">Queue</a>
              <a href="/admin/new">New report</a>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}

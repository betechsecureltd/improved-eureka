import "./globals.css";
import TopNav from "./_components/TopNav";

export const metadata = {
  title: "Be Tech Secure — Security Reporter",
  description: "Passive external security reports.",
};

const BRAND = process.env.BRAND_NAME ?? "Be Tech Secure";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        <TopNav brand={BRAND} />
        {children}
      </body>
    </html>
  );
}

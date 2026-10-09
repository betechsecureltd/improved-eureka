"use client";

import { usePathname, useRouter } from "next/navigation";

export default function TopNav({ brand }: { brand: string }) {
  const pathname = usePathname();
  const router = useRouter();

  // Hide the nav on the login screen.
  if (pathname === "/login") return null;

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const isAdmin = pathname.startsWith("/admin");

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a className="brandmark" href="/admin">
          <span className="mark" />
          {brand}
        </a>
        {isAdmin && (
          <nav className="nav">
            <a href="/admin" className={pathname === "/admin" ? "active" : ""}>Dashboard</a>
            <a href="/admin/new" className={pathname === "/admin/new" ? "active" : ""}>New report</a>
            <button className="linkbtn" onClick={signOut}>Sign out</button>
          </nav>
        )}
      </div>
    </header>
  );
}

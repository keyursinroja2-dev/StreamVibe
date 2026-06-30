import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import { useState, useEffect, useRef } from "react";

// Pages where sidebar/bottom nav should be hidden (auth pages, watch page on mobile)
const MINIMAL_PAGES = ["/login", "/register", "/forgot-password"];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const isMinimal = MINIMAL_PAGES.some((p) => location.pathname.startsWith(p));

  // Auto-close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Restore scroll position when returning to the same route
  const mainRef = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef<Record<string, number>>({});

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    // Save scroll on leave, restore on enter
    const key = location.pathname + location.search;
    const savedPos = scrollPositions.current[key] ?? 0;
    el.scrollTop = savedPos;
    return () => {
      scrollPositions.current[key] = el.scrollTop;
    };
  }, [location.pathname, location.search]);

  if (isMinimal) {
    return (
      <div className="flex h-full bg-background overflow-hidden">
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <main className="flex-1 overflow-y-auto scrollbar-thin scroll-gpu">
            <Outlet />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-background overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Navbar onMenuClick={() => setSidebarOpen((p) => !p)} />
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto scrollbar-thin pb-16 sm:pb-0 scroll-gpu"
        >
          <Outlet />
        </main>
      </div>
      {/* Mobile bottom navigation */}
      <BottomNav />
    </div>
  );
}

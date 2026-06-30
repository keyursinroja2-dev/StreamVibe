import { Link, useNavigate } from "react-router-dom";
import { Search, Bell, Upload, Menu, LogIn, User, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { getAvatarUrl } from "@/lib/utils";
import { toast } from "sonner";

interface NavbarProps {
  onMenuClick: () => void;
}

export default function Navbar({ onMenuClick }: NavbarProps) {
  const { user, logout, isGuest } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [unread, setUnread] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("notifications")
      .select("id", { count: "exact" })
      .eq("user_id", user.id)
      .eq("is_read", false)
      .then(({ count }) => setUnread(count || 0));
  }, [user]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setSearchOpen(false);
    }
  }

  async function handleLogout() {
    await logout();
    toast.success("Signed out");
    navigate("/login");
  }

  const avatarSrc = user?.avatar_url || getAvatarUrl(user?.username || "guest");

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
      {/* Mobile search overlay */}
      {searchOpen && (
        <div className="absolute inset-0 z-50 flex items-center gap-2 px-3 bg-background/98 sm:hidden">
          <form onSubmit={handleSearch} className="flex-1">
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search videos, channels..."
              className="w-full bg-surface border border-border rounded-full pl-4 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </form>
          <button
            onClick={() => setSearchOpen(false)}
            className="p-2 rounded-lg hover:bg-surface transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-4 h-14">
        {/* Menu button - hidden on mobile (uses bottom nav) */}
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg hover:bg-surface transition-colors hidden sm:flex"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/30">
            <span className="text-white font-display font-bold text-sm">SV</span>
          </div>
          <span className="font-display font-bold text-lg hidden sm:block">StreamVibe</span>
        </Link>

        {/* Desktop search */}
        <form onSubmit={handleSearch} className="flex-1 max-w-xl mx-auto hidden sm:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search videos, channels..."
              className="w-full bg-surface border border-border rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            />
          </div>
        </form>

        <div className="flex-1 sm:hidden" />

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Mobile search button */}
          <button
            onClick={() => setSearchOpen(true)}
            className="p-2 rounded-lg hover:bg-surface transition-colors sm:hidden"
          >
            <Search className="w-5 h-5" />
          </button>

          {user ? (
            <>
              {/* Upload - desktop only (mobile uses bottom nav) */}
              <Link
                to="/upload"
                className="hidden sm:flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span>Upload</span>
              </Link>

              {/* Notifications */}
              <Link to="/notifications" className="relative p-2 rounded-lg hover:bg-surface transition-colors">
                <Bell className="w-5 h-5" />
                {unread > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>

              {/* Avatar dropdown */}
              <div className="relative" ref={dropRef}>
                <button
                  onClick={() => setDropdownOpen((p) => !p)}
                  className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-transparent hover:ring-primary transition-all"
                >
                  <img src={avatarSrc} alt={user.username} className="w-full h-full object-cover" />
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 top-10 w-52 bg-popover border border-border rounded-xl shadow-2xl py-1 z-50 animate-fade-in">
                    <div className="px-4 py-3 border-b border-border">
                      <p className="font-semibold text-sm">{user.username}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <Link to="/profile" onClick={() => setDropdownOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-surface transition-colors">
                      <User className="w-4 h-4" /> Profile & Channel
                    </Link>
                    <Link to="/settings" onClick={() => setDropdownOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-surface transition-colors">
                      Settings
                    </Link>
                    {user.is_admin && (
                      <Link to="/admin" onClick={() => setDropdownOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-surface transition-colors text-primary font-medium">
                        Admin Panel
                      </Link>
                    )}
                    <div className="border-t border-border mt-1 pt-1">
                      <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-surface transition-colors text-destructive">
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-2 px-3 sm:px-4 py-2 border border-primary text-primary rounded-lg text-sm font-medium hover:bg-primary hover:text-white transition-colors"
            >
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">Sign in</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

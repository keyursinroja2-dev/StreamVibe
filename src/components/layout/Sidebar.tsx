import { NavLink } from "react-router-dom";
import {
  Home, Compass, Clock, ThumbsUp, Bookmark, Radio,
  Bell, Settings, Shield, Upload, Library, X
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const mainLinks = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/subscriptions", icon: Radio, label: "Subscriptions", authRequired: true },
];

const libraryLinks = [
  { to: "/library?tab=history", icon: Clock, label: "History", authRequired: true },
  { to: "/library?tab=saved", icon: Bookmark, label: "Saved", authRequired: true },
  { to: "/library?tab=liked", icon: ThumbsUp, label: "Liked", authRequired: true },
  { to: "/library?tab=uploads", icon: Upload, label: "Your Videos", authRequired: true },
  { to: "/library", icon: Library, label: "Library", authRequired: true },
];

const moreLinks = [
  { to: "/notifications", icon: Bell, label: "Notifications", authRequired: true },
  { to: "/settings", icon: Settings, label: "Settings" },
];

function SideLink({ to, icon: Icon, label, onClick }: { to: string; icon: React.ElementType; label: string; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
          isActive
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:bg-surface hover:text-foreground"
        )
      }
    >
      <Icon className="w-5 h-5 shrink-0" />
      <span>{label}</span>
    </NavLink>
  );
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { user } = useAuth();

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed lg:relative z-40 flex flex-col h-full bg-background border-r border-border transition-all duration-300 overflow-hidden shrink-0",
          open ? "w-60" : "w-0 lg:w-16"
        )}
      >
        {/* Mobile close */}
        <div className="flex items-center justify-between px-4 h-14 lg:hidden shrink-0">
          <span className="font-display font-bold">Menu</span>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-hide py-2 px-2">
          <div className="space-y-1">
            {mainLinks.map((l) => {
              if (l.authRequired && !user) return null;
              return (
                <SideLink key={l.to} to={l.to} icon={l.icon} label={l.label} onClick={onClose} />
              );
            })}
          </div>

          {user && (
            <>
              <div className={cn("my-3 border-t border-border", !open && "hidden lg:block")} />
              <p className={cn("px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider", !open && "hidden")}>
                Library
              </p>
              <div className="space-y-1 mt-1">
                {libraryLinks.map((l) => (
                  <SideLink key={l.to} to={l.to} icon={l.icon} label={l.label} onClick={onClose} />
                ))}
              </div>
            </>
          )}

          <div className={cn("my-3 border-t border-border")} />
          <div className="space-y-1">
            {moreLinks.map((l) => {
              if (l.authRequired && !user) return null;
              return (
                <SideLink key={l.to} to={l.to} icon={l.icon} label={l.label} onClick={onClose} />
              );
            })}
            {user?.is_admin && (
              <SideLink to="/admin" icon={Shield} label="Admin Panel" onClick={onClose} />
            )}
          </div>
        </nav>

        <div className={cn("px-3 py-3 border-t border-border text-xs text-muted-foreground", !open && "hidden")}>
          © 2025 StreamVibe
        </div>
      </aside>
    </>
  );
}

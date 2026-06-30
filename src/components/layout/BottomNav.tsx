import { NavLink, useNavigate } from "react-router-dom";
import { Home, Search, Upload, Library, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/search", icon: Search, label: "Search" },
  { to: "/upload", icon: Upload, label: "Upload", special: true },
  { to: "/library", icon: Library, label: "Library", authRequired: true },
  { to: "/profile", icon: User, label: "Profile" },
];

export default function BottomNav() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-background/95 backdrop-blur-lg border-t border-border safe-area-pb">
      <div className="flex items-center justify-around px-2 h-16">
        {navItems.map(({ to, icon: Icon, label, special, authRequired }) => {
          if (authRequired && !user) return null;

          if (special) {
            return (
              <button
                key={to}
                onClick={() => navigate(to)}
                className="flex flex-col items-center justify-center gap-0.5 min-w-[60px]"
              >
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30">
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </button>
            );
          }

          return (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn("w-5 h-5", isActive && "fill-primary stroke-primary")} />
                  <span className="text-[10px] font-medium">{label}</span>
                </>
              )}
            </NavLink>
          );
        })}

        {!user && (
          <NavLink
            to="/login"
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )
            }
          >
            {({ isActive }) => (
              <>
                <User className={cn("w-5 h-5", isActive && "text-primary")} />
                <span className="text-[10px] font-medium">Sign In</span>
              </>
            )}
          </NavLink>
        )}
      </div>
    </nav>
  );
}

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useNavigate } from "react-router-dom";
import { Sun, Moon, Bell, Shield, LogOut, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Settings() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    toast.success("Signed out");
    navigate("/login");
  }

  const SettingRow = ({
    icon: Icon,
    label,
    description,
    action,
    danger = false,
  }: {
    icon: React.ElementType;
    label: string;
    description?: string;
    action: React.ReactNode;
    danger?: boolean;
  }) => (
    <div className={cn("flex items-center justify-between p-4 bg-surface rounded-xl", danger && "bg-destructive/10")}>
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-lg bg-surface-2", danger && "bg-destructive/20")}>
          <Icon className={cn("w-4 h-4", danger ? "text-destructive" : "text-muted-foreground")} />
        </div>
        <div>
          <p className={cn("text-sm font-medium", danger && "text-destructive")}>{label}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="font-display font-bold text-2xl mb-6">Settings</h1>

      <div className="space-y-6">
        {/* Appearance */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Appearance</h2>
          <SettingRow
            icon={theme === "dark" ? Moon : Sun}
            label="Theme"
            description={theme === "dark" ? "Dark mode is on" : "Light mode is on"}
            action={
              <button
                onClick={toggleTheme}
                className={cn("relative w-12 h-6 rounded-full transition-colors", theme === "dark" ? "bg-primary" : "bg-surface-2")}
              >
                <div className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-transform", theme === "dark" ? "left-7" : "left-1")} />
              </button>
            }
          />
        </section>

        {/* Notifications */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Notifications</h2>
          <div className="space-y-2">
            <SettingRow
              icon={Bell}
              label="Push Notifications"
              description="Get notified about new uploads and comments"
              action={
                <button className="text-xs text-primary hover:underline flex items-center gap-1">
                  Manage <ChevronRight className="w-3 h-3" />
                </button>
              }
            />
          </div>
        </section>

        {/* Privacy */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Privacy</h2>
          <SettingRow
            icon={Shield}
            label="Privacy Settings"
            description="Control who can see your activity"
            action={
              <button className="text-xs text-primary hover:underline flex items-center gap-1">
                Manage <ChevronRight className="w-3 h-3" />
              </button>
            }
          />
        </section>

        {/* Account */}
        {user && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Account</h2>
            <div className="space-y-2">
              <div className="p-4 bg-surface rounded-xl">
                <p className="text-sm font-medium">{user.username}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <SettingRow
                icon={LogOut}
                label="Sign Out"
                description="Sign out of your account"
                action={
                  <button onClick={handleLogout} className="text-sm text-destructive font-medium hover:underline">
                    Sign Out
                  </button>
                }
                danger
              />
            </div>
          </section>
        )}

        <p className="text-xs text-muted-foreground text-center">StreamVibe v1.0 · © 2025</p>
      </div>
    </div>
  );
}

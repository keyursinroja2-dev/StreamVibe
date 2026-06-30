import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff, Mail, User, Lock } from "lucide-react";
import { toast } from "sonner";
import { FunctionsHttpError } from "@supabase/supabase-js";

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    const trimmedEmail = email.trim();
    const trimmedUsername = username.trim();

    if (!trimmedEmail || !trimmedUsername || !password) {
      toast.error("Please fill in all fields");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (trimmedUsername.length < 3) {
      toast.error("Username must be at least 3 characters");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    // Step 1: Create pre-confirmed user via edge function (no email verification needed)
    const { data: fnData, error: fnError } = await supabase.functions.invoke("register-user", {
      body: { email: trimmedEmail, password, username: trimmedUsername },
    });

    if (fnError) {
      let msg = fnError.message;
      if (fnError instanceof FunctionsHttpError) {
        try {
          const text = await fnError.context?.text();
          const parsed = text ? JSON.parse(text) : null;
          msg = parsed?.error || text || msg;
        } catch {
          // use default msg
        }
      }
      toast.error(msg);
      setLoading(false);
      return;
    }

    if (!fnData?.success) {
      toast.error(fnData?.error || "Registration failed");
      setLoading(false);
      return;
    }

    // Step 2: Sign in with the newly created (pre-confirmed) account
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (signInError) {
      toast.error("Account created but sign-in failed: " + signInError.message);
      setLoading(false);
      navigate("/login");
      return;
    }

    if (!signInData.user) {
      toast.error("Sign-in failed. Please try signing in manually.");
      setLoading(false);
      navigate("/login");
      return;
    }

    // Step 3: Fetch profile and set auth state
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", signInData.user.id)
      .maybeSingle();

    login({
      id: signInData.user.id,
      email: signInData.user.email!,
      username: profile?.username || trimmedUsername,
      avatar_url: profile?.avatar_url || null,
      is_admin: profile?.is_admin || false,
    });

    toast.success(`Welcome to StreamVibe, ${trimmedUsername}!`);
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-white font-display font-bold">SV</span>
            </div>
            <span className="font-display font-bold text-2xl">StreamVibe</span>
          </Link>
          <h1 className="font-display font-bold text-2xl">Create your account</h1>
          <p className="text-muted-foreground mt-1">Join StreamVibe — no email verification required</p>
        </div>

        {/* Form */}
        <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))}
                placeholder="coolcreator (letters, numbers, _ .)"
                autoComplete="username"
                className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                autoComplete="new-password"
                className="w-full bg-background border border-border rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
                onKeyDown={(e) => e.key === "Enter" && handleRegister()}
              />
              <button
                type="button"
                onClick={() => setShowPass((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {password && password.length < 8 && (
              <p className="text-xs text-destructive mt-1">Password is too short ({password.length}/8)</p>
            )}
          </div>

          <button
            onClick={handleRegister}
            disabled={loading}
            className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors mt-2"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

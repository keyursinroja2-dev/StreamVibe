import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Camera, CheckCircle2, Loader2, Tv2, AtSign, AlignLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Helpers ──────────────────────────────────────────────────────────────────
function getInitialsAvatar(name: string) {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=e53935&textColor=ffffff`;
}

export default function CreateChannel() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [channelName, setChannelName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // Redirect if not logged in or already has a channel
  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    supabase
      .from("channels")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) navigate("/profile?tab=channel", { replace: true });
      });
  }, [user]);

  // Live name validation
  function handleNameChange(v: string) {
    setChannelName(v);
    if (!v.trim()) setNameError("Channel name is required");
    else if (v.trim().length < 2) setNameError("At least 2 characters required");
    else if (v.trim().length > 100) setNameError("Maximum 100 characters");
    else setNameError("");
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Please select an image"); return; }
    setAvatarFile(f);
    setAvatarPreview(URL.createObjectURL(f));
  }

  function handleBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Please select an image"); return; }
    setBannerFile(f);
    setBannerPreview(URL.createObjectURL(f));
  }

  async function handleCreate() {
    if (!channelName.trim() || nameError || !user) return;
    setSaving(true);

    let avatarUrl: string | null = null;
    let bannerUrl: string | null = null;

    // Upload avatar
    if (avatarFile) {
      const ext = avatarFile.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, avatarFile, { upsert: true });
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
        avatarUrl = publicUrl;
      }
    }

    // Upload banner
    if (bannerFile) {
      const ext = bannerFile.name.split(".").pop();
      const path = `${user.id}/banner.${ext}`;
      const { error } = await supabase.storage.from("channel-banners").upload(path, bannerFile, { upsert: true });
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from("channel-banners").getPublicUrl(path);
        bannerUrl = publicUrl;
      }
    }

    const { data, error } = await supabase
      .from("channels")
      .insert({
        user_id: user.id,
        name: channelName.trim(),
        description: description.trim(),
        banner_url: bannerUrl,
      })
      .select("id")
      .single();

    setSaving(false);

    if (error) {
      if (error.code === "23505") toast.error("You already have a channel.");
      else toast.error("Failed to create channel: " + error.message);
      return;
    }

    // Update profile avatar if provided
    if (avatarUrl) {
      await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("user_id", user.id);
    }

    setDone(true);
    setTimeout(() => navigate(`/channel/${data.id}`), 2000);
  }

  const canSubmit = channelName.trim().length >= 2 && !nameError && !saving && !done;
  const previewAvatar = avatarPreview || getInitialsAvatar(channelName || "C");

  // ── Success screen ────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-5 p-6">
        <div
          className="w-24 h-24 rounded-full bg-green-500/15 flex items-center justify-center"
          style={{ animation: "scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}
        >
          <CheckCircle2 className="w-12 h-12 text-green-500" />
        </div>
        <div className="text-center">
          <h2 className="font-display font-bold text-2xl mb-1">Channel Created!</h2>
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground">{channelName}</span> is ready.
          </p>
          <p className="text-sm text-muted-foreground mt-1">Redirecting to your channel…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 sm:pb-10">
      {/* ── Banner area ─────────────────────────────────────────────────── */}
      <div
        className="relative h-44 sm:h-56 cursor-pointer overflow-hidden bg-gradient-to-br from-primary/20 via-primary/10 to-surface group"
        onClick={() => bannerInputRef.current?.click()}
      >
        {bannerPreview ? (
          <img src={bannerPreview} alt="Banner" className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Camera className="w-7 h-7 opacity-50" />
            <span className="text-sm opacity-50">Add channel banner</span>
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <span className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 px-4 py-2 rounded-full">
            {bannerPreview ? "Change banner" : "Add banner"}
          </span>
        </div>
        <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerChange} />
      </div>

      {/* ── Main card ───────────────────────────────────────────────────── */}
      <div className="max-w-xl mx-auto px-4 sm:px-6">
        {/* Avatar — overlaps banner */}
        <div className="flex items-end gap-4 -mt-10 mb-6">
          <div className="relative shrink-0">
            <div
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden ring-4 ring-background cursor-pointer group/avatar"
              onClick={() => avatarInputRef.current?.click()}
            >
              <img
                src={previewAvatar}
                alt="Channel avatar"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover/avatar:bg-black/50 transition-colors rounded-full flex items-center justify-center">
                <Camera className="w-5 h-5 text-white opacity-0 group-hover/avatar:opacity-100 transition-opacity" />
              </div>
            </div>
            {/* Edit badge */}
            <button
              onClick={() => avatarInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-7 h-7 bg-primary rounded-full flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors ring-2 ring-background"
            >
              <Camera className="w-3.5 h-3.5 text-white" />
            </button>
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>

          <div className="pb-1">
            <h1 className="font-display font-bold text-xl sm:text-2xl leading-tight">
              {channelName.trim() || "Your Channel"}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">0 subscribers</p>
          </div>
        </div>

        {/* ── Form ──────────────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Channel Name */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-sm font-semibold">
              <Tv2 className="w-4 h-4 text-primary" />
              Channel Name
              <span className="text-destructive ml-0.5">*</span>
            </label>
            <div className="relative">
              <input
                value={channelName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. My Awesome Channel"
                maxLength={100}
                className={cn(
                  "w-full bg-surface border rounded-xl px-4 py-3 text-sm pr-16",
                  "focus:outline-none focus:ring-2 transition-all placeholder:text-muted-foreground/50",
                  nameError
                    ? "border-destructive focus:ring-destructive/40"
                    : channelName.trim().length >= 2
                    ? "border-green-500/60 focus:ring-green-500/30"
                    : "border-border focus:ring-primary/40"
                )}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {channelName.trim().length >= 2 && !nameError && (
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                )}
                <span className="text-xs text-muted-foreground tabular-nums">
                  {channelName.length}/100
                </span>
              </div>
            </div>
            {nameError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <span className="w-3.5 h-3.5 rounded-full border border-destructive inline-flex items-center justify-center text-[10px] shrink-0">!</span>
                {nameError}
              </p>
            )}
            {!nameError && channelName.trim().length >= 2 && (
              <p className="text-xs text-green-500">Looks good!</p>
            )}
          </div>

          {/* Channel Handle (display only, derived from name) */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-sm font-semibold">
              <AtSign className="w-4 h-4 text-primary" />
              Channel Handle
              <span className="text-muted-foreground text-xs font-normal ml-1">(auto-generated)</span>
            </label>
            <div className="relative">
              <div className="w-full bg-surface/50 border border-border rounded-xl px-4 py-3 text-sm text-muted-foreground flex items-center gap-0">
                <span className="text-muted-foreground/60">@</span>
                <span className="ml-0.5">
                  {channelName.trim()
                    ? channelName.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 30)
                    : "your_channel"}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">This is how others will find your channel</p>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-sm font-semibold">
              <AlignLeft className="w-4 h-4 text-primary" />
              Description
              <span className="text-muted-foreground text-xs font-normal ml-1">(optional)</span>
            </label>
            <div className="relative">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell viewers what your channel is about…"
                rows={4}
                maxLength={500}
                className={cn(
                  "w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all",
                  "resize-none placeholder:text-muted-foreground/50"
                )}
              />
              <span className="absolute bottom-2.5 right-3 text-xs text-muted-foreground tabular-nums">
                {description.length}/500
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Info chips */}
          <div className="flex flex-wrap gap-2">
            {[
              "Upload videos",
              "Build subscribers",
              "Engage with your community",
            ].map((item) => (
              <span
                key={item}
                className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-medium"
              >
                ✓ {item}
              </span>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={handleCreate}
            disabled={!canSubmit}
            className={cn(
              "w-full py-3.5 rounded-xl font-bold text-white text-base transition-all duration-200",
              "flex items-center justify-center gap-2",
              canSubmit
                ? "bg-primary hover:bg-primary/90 active:scale-[0.98] shadow-lg shadow-primary/20"
                : "bg-primary/30 cursor-not-allowed"
            )}
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating your channel…
              </>
            ) : (
              <>
                <Tv2 className="w-5 h-5" />
                Create Channel
              </>
            )}
          </button>

          <p className="text-center text-xs text-muted-foreground pb-2">
            You can edit your channel details anytime from your profile settings.
          </p>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { getAvatarUrl } from "@/lib/utils";
import { Camera, Save, Plus } from "lucide-react";
import { toast } from "sonner";
import type { Channel } from "@/types";

export default function Profile() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [channelName, setChannelName] = useState("");
  const [channelDesc, setChannelDesc] = useState("");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [savingChannel, setSavingChannel] = useState(false);
  const [tab, setTab] = useState<"profile" | "channel">("profile");

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    loadProfile();
    loadChannel();
  }, [user]);

  async function loadProfile() {
    const { data } = await supabase.from("profiles").select("*").eq("user_id", user!.id).maybeSingle();
    if (data) {
      setUsername(data.username);
      setBio(data.bio || "");
      setAvatarPreview(data.avatar_url);
    } else {
      setUsername(user!.username);
    }
  }

  async function loadChannel() {
    const { data } = await supabase.from("channels").select("*").eq("user_id", user!.id).maybeSingle();
    if (data) {
      setChannel(data);
      setChannelName(data.name);
      setChannelDesc(data.description || "");
      setBannerPreview(data.banner_url);
    }
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setAvatarFile(f);
    setAvatarPreview(URL.createObjectURL(f));
  }

  function handleBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBannerFile(f);
    setBannerPreview(URL.createObjectURL(f));
  }

  async function saveProfile() {
    if (!user) return;
    setSaving(true);
    let avatarUrl = avatarPreview;

    if (avatarFile) {
      const ext = avatarFile.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      await supabase.storage.from("avatars").upload(path, avatarFile, { upsert: true });
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      avatarUrl = publicUrl;
    }

    const profileData = { username: username.trim(), bio: bio.trim(), avatar_url: avatarUrl, user_id: user.id };
    const { error } = await supabase.from("profiles").upsert(profileData, { onConflict: "user_id" });
    if (error) toast.error(error.message);
    else { toast.success("Profile saved!"); await refreshProfile(); }
    setSaving(false);
  }

  async function saveChannel() {
    if (!user) return;
    if (!channelName.trim()) { toast.error("Channel name required"); return; }
    setSavingChannel(true);

    let bannerUrl = bannerPreview;
    if (bannerFile) {
      const ext = bannerFile.name.split(".").pop();
      const path = `${user.id}/banner.${ext}`;
      await supabase.storage.from("channel-banners").upload(path, bannerFile, { upsert: true });
      const { data: { publicUrl } } = supabase.storage.from("channel-banners").getPublicUrl(path);
      bannerUrl = publicUrl;
    }

    const channelData = { name: channelName.trim(), description: channelDesc.trim(), banner_url: bannerUrl, user_id: user.id };

    if (channel) {
      await supabase.from("channels").update(channelData).eq("id", channel.id);
      toast.success("Channel updated!");
    } else {
      const { data } = await supabase.from("channels").insert(channelData).select().single();
      setChannel(data);
      toast.success("Channel created!");
    }
    setSavingChannel(false);
  }

  const avatar = avatarPreview || getAvatarUrl(username || "user");

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="font-display font-bold text-2xl mb-6">Account Settings</h1>

      <div className="flex gap-2 mb-6">
        {(["profile", "channel"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${tab === t ? "bg-primary text-white" : "bg-surface text-muted-foreground hover:text-foreground"}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "profile" ? (
        <div className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <img src={avatar} alt="" className="w-20 h-20 rounded-full object-cover" />
              <button onClick={() => avatarRef.current?.click()} className="absolute bottom-0 right-0 p-1.5 bg-primary rounded-full text-white hover:bg-primary/90 transition-colors">
                <Camera className="w-3.5 h-3.5" />
              </button>
              <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            <div>
              <p className="font-medium">{username || "Your Name"}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Bio</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Tell us about yourself..." className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
          </div>

          <button onClick={saveProfile} disabled={saving} className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
            <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Banner */}
          <div>
            <label className="block text-sm font-medium mb-2">Channel Banner</label>
            <div className="relative h-32 bg-gradient-to-r from-primary/30 to-primary/10 rounded-xl overflow-hidden cursor-pointer" onClick={() => bannerRef.current?.click()}>
              {bannerPreview && <img src={bannerPreview} alt="" className="w-full h-full object-cover" />}
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors">
                <Camera className="w-6 h-6 text-white" />
              </div>
              <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={handleBannerChange} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Channel Name <span className="text-destructive">*</span></label>
            <input value={channelName} onChange={(e) => setChannelName(e.target.value)} placeholder="My Awesome Channel" className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Channel Description</label>
            <textarea value={channelDesc} onChange={(e) => setChannelDesc(e.target.value)} rows={3} placeholder="Describe your channel..." className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
          </div>

          <button onClick={saveChannel} disabled={savingChannel} className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
            <Plus className="w-4 h-4" /> {savingChannel ? "Saving..." : channel ? "Update Channel" : "Create Channel"}
          </button>
        </div>
      )}
    </div>
  );
}

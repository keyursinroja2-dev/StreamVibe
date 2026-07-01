import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Upload as UploadIcon, Image, X, CheckCircle, Loader2, Film } from "lucide-react";
import { toast } from "sonner";
import type { Category } from "@/types";
import { cn } from "@/lib/utils";

// Extract a video thumbnail from a File at a given timestamp
async function extractThumbnail(file: File, seekTo = 1): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    video.src = url;

    video.onloadeddata = () => {
      video.currentTime = Math.min(seekTo, video.duration * 0.1);
    };

    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); resolve(null); return; }
      ctx.drawImage(video, 0, 0);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          resolve(blob);
        },
        "image/jpeg",
        0.88
      );
    };

    video.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    video.load();
  });
}

// Extract duration from a video File
function extractVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    const url = URL.createObjectURL(file);
    video.src = url;
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Math.round(video.duration) || 0);
    };
    video.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
  });
}

export default function Upload() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [channelLoading, setChannelLoading] = useState(true);
  const [videoDuration, setVideoDuration] = useState(0);

  const [stage, setStage] = useState<"idle" | "extracting" | "uploading" | "processing" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState("");
  const [timeRemaining, setTimeRemaining] = useState("");

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    supabase.from("categories").select("*").order("name").then(({ data }) => {
      if (data) setCategories(data);
    });
    checkChannel();
  }, [user]);

  async function checkChannel() {
    if (!user) return;
    setChannelLoading(true);
    const { data: existing } = await supabase
      .from("channels").select("id").eq("user_id", user.id).maybeSingle();
    if (existing) {
      setChannelId(existing.id);
    } else {
      // No channel — redirect to create one first
      navigate("/create-channel");
    }
    setChannelLoading(false);
  }

  async function handleVideoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("video/")) { toast.error("Please select a video file"); return; }
    setVideoFile(f);
    setVideoPreview(URL.createObjectURL(f));
    if (!title) setTitle(f.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "));
    // Extract duration in background
    extractVideoDuration(f).then(setVideoDuration);
  }

  function handleThumbChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Please select an image"); return; }
    setThumbFile(f);
    setThumbPreview(URL.createObjectURL(f));
  }

  const handleUpload = useCallback(async () => {
    if (!videoFile || !title.trim() || !user || !channelId) {
      toast.error("Please add a video and title");
      return;
    }

    // Step 1: Extract thumbnail if not provided
    setStage("extracting");
    setProgress(0);

    let finalThumbBlob: Blob | null = null;
    if (thumbFile) {
      finalThumbBlob = thumbFile;
    } else {
      finalThumbBlob = await extractThumbnail(videoFile, 2);
    }

    // Step 2: Upload video to Supabase Storage using XHR for progress
    setStage("uploading");
    setProgress(0);

    const videoExt = videoFile.name.split(".").pop() || "mp4";
    const videoPath = `${user.id}/${Date.now()}_video.${videoExt}`;
    const { data: { publicUrl: supabaseUrl } } = supabase.storage
      .from("videos")
      .getPublicUrl(videoPath);

    // Get the upload URL via Supabase storage API
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const accessToken = session?.access_token || "";

    let videoUrl = "";
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        let lastLoaded = 0;
        let lastTime = Date.now();

        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable) return;
          const pct = Math.round((e.loaded / e.total) * 100);
          setProgress(pct);

          const now = Date.now();
          const elapsed = (now - lastTime) / 1000;
          if (elapsed > 0.5) {
            const bps = (e.loaded - lastLoaded) / elapsed;
            const rem = e.total - e.loaded;
            const eta = bps > 0 ? rem / bps : 0;
            setUploadSpeed(
              bps > 1024 * 1024
                ? `${(bps / (1024 * 1024)).toFixed(1)} MB/s`
                : `${Math.round(bps / 1024)} KB/s`
            );
            setTimeRemaining(
              eta > 60
                ? `${Math.round(eta / 60)}m ${Math.round(eta % 60)}s left`
                : `${Math.round(eta)}s left`
            );
            lastLoaded = e.loaded;
            lastTime = now;
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.onabort = () => reject(new Error("Upload cancelled"));

        const supabaseStorageUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/videos/${videoPath}`;
        xhr.open("POST", supabaseStorageUrl);
        xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
        xhr.setRequestHeader("x-upsert", "false");
        xhr.setRequestHeader("Content-Type", videoFile.type || "video/mp4");
        xhr.send(videoFile);
      });
    } catch (err: any) {
      // Fallback: use supabase client upload (no progress)
      console.warn("XHR upload failed, falling back to supabase client:", err.message);
      setUploadSpeed("");
      setTimeRemaining("");
      const { error: uploadError } = await supabase.storage
        .from("videos")
        .upload(videoPath, videoFile, { upsert: false });
      if (uploadError) {
        toast.error("Video upload failed: " + uploadError.message);
        setStage("idle");
        return;
      }
    }

    setProgress(100);
    setUploadSpeed("");
    setTimeRemaining("");
    videoUrl = supabaseUrl;

    // Step 3: Upload thumbnail
    setStage("processing");
    let thumbnailUrl: string | null = null;

    if (finalThumbBlob) {
      const thumbPath = `${user.id}/${Date.now()}_thumb.jpg`;
      const { error: thumbErr } = await supabase.storage
        .from("thumbnails")
        .upload(thumbPath, finalThumbBlob, { contentType: "image/jpeg" });
      if (!thumbErr) {
        const { data: { publicUrl } } = supabase.storage
          .from("thumbnails").getPublicUrl(thumbPath);
        thumbnailUrl = publicUrl;
      }
    }

    // Step 4: Insert video record
    const { data: videoRecord, error: dbError } = await supabase
      .from("videos")
      .insert({
        user_id: user.id,
        channel_id: channelId,
        title: title.trim(),
        description: description.trim(),
        category_id: categoryId || null,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        duration: videoDuration || 0,
        status: "published",
        processing_status: "ready",
      })
      .select("id")
      .single();

    if (dbError) {
      toast.error("Failed to save video: " + dbError.message);
      setStage("idle");
      return;
    }

    setStage("done");
    setTimeout(() => navigate(`/watch/${videoRecord.id}`), 1800);
  }, [videoFile, thumbFile, title, description, categoryId, user, channelId, videoDuration]);

  function cancelUpload() {
    xhrRef.current?.abort();
    setStage("idle");
    setProgress(0);
    setUploadSpeed("");
    setTimeRemaining("");
  }

  if (channelLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (stage === "done") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="font-display font-bold text-2xl">Upload Complete!</h2>
        <p className="text-muted-foreground text-center">Your video is live and ready to watch.</p>
        <p className="text-muted-foreground text-sm">Redirecting to your video...</p>
      </div>
    );
  }

  const isUploading = stage === "uploading" || stage === "extracting" || stage === "processing";

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto pb-20 sm:pb-8">
      <h1 className="font-display font-bold text-2xl mb-6">Upload Video</h1>

      {/* Video drop zone */}
      {!videoFile ? (
        <div
          onClick={() => videoInputRef.current?.click()}
          className="border-2 border-dashed border-border rounded-2xl p-10 sm:p-14 text-center cursor-pointer hover:border-primary hover:bg-primary/5 active:bg-primary/10 transition-colors mb-6"
        >
          <UploadIcon className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold text-lg">Tap to select a video</p>
          <p className="text-sm text-muted-foreground mt-1">MP4, MOV, WebM — any size</p>
          <p className="text-xs text-muted-foreground/60 mt-2">
            Thumbnails are auto-generated if not provided
          </p>
          <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoChange} />
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden bg-black mb-6">
          <video src={videoPreview!} className="w-full max-h-56 object-contain" controls playsInline />
          {!isUploading && (
            <button
              onClick={() => { setVideoFile(null); setVideoPreview(null); setVideoDuration(0); }}
              className="absolute top-2 right-2 p-1.5 bg-black/70 rounded-full hover:bg-black/90 transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          )}
          {videoDuration > 0 && (
            <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/80 text-white text-xs px-2 py-1 rounded-lg">
              <Film className="w-3 h-3" />
              {Math.floor(videoDuration / 60)}:{String(videoDuration % 60).padStart(2, "0")}
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Title <span className="text-destructive">*</span>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter video title"
            maxLength={100}
            disabled={isUploading}
            className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60"
          />
          <p className="text-xs text-muted-foreground mt-1 text-right">{title.length}/100</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell viewers about your video..."
            rows={3}
            disabled={isUploading}
            className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none disabled:opacity-60"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={isUploading}
            className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60"
          >
            <option value="">Select a category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Thumbnail
            <span className="text-muted-foreground text-xs ml-1">(auto-generated if not provided)</span>
          </label>
          {thumbPreview ? (
            <div className="relative inline-block">
              <img src={thumbPreview} alt="Thumbnail" className="w-40 aspect-video object-cover rounded-xl" />
              {!isUploading && (
                <button
                  onClick={() => { setThumbFile(null); setThumbPreview(null); }}
                  className="absolute top-1 right-1 p-1 bg-black/70 rounded-full"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => thumbInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2 px-4 py-3 bg-surface border border-dashed border-border rounded-xl text-sm text-muted-foreground hover:text-foreground hover:border-primary disabled:opacity-60 transition-colors"
            >
              <Image className="w-4 h-4" /> Upload custom thumbnail
            </button>
          )}
          <input ref={thumbInputRef} type="file" accept="image/*" className="hidden" onChange={handleThumbChange} />
        </div>

        {/* Progress panel */}
        {isUploading && (
          <div className="p-5 bg-surface rounded-2xl border border-border space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse shrink-0" />
              <p className="text-sm font-semibold">
                {stage === "extracting" && "Preparing thumbnail..."}
                {stage === "uploading" && "Uploading video..."}
                {stage === "processing" && "Saving video..."}
              </p>
              {uploadSpeed && (
                <span className="ml-auto text-xs text-muted-foreground">{uploadSpeed}</span>
              )}
            </div>

            {stage === "uploading" && (
              <>
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Upload progress</span>
                    <div className="flex items-center gap-2">
                      {timeRemaining && (
                        <span className="text-muted-foreground">{timeRemaining}</span>
                      )}
                      <span className="font-semibold tabular-nums">{progress}%</span>
                    </div>
                  </div>
                  <div className="h-2.5 bg-surface-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-200"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                <button
                  onClick={cancelUpload}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  Cancel upload
                </button>
              </>
            )}

            {(stage === "extracting" || stage === "processing") && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>
                  {stage === "extracting" ? "Extracting thumbnail from video..." : "Saving to database..."}
                </span>
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!videoFile || !title.trim() || isUploading}
          className={cn(
            "w-full py-3.5 rounded-xl font-semibold text-white transition-colors text-base",
            !videoFile || !title.trim() || isUploading
              ? "bg-primary/40 cursor-not-allowed"
              : "bg-primary hover:bg-primary/90 active:bg-primary/80"
          )}
        >
          {stage === "extracting" ? "Preparing..." :
           stage === "uploading" ? `Uploading ${progress}%...` :
           stage === "processing" ? "Saving..." :
           "Publish Video"}
        </button>
      </div>
    </div>
  );
}

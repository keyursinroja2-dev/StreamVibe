import { useEffect, useRef, useState, useCallback } from "react";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  Settings, RotateCcw, RotateCw
} from "lucide-react";
import { cn } from "@/lib/utils";

declare global {
  interface Document {
    webkitFullscreenElement?: Element | null;
    mozFullScreenElement?: Element | null;
    webkitExitFullscreen?: () => Promise<void>;
    mozCancelFullScreen?: () => Promise<void>;
  }
  interface HTMLElement {
    webkitRequestFullscreen?: () => Promise<void>;
    mozRequestFullScreen?: () => Promise<void>;
  }
  interface ScreenOrientation {
    lock?: (orientation: string) => Promise<void>;
  }
}

interface VideoPlayerProps {
  src: string;
  thumbnail?: string;
  autoplay?: boolean;
  onEnded?: () => void;
}

function formatTime(s: number) {
  if (!isFinite(s) || isNaN(s) || s <= 0) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

// ── Seek gesture state per side ─────────────────────────────────────────────
interface SideSeekState {
  tapCount: number;           // how many consecutive taps on this side
  totalSeeked: number;        // accumulated seconds already applied
  resetTimer: ReturnType<typeof setTimeout> | null;
}

const DOUBLE_TAP_GAP = 300;   // ms between taps to count as consecutive
const SEEK_RESET_DELAY = 800; // ms of inactivity before resetting tap count

export default function VideoPlayer({ src, thumbnail, autoplay = false, onEnded }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);

  // Double-tap seek state (separate for each side)
  const leftSeekRef = useRef<SideSeekState>({ tapCount: 0, totalSeeked: 0, resetTimer: null });
  const rightSeekRef = useRef<SideSeekState>({ tapCount: 0, totalSeeked: 0, resetTimer: null });

  // Last tap info — used to distinguish single vs double tap
  const lastTapRef = useRef<{ time: number; side: "left" | "right" | "center" | null }>({
    time: 0,
    side: null,
  });
  // Timer that fires the single-tap action (controls toggle) if no second tap arrives
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [loading, setLoading] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const isDraggingSeek = useRef(false);

  // Seek overlay feedback: show how many seconds were seeked on which side
  const [seekOverlay, setSeekOverlay] = useState<{
    dir: "left" | "right" | null;
    secs: number;
    key: number; // changes every gesture burst to re-trigger animation
  }>({ dir: null, secs: 0, key: 0 });
  const seekOverlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load video ──────────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    setLoading(true);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setBuffered(0);
    video.preload = "metadata";
    video.src = src;
    video.load();
    if (autoplay) video.play().catch(() => {});
  }, [src]);

  // ── Controls auto-hide ──────────────────────────────────────────────────
  const scheduleHideControls = useCallback(() => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 3500);
  }, []);

  const showControlsNow = useCallback(() => {
    setShowControls(true);
    if (playing) scheduleHideControls();
  }, [playing, scheduleHideControls]);

  useEffect(() => {
    if (playing) scheduleHideControls();
    else {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      setShowControls(true);
    }
  }, [playing]);

  // ── Fullscreen change ───────────────────────────────────────────────────
  useEffect(() => {
    function onFsChange() {
      const isFs = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement
      );
      setFullscreen(isFs);
      if (!isFs && screen.orientation?.lock) {
        screen.orientation.lock("portrait-primary").catch(() => {});
      }
    }
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    document.addEventListener("mozfullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
      document.removeEventListener("mozfullscreenchange", onFsChange);
    };
  }, []);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlayPause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          applySeekStep("left");
          break;
        case "ArrowRight":
          e.preventDefault();
          applySeekStep("right");
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing]);

  // ── Fullscreen toggle ───────────────────────────────────────────────────
  async function toggleFullscreen() {
    const container = containerRef.current;
    if (!container) return;
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (!isFs) {
      try {
        if (container.requestFullscreen) await container.requestFullscreen();
        else if (container.webkitRequestFullscreen) await container.webkitRequestFullscreen();
        else if (container.mozRequestFullScreen) await container.mozRequestFullScreen();
        if (screen.orientation?.lock) screen.orientation.lock("landscape").catch(() => {});
      } catch {}
    } else {
      try {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
        else if (document.mozCancelFullScreen) await document.mozCancelFullScreen();
      } catch {}
    }
  }

  // ── Play / Pause ────────────────────────────────────────────────────────
  function togglePlayPause() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
    showControlsNow();
  }

  // ── Seek bar ────────────────────────────────────────────────────────────
  function seekToPosition(clientX: number, rect: DOMRect) {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const pct = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
    v.currentTime = pct * v.duration;
    setCurrentTime(v.currentTime);
  }

  function handleSeekBarMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    isDraggingSeek.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    seekToPosition(e.clientX, rect);
    showControlsNow();
    const onMove = (ev: MouseEvent) => { if (isDraggingSeek.current) seekToPosition(ev.clientX, rect); };
    const onUp = () => {
      isDraggingSeek.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleSeekBarTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    e.stopPropagation();
    isDraggingSeek.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    seekToPosition(e.touches[0].clientX, rect);
    showControlsNow();
    const onMove = (ev: TouchEvent) => {
      if (!isDraggingSeek.current) return;
      ev.preventDefault();
      seekToPosition(ev.touches[0].clientX, rect);
    };
    const onEnd = () => {
      isDraggingSeek.current = false;
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
    };
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
  }

  // ── Volume ──────────────────────────────────────────────────────────────
  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) videoRef.current.volume = val;
    setMuted(val === 0);
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    const newMuted = !muted;
    v.muted = newMuted;
    setMuted(newMuted);
  }

  function setSpeed(rate: number) {
    if (videoRef.current) videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSettings(false);
  }

  // ── Cumulative double-tap seek ──────────────────────────────────────────
  /**
   * Called each time a consecutive tap on the same side is detected.
   * Applies an incremental +10s seek and shows the updated overlay.
   */
  function applySeekStep(side: "left" | "right") {
    const v = videoRef.current;
    if (!v || !v.duration) return;

    const ref = side === "left" ? leftSeekRef : rightSeekRef;
    const otherRef = side === "left" ? rightSeekRef : leftSeekRef;

    // Cancel any reset timer already running for this side
    if (ref.current.resetTimer) clearTimeout(ref.current.resetTimer);

    // Reset the OTHER side so they don't accumulate independently
    if (otherRef.current.resetTimer) clearTimeout(otherRef.current.resetTimer);
    otherRef.current = { tapCount: 0, totalSeeked: 0, resetTimer: null };

    // Increment tap count and apply seek
    ref.current.tapCount += 1;
    const delta = side === "left" ? -10 : 10;
    v.currentTime = Math.max(0, Math.min(v.currentTime + delta, v.duration));
    ref.current.totalSeeked += Math.abs(delta);

    // Show overlay with cumulative amount
    if (seekOverlayTimerRef.current) clearTimeout(seekOverlayTimerRef.current);
    setSeekOverlay((prev) => ({
      dir: side,
      secs: ref.current.totalSeeked,
      key: prev.key + 1,
    }));
    // Hide overlay after inactivity
    seekOverlayTimerRef.current = setTimeout(() => {
      setSeekOverlay((prev) => ({ ...prev, dir: null }));
    }, SEEK_RESET_DELAY + 200);

    // Haptic feedback (supported on mobile)
    if (navigator.vibrate) navigator.vibrate(30);

    // Schedule reset of this side's state
    ref.current.resetTimer = setTimeout(() => {
      ref.current = { tapCount: 0, totalSeeked: 0, resetTimer: null };
    }, SEEK_RESET_DELAY);

    showControlsNow();
  }

  // ── Tap handler on the video surface ───────────────────────────────────
  /**
   * Unified handler for both click and touchend on the video container.
   *
   * Logic:
   * 1. If tap is on a control element → ignore (controls handle themselves).
   * 2. Determine tap side: left (<40%), right (>60%), center.
   * 3. If a previous tap on the SAME side happened within DOUBLE_TAP_GAP ms
   *    → cancel the pending single-tap timer, treat as double-tap, call applySeekStep.
   * 4. Otherwise → start a single-tap timer; if it expires without a second tap
   *    → toggle controls visibility.
   */
  function handleVideoTap(e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) {
    // Ignore taps on control elements
    if ((e.target as HTMLElement).closest("[data-controls]")) return;
    // Ignore if dragging seek bar
    if (isDraggingSeek.current) return;

    const clientX =
      "changedTouches" in e
        ? (e as React.TouchEvent).changedTouches[0]?.clientX ?? 0
        : (e as React.MouseEvent).clientX;

    const containerW = containerRef.current?.offsetWidth || 1;
    const relativePct = clientX / containerW;

    const side: "left" | "right" | "center" =
      relativePct < 0.4 ? "left" : relativePct > 0.6 ? "right" : "center";

    const now = Date.now();
    const last = lastTapRef.current;
    const isDoubleTap = now - last.time < DOUBLE_TAP_GAP && last.side === side && side !== "center";

    if (isDoubleTap) {
      // ── Double-tap: cancel any pending single-tap action and seek ───────
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      // Reset tracking so we keep accumulating without this tap causing
      // another double-tap on the very next tap
      lastTapRef.current = { time: now, side };
      applySeekStep(side);
    } else {
      // ── Single-tap: schedule controls toggle, wait for possible 2nd tap ─
      lastTapRef.current = { time: now, side };
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = setTimeout(() => {
        singleTapTimerRef.current = null;
        // Single tap confirmed → toggle controls
        showControlsNow();
      }, DOUBLE_TAP_GAP);
    }
  }

  // ── Empty src guard ─────────────────────────────────────────────────────
  if (!src) {
    return (
      <div className="relative aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center">
        {thumbnail && (
          <img src={thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
        )}
        <div className="text-white/60 text-sm">Video unavailable</div>
      </div>
    );
  }

  const progressPct = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;
  const bufferedPct = duration > 0 ? Math.min((buffered / duration) * 100, 100) : 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative bg-black select-none outline-none",
        fullscreen ? "fixed inset-0 z-[9999] w-screen h-screen" : "aspect-video w-full"
      )}
      tabIndex={0}
      onMouseMove={showControlsNow}
      onClick={handleVideoTap}
      onTouchEnd={handleVideoTap}
    >
      {/* ── Video element ────────────────────────────────────────────────── */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        poster={thumbnail}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={() => {
          const v = videoRef.current;
          if (!v || isDraggingSeek.current) return;
          setCurrentTime(v.currentTime);
          if (v.buffered.length > 0) setBuffered(v.buffered.end(v.buffered.length - 1));
        }}
        onLoadedMetadata={() => {
          const v = videoRef.current;
          if (v) { setDuration(v.duration); v.volume = volume; }
          setLoading(false);
        }}
        onWaiting={() => setLoading(true)}
        onCanPlay={() => setLoading(false)}
        onPlaying={() => setLoading(false)}
        onEnded={() => { setPlaying(false); setShowControls(true); onEnded?.(); }}
        onError={() => setLoading(false)}
      />

      {/* ── Loading spinner ──────────────────────────────────────────────── */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 border-[3px] border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* ── Double-tap seek overlays ─────────────────────────────────────── */}
      {seekOverlay.dir === "left" && (
        <div
          key={`left-${seekOverlay.key}`}
          className="absolute left-0 top-0 bottom-0 w-2/5 flex flex-col items-center justify-center gap-1 pointer-events-none"
          style={{ animation: "seekPulse 0.25s ease-out" }}
        >
          <div className="bg-black/55 rounded-full p-3.5 backdrop-blur-sm">
            <RotateCcw className="w-7 h-7 text-white" />
          </div>
          <span className="text-white text-sm font-bold bg-black/60 px-3 py-0.5 rounded-full">
            -{seekOverlay.secs}s
          </span>
        </div>
      )}
      {seekOverlay.dir === "right" && (
        <div
          key={`right-${seekOverlay.key}`}
          className="absolute right-0 top-0 bottom-0 w-2/5 flex flex-col items-center justify-center gap-1 pointer-events-none"
          style={{ animation: "seekPulse 0.25s ease-out" }}
        >
          <div className="bg-black/55 rounded-full p-3.5 backdrop-blur-sm">
            <RotateCw className="w-7 h-7 text-white" />
          </div>
          <span className="text-white text-sm font-bold bg-black/60 px-3 py-0.5 rounded-full">
            +{seekOverlay.secs}s
          </span>
        </div>
      )}

      {/* ── Center play / pause button ───────────────────────────────────── */}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-200",
          showControls ? "opacity-100" : "opacity-0"
        )}
      >
        <button
          data-controls
          onClick={(e) => { e.stopPropagation(); togglePlayPause(); }}
          className={cn(
            "w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center pointer-events-auto",
            "bg-black/60 backdrop-blur-sm transition-all duration-150",
            "hover:bg-black/80 hover:scale-110 active:scale-95"
          )}
        >
          {playing
            ? <Pause className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="white" />
            : <Play className="w-8 h-8 sm:w-10 sm:h-10 text-white ml-1" fill="white" />
          }
        </button>
      </div>

      {/* ── Bottom controls gradient + bar ───────────────────────────────── */}
      <div
        data-controls
        className={cn(
          "absolute bottom-0 left-0 right-0 transition-all duration-200",
          showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
        )}
        onClick={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none" />

        <div className="relative px-3 sm:px-5 pb-3 sm:pb-4 pt-8">
          {/* Seek bar */}
          <div
            ref={seekBarRef}
            className="relative h-5 flex items-center cursor-pointer mb-1 group/seek"
            onMouseDown={handleSeekBarMouseDown}
            onTouchStart={handleSeekBarTouchStart}
          >
            <div className="absolute inset-y-0 flex items-center w-full">
              <div className="w-full h-1 sm:h-1.5 bg-white/25 rounded-full overflow-hidden relative">
                {/* Buffered */}
                <div
                  className="absolute left-0 top-0 h-full bg-white/30 rounded-full transition-all duration-300"
                  style={{ width: `${bufferedPct}%` }}
                />
                {/* Played */}
                <div
                  className="absolute left-0 top-0 h-full bg-primary rounded-full"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              {/* Thumb */}
              <div
                className="absolute w-3.5 h-3.5 sm:w-4 sm:h-4 bg-white rounded-full shadow-md pointer-events-none transition-opacity opacity-0 group-hover/seek:opacity-100"
                style={{ left: `calc(${progressPct}% - 7px)` }}
              />
            </div>
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-1 sm:gap-2 mt-1">
            {/* Play/Pause */}
            <button
              data-controls
              onClick={togglePlayPause}
              className="text-white hover:text-primary transition-colors w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 shrink-0"
            >
              {playing
                ? <Pause className="w-5 h-5" fill="currentColor" />
                : <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
              }
            </button>

            {/* Seek ±10 (desktop only) */}
            <button
              data-controls
              onClick={() => applySeekStep("left")}
              className="text-white/80 hover:text-white hidden sm:flex items-center justify-center w-9 h-9 rounded-full hover:bg-white/10 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              data-controls
              onClick={() => applySeekStep("right")}
              className="text-white/80 hover:text-white hidden sm:flex items-center justify-center w-9 h-9 rounded-full hover:bg-white/10 transition-colors"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Volume (desktop) */}
            <div className="hidden sm:flex items-center gap-1.5">
              <button
                data-controls
                onClick={toggleMute}
                className="text-white hover:text-primary transition-colors w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10"
              >
                {muted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range" min={0} max={1} step={0.05}
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-20 accent-primary cursor-pointer h-1 rounded-full"
                data-controls
              />
            </div>

            {/* Time */}
            <span className="text-white/90 text-xs sm:text-sm font-mono tabular-nums px-1 shrink-0">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div className="flex-1" />

            {/* Speed */}
            <div className="relative">
              <button
                data-controls
                onClick={() => setShowSettings((p) => !p)}
                className="text-white/80 hover:text-white w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>
              {showSettings && (
                <div
                  data-controls
                  className="absolute bottom-11 right-0 bg-black/95 border border-white/10 rounded-xl p-3 w-44 z-50 shadow-2xl"
                >
                  <p className="text-white/50 text-[11px] mb-2 font-semibold uppercase tracking-wide">
                    Playback Speed
                  </p>
                  {SPEEDS.map((r) => (
                    <button
                      key={r}
                      data-controls
                      onClick={() => setSpeed(r)}
                      className={cn(
                        "block w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors",
                        playbackRate === r
                          ? "text-primary font-semibold bg-primary/10"
                          : "text-white hover:bg-white/10"
                      )}
                    >
                      {r === 1 ? "Normal (1×)" : `${r}×`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <button
              data-controls
              onClick={toggleFullscreen}
              className="text-white/80 hover:text-white w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            >
              {fullscreen ? <Minimize className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

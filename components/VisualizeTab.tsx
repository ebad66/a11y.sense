'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Profile } from '@/lib/profiles';
import { AccessibilityIssue } from '@/lib/claude';

interface Props {
  profile: Profile;
  issues: AccessibilityIssue[];
  sessionId: string;
  hasScreenshot: boolean;
  screenshotWidth: number;
  screenshotHeight: number;
  elementCoords: Record<string, { xPct: number; yPct: number; wPct: number; hPct: number }>;
}

interface ResolvedPin {
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  issue: AccessibilityIssue;
  /** true = coordinate came from real DOM resolution, false = live-lookup fallback */
  precise: boolean;
}

// ── Animation constants ────────────────────────────────────────────────────────
const SCAN_FRAMES      = 100;
const WANDER_SPEED     = 1.5;
const WANDER_WAYPOINTS = 5;

// ── Per-profile immersive visual effects ──────────────────────────────────────
interface ProfileEffect {
  /** CSS filter on the screenshot image */
  imgFilter:   string;
  /** Overlay div style (position:absolute, full cover, pointerEvents:none) */
  overlay?:    React.CSSProperties;
  /** CSS animation name applied to the entire stage wrapper */
  animation?:  string;
  /** Short human-readable label shown in the badge */
  label:       string;
  /** Badge background colour */
  badgeColor:  string;
}

const PROFILE_EFFECTS: Record<string, ProfileEffect> = {
  blind: {
    // Near-total darkness — only extreme contrast edges survive.
    // Flags remain visible (they're above the img layer) showing what a screen reader hits.
    imgFilter:  'brightness(0.06) contrast(7) grayscale(1)',
    label:      'Total vision loss simulated',
    badgeColor: '#7c3aed',
  },
  'low-vision': {
    // Heavy blur + tunnel-vision vignette (dark edges, faint centre)
    imgFilter:  'blur(5px) brightness(0.55) contrast(0.6) saturate(0.45)',
    overlay: {
      background: 'radial-gradient(ellipse at 50% 38%, transparent 18%, rgba(0,0,0,0.72) 55%, rgba(0,0,0,0.95) 100%)',
    },
    label:      'Low acuity + tunnel vision simulated',
    badgeColor: '#1d4ed8',
  },
  dyslexia: {
    // Warm cream tint overlay (like the coloured overlays dyslexic readers use) + slight contrast dip
    imgFilter:  'contrast(0.80) brightness(1.04) saturate(0.9)',
    overlay: {
      background: 'rgba(255, 230, 160, 0.20)',
      mixBlendMode: 'multiply' as const,
    },
    label:      'Visual stress + colour overlay simulated',
    badgeColor: '#b45309',
  },
  deaf: {
    // Desaturated silent world — all colour stripped, slight darkening
    imgFilter:  'grayscale(1) contrast(0.78) brightness(0.82) sepia(0.12)',
    overlay: {
      // Subtle horizontal scan-lines to hint at "missed" audio waveform
      background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.07) 3px, rgba(0,0,0,0.07) 4px)',
    },
    label:      'Silent / audio-inaccessible world simulated',
    badgeColor: '#065f46',
  },
  motor: {
    // Slight blur + tremor shake animation on the whole container
    imgFilter:  'blur(0.9px) brightness(0.88) contrast(0.9) saturate(0.75)',
    animation:  'motorTremor 0.25s steps(1) infinite',
    label:      'Fine-motor tremor simulated',
    badgeColor: '#991b1b',
  },
};

export function VisualizeTab({
  profile,
  issues,
  sessionId,
  hasScreenshot,
  screenshotWidth,
  screenshotHeight,
  elementCoords,
}: Props) {
  const wrapperRef   = useRef<HTMLDivElement>(null);
  const scrollRef    = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const spriteRef    = useRef<HTMLDivElement>(null);
  const rafRef       = useRef<number>(0);

  const [loadingCoords, setLoadingCoords] = useState(false);
  const [started,       setStarted]       = useState(false);
  const [animDone,      setAnimDone]      = useState(false);
  const [containerW,    setContainerW]    = useState(800);
  const [selectedPin,   setSelectedPin]   = useState<ResolvedPin | null>(null);
  const [statusText,    setStatusText]    = useState<string | null>(null);

  // Pins array — built at start-time, revealed one-by-one during animation
  const [pins,      setPins]      = useState<(ResolvedPin & { visible: boolean })[]>([]);
  const pinsRef     = useRef<(ResolvedPin & { visible: boolean })[]>([]);

  const nonPassIssues = issues.filter(i => i.severity !== 'Pass');

  const scale    = containerW / (screenshotWidth  || 1280);
  const displayH = (screenshotHeight || 900) * scale;


  // ── Scanner animation state (mutable ref so RAF reads latest without re-render) ──
  const anim = useRef({
    x:          60,
    y:          0,
    targetX:    60,
    targetY:    0,
    phase:      'moving' as 'moving' | 'scanning' | 'done',
    pinIdx:     0,
    frameCount: 0,
    scanFrames: 0,
    scanY:      0, // fixed viewport Y the reticle parks at while scanning
    waypoints:  [] as {x: number, y: number}[],
    dir:        1, // 1 for right, -1 for left
  });

  // ── Draw trails/rings on canvas ────────────────────────────────────────────────────
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const a = anim.current;
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    if (a.phase === 'done') return;

    const { x, y }   = a;
    const isMoving   = a.phase === 'moving';
    const isScanning = a.phase === 'scanning';

    // Faint dashed trail behind sprite
    if (isMoving && a.frameCount % 3 === 0) {
      ctx.save();
      ctx.fillStyle = `${profile.color}44`;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Expanding rings while scanning
    if (isScanning) {
      for (let r = 0; r < 3; r++) {
        const prog   = ((a.scanFrames / SCAN_FRAMES) + r / 3) % 1;
        const radius = 14 + prog * 56;
        const alpha  = (1 - prog) * 0.55;
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = profile.color + Math.round(alpha * 255).toString(16).padStart(2, '0');
        ctx.lineWidth   = 1.5;
        ctx.stroke();
        ctx.restore();
      }

      // Bounding-box highlight
      const pin = pinsRef.current[a.pinIdx];
      if (pin?.wPct && pin.hPct) {
        const bW = Math.max(pin.wPct * W, 24);
        const bH = Math.max(pin.hPct * displayH, 14);
        ctx.save();
        ctx.strokeStyle = profile.color + '88'; // Make it pop more
        ctx.lineWidth   = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x - bW / 2, y - bH / 2, bW, bH);
        ctx.restore();
      }
    }

  }, [containerW, displayH, profile]);

  // ── RAF animation loop ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!started) return;

    const tick = () => {
      const a = anim.current;
      a.frameCount++;

      if (a.phase === 'moving') {
        if (a.waypoints.length === 0) {
          // Reached destination, snap to it
          a.x = a.targetX;
          a.y = a.targetY;
          const allPins = pinsRef.current;
          if (a.pinIdx < allPins.length) {
            a.phase      = 'scanning';
            a.scanFrames = 0;
            // Face forward
            a.dir = 1;

            const pin = allPins[a.pinIdx];
            setStatusText(
              pin
                ? (pin.issue.title.length > 56
                    ? pin.issue.title.slice(0, 53) + '…'
                    : pin.issue.title)
                : null
            );
          } else {
            a.phase = 'done';
            setStatusText(null);
            setAnimDone(true);
          }
        } else {
          // Move towards current waypoint
          const nextWp = a.waypoints[0];
          const dx   = nextWp.x - a.x;
          const dy   = nextWp.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Determine facing direction based on horizontal movement
          if (Math.abs(dx) > 0.5) {
             // We flip by using `dir: 1` or `dir: -1` in the scaleX transform
             a.dir = dx > 0 ? 1 : -1;
          }

          if (dist < WANDER_SPEED) {
            // Reached waypoint, remove it and proceed to next
            a.x = nextWp.x;
            a.y = nextWp.y;
            a.waypoints.shift();
          } else {
            a.x += (dx / dist) * WANDER_SPEED;
            a.y += (dy / dist) * WANDER_SPEED;
          }
        }
        
        // Directly update the sprite DOM element
        if (spriteRef.current) {
          spriteRef.current.style.transform = `translate(${Math.round(a.x - 20) || 0}px, ${Math.round(a.y - 20) || 0}px) scaleX(${a.dir || 1})`;
        }
      } else if (a.phase === 'scanning') {
        a.scanFrames++;
        if (a.scanFrames === Math.floor(SCAN_FRAMES / 2)) {
          // Drop flag halfway through scan
          setPins(prev => {
             const next = prev.map((p, i) => i === a.pinIdx ? { ...p, visible: true } : p);
             pinsRef.current = next;
             return next;
          });
        }
        if (a.scanFrames > SCAN_FRAMES) {
          a.pinIdx++;
          a.phase = 'moving';
          setStatusText(null);

          const allPins = pinsRef.current;
          if (a.pinIdx < allPins.length) {
            const next    = allPins[a.pinIdx];
            // Scroll so next element is at scanY in the viewport
            const pagePxY = next.yPct * displayH;
            const scrollTo = Math.max(0, Math.min(pagePxY - a.scanY, displayH - a.scanY));
            scrollRef.current?.scrollTo({ top: scrollTo, behavior: 'smooth' });

            a.targetX = next.xPct * containerW;
            a.targetY = a.scanY;

            // Generate wandering waypoints towards new target
            a.waypoints = [];
            let currX = a.x;
            let currY = a.y;
            for (let i = 1; i <= WANDER_WAYPOINTS; i++) {
               const progress = i / (WANDER_WAYPOINTS + 1);
               // Base point on direct line
               const baseX = currX + (a.targetX - currX) * progress;
               const baseY = currY + (a.targetY - currY) * progress;
               // Add noise (more noise in the middle, less near ends)
               const noiseAmt = Math.sin(progress * Math.PI) * 100;
               a.waypoints.push({
                 x: Math.max(20, Math.min(containerW - 20, baseX + (Math.random() * 2 - 1) * noiseAmt)),
                 y: Math.max(20, Math.min(a.scanY + 200, baseY + (Math.random() * 2 - 1) * noiseAmt)),
               });
            }
            a.waypoints.push({ x: a.targetX, y: a.targetY }); // Final waypoint is Exact target
          }
        }
      }

      drawFrame();
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [started, containerW, displayH, drawFrame]);

  // ── Start / restart ───────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    cancelAnimationFrame(rafRef.current);
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const w      = wrapper.offsetWidth;
    const scaleX = w / (screenshotWidth || 1280);
    const dispH  = (screenshotHeight || 900) * scaleX;
    const stageH = Math.min(dispH, 580);
    const scanY  = Math.round(stageH * 0.42);

    setContainerW(w);
    setStarted(false);
    setAnimDone(false);
    setStatusText(null);
    setSelectedPin(null);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;

    // ── Step 1: use pre-resolved coords from the scan ──────────────────────────
    let resolved: (ResolvedPin | null)[] = nonPassIssues.map((issue) => {
      // Look up by selector first, fall back to element snippet — matches how scan/route.ts keys the store
      const key = issue.selector || issue.element;
      const box = key ? elementCoords[key] : undefined;
      if (
        box &&
        box.xPct > 0 &&
        box.yPct > 0 &&
        box.xPct <= 1 &&
        box.yPct <= 1
      ) {
        return {
          xPct: box.xPct, yPct: box.yPct,
          wPct: box.wPct ?? 0, hPct: box.hPct ?? 0,
          issue,
          precise: true,
        };
      }
      return null; // needs live lookup
    });

    // ── Step 2: live fallback via /api/coords for any unresolved ──────────────
    const missingIdxs = resolved
      .map((r, i) => (r === null ? i : -1))
      .filter(i => i >= 0);

    if (missingIdxs.length > 0) {
      setLoadingCoords(true);
      try {
        const res = await fetch(`/api/coords/${sessionId}`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            // Prefer element HTML snippet — gives the coords route richer info for matching
            elements: missingIdxs.map(i =>
              nonPassIssues[i].element || nonPassIssues[i].selector || ''
            ),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          missingIdxs.forEach((origIdx, liveIdx) => {
            const live = data.coords?.[liveIdx];
            if (
              live?.found &&
              live.xPct > 0 &&
              live.yPct > 0 &&
              live.xPct <= 1 &&
              live.yPct <= 1
            ) {
              resolved[origIdx] = {
                xPct: live.xPct, yPct: live.yPct,
                wPct: live.wPct ?? 0, hPct: live.hPct ?? 0,
                issue: nonPassIssues[origIdx],
                precise: true,
              };
            }
          });
        }
      } catch { /* non-fatal */ }
      setLoadingCoords(false);
    }

    // ── Step 3: assign fallback positions for still-unresolved issues ─────────
    const unresolvedCount = resolved.filter(r => r === null).length;
    let fallbackSlot = 0;
    const finalResolved: ResolvedPin[] = resolved.map((r, i) => {
      if (r !== null) return r;
      // Spread unresolved pins evenly across the page height, centred horizontally
      const yPct = unresolvedCount === 1
        ? 0.5
        : 0.1 + (fallbackSlot / Math.max(unresolvedCount - 1, 1)) * 0.8;
      fallbackSlot++;
      return {
        xPct:    0.5,
        yPct,
        wPct:    0,
        hPct:    0,
        issue:   nonPassIssues[i],
        precise: false,
      };
    });

    // Sort top → bottom so scanner scrolls naturally downward
    let validPins: ResolvedPin[] = finalResolved
      .sort((a, b) => a.yPct - b.yPct);

    // De-overlap: if two pins land within 36px of each other (Y) and 28px (X),
    // stagger their X so their flags and labels don't stack on top of each other.
    validPins = validPins.map((pin, i) => {
      if (i === 0) return pin;
      const prev = validPins[i - 1];
      const dyPx = (pin.yPct - prev.yPct) * dispH;
      const dxPx = Math.abs(pin.xPct - prev.xPct) * w;
      if (dyPx < 36 && dxPx < 28) {
        // Nudge this pin 40px to the right (clamped to page width)
        return { ...pin, xPct: Math.min(0.95, pin.xPct + 40 / w) };
      }
      return pin;
    });

    if (validPins.length === 0) {
      // Nothing to visualise — skip animation, go straight to done
      setStarted(true);
      setAnimDone(true);
      return;
    }

    // Size the canvas
    const canvas = canvasRef.current;
    if (canvas) { canvas.width = w; canvas.height = stageH; }

    const withVisible = validPins.map(p => ({ ...p, visible: false }));
    pinsRef.current = withVisible;
    setPins(withVisible);

    // Initial scroll to first pin
    const first      = validPins[0];
    const initScroll = Math.max(0, Math.min(first.yPct * dispH - scanY, dispH - stageH));

    // We set up the initial waypoints
    const wpts = [];
    for (let i = 1; i <= WANDER_WAYPOINTS; i++) {
        const progress = i / (WANDER_WAYPOINTS + 1);
        const baseX = 40 + (first.xPct * w - 40) * progress;
        const baseY = scanY;
        const noiseAmt = Math.sin(progress * Math.PI) * 100;
        wpts.push({
          x: Math.max(20, Math.min(w - 20, baseX + (Math.random() * 2 - 1) * noiseAmt)),
          y: Math.max(20, Math.min(scanY + 200, baseY + (Math.random() * 2 - 1) * noiseAmt)),
        });
    }
    wpts.push({ x: first.xPct * w, y: scanY });

    anim.current = {
      x:          40,
      y:          scanY,
      targetX:    first.xPct * w,
      targetY:    scanY,
      phase:      'moving',
      pinIdx:     0,
      frameCount: 0,
      scanFrames: 0,
      scanY,
      waypoints:  wpts,
      dir:        1,
    };

    setStarted(true);

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: initScroll, behavior: 'smooth' });
    });
  }, [nonPassIssues, elementCoords, sessionId, screenshotWidth, screenshotHeight]);

  // ── Profile Sprite Component ───────────────────────────────────────────────────
  const ProfileSprite = ({ profileId, color, isMoving }: { profileId: string, color: string, isMoving: boolean }) => {
    // A subtle bobbing animation when moving
    const animStyle = isMoving ? { animation: 'spriteBob 0.6s infinite alternate ease-in-out' } : {};

    switch (profileId) {
      case 'blind':
        return (
          <svg width="40" height="40" viewBox="0 0 40 40" style={animStyle}>
            {/* Guide Dog / Bot */}
            <rect x="10" y="16" width="20" height="14" rx="4" fill={color} />
            <circle cx="15" cy="20" r="2" fill="#fff" />
            <circle cx="25" cy="20" r="2" fill="#fff" />
            <path d="M10 16 L6 10" stroke={color} strokeWidth="2" strokeLinecap="round" />
            <path d="M30 16 L34 10" stroke={color} strokeWidth="2" strokeLinecap="round" />
            {/* White cane */}
            <line x1="28" y1="24" x2="38" y2="36" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            <circle cx="38" cy="36" r="2" fill="#ef4444" />
          </svg>
        );
      case 'low-vision':
        return (
          <svg width="40" height="40" viewBox="0 0 40 40" style={animStyle}>
            {/* Character with giant magnifying glass */}
            <circle cx="20" cy="20" r="10" fill={color} />
            <circle cx="20" cy="18" r="4" fill="#0f0f1a" />
            {/* Magnifier */}
            <circle cx="28" cy="28" r="8" fill="#fff" fillOpacity="0.3" stroke="#fff" strokeWidth="2" />
            <line x1="20" y1="20" x2="24" y2="24" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          </svg>
        );
      case 'dyslexia':
        return (
          <svg width="40" height="40" viewBox="0 0 40 40" style={animStyle}>
            {/* Floating letters bot */}
            <rect x="12" y="14" width="16" height="18" rx="3" fill={color} />
            <text x="7" y="14" fill="#fff" fontSize="10" fontFamily="sans-serif" style={{ animation: 'floatLetter1 2s infinite alternate' }}>A</text>
            <text x="28" y="10" fill="#fff" fontSize="10" fontFamily="sans-serif" style={{ animation: 'floatLetter2 2.5s infinite alternate-reverse' }}>Z</text>
            <text x="30" y="28" fill="#fff" fontSize="10" fontFamily="sans-serif" style={{ animation: 'floatLetter3 1.8s infinite alternate' }}>E</text>
          </svg>
        );
      case 'deaf':
        return (
          <svg width="40" height="40" viewBox="0 0 40 40" style={animStyle}>
            {/* Radar ears bot */}
            <rect x="14" y="16" width="12" height="14" rx="2" fill={color} />
            {/* Left Radar */}
            <path d="M12 20 Q4 20 4 14" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
            <circle cx="4" cy="14" r="3" fill="#fff" />
            {/* Right Radar */}
            <path d="M28 20 Q36 20 36 14" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
            <circle cx="36" cy="14" r="3" fill="#fff" />
          </svg>
        );
      case 'motor':
        return (
          <svg width="40" height="40" viewBox="0 0 40 40" style={animStyle}>
            {/* Hover chair bot */}
            <circle cx="20" cy="16" r="8" fill={color} />
            <path d="M10 26 Q20 34 30 26" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
            <rect x="16" y="28" width="8" height="6" fill={color} opacity="0.6" />
            {/* Hover thrusters */}
            <polygon points="12,28 16,36 8,36" fill="#f59e0b" style={{ animation: 'thrusterPulse 0.4s infinite alternate' }} />
            <polygon points="28,28 32,36 24,36" fill="#f59e0b" style={{ animation: 'thrusterPulse 0.4s infinite alternate-reverse' }} />
          </svg>
        );
      default:
        return (
          <svg width="40" height="40" viewBox="0 0 40 40" style={animStyle}>
            <circle cx="20" cy="20" r="12" fill={color} />
            <circle cx="16" cy="18" r="2" fill="#fff" />
            <circle cx="24" cy="18" r="2" fill="#fff" />
          </svg>
        );
    }
  };

  // ── Pin badge (Flag) ────────────────────────────────────────────────────────
  const PinBadge = ({ issue }: { issue: AccessibilityIssue }) => {
    const isCritical = issue.severity === 'Critical';
    const color = isCritical ? '#ef4444' : '#f59e0b';
    return (
      <svg width="24" height="30" viewBox="0 0 24 30"
        style={{ display: 'block', filter: `drop-shadow(0 0 6px ${color})`, transformOrigin: 'bottom left', animation: 'flagPlant 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }}>
        {/* Flag Pole */}
        <line x1="2" y1="2" x2="2" y2="30" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
        {/* Flag Pennant */}
        <path d="M3 2 L22 8 L3 14 Z" fill={color} />
        {/* ! for Critical, ? for Warning — always shown */}
        <text x="8" y="10" fill="#fff" fontSize="8" fontFamily="sans-serif" fontWeight="bold">
          {isCritical ? '!' : '?'}
        </text>
      </svg>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  const visiblePins = pins.filter(p => p.visible);
  const fx = PROFILE_EFFECTS[profile.id] ?? {
    imgFilter: 'brightness(1)', label: '', badgeColor: profile.color,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ── Immersion badge ── */}
      {started && fx.label && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '6px 12px',
          backgroundColor: `${fx.badgeColor}22`,
          border: `1px solid ${fx.badgeColor}55`,
          borderRadius: '6px',
          marginBottom: '2px',
        }}>
          <span style={{ fontSize: '14px' }}>
            {profile.id === 'blind'      ? '🦯'
            : profile.id === 'low-vision' ? '👁️'
            : profile.id === 'dyslexia'   ? '📖'
            : profile.id === 'deaf'       ? '🔇'
            : profile.id === 'motor'      ? '🤲' : '♿'}
          </span>
          <span style={{
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '7px',
            color: fx.badgeColor,
            letterSpacing: '0.04em',
          }}>
            {fx.label}
          </span>
        </div>
      )}

      {/* ── Stage (outer wrapper for positioning context) ── */}
      <div
        ref={wrapperRef}
        style={{
          position: 'relative',
          width:    '100%',
          borderRadius: '8px',
          border:   `1px solid ${started ? profile.color + '44' : '#1a1a2e'}`,
          overflow: 'hidden',
          backgroundColor: '#060610',
          transition: 'border-color 0.3s',
          animation: started && fx.animation ? fx.animation : undefined,
        }}
      >
        {/* ── Scrollable viewport ── */}
        <div
          ref={scrollRef}
          style={{
            height:     `${animDone ? Math.min(displayH, 800) : (started ? Math.min(displayH, 580) : 220)}px`,
            overflowY:  'auto',
            overflowX:  'hidden',
            transition: 'height 0.4s ease',
            scrollbarWidth: 'thin',
            scrollbarColor: `${profile.color}44 transparent`,
          }}
        >
          {started ? (
            /* Full page-height inner div — screenshot + pins */
            <div style={{ position: 'relative', width: '100%', height: `${displayH}px` }}>

              {/* Screenshot backdrop */}
              {hasScreenshot && (
                <img
                  src={`/api/screenshot/${sessionId}`}
                  alt="Page screenshot"
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: 0, left: 0,
                    width: '100%',
                    height: 'auto',
                    opacity: 1,
                    filter: started ? fx.imgFilter : 'brightness(1)',
                    pointerEvents: 'none',
                    userSelect: 'none',
                    transition: 'filter 0.8s ease, opacity 0.6s',
                  }}
                />
              )}

              {/* Per-profile immersive overlay */}
              {fx.overlay && started && (
                <div style={{
                  position: 'absolute', top: 0, left: 0,
                  width: '100%', height: '100%',
                  pointerEvents: 'none',
                  zIndex: 2,
                  ...fx.overlay,
                }} />
              )}

              {/* Pins — one per crit/warn, guaranteed ───────────────── */}
              {pins.map((pin, i) => {
                if (!pin.visible) return null;
                const isCrit   = pin.issue.severity === 'Critical';
                const pinColor = isCrit ? '#ef4444' : '#f59e0b';
                // Clamp label to left side when pin is near right edge
                const labelRight = pin.xPct > 0.72;
                const shortTitle = pin.issue.title.length > 28
                  ? pin.issue.title.slice(0, 26) + '…'
                  : pin.issue.title;
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedPin(prev =>
                      prev?.issue.title === pin.issue.title ? null : pin
                    )}
                    aria-label={`${pin.issue.severity}: ${pin.issue.title}`}
                    style={{
                      position:  'absolute',
                      top:       `${pin.yPct * displayH - 30}px`,
                      left:      `${pin.xPct * containerW}px`,
                      transform: 'translateX(-50%)',
                      background: 'none',
                      border:     'none',
                      padding:    0,
                      cursor:    'pointer',
                      animation: 'pinDrop 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards',
                      zIndex:    5,
                    }}
                  >
                    {/* Flag SVG */}
                    <PinBadge issue={pin.issue} />

                    {/* Visible error label — floats right (or left near right edge) */}
                    <div style={{
                      position:   'absolute',
                      top:        '2px',
                      ...(labelRight
                        ? { right: '26px' }
                        : { left:  '26px' }),
                      maxWidth:   '140px',
                      whiteSpace: 'nowrap',
                      overflow:   'hidden',
                      textOverflow: 'ellipsis',
                      backgroundColor: `${pinColor}18`,
                      border:     `1px solid ${pinColor}55`,
                      borderRadius: '3px',
                      padding:    '2px 6px',
                      fontSize:   '9px',
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      fontWeight: 600,
                      color:      pinColor,
                      lineHeight: 1.4,
                      pointerEvents: 'none',
                    }}>
                      {shortTitle}
                    </div>

                  </button>
                );
              })}
            </div>
          ) : (
            /* ── Pre-start overlay ── */
            <div style={{
              height: '100%',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '14px',
            }}>
              {loadingCoords ? (
                <>
                  <div style={{
                    width: '24px', height: '24px',
                    border: `2px solid ${profile.color}`,
                    borderTopColor: 'transparent',
                    borderRadius:   '50%',
                    animation: 'spin 0.7s linear infinite',
                  }} />
                  <span style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '7px', color: profile.color }}>
                    Locating elements…
                  </span>
                </>
              ) : (
                <>
                  <div style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '7px', color: '#4b5563' }}>
                    {nonPassIssues.length} issue{nonPassIssues.length !== 1 ? 's' : ''} to scan
                  </div>
                  <button
                    onClick={handleStart}
                    style={{
                      padding: '12px 26px',
                      backgroundColor: profile.color,
                      color: '#fff',
                      fontFamily: '"Press Start 2P", monospace',
                      fontSize: '9px',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      boxShadow: `0 0 24px ${profile.color}55`,
                    }}
                  >
                    ▶ Start Scan
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Canvas overlay (scan rings only, hidden when done) ── */}
        {started && !animDone && (
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              top: 0, left: 0,
              width:  '100%',
              height: `${Math.min(displayH, 580)}px`,
              pointerEvents: 'none',
              zIndex: 10,
            }}
          />
        )}

        {/* ── Sprite Overlay ── */}
        {started && !animDone && anim.current && (
           <div
             ref={spriteRef}
             style={{
               position: 'absolute',
               top: 0, left: 0,
               width: '40px', height: '40px',
               // Center the sprite on x,y
               transform: `translate(${Math.round(anim.current.x - 20) || 0}px, ${Math.round(anim.current.y - 20) || 0}px) scaleX(${anim.current.dir || 1})`,
               pointerEvents: 'none',
               zIndex: 25,
             }}
           >
             <ProfileSprite profileId={profile.id} color={profile.color} isMoving={anim.current.phase === 'moving'} />
           </div>
        )}

        {/* Status bar */}
        {started && !animDone && statusText && (
          <div style={{
            position: 'absolute',
            bottom:   '12px',
            left:     '50%',
            transform: 'translateX(-50%)',
            maxWidth: '82%',
            padding:  '5px 12px',
            backgroundColor: '#0c0c1ecc',
            border:    `1px solid ${profile.color}44`,
            borderRadius: '4px',
            fontFamily: '"Press Start 2P", monospace',
            fontSize:   '7px',
            color:     '#e5e7eb',
            lineHeight: 1.7,
            whiteSpace: 'nowrap',
            overflow:   'hidden',
            textOverflow: 'ellipsis',
            pointerEvents: 'none',
            animation: 'fadeSlideIn 0.2s ease',
            zIndex: 20,
          }}>
            {statusText}
          </div>
        )}

        {/* Scan-complete banner */}
        {animDone && (
          <div style={{
            position:  'absolute',
            top:       '10px',
            left:      '50%',
            transform: 'translateX(-50%)',
            padding:   '4px 10px',
            backgroundColor: '#0c0c1ecc',
            border:    `1px solid ${profile.color}44`,
            borderRadius: '4px',
            fontFamily: '"Press Start 2P", monospace',
            fontSize:   '6px',
            color:      profile.color,
            pointerEvents: 'none',
            zIndex: 20,
          }}>
            {visiblePins.length} pin{visiblePins.length !== 1 ? 's' : ''} placed — scroll to explore
          </div>
        )}

        {/* Restart */}
        {started && (
          <button
            onClick={handleStart}
            style={{
              position: 'absolute',
              top: '10px', right: '10px',
              padding: '4px 10px',
              fontFamily: '"Press Start 2P", monospace',
              fontSize: '7px',
              color: '#4b5563',
              backgroundColor: '#0c0c1ecc',
              border: '1px solid #2a2a4a',
              borderRadius: '4px',
              cursor: 'pointer',
              zIndex: 20,
            }}
          >
            ↺
          </button>
        )}
      </div>

      {/* ── Selected pin detail panel ── */}
      {selectedPin && (
        <div style={{
          padding: '16px',
          backgroundColor: '#1a1a2e',
          border:  `1px solid ${selectedPin.issue.severity === 'Critical' ? '#ef4444' : '#f59e0b'}44`,
          borderRadius: '8px',
          animation: 'fadeSlideIn 0.2s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <span style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: '7px',
              color:  selectedPin.issue.severity === 'Critical' ? '#ef4444' : '#f59e0b',
              border: `1px solid ${selectedPin.issue.severity === 'Critical' ? '#ef4444' : '#f59e0b'}`,
              padding: '3px 8px',
              borderRadius: '3px',
            }}>
              {selectedPin.issue.severity.toUpperCase()}
            </span>
            <span style={{ color: '#fff', fontSize: '13px', fontWeight: 600, flex: 1 }}>
              {selectedPin.issue.title}
            </span>
            <button
              onClick={() => setSelectedPin(null)}
              style={{ background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}
              aria-label="Close"
            >×</button>
          </div>
          {selectedPin.issue.element && (
            <code style={{
              display: 'block',
              padding: '6px 10px', marginBottom: '10px',
              backgroundColor: '#0c0c1e',
              border: '1px solid #1a1a2e',
              borderRadius: '4px',
              fontSize: '11px',
              color: '#93c5fd',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}>
              {selectedPin.issue.element}
            </code>
          )}
          <p style={{ color: '#9ca3af', fontSize: '13px', lineHeight: 1.6, margin: '0 0 10px' }}>
            {selectedPin.issue.description}
          </p>
          {selectedPin.issue.fix && (
            <div style={{
              fontSize: '12px', padding: '8px 12px', borderRadius: '4px',
              color: '#93c5fd', backgroundColor: '#1e3a5f',
              border: '1px solid #2a4a7f', lineHeight: 1.6,
            }}>
              <span style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '6px', color: '#4b83c0', display: 'block', marginBottom: '4px' }}>
                HOW TO FIX
              </span>
              {selectedPin.issue.fix}
            </div>
          )}
          {!selectedPin.precise && (
            <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '8px', fontStyle: 'italic' }}>
              ⚠ Element position could not be precisely located — pin is approximate.
            </p>
          )}
        </div>
      )}

      {/* Empty state */}
      {nonPassIssues.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '32px',
          color: '#10b981',
          fontFamily: '"Press Start 2P", monospace', fontSize: '9px',
          border: '1px dashed #10b98144', borderRadius: '8px',
        }}>
          ✓ No issues — all checks pass
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes flagPlant {
          0%   { transform: rotate(-45deg) scale(0.4); opacity: 0; }
          70%  { transform: rotate(5deg)  scale(1.05); opacity: 1; }
          100% { transform: rotate(0deg)  scale(1);    opacity: 1; }
        }
        @keyframes pinDrop {
          0%   { transform: translateX(-50%) translateY(-20px) scale(0.6); opacity: 0; }
          70%  { transform: translateX(-50%) translateY(4px)  scale(1.08); opacity: 1; }
          100% { transform: translateX(-50%) translateY(0px)  scale(1);    opacity: 1; }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spriteBob {
          from { transform: translateY(0px); }
          to   { transform: translateY(-3px); }
        }
        @keyframes thrusterPulse {
          from { opacity: 0.5; transform: scaleY(0.8); }
          to   { opacity: 1;   transform: scaleY(1.2); }
        }
        @keyframes motorTremor {
          0%   { transform: translate(0px,   0px)   rotate(0deg); }
          10%  { transform: translate(-1px,  1px)   rotate(-0.4deg); }
          20%  { transform: translate(2px,  -1px)   rotate(0.3deg); }
          30%  { transform: translate(-2px,  2px)   rotate(-0.5deg); }
          40%  { transform: translate(1px,  -2px)   rotate(0.4deg); }
          50%  { transform: translate(-1px,  1px)   rotate(-0.3deg); }
          60%  { transform: translate(2px,   0px)   rotate(0.5deg); }
          70%  { transform: translate(-2px, -1px)   rotate(-0.4deg); }
          80%  { transform: translate(1px,   2px)   rotate(0.3deg); }
          90%  { transform: translate(-1px, -1px)   rotate(-0.2deg); }
          100% { transform: translate(0px,   0px)   rotate(0deg); }
        }
      `}</style>
    </div>
  );
}

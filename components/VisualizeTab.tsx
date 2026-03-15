'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { WcagPrinciple } from '@/lib/wcag';
import { AccessibilityIssue } from '@/lib/claude';

interface Props {
  principle: WcagPrinciple;
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
  /** true = coordinate came from real DOM resolution */
  precise: boolean;
}

// ── Animation constants ────────────────────────────────────────────────────────
const SCAN_FRAMES      = 100;
const WANDER_SPEED     = 1.5;
const WANDER_WAYPOINTS = 5;

export function VisualizeTab({
  principle,
  issues,
  sessionId,
  hasScreenshot,
  screenshotWidth,
  screenshotHeight,
  elementCoords,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const scrollRef  = useRef<HTMLDivElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const spriteRef  = useRef<HTMLDivElement>(null);
  const rafRef     = useRef<number>(0);

  const [loadingCoords, setLoadingCoords] = useState(false);
  const [started,       setStarted]       = useState(false);
  const [animDone,      setAnimDone]      = useState(false);
  const [containerW,    setContainerW]    = useState(800);
  const [selectedPin,   setSelectedPin]   = useState<ResolvedPin | null>(null);
  const [statusText,    setStatusText]    = useState<string | null>(null);

  const [pins,   setPins]   = useState<(ResolvedPin & { visible: boolean })[]>([]);
  const pinsRef  = useRef<(ResolvedPin & { visible: boolean })[]>([]);

  const nonPassIssues = issues.filter(i => i.severity !== 'Pass');

  const scale    = containerW / (screenshotWidth  || 1280);
  const displayH = (screenshotHeight || 900) * scale;

  // ── Scanner animation state ────────────────────────────────────────────────
  const anim = useRef({
    x:          60,
    y:          0,
    targetX:    60,
    targetY:    0,
    phase:      'moving' as 'moving' | 'scanning' | 'done',
    pinIdx:     0,
    frameCount: 0,
    scanFrames: 0,
    scanY:      0,
    waypoints:  [] as { x: number; y: number }[],
    dir:        1,
  });

  // ── Canvas draw ────────────────────────────────────────────────────────────
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const a = anim.current;
    const W = canvas.width;

    ctx.clearRect(0, 0, W, canvas.height);
    if (a.phase === 'done') return;

    const { x, y } = a;

    // Faint dot trail while moving
    if (a.phase === 'moving' && a.frameCount % 3 === 0) {
      ctx.save();
      ctx.fillStyle = `${principle.color}44`;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Expanding rings while scanning
    if (a.phase === 'scanning') {
      for (let r = 0; r < 3; r++) {
        const prog   = ((a.scanFrames / SCAN_FRAMES) + r / 3) % 1;
        const radius = 14 + prog * 56;
        const alpha  = (1 - prog) * 0.55;
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = principle.color + Math.round(alpha * 255).toString(16).padStart(2, '0');
        ctx.lineWidth   = 1.5;
        ctx.stroke();
        ctx.restore();
      }

      // Dashed bounding-box highlight
      const pin = pinsRef.current[a.pinIdx];
      if (pin?.wPct && pin.hPct) {
        const bW = Math.max(pin.wPct * W, 24);
        const bH = Math.max(pin.hPct * displayH, 14);
        ctx.save();
        ctx.strokeStyle = principle.color + '88';
        ctx.lineWidth   = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x - bW / 2, y - bH / 2, bW, bH);
        ctx.restore();
      }
    }
  }, [containerW, displayH, principle]);

  // ── RAF loop ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!started) return;

    const tick = () => {
      const a = anim.current;
      a.frameCount++;

      if (a.phase === 'moving') {
        if (a.waypoints.length === 0) {
          a.x = a.targetX;
          a.y = a.targetY;
          const allPins = pinsRef.current;
          if (a.pinIdx < allPins.length) {
            a.phase      = 'scanning';
            a.scanFrames = 0;
            a.dir        = 1;
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
          const nextWp = a.waypoints[0];
          const dx   = nextWp.x - a.x;
          const dy   = nextWp.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (Math.abs(dx) > 0.5) a.dir = dx > 0 ? 1 : -1;
          if (dist < WANDER_SPEED) {
            a.x = nextWp.x; a.y = nextWp.y;
            a.waypoints.shift();
          } else {
            a.x += (dx / dist) * WANDER_SPEED;
            a.y += (dy / dist) * WANDER_SPEED;
          }
        }
        if (spriteRef.current) {
          spriteRef.current.style.transform =
            `translate(${Math.round(a.x - 20) || 0}px, ${Math.round(a.y - 20) || 0}px) scaleX(${a.dir || 1})`;
        }
      } else if (a.phase === 'scanning') {
        a.scanFrames++;
        if (a.scanFrames === Math.floor(SCAN_FRAMES / 2)) {
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
            const pagePxY = next.yPct * displayH;
            const scrollTo = Math.max(0, Math.min(pagePxY - a.scanY, displayH - a.scanY));
            scrollRef.current?.scrollTo({ top: scrollTo, behavior: 'smooth' });
            a.targetX = next.xPct * containerW;
            a.targetY = a.scanY;
            a.waypoints = [];
            for (let i = 1; i <= WANDER_WAYPOINTS; i++) {
              const progress = i / (WANDER_WAYPOINTS + 1);
              const baseX = a.x + (a.targetX - a.x) * progress;
              const baseY = a.y + (a.targetY - a.y) * progress;
              const noiseAmt = Math.sin(progress * Math.PI) * 100;
              a.waypoints.push({
                x: Math.max(20, Math.min(containerW - 20, baseX + (Math.random() * 2 - 1) * noiseAmt)),
                y: Math.max(20, Math.min(a.scanY + 200,  baseY + (Math.random() * 2 - 1) * noiseAmt)),
              });
            }
            a.waypoints.push({ x: a.targetX, y: a.targetY });
          }
        }
      }

      drawFrame();
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [started, containerW, displayH, drawFrame]);

  // ── Start / restart ────────────────────────────────────────────────────────
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

    // Step 1: use pre-resolved coords from the scan session
    let resolved: (ResolvedPin | null)[] = nonPassIssues.map((issue) => {
      const key = issue.selector || issue.element;
      const box = key ? elementCoords[key] : undefined;
      if (box && box.xPct > 0 && box.yPct > 0 && box.xPct <= 1 && box.yPct <= 1) {
        return { xPct: box.xPct, yPct: box.yPct, wPct: box.wPct ?? 0, hPct: box.hPct ?? 0, issue, precise: true };
      }
      return null;
    });

    // Step 2: live fallback for unresolved issues
    const missingIdxs = resolved.map((r, i) => (r === null ? i : -1)).filter(i => i >= 0);
    if (missingIdxs.length > 0) {
      setLoadingCoords(true);
      try {
        const res = await fetch(`/api/coords/${sessionId}`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            elements: missingIdxs.map(i => nonPassIssues[i].element || nonPassIssues[i].selector || ''),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          missingIdxs.forEach((origIdx, liveIdx) => {
            const live = data.coords?.[liveIdx];
            if (live?.found && live.xPct > 0 && live.yPct > 0 && live.xPct <= 1 && live.yPct <= 1) {
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

    // Step 3: fallback positions for still-unresolved issues
    const unresolvedCount = resolved.filter(r => r === null).length;
    let fallbackSlot = 0;
    const finalResolved: ResolvedPin[] = resolved.map((r, i) => {
      if (r !== null) return r;
      const yPct = unresolvedCount === 1
        ? 0.5
        : 0.1 + (fallbackSlot / Math.max(unresolvedCount - 1, 1)) * 0.8;
      fallbackSlot++;
      return { xPct: 0.5, yPct, wPct: 0, hPct: 0, issue: nonPassIssues[i], precise: false };
    });

    // Sort top → bottom so scanner scrolls naturally downward
    let validPins = finalResolved.sort((a, b) => a.yPct - b.yPct);

    // De-overlap: nudge pins that land within 36px (Y) and 28px (X) of each other
    validPins = validPins.map((pin, i) => {
      if (i === 0) return pin;
      const prev  = validPins[i - 1];
      const dyPx  = (pin.yPct - prev.yPct) * dispH;
      const dxPx  = Math.abs(pin.xPct - prev.xPct) * w;
      if (dyPx < 36 && dxPx < 28) {
        return { ...pin, xPct: Math.min(0.95, pin.xPct + 40 / w) };
      }
      return pin;
    });

    if (validPins.length === 0) {
      setStarted(true);
      setAnimDone(true);
      return;
    }

    const canvas = canvasRef.current;
    if (canvas) { canvas.width = w; canvas.height = stageH; }

    const withVisible = validPins.map(p => ({ ...p, visible: false }));
    pinsRef.current = withVisible;
    setPins(withVisible);

    const first      = validPins[0];
    const initScroll = Math.max(0, Math.min(first.yPct * dispH - scanY, dispH - stageH));

    const wpts: { x: number; y: number }[] = [];
    for (let i = 1; i <= WANDER_WAYPOINTS; i++) {
      const progress = i / (WANDER_WAYPOINTS + 1);
      const baseX    = 40 + (first.xPct * w - 40) * progress;
      const noiseAmt = Math.sin(progress * Math.PI) * 100;
      wpts.push({
        x: Math.max(20, Math.min(w - 20, baseX + (Math.random() * 2 - 1) * noiseAmt)),
        y: Math.max(20, Math.min(scanY + 200, scanY + (Math.random() * 2 - 1) * noiseAmt)),
      });
    }
    wpts.push({ x: first.xPct * w, y: scanY });

    anim.current = {
      x: 40, y: scanY,
      targetX: first.xPct * w, targetY: scanY,
      phase: 'moving', pinIdx: 0, frameCount: 0, scanFrames: 0,
      scanY, waypoints: wpts, dir: 1,
    };

    setStarted(true);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: initScroll, behavior: 'smooth' });
    });
  }, [nonPassIssues, elementCoords, sessionId, screenshotWidth, screenshotHeight]);

  // ── Per-principle sprites ──────────────────────────────────────────────────
  //
  // perceivable  → giant eye with iris + scan beam shooting from pupil
  // operable     → hand/cursor with a keyboard key underfoot
  // understandable → lightbulb with a circuit brain inside
  // robust       → wrench body gripping a code bracket
  //
  const ScannerSprite = () => {
    const c = principle.color;

    if (principle.id === 'perceivable') {
      // Eye — sclera oval, iris, pupil, eyelid arc, scan beam from pupil
      return (
        <svg width="44" height="40" viewBox="0 0 44 40" aria-hidden="true">
          {/* Sclera */}
          <ellipse cx="20" cy="22" rx="16" ry="10" fill="#fff" stroke={c} strokeWidth="1.5" />
          {/* Iris */}
          <circle cx="20" cy="22" r="7" fill={c} opacity="0.85" />
          {/* Pupil */}
          <circle cx="20" cy="22" r="3.5" fill="#0a0a14" />
          {/* Catchlight */}
          <circle cx="22" cy="20" r="1.2" fill="#fff" opacity="0.7" />
          {/* Upper eyelid arc */}
          <path d="M4 22 Q20 8 36 22" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" />
          {/* Scan beam from pupil */}
          <line x1="27" y1="22" x2="43" y2="22"
            stroke={c} strokeWidth="2" strokeLinecap="round" opacity="0.7"
            style={{ animation: 'beamPulse 0.7s ease-in-out infinite alternate' }} />
          {/* Small eyelash ticks */}
          <line x1="9"  y1="16" x2="7"  y2="14" stroke={c} strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
          <line x1="20" y1="12" x2="20" y2="10" stroke={c} strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
          <line x1="31" y1="16" x2="33" y2="14" stroke={c} strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
        </svg>
      );
    }

    if (principle.id === 'operable') {
      // Hand cursor with a keyboard key below it — represents keyboard operability
      return (
        <svg width="42" height="44" viewBox="0 0 42 44" aria-hidden="true">
          {/* Keyboard key (bottom) */}
          <rect x="6" y="30" width="28" height="11" rx="3" fill={c} opacity="0.25" stroke={c} strokeWidth="1.5" />
          <rect x="10" y="33" width="6"  height="5" rx="1.5" fill={c} opacity="0.5" />
          <rect x="18" y="33" width="6"  height="5" rx="1.5" fill={c} opacity="0.5" />
          <rect x="26" y="33" width="5"  height="5" rx="1.5" fill={c} opacity="0.5" />
          {/* Pointer finger */}
          <rect x="17" y="5"  width="6" height="18" rx="3" fill="#e5e7eb" stroke={c} strokeWidth="1.2" />
          {/* Middle finger */}
          <rect x="24" y="9"  width="5.5" height="14" rx="2.5" fill="#e5e7eb" stroke={c} strokeWidth="1.2" />
          {/* Ring finger */}
          <rect x="11" y="11" width="5.5" height="12" rx="2.5" fill="#e5e7eb" stroke={c} strokeWidth="1.2" />
          {/* Palm */}
          <rect x="11" y="19" width="19" height="11" rx="4" fill="#e5e7eb" stroke={c} strokeWidth="1.2" />
          {/* Thumb */}
          <rect x="6"  y="22" width="6"  height="8"  rx="3" fill="#e5e7eb" stroke={c} strokeWidth="1.2" />
          {/* Tap ripple at fingertip */}
          <circle cx="20" cy="10" r="4" fill="none" stroke={c} strokeWidth="1"
            opacity="0.5" style={{ animation: 'beamPulse 0.9s ease-in-out infinite alternate' }} />
        </svg>
      );
    }

    if (principle.id === 'understandable') {
      // Lightbulb with a simple circuit-brain pattern inside
      return (
        <svg width="38" height="46" viewBox="0 0 38 46" aria-hidden="true">
          {/* Bulb glass */}
          <path d="M8 18 Q8 4 19 4 Q30 4 30 18 Q30 26 24 30 L14 30 Q8 26 8 18Z"
            fill={c} opacity="0.18" stroke={c} strokeWidth="1.8" />
          {/* Filament / brain lines inside */}
          <path d="M13 20 Q15 16 19 19 Q23 22 25 18"
            fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
          <path d="M13 24 Q16 21 19 23 Q22 25 25 22"
            fill="none" stroke={c} strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
          {/* Base ridges */}
          <rect x="13" y="30" width="12" height="3"  rx="1.5" fill={c} opacity="0.5" />
          <rect x="14" y="34" width="10" height="3"  rx="1.5" fill={c} opacity="0.4" />
          <rect x="16" y="38" width="6"  height="2.5" rx="1.2" fill={c} opacity="0.3" />
          {/* Glow dot at top */}
          <circle cx="19" cy="11" r="3" fill={c} opacity="0.35"
            style={{ animation: 'beamPulse 0.9s ease-in-out infinite alternate' }} />
          {/* Sparkle lines */}
          <line x1="4"  y1="10" x2="1"  y2="7"  stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
          <line x1="34" y1="10" x2="37" y2="7"  stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
          <line x1="4"  y1="20" x2="1"  y2="20" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
          <line x1="34" y1="20" x2="37" y2="20" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
        </svg>
      );
    }

    // robust — wrench gripping an angle bracket < >
    return (
      <svg width="42" height="42" viewBox="0 0 42 42" aria-hidden="true">
        {/* Code brackets */}
        <text x="6" y="28" fontSize="22" fontFamily="monospace" fontWeight="bold" fill={c} opacity="0.25">{'<>'}</text>
        {/* Wrench handle */}
        <rect x="18" y="20" width="6" height="18" rx="3" fill={c}
          transform="rotate(-40 21 21)" />
        {/* Wrench head (open-end circle with gap) */}
        <circle cx="28" cy="13" r="8" fill="none" stroke={c} strokeWidth="4" />
        {/* Gap to make it an open wrench */}
        <rect x="23" y="9" width="4" height="9" fill="#0f0f1a" />
        {/* Inner nut hex hint */}
        <circle cx="28" cy="13" r="3" fill={c} opacity="0.4" />
        {/* Scan spark at tip */}
        <circle cx="12" cy="34" r="2.5" fill={c} opacity="0.6"
          style={{ animation: 'beamPulse 0.75s ease-in-out infinite alternate' }} />
        <line x1="12" y1="30" x2="12" y2="27" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
        <line x1="9"  y1="32" x2="6"  y2="31" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
        <line x1="15" y1="32" x2="18" y2="31" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      </svg>
    );
  };

  // ── Pin flag badge ─────────────────────────────────────────────────────────
  const PinBadge = ({ issue }: { issue: AccessibilityIssue }) => {
    const isCritical = issue.severity === 'Critical';
    const color      = isCritical ? '#ef4444' : '#f59e0b';
    return (
      <svg width="24" height="30" viewBox="0 0 24 30" style={{
        display: 'block',
        filter: `drop-shadow(0 0 6px ${color})`,
        transformOrigin: 'bottom left',
        animation: 'flagPlant 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
      }}>
        <line x1="2" y1="2" x2="2" y2="30" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
        <path d="M3 2 L22 8 L3 14 Z" fill={color} />
        <text x="8" y="10" fill="#fff" fontSize="8" fontFamily="sans-serif" fontWeight="bold">
          {isCritical ? '!' : '?'}
        </text>
      </svg>
    );
  };

  const visiblePins = pins.filter(p => p.visible);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ── Stage wrapper ── */}
      <div
        ref={wrapperRef}
        style={{
          position: 'relative',
          width:    '100%',
          borderRadius: '8px',
          border:   `1px solid ${started ? principle.color + '44' : '#1a1a2e'}`,
          overflow: 'hidden',
          backgroundColor: '#060610',
          transition: 'border-color 0.3s',
        }}
      >
        {/* ── Scrollable viewport ── */}
        <div
          ref={scrollRef}
          style={{
            height:    `${animDone ? Math.min(displayH, 800) : (started ? Math.min(displayH, 580) : 220)}px`,
            overflowY:  'auto',
            overflowX:  'hidden',
            transition: 'height 0.4s ease',
            scrollbarWidth: 'thin',
            scrollbarColor: `${principle.color}44 transparent`,
          }}
        >
          {started ? (
            <div style={{ position: 'relative', width: '100%', height: `${displayH}px` }}>

              {/* Screenshot */}
              {hasScreenshot && (
                <img
                  src={`/api/screenshot/${sessionId}`}
                  alt="Page screenshot"
                  aria-hidden="true"
                  style={{
                    position: 'absolute', top: 0, left: 0,
                    width: '100%', height: 'auto',
                    opacity: 1,
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}
                />
              )}

              {/* Pins — one per Critical/Warning issue ─────────────── */}
              {pins.map((pin, i) => {
                if (!pin.visible) return null;
                const isCrit    = pin.issue.severity === 'Critical';
                const pinColor  = isCrit ? '#ef4444' : '#f59e0b';
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
                      background: 'none', border: 'none',
                      padding: 0, cursor: 'pointer',
                      animation: 'pinDrop 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards',
                      zIndex: 5,
                    }}
                  >
                    <PinBadge issue={pin.issue} />

                    {/* Error label chip */}
                    <div style={{
                      position:   'absolute',
                      top:        '2px',
                      ...(labelRight ? { right: '26px' } : { left: '26px' }),
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
                    border: `2px solid ${principle.color}`,
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                  }} />
                  <span style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '7px', color: principle.color }}>
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
                      backgroundColor: principle.color,
                      color: '#fff',
                      fontFamily: '"Press Start 2P", monospace',
                      fontSize: '9px',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      boxShadow: `0 0 24px ${principle.color}55`,
                    }}
                  >
                    ▶ Start Scan
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Canvas (scan rings, hidden when done) ── */}
        {started && !animDone && (
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute', top: 0, left: 0,
              width: '100%',
              height: `${Math.min(displayH, 580)}px`,
              pointerEvents: 'none',
              zIndex: 10,
            }}
          />
        )}

        {/* ── Scanner sprite ── */}
        {started && !animDone && (
          <div
            ref={spriteRef}
            style={{
              position: 'absolute', top: 0, left: 0,
              width: '40px', height: '40px',
              transform: `translate(${Math.round(anim.current.x - 20) || 0}px, ${Math.round(anim.current.y - 20) || 0}px) scaleX(${anim.current.dir || 1})`,
              pointerEvents: 'none',
              zIndex: 25,
            }}
          >
            <ScannerSprite />
          </div>
        )}

        {/* Status bar */}
        {started && !animDone && statusText && (
          <div style={{
            position: 'absolute', bottom: '12px', left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: '82%',
            padding: '5px 12px',
            backgroundColor: '#0c0c1ecc',
            border: `1px solid ${principle.color}44`,
            borderRadius: '4px',
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '7px',
            color: '#e5e7eb',
            lineHeight: 1.7,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
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
            position: 'absolute', top: '10px', left: '50%',
            transform: 'translateX(-50%)',
            padding: '4px 10px',
            backgroundColor: '#0c0c1ecc',
            border: `1px solid ${principle.color}44`,
            borderRadius: '4px',
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '6px',
            color: principle.color,
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
              position: 'absolute', top: '10px', right: '10px',
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
          border: `1px solid ${selectedPin.issue.severity === 'Critical' ? '#ef4444' : '#f59e0b'}44`,
          borderRadius: '8px',
          animation: 'fadeSlideIn 0.2s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <span style={{
              fontFamily: '"Press Start 2P", monospace', fontSize: '7px',
              color:  selectedPin.issue.severity === 'Critical' ? '#ef4444' : '#f59e0b',
              border: `1px solid ${selectedPin.issue.severity === 'Critical' ? '#ef4444' : '#f59e0b'}`,
              padding: '3px 8px', borderRadius: '3px',
            }}>
              {selectedPin.issue.severity.toUpperCase()}
            </span>
            {selectedPin.issue.wcag && (
              <span style={{ fontSize: '10px', color: '#6b7280', fontFamily: 'monospace' }}>
                WCAG {selectedPin.issue.wcag}
              </span>
            )}
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
              display: 'block', padding: '6px 10px', marginBottom: '10px',
              backgroundColor: '#0c0c1e', border: '1px solid #1a1a2e',
              borderRadius: '4px', fontSize: '11px', color: '#93c5fd',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
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
              <span style={{
                fontFamily: '"Press Start 2P", monospace', fontSize: '6px',
                color: '#4b83c0', display: 'block', marginBottom: '4px',
              }}>
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
          ✓ No issues — all {principle.label} checks pass
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
        @keyframes beamPulse {
          from { opacity: 0.3; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

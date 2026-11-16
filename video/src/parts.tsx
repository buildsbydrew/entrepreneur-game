// The pieces both videos are built from: footage clips, captions, the title, premise, chapter,
// time-jump, decision and end cards. The look matches the game's own interface: cream paper, dark brown ink,
// orange and teal.
import React from 'react';
import { AbsoluteFill, Easing, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont as loadTitleFont } from '@remotion/google-fonts/Fredoka';
import { loadFont as loadTextFont } from '@remotion/google-fonts/Nunito';

const { fontFamily: TITLE } = loadTitleFont('normal', { weights: ['600', '700'], subsets: ['latin'] });
const { fontFamily: TEXT } = loadTextFont('normal', { weights: ['700', '800'], subsets: ['latin'] });
export const FONTS = { TITLE, TEXT };

export const C = {
  ink: '#3b2a20',
  cream: '#fff4dc',
  paper: '#fffaf0',
  orange: '#f39c12',
  teal: '#1fa7a0',
  magenta: '#d6336c',
  sky: '#9ed6f2',
  night: '#2a1f2d'
};

export const sec = (s: number, fps: number) => Math.round(s * fps);

// One stretch of recorded footage, placed on the timeline
export const Clip: React.FC<{ src: string; at: number; dur: number; from: number; fps: number; volume?: number }> = ({ src, at, dur, from, fps }) => {
  const start = sec(at, fps);
  const length = Math.max(1, sec(at + dur, fps) - start);
  return (
    <Sequence from={start} durationInFrames={length} layout="none">
      <AbsoluteFill>
        <OffthreadVideo src={staticFile(src)} startFrom={sec(from, fps)} muted style={{ width: '100%', height: '100%' }} />
      </AbsoluteFill>
    </Sequence>
  );
};

// Fades in and out over a few frames
const useInOut = (length: number, edge = 7) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [0, edge, length - edge, length], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
};

// A caption telling the story, on paper, like the game's own boxes
export const Caption: React.FC<{ text: string; length: number; size?: number; top?: number; maxWidth?: number }> = ({ text, length, size = 46, top = 104, maxWidth = 1300 }) => {
  const o = useInOut(length);
  const frame = useCurrentFrame();
  const y = interpolate(frame, [0, 8], [-14, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ alignItems: 'center', pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', top, maxWidth, opacity: o, transform: `translateY(${y}px)`,
        background: C.paper, color: C.ink, border: `4px solid ${C.ink}`, borderRadius: 22, boxShadow: `0 7px 0 ${C.ink}`,
        padding: `${size * 0.32}px ${size * 0.62}px`, fontFamily: TEXT, fontWeight: 800, fontSize: size, lineHeight: 1.25, textAlign: 'center'
      }}>{text}</div>
    </AbsoluteFill>
  );
};

// A little robot face: the AI
export const Bot: React.FC<{ size: number; blink?: boolean }> = ({ size, blink }) => (
  <svg width={size} height={size} viewBox="0 0 40 40">
    <line x1="20" y1="3" x2="20" y2="9" stroke={C.ink} strokeWidth="3" strokeLinecap="round" />
    <circle cx="20" cy="4" r="3" fill={C.orange} stroke={C.ink} strokeWidth="2" />
    <rect x="5" y="9" width="30" height="26" rx="9" fill={C.teal} stroke={C.ink} strokeWidth="3" />
    <rect x="10" y="15" width="20" height="13" rx="5" fill={C.cream} stroke={C.ink} strokeWidth="2" />
    {blink ? <>
      <line x1="13.5" y1="21.5" x2="18" y2="21.5" stroke={C.ink} strokeWidth="2.4" strokeLinecap="round" />
      <line x1="22" y1="21.5" x2="26.5" y2="21.5" stroke={C.ink} strokeWidth="2.4" strokeLinecap="round" />
    </> : <>
      <circle cx="16" cy="21.5" r="2.4" fill={C.ink} />
      <circle cx="24" cy="21.5" r="2.4" fill={C.ink} />
    </>}
  </svg>
);

// Soft paper clouds drifting over a sky, for the title and end cards
export const Sky: React.FC<{ tint?: string }> = ({ tint = C.sky }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const clouds = [[0.12, 0.2, 1], [0.7, 0.13, 0.8], [0.4, 0.75, 1.2], [0.88, 0.62, 0.9], [0.2, 0.55, 0.7]];
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${tint} 0%, ${C.cream} 100%)` }}>
      {clouds.map(([x, y, s], i) => {
        const dx = ((x * width + frame * (0.5 + i * 0.12)) % (width + 400)) - 200;
        return (
          <svg key={i} style={{ position: 'absolute', left: dx, top: y * height }} width={220 * s} height={90 * s} viewBox="0 0 220 90">
            <path d="M30 80 Q5 80 10 58 Q15 38 45 42 Q55 12 95 18 Q125 0 150 25 Q190 18 195 50 Q218 55 210 75 Q205 82 190 80 Z" fill={C.paper} stroke={C.ink} strokeWidth="4" opacity="0.9" />
          </svg>
        );
      })}
    </AbsoluteFill>
  );
};

export const TitleCard: React.FC<{ item: any; vertical?: boolean }> = ({ item, vertical }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 4, fps, config: { damping: 12 } });
  const sub = spring({ frame: frame - 22, fps, config: { damping: 14 } });
  const s = vertical ? 0.8 : 1;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Sky />
      <div style={{ transform: `scale(${pop})`, textAlign: 'center', fontFamily: TITLE, color: C.ink, padding: '0 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}><Bot size={150 * s} blink={frame % 80 > 74} /></div>
        <div style={{ fontSize: 108 * s, fontWeight: 700, lineHeight: 1.02 }}>I let AI live<br />a whole life</div>
        <div style={{ fontSize: 56 * s, fontWeight: 600, color: C.orange, WebkitTextStroke: `2px ${C.ink}`, marginTop: 10 }}>in my game</div>
      </div>
      <div style={{ position: 'absolute', bottom: vertical ? 380 : 90, opacity: sub, transform: `translateY(${(1 - sub) * 30}px)`, fontFamily: TEXT, fontWeight: 800, fontSize: 40 * s, color: C.ink, background: C.paper, border: `4px solid ${C.ink}`, borderRadius: 18, padding: '10px 28px', boxShadow: `0 6px 0 ${C.ink}` }}>
        {item.name} · personality: {String(item.profile).toLowerCase()}
      </div>
    </AbsoluteFill>
  );
};

export const ChapterCard: React.FC<{ item: any; length: number; vertical?: boolean }> = ({ item, length, vertical }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inn = spring({ frame, fps, config: { damping: 15, stiffness: 120 } });
  const out = interpolate(frame, [length - 8, length], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const [head, ...rest] = String(item.title).split(':');
  const s = vertical ? 0.85 : 1;
  return (
    <AbsoluteFill style={{ background: C.night, alignItems: 'center', justifyContent: 'center', opacity: 1 - out * 0.9 }}>
      <div style={{
        transform: `translateY(${(1 - inn) * 80}px) rotate(${(1 - inn) * -3}deg)`, opacity: inn, background: C.paper, border: `5px solid ${C.ink}`,
        borderRadius: 30, boxShadow: `0 10px 0 ${C.ink}`, padding: vertical ? '50px 50px' : '46px 80px', textAlign: 'center', maxWidth: vertical ? 900 : 1500
      }}>
        <div style={{ fontFamily: TITLE, fontWeight: 700, fontSize: 120 * s, color: C.orange, WebkitTextStroke: `3px ${C.ink}`, lineHeight: 1 }}>{head}</div>
        {rest.length ? <div style={{ fontFamily: TITLE, fontWeight: 600, fontSize: 64 * s, color: C.ink, marginTop: 14 }}>{rest.join(':').trim()}</div> : null}
        {item.sub ? <div style={{ fontFamily: TEXT, fontWeight: 700, fontSize: 34 * s, color: C.ink, opacity: 0.6, marginTop: 10 }}>{item.sub}</div> : null}
      </div>
    </AbsoluteFill>
  );
};

export const EndCard: React.FC<{ item: any; length: number; vertical?: boolean }> = ({ item, length, vertical }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const st = item.story ?? {};
  const stats = item.stats ?? {};
  const show = (i: number) => spring({ frame: frame - 8 - i * 9, fps, config: { damping: 16 } });
  const s = vertical ? 0.86 : 1;
  // The plan picks moments from the whole life; otherwise the game's own list, each moment once
  const seen = new Set<string>();
  const moments = (item.moments ?? (st.moments ?? []).filter((m: any) => !/^Turned \d+/.test(m.text) && !seen.has(m.text) && Boolean(seen.add(m.text))).slice(-5));
  const teaser = interpolate(frame, [length - 110, length - 90], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const row = (i: number, child: React.ReactNode, style: React.CSSProperties = {}) => (
    <div style={{ opacity: show(i), transform: `translateY(${(1 - show(i)) * 24}px)`, ...style }}>{child}</div>
  );
  return (
    <AbsoluteFill>
      <Sky tint="#f7d9a8" />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: 1 - teaser }}>
        <div style={{ width: vertical ? 940 : 1400, background: C.paper, border: `5px solid ${C.ink}`, borderRadius: 34, boxShadow: `0 10px 0 ${C.ink}`, padding: vertical ? '50px 46px' : '50px 70px', fontFamily: TEXT, color: C.ink, textAlign: 'center' }}>
          {row(0, <div style={{ fontFamily: TITLE, fontWeight: 700, fontSize: 104 * s, lineHeight: 1 }}>{st.name}</div>)}
          {row(1, <div style={{ fontSize: 34 * s, opacity: 0.65, fontWeight: 700, marginTop: 6 }}>{st.years}</div>)}
          {row(2, <div style={{ fontSize: 38 * s, fontWeight: 800, marginTop: 18 }}>{st.cause}</div>)}
          {st.traits?.length ? row(3, <div style={{ fontSize: 42 * s, fontWeight: 800, color: C.teal, marginTop: 14 }}>Remembered as {st.traits.map((t: string) => t.toLowerCase()).join(' and ')}.</div>) : null}
          {st.closest?.length ? row(4, <div style={{ fontSize: 34 * s, fontWeight: 700, marginTop: 10 }}>Closest to {st.closest.join(', ')}</div>) : null}
          {row(5, <div style={{ textAlign: 'left', margin: '26px auto 0', maxWidth: 1100, fontSize: 29 * s, fontWeight: 700, lineHeight: 1.45 }}>
            {moments.map((m: any, i: number) => <div key={i}><span style={{ color: C.orange, fontWeight: 800 }}>Age {m.age} · </span>{m.text}</div>)}
          </div>)}
          {row(6, <div style={{ display: 'flex', justifyContent: 'center', gap: vertical ? 16 : 30, marginTop: 28, flexWrap: 'wrap' }}>
            {[[stats.choices, 'choices'], [stats.conversations, 'conversations'], [stats.playedDays, 'days played'], [st.money, 'left behind']].map(([n, l], i) => (
              <div key={i} style={{ background: C.cream, border: `3px solid ${C.ink}`, borderRadius: 16, padding: '8px 22px', fontSize: 30 * s, fontWeight: 800 }}>{n} <span style={{ opacity: 0.6 }}>{l}</span></div>
            ))}
          </div>)}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: teaser }}>
        <div style={{ textAlign: 'center', fontFamily: TITLE, color: C.ink, padding: '0 80px' }}>
          <div style={{ fontSize: 84 * s, fontWeight: 700 }}>{item.question ?? 'What would YOU have done?'}</div>
          <div style={{ fontSize: 50 * s, fontWeight: 600, color: C.orange, WebkitTextStroke: `2px ${C.ink}`, marginTop: 12 }}>Tell me in the comments</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// One line on a dark screen: the premise, or "And then, one day..."
export const LineCard: React.FC<{ text: string; length: number; vertical?: boolean }> = ({ text, length, vertical }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 10, length - 10, length], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: C.night, alignItems: 'center', justifyContent: 'center', padding: vertical ? 90 : 200 }}>
      <div style={{ opacity: o, fontFamily: TITLE, fontWeight: 600, fontSize: vertical ? 70 : 64, color: C.cream, textAlign: 'center', lineHeight: 1.25 }}>{text}</div>
    </AbsoluteFill>
  );
};

// A time jump, told in a sentence or two: "A year passed. Ada spent it with family."
export const JumpCard: React.FC<{ item: any; length: number; vertical?: boolean }> = ({ item, length, vertical }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const o = interpolate(frame, [0, 8, length - 8, length], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const rise = spring({ frame, fps, config: { damping: 18 } });
  const s = vertical ? 1.05 : 1;
  return (
    <AbsoluteFill style={{ background: C.night, alignItems: 'center', justifyContent: 'center', padding: vertical ? 80 : 160 }}>
      <div style={{ opacity: o, transform: `translateY(${(1 - rise) * 24}px)`, textAlign: 'center', color: C.cream, fontFamily: TEXT }}>
        {item.age !== undefined ? <div style={{ fontFamily: TITLE, fontWeight: 700, fontSize: 40 * s, color: C.orange, letterSpacing: 2 }}>AGE {item.age}</div> : null}
        <div style={{ fontFamily: TITLE, fontWeight: 600, fontSize: 78 * s, lineHeight: 1.1, marginTop: 6 }}>{item.title}</div>
        {item.text ? <div style={{ fontWeight: 800, fontSize: 44 * s, marginTop: 14, opacity: 0.92 }}>{item.text}</div> : null}
        {(item.events ?? []).map((e: string, i: number) => (
          <div key={i} style={{ fontWeight: 700, fontSize: 36 * s, marginTop: 10, opacity: interpolate(frame, [14 + i * 10, 24 + i * 10], [0, 0.8], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>{e}</div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// One of the few big decisions of the life: the question, in the edit's own style (never the game's menu)
export const DecisionCard: React.FC<{ item: any; length: number; vertical?: boolean }> = ({ item, length, vertical }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 11, stiffness: 150 } });
  const o = interpolate(frame, [length - 6, length], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const push = interpolate(frame, [0, length], [1, 1.06]);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 45%, #43304a 0%, ${C.night} 70%)`, alignItems: 'center', justifyContent: 'center', opacity: o }}>
      <div style={{ transform: `scale(${pop * push})`, textAlign: 'center', padding: vertical ? '0 70px' : '0 180px' }}>
        <div style={{ fontFamily: TEXT, fontWeight: 800, fontSize: vertical ? 40 : 34, color: C.orange, letterSpacing: 6 }}>DECISION</div>
        {item.question ? <div style={{ fontFamily: TITLE, fontWeight: 700, fontSize: vertical ? 78 : 76, color: C.cream, lineHeight: 1.15, marginTop: 12 }}>{item.question}</div> : (item.options ?? []).map((o: string, i: number) => (
          <React.Fragment key={i}>
            {i > 0 ? <div style={{ fontFamily: TEXT, fontWeight: 800, fontSize: vertical ? 44 : 38, color: C.orange, margin: '10px 0' }}>or</div> : null}
            <div style={{ fontFamily: TITLE, fontWeight: 700, fontSize: vertical ? 66 : 62, color: C.cream, lineHeight: 1.15, marginTop: i ? 0 : 14 }}>{o}</div>
          </React.Fragment>
        ))}
      </div>
    </AbsoluteFill>
  );
};

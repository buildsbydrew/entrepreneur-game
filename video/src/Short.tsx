// The 60-second vertical Short. Text stays inside the part of the screen that YouTube, TikTok and
// Instagram don't cover with their buttons.
import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Caption, Chip, Clip, TitleCard, Bot, C, FONTS, sec } from './parts';

const BigAge: React.FC<{ text: string; length: number }> = ({ text, length }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 10, stiffness: 140 } });
  const o = interpolate(frame, [length - 6, length], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ alignItems: 'center', top: 330 }}>
      <div style={{ fontFamily: FONTS.TITLE, fontWeight: 700, fontSize: 150, color: C.orange, WebkitTextStroke: `4px ${C.ink}`, transform: `scale(${pop})`, opacity: o, textShadow: `0 8px 0 ${C.ink}` }}>{text}</div>
    </AbsoluteFill>
  );
};

const Outro: React.FC<{ name: string }> = ({ name }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 12 } });
  return (
    <AbsoluteFill style={{ background: C.night, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ transform: `scale(${pop})`, textAlign: 'center', fontFamily: FONTS.TITLE, color: C.cream, padding: '0 80px' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}><Bot size={170} /></div>
        <div style={{ fontSize: 76, fontWeight: 700, marginTop: 20, lineHeight: 1.1 }}>{name}'s whole life</div>
        <div style={{ fontSize: 54, fontWeight: 600, color: C.orange }}>is on the channel</div>
      </div>
    </AbsoluteFill>
  );
};

export const Short: React.FC<{ id: string; plan: any }> = ({ plan }) => {
  const { fps } = useVideoConfig();
  if (!plan) return null;
  return (
    <AbsoluteFill style={{ background: C.night }}>
      {plan.items.map((item: any, i: number) => {
        if (item.kind === 'clip') return <Clip key={i} src={plan.footage} at={item.at} dur={item.dur} from={item.from} fps={fps} />;
        const from = sec(item.at, fps);
        const length = Math.max(1, sec(item.at + item.dur, fps) - from);
        return (
          <Sequence key={i} from={from} durationInFrames={length}>
            {item.kind === 'title' && <TitleCard item={item} vertical />}
            {item.kind === 'outro' && <Outro name={item.name} />}
          </Sequence>
        );
      })}
      {plan.chips.map((c: any, i: number) => {
        const from = sec(c.at, fps);
        const length = sec(c.dur, fps);
        return (
          <Sequence key={`chip${i}`} from={from} durationInFrames={length}>
            <Chip label="AI picks" text={c.pick} why={c.why} length={length} scale={1.35} style={{ right: 70, left: 70, width: 'auto', bottom: 'auto', top: 520, transformOrigin: 'center top' }} />
          </Sequence>
        );
      })}
      {plan.captions.map((c: any, i: number) => {
        const from = sec(c.at, fps);
        const length = sec(c.dur, fps);
        return (
          <Sequence key={`cap${i}`} from={from} durationInFrames={length}>
            {c.big && /^Age \d+$/.test(c.text) ? <BigAge text={c.text} length={length} /> : <Caption text={c.text} length={length} size={56} top={c.big ? 300 : 250} maxWidth={940} />}
          </Sequence>
        );
      })}
      <Audio src={staticFile(plan.soundtrack)} />
    </AbsoluteFill>
  );
};

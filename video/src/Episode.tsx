// The full episode, 16:9: title card, footage clips with the dull bits cut, chapter cards per age,
// time-jump captions, a few decision cards, and the end card, over the soundtrack made by audio.mjs.
import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useVideoConfig } from 'remotion';
import { Caption, Clip, TitleCard, ChapterCard, EndCard, LineCard, JumpCard, DecisionCard, IntroCard, TbcCard, C, sec } from './parts';

export const Episode: React.FC<{ id: string; plan: any }> = ({ plan }) => {
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
            {item.kind === 'title' && <TitleCard item={item} />}
            {item.kind === 'chapter' && <ChapterCard item={item} length={length} />}
            {item.kind === 'end' && <EndCard item={item} length={length} />}
            {(item.kind === 'premise' || item.kind === 'quote') && <LineCard text={item.text} length={length} small={item.small} />}
            {item.kind === 'intro' && <IntroCard item={item} src={plan.footage} length={length} />}
            {item.kind === 'tbc' && <TbcCard item={item} length={length} />}
            {item.kind === 'jump' && <JumpCard item={item} length={length} />}
            {item.kind === 'decision' && <DecisionCard item={item} length={length} />}
          </Sequence>
        );
      })}
      {plan.captions.map((c: any, i: number) => {
        const from = sec(c.at, fps);
        const length = sec(c.dur, fps);
        return <Sequence key={`cap${i}`} from={from} durationInFrames={length}><Caption text={c.text} length={length} /></Sequence>;
      })}
      <Audio src={staticFile(plan.soundtrack)} />
    </AbsoluteFill>
  );
};

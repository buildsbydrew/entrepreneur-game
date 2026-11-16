// The videos: the full episode (16:9) and the Short (9:16). Each reads its edit plan, made by
// plan.mjs (episode) or short.mjs (Short), from public/episode/<id>/.
import React from 'react';
import { Composition, Still, staticFile } from 'remotion';
import { Episode } from './Episode';
import { ShortThumbnail, Thumbnail } from './Thumbnail';
import { Short } from './Short';

const loadPlan = async (file: string) => {
  const res = await fetch(staticFile(file));
  if (!res.ok) throw new Error(`No plan at public/${file}. Run plan.mjs (or short.mjs) first.`);
  return res.json();
};

export const Root: React.FC = () => (
  <>
    <Composition
      id="Episode"
      component={Episode}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={300}
      defaultProps={{ id: 'ep01', plan: null as any }}
      calculateMetadata={async ({ props }) => {
        const plan = await loadPlan(`episode/${props.id}/plan.json`);
        return { durationInFrames: plan.frames, props: { ...props, plan } };
      }}
    />
    <Still
      id="Thumbnail"
      component={Thumbnail}
      width={1280}
      height={720}
      defaultProps={{ image: 'thumb/remy1.jpg', big: 'WHO IS HE?', small: 'An AI lives a whole life in my game', tag: 'EPISODE 1' }}
    />
    <Still
      id="ShortThumbnail"
      component={ShortThumbnail}
      width={1080}
      height={1920}
      defaultProps={{ image: 'thumb/remy1-short.jpg', big: 'AN AI IS LIVING HIS WHOLE LIFE', small: 'Every choice is its own.', tag: 'EPISODE 1' }}
    />
    <Composition
      id="Short"
      component={Short}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={300}
      defaultProps={{ id: 'ep01', plan: null as any }}
      calculateMetadata={async ({ props }) => {
        const plan = await loadPlan(`episode/${props.id}/short-plan.json`);
        return { durationInFrames: plan.frames, props: { ...props, plan } };
      }}
    />
  </>
);

// The videos: the full episode (16:9) and the Short (9:16). Each reads its edit plan, made by
// plan.mjs (episode) or short.mjs (Short), from public/episode/<id>/.
import React from 'react';
import { Composition, staticFile } from 'remotion';
import { Episode } from './Episode';
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

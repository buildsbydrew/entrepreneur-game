// The YouTube thumbnail for an episode (1280x720): a frame from the episode on the right, a big
// question on the left. Render: npx remotion still src/index.ts Thumbnail out/<id>-thumbnail.png --props=...
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { loadFont as loadTitleFont } from '@remotion/google-fonts/Fredoka';
import { loadFont as loadTextFont } from '@remotion/google-fonts/Nunito';

const { fontFamily: TITLE } = loadTitleFont('normal', { weights: ['700'], subsets: ['latin'] });
const { fontFamily: TEXT } = loadTextFont('normal', { weights: ['800', '900'], subsets: ['latin'] });

export type ThumbnailProps = { image: string; big: string; small: string; tag: string };

// The Short's cover (1080x1920): the frame on top, fading into the words below.
export const ShortThumbnail: React.FC<ThumbnailProps> = ({ image, big, small, tag }) => (
  <AbsoluteFill style={{ backgroundColor: '#0d1426' }}>
    <Img src={staticFile(image)} style={{
      position: 'absolute', left: 0, top: 0, width: 1080, height: 'auto',
      filter: 'brightness(1.4) contrast(1.12) saturate(1.25)',
    }} />
    <AbsoluteFill style={{ background: 'linear-gradient(180deg, #0d142600 42%, #0d1426cc 54%, #0d1426 60.5%)' }} />
    <div style={{ position: 'absolute', left: 60, right: 60, top: 1120, textAlign: 'center' }}>
      <div style={{
        display: 'inline-block', background: '#ff4d3d', color: 'white', fontFamily: TEXT, fontWeight: 900,
        fontSize: 44, padding: '8px 24px', borderRadius: 10, letterSpacing: 1,
      }}>{tag}</div>
      <div style={{
        fontFamily: TITLE, fontWeight: 700, fontSize: 124, lineHeight: 0.98, color: '#ffd23f', marginTop: 30,
        textShadow: '4px 4px 0 #000, -4px 4px 0 #000, 4px -4px 0 #000, -4px -4px 0 #000, 0 10px 0 #000',
      }}>{big}</div>
      <div style={{
        fontFamily: TEXT, fontWeight: 900, fontSize: 54, color: 'white', marginTop: 30,
        textShadow: '0 4px 0 #000, 0 0 24px #000',
      }}>{small}</div>
    </div>
  </AbsoluteFill>
);

export const Thumbnail: React.FC<ThumbnailProps> = ({ image, big, small, tag }) => (
  <AbsoluteFill style={{ backgroundColor: '#0d1426' }}>
    <Img src={staticFile(image)} style={{
      position: 'absolute', right: -330, top: -20, height: 760, width: 'auto',
      filter: 'brightness(1.35) contrast(1.15) saturate(1.2)',
    }} />
    <AbsoluteFill style={{ background: 'linear-gradient(90deg, #0d1426 0%, #0d1426ee 32%, #0d142600 52%)' }} />
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 70% 45%, transparent 45%, #000a 100%)' }} />
    <div style={{ position: 'absolute', left: 56, top: 64, width: 560 }}>
      <div style={{
        display: 'inline-block', background: '#ff4d3d', color: 'white', fontFamily: TEXT, fontWeight: 900,
        fontSize: 30, padding: '6px 16px', borderRadius: 8, letterSpacing: 1,
      }}>{tag}</div>
      <div style={{
        fontFamily: TITLE, fontWeight: 700, fontSize: 136, lineHeight: 0.95, color: '#ffd23f', marginTop: 26,
        textShadow: '3px 3px 0 #000, -3px 3px 0 #000, 3px -3px 0 #000, -3px -3px 0 #000, 0 8px 0 #000, 0 0 40px #000c',
      }}>{big}</div>
      <div style={{
        fontFamily: TEXT, fontWeight: 900, fontSize: 46, lineHeight: 1.1, color: 'white', marginTop: 30,
        textShadow: '0 4px 0 #000, 0 0 24px #000',
      }}>{small}</div>
    </div>
  </AbsoluteFill>
);

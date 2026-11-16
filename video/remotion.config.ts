import { Config } from '@remotion/cli/config';

// This laptop has little memory: one frame at a time, and patience with slow frames
Config.setConcurrency(1);
Config.setDelayRenderTimeoutInMilliseconds(300000);
Config.setVideoImageFormat('jpeg');

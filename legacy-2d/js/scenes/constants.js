// Numbers shared by the scenes: sizes, speeds, and which things draw in front of which.
export const WORLD_W = 2400;
export const WORLD_H = 1400;
export const INTERACT_RANGE = 110;
export const REPORT_W = 480;
export const REPORT_H = 590;
export const PERSON_W = 72;
export const PERSON_H = 108;
export const STALL_SCALE = 1.1;
export const ACCEL = 1500; // how quickly the player picks up speed
export const DRAG = 1300;  // how quickly the player slows down when you let go
export const MENTOR_SPEED = 95; // how fast Maame Gyasiwaa walks when she is on her way to talk to you
export const MENTOR_ERRAND_SPEED = 65; // and when she goes shopping

// Things in the world sort by their position on the ground (their y value),
// so anything lower on screen draws in front. Interface layers sit above all of it.
export const DEPTH = {
  ground: -1000,
  mat: -500,
  marks: -400,
  prompt: 3000,
  floatText: 3500,
  hud: 5000,
  report: 6000
};

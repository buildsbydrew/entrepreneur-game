// What the player chose on the setup screen. It lives here so every scene can read it.
import { PLAYER_LOOK } from './art/people.js';

export const DEFAULT_STALL_NAME = 'My Stall';

export const profile = {
  stallName: DEFAULT_STALL_NAME,
  look: { ...PLAYER_LOOK, wrap: '#f6c026' }
};

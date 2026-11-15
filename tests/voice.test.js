// Checks for the Urlivani voices: the words, the voices and the feelings (the sound itself needs a browser).
import { describe, it, expect } from 'vitest';
import { urlivaniWord, speechPlan, voiceFor, feelingOf } from '../src/audio/voice.js';

describe('Urlivani', () => {
  it('turns the same English word into the same Urlivani word, every time', () => {
    expect(urlivaniWord('Mum')).toEqual(urlivaniWord('mum'));
    expect(urlivaniWord('hello')).toEqual(urlivaniWord('hello'));
    expect(urlivaniWord('hello')).not.toEqual(urlivaniWord('goodbye'));
  });

  it('gives longer words more syllables, up to four', () => {
    expect(urlivaniWord('I').length).toBe(1);
    expect(urlivaniWord('extraordinarily').length).toBe(4);
    expect(urlivaniWord('123')).toEqual([]);
  });

  it('plans pauses, trailing off and laughs', () => {
    const plan = speechPlan('Well, ha ha... fine.');
    expect(plan.some(p => p.pause && !p.trail)).toBe(true);
    expect(plan.some(p => p.laugh)).toBe(true);
    expect(plan.some(p => p.trail)).toBe(true);
  });
});

describe('voices', () => {
  it('children sound higher than adults, and elders slower', () => {
    const child = voiceFor({ body: 'boy', stage: 'child', seed: 'nico' });
    const adult = voiceFor({ body: 'boy', stage: 'adult', seed: 'nico' });
    const elder = voiceFor({ body: 'boy', stage: 'elder', seed: 'nico' });
    expect(child.pitch).toBeGreaterThan(adult.pitch);
    expect(elder.speed).toBeLessThan(adult.speed);
    expect(elder.shake).toBeGreaterThan(0);
  });

  it('gives different people different voices', () => {
    const a = voiceFor({ body: 'girl', stage: 'adult', seed: 'mum' });
    const b = voiceFor({ body: 'girl', stage: 'adult', seed: 'pell' });
    expect(a.pitch).not.toBe(b.pitch);
  });
});

describe('feelings', () => {
  it('guesses the feeling of a line', () => {
    expect(feelingOf('No! Get out!')).toBe('angry');
    expect(feelingOf("I'm sorry. I miss him.")).toBe('sad');
    expect(feelingOf('Haha, yes!')).toBe('happy');
    expect(feelingOf('The shop opens at seven.')).toBe('calm');
  });
});

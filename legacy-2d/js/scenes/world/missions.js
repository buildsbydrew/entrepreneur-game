// The goals panel, finishing goals, and the level-complete screen.
// These methods are added to the scene, so `this` is the scene.
import { state, completeLevel, advanceLevel } from '../../state.js';
import { play } from '../../audio/sound.js';
import { showLevelComplete } from '../../ui/screens.js';
import { checkMission, updateMissions, levelProgress, describeMission } from '../../missions.js';
import { DEPTH } from '../constants.js';

export const missionsMethods = {
  // ---------- Levels and missions ----------
  createMissionPanel() {
    this.missionText = this.add.text(16, 178, '', {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 10, y: 8 },
      lineSpacing: 6,
      wordWrap: { width: 300 }
    }).setScrollFactor(0).setDepth(DEPTH.hud);

    this.refreshMissions();
  },

  currentLevel() {
    const levels = this.levelsData.levels;
    return levels.find(level => level.id === state.level) ?? levels[0];
  },

  // Checks the goals against what has happened, announces any that were just finished,
  // and notes when a whole level is done. Pass true once the day has ended.
  refreshMissions(dayEnded = false) {
    const level = this.currentLevel();

    if (!state.levelsDone.includes(level.id)) {
      updateMissions(level, state, this.setting, { dayEnded })
        .forEach(mission => {
          play('mission');
          this.showBanner(`Mission complete: ${describeMission(mission, this.setting)}`);
        });

      if (levelProgress(level, state).complete) this.levelUpPending = true;
    }

    this.drawMissionPanel();
  },

  drawMissionPanel() {
    const level = this.currentLevel();
    const lines = [`LEVEL ${level.id}: ${level.name.toUpperCase()}`];

    if (state.levelsDone.includes(level.id)) {
      lines.push('\u2713 Level complete!');
      const next = this.levelsData.levels.find(l => l.id === level.id + 1);
      if (next) lines.push(`Next: ${next.name}${next.comingSoon ? ' (coming soon)' : ''}`);
    } else {
      level.missions.forEach(mission => {
        const done = state.missionsDone.includes(mission.id);
        const progress = checkMission(mission, state).progress;
        const note = !done && progress ? ` (${progress})` : '';
        lines.push(`${done ? '\u2713' : '\u25CB'} ${describeMission(mission, this.setting)}${note}`);
      });
    }

    this.missionText.setText(lines.join('\n'));
  },

  // Shows the level-complete screen if the last goal was just finished, then carries on
  maybeShowLevelComplete(then) {
    if (!this.levelUpPending) {
      then();
      return;
    }

    this.levelUpPending = false;
    const level = this.currentLevel();
    completeLevel(level.id);

    const next = this.levelsData.levels.find(l => l.id === level.id + 1);
    advanceLevel(this.levelsData.levels); // the next level opens, if there is one
    play('levelUp');
    this.openModal();
    if (this.report) this.report.setVisible(false);

    showLevelComplete({
      levelId: level.id,
      levelName: level.name,
      missions: level.missions.map(mission => describeMission(mission, this.setting)),
      nextName: next ? (next.comingSoon ? `${next.name} (coming soon)` : next.name) : null,
      onDone: () => {
        this.closeModal();
        this.drawMissionPanel();
        then();
      }
    });
  },
};

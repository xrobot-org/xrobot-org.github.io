/* RingBuffer self-playing scenes. No DOM: runs in node (sim.test.mjs).
   The receive path runs all the time; every SCENE_PERIOD_S of running time one scene plays on top of it, alternating:
     away   the read thread stops reading (`Read` not called) -> the queue fills -> reading resumes -> the queue drains
     burst  the receive interrupt is held off -> the bytes stay in the DMA ring -> released, one copy into the queue
   The runner owns only what it switched on: when the reader (hover, press, key) or a control they set takes over, it puts its own
   switches back and stays quiet. `tick` takes screen seconds; the engine feeds it from its animation frames. */

export type Caption = 'idle' | 'awayOn' | 'awayOff' | 'burstOn' | 'burstOff';
export type SceneState = { away: boolean; held: boolean; caption: Caption };

export const SCENES = {
  first: 3,     // first scene starts this long after the loop starts
  period: 10,   // from the start of one scene to the start of the next
  away: { offAt: 3.4, endAt: 8 },    // reading stops at 0, resumes at offAt, the caption stays until endAt
  burst: { offAt: 2.4, endAt: 6.5 },   // interrupt held from 0 to offAt, the caption after the release stays until endAt
  retry: 1.5,   // after a pause, the next scene starts this soon
} as const;

const IDLE: SceneState = { away: false, held: false, caption: 'idle' };
const same = (a: SceneState, b: SceneState): boolean => a.away === b.away && a.held === b.held && a.caption === b.caption;

export class SceneRunner {
  state: SceneState = { ...IDLE };
  /** scenes started so far: even -> away, odd -> burst */
  count = 0;
  private waitLeft: number = SCENES.first;
  private scene: 'away' | 'burst' | null = null;
  private local = 0;

  /** advance by dt screen seconds. `hold`: the reader has the controls (or the page is not to play itself): scenes stop and
      anything the runner switched on is put back. Returns the new state when it changed. */
  tick(dt: number, hold: boolean): SceneState | null {
    const before = this.state;
    if (hold) {
      if (this.scene) { this.scene = null; this.waitLeft = SCENES.retry; this.state = { ...IDLE }; }
      else this.waitLeft = Math.max(this.waitLeft, SCENES.retry);
      return same(before, this.state) ? null : this.state;
    }
    if (!this.scene) {
      this.waitLeft -= dt;
      if (this.waitLeft <= 0) {
        this.scene = this.count % 2 === 0 ? 'away' : 'burst';
        this.count += 1;
        this.local = 0;
        this.state = this.scene === 'away' ? { away: true, held: false, caption: 'awayOn' } : { away: false, held: true, caption: 'burstOn' };
      }
    } else {
      this.local += dt;
      const sc = SCENES[this.scene];
      if (this.local >= sc.endAt) {
        this.waitLeft = SCENES.period - sc.endAt;
        this.scene = null;
        this.state = { ...IDLE };
      } else if (this.local >= sc.offAt) {
        this.state = this.scene === 'away' ? { away: false, held: false, caption: 'awayOff' } : { away: false, held: false, caption: 'burstOff' };
      }
    }
    return same(before, this.state) ? null : this.state;
  }
  get playing(): boolean { return this.scene !== null; }
}

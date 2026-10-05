/* Shared by the widgets that play themselves: the "user touched it" gate. No DOM, runs under node (autoplay.test.mjs).
   Any pointer enter, press, key or focus on a control pauses the self-playing; it resumes after RESUME_MS without input.
   A pointer that stays over the control keeps it paused (hover count), the quiet time starts when it leaves. */

export const RESUME_MS = 8000;
/** how often a paused widget looks again while the pointer rests on a control */
export const HOVER_POLL_MS = 400;

export class UserIdle {
  private until = -Infinity;
  private hovers = 0;
  readonly resumeMs: number;
  private readonly clock: () => number;
  constructor(resumeMs: number = RESUME_MS, clock: () => number = () => performance.now()) {
    this.resumeMs = resumeMs;
    this.clock = clock;
  }

  /** a click, key or focus: quiet time restarts */
  touch(): void { this.until = this.clock() + this.resumeMs; }
  enter(): void { this.hovers += 1; this.touch(); }
  leave(): void { this.hovers = Math.max(0, this.hovers - 1); this.touch(); }
  paused(now: number = this.clock()): boolean { return this.hovers > 0 || now < this.until; }
  /** ms until it is worth asking again (0 when not paused) */
  waitMs(now: number = this.clock()): number {
    if (this.hovers > 0) return HOVER_POLL_MS;
    return Math.max(0, Math.ceil(this.until - now));
  }
}

/** event props for any React element that holds controls (React's synthetic names; no React import here) */
export type IdleProps = {
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onPointerDown: () => void;
  onKeyDown: () => void;
  onFocus: () => void;
};
export function idleProps(idle: UserIdle): IdleProps {
  return {
    onPointerEnter: () => idle.enter(),
    onPointerLeave: () => idle.leave(),
    onPointerDown: () => idle.touch(),
    onKeyDown: () => idle.touch(),
    onFocus: () => idle.touch(),
  };
}

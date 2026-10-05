/**
 * SameCode: one BlinkLED Module on four kinds of hardware and systems.
 *
 * The Module asks for a `LibXR::GPIO&`, the configuration binds it to the name `LED`, and each
 * platform's entry source registers its own GPIO object under that name with `XR_REGISTER`.
 * Selecting a platform connects the name tag to that board's pin, draws the net to its LED and blinks
 * it; the Module and the configuration panels stay unchanged ("0 lines changed"). While visible the
 * widget steps through the platforms on its own; a pick holds that platform for HOLD_MS.
 * Board drawings: static/showcase/samecode/<id>.svg (2.5D, model materials), anchors in ./art.ts
 * (generated together).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { translate } from '@docusaurus/Translate';
import useBaseUrl from '@docusaurus/useBaseUrl';
import { Tag, highlightCpp, inlineCode } from '@site/src/components/xr';
import type { ShowcaseWidgetProps } from '../Showcase';
import {
  BOARDS,
  BOARD_RECT,
  BLINK_CYCLE_MS,
  CONFIG_CODE,
  CONFIG_FILE,
  MODULE_CODE,
  MODULE_FILE,
  REGISTERED_NAME,
  STAGE_H,
  STAGE_W,
  TAG,
  bindingPoints,
  fit,
  laneTicks,
  ledLevel,
  nextBoard,
  splitMarks,
  tracePoints,
  type Board,
  type BoardId,
  type Point,
} from './sim';
import { BOARD_ART } from './art';
import styles from './styles.module.css';

/** Trace window: the last three seconds of the LED pin. */
const TRACE_WINDOW_MS = 3000;
/** Explanation-layer loop: time on each platform while playing, and the pause after the reader picks one. */
const DWELL_MS = 4000;
const HOLD_MS = 8000;
/** Scheduling lane: wake marks drawn every 25 ms (the 1 ms refreshes, thinned). */
const LANE_STEP_MS = 25;
/** Still frame for reduced motion: right edge of the trace inside an "on" interval. */
const STILL_T_MS = TRACE_WINDOW_MS + 3 * BLINK_CYCLE_MS / 2;

/** LED colour of each board (model material), for the glow drawn around it. */
const LED_TINT: Record<BoardId, string> = {
  stm32: 'var(--m-led-b)',
  ch32: 'var(--m-led-g)',
  mspm0: 'var(--m-led-b)',
  linux: 'var(--m-led-r)',
};

type Drawing = { viewBox: string; inner: string };
const drawingCache = new Map<string, Promise<Drawing>>();
function loadDrawing(url: string): Promise<Drawing> {
  let p = drawingCache.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${url}: ${r.status}`))))
      .then((text) => ({
        viewBox: /viewBox="([^"]+)"/.exec(text)?.[1] ?? '0 0 1 1',
        inner: text.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, ''),
      }));
    p.catch(() => drawingCache.delete(url));
    drawingCache.set(url, p);
  }
  return p;
}

function systemName(board: Board): string {
  switch (board.system) {
    case 'threadx':
      return translate({ id: 'showcase.SameCode.system.threadx', message: 'ThreadX' });
    case 'freertos':
      return translate({ id: 'showcase.SameCode.system.freertos', message: 'FreeRTOS' });
    case 'none':
      return translate({ id: 'showcase.SameCode.system.none', message: '裸机' });
    default:
      return translate({ id: 'showcase.SameCode.system.linux', message: 'Linux 用户态' });
  }
}

function MarkedCode({ code, cpp, flash }: { code: string; cpp: boolean; flash?: boolean }): JSX.Element {
  return (
    <pre className={`xr-code-pre ${styles.pre}`}>
      <code>
        {splitMarks(code).map((run, i) =>
          run.mark ? (
            <mark key={i} className={`${run.mark === 'name' ? styles.markName : styles.markPin} ${flash ? styles.markFlash : ''}`}>
              {run.text}
            </mark>
          ) : (
            <React.Fragment key={i}>{cpp ? highlightCpp(run.text) : run.text}</React.Fragment>
          ),
        )}
      </code>
    </pre>
  );
}

function Panel({ file, aside, children, flash }: { file: string; aside: React.ReactNode; children: React.ReactNode; flash?: boolean }): JSX.Element {
  return (
    <figure className={`xr-code ${styles.panel} ${flash ? styles.flash : ''}`}>
      <figcaption className="xr-code-title">
        <span className={styles.file}>{file}</span>
        <span className={styles.aside}>{aside}</span>
      </figcaption>
      {children}
    </figure>
  );
}

function pts(points: Point[]): string {
  return points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
}

const RAYS: Point[] = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1.4]];

function BoardStage({ board, led, drawing, round }: { board: Board; led: boolean; drawing?: Drawing; round: number }): JSX.Element {
  const art = BOARD_ART[board.id];
  const box = fit(art.viewBox, BOARD_RECT);
  const pin = box.map(art.pin);
  const [lx, ly] = box.map(art.led);
  const net = art.route.map(box.map);
  const binding = bindingPoints(pin).reverse();
  const html = useMemo(() => (drawing ? { __html: drawing.inner } : undefined), [drawing]);
  const label = translate(
    {
      id: 'showcase.SameCode.boardAria',
      message: '{platform} · {system}：名字 {name} 绑定到引脚 {pin}，LED {state}',
    },
    {
      platform: board.platform,
      system: systemName(board),
      name: REGISTERED_NAME,
      pin: board.pin,
      state: led
        ? translate({ id: 'showcase.SameCode.ledOn', message: '亮' })
        : translate({ id: 'showcase.SameCode.ledOff', message: '灭' }),
    },
  );
  return (
    <svg className={styles.board} viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} role="img" aria-label={label}>
      <g key={`${board.id}-${round}`} className={styles.art}>
        {html ? (
          <svg
            x={box.x}
            y={box.y}
            width={box.w}
            height={box.h}
            viewBox={drawing?.viewBox}
            className={`sc-board sc-${board.id}${led ? ' sc-on' : ''}`}
            aria-hidden="true"
            dangerouslySetInnerHTML={html}
          />
        ) : null}
        {led ? (
          <g className={styles.glow} style={{ stroke: LED_TINT[board.id] }}>
            {RAYS.map(([dx, dy], i) => (
              <line key={i} x1={lx + dx * 6} y1={ly + dy * 5} x2={lx + dx * 11} y2={ly + dy * 9} />
            ))}
          </g>
        ) : null}
        <polyline className={styles.netHalo} points={pts(net)} />
        <polyline className={styles.net} points={pts(net)} pathLength={1} />
        <polyline className={styles.bindingHalo} points={pts(binding)} />
        <polyline className={styles.binding} points={pts(binding)} pathLength={1} />
        <rect className={styles.pinPulse} x={pin[0] - 6} y={pin[1] - 6} width={12} height={12} />
        <rect className={styles.pinPad} x={pin[0] - 2.5} y={pin[1] - 2.5} width={5} height={5} />
        <g className={styles.tagGroup}>
          <rect className={styles.tag} x={TAG.x} y={TAG.y} width={TAG.w} height={TAG.h} />
          <text className={styles.tagText} x={TAG.x + TAG.w / 2} y={TAG.y + 14} textAnchor="middle">
            {REGISTERED_NAME}
          </text>
        </g>
      </g>
    </svg>
  );
}

function laneText(board: Board): { name: string; note: string; aria: string } {
  if (board.scheduling === 'loop') {
    return {
      name: translate({ id: 'showcase.SameCode.lane.loop', message: '主循环' }),
      note: translate({ id: 'showcase.SameCode.lane.loopNote', message: '空闲时按 1 ms 刷新' }),
      aria: translate(
        {
          id: 'showcase.SameCode.lane.loopAria',
          message: '裸机没有线程：主循环等待时检查 1 ms 时基，每过 1 ms 刷新一次定时器，计满 {ms} 次调用 BlinkLED。',
        },
        { ms: String(BLINK_CYCLE_MS) },
      ),
    };
  }
  return {
    name: 'libxr_timer_task',
    note: translate({ id: 'showcase.SameCode.lane.threadNote', message: '每 1 ms 唤醒' }),
    aria: translate(
      {
        id: 'showcase.SameCode.lane.threadAria',
        message: '{system}：定时器线程 libxr_timer_task 每 1 ms 唤醒一次，计满 {ms} 次调用 BlinkLED。',
      },
      { system: systemName(board), ms: String(BLINK_CYCLE_MS) },
    ),
  };
}

export default function SameCode({ active, reducedMotion }: ShowcaseWidgetProps): JSX.Element {
  const [boardId, setBoardId] = useState<BoardId>('stm32');
  const [led, setLed] = useState(true);
  const [round, setRound] = useState(0);
  const [held, setHeld] = useState(false);
  const [drawings, setDrawings] = useState<Partial<Record<BoardId, Drawing>>>({});
  const traceRef = useRef<SVGPolylineElement>(null);
  const wakeRef = useRef<SVGPathElement>(null);
  const runRef = useRef<SVGPathElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const board = BOARDS.find((b) => b.id === boardId) ?? BOARDS[0];
  const baseUrl = useBaseUrl('/');

  // Board drawings: all four at once, so a switch never waits for the network.
  useEffect(() => {
    let alive = true;
    for (const b of BOARDS) {
      loadDrawing(baseUrl + b.art.replace(/^\//, ''))
        .then((d) => {
          if (alive) setDrawings((m) => ({ ...m, [b.id]: d }));
        })
        .catch(() => undefined);
    }
    return () => {
      alive = false;
    };
  }, [baseUrl]);

  // Blink, trace and scheduling lane: one requestAnimationFrame loop while active; the clock restarts with each switch.
  useEffect(() => {
    const draw = (t: number) => {
      traceRef.current?.setAttribute('points', tracePoints(t, TRACE_WINDOW_MS, 3, 21));
      wakeRef.current?.setAttribute('d', laneTicks(t, TRACE_WINDOW_MS, LANE_STEP_MS, 21, 15, 15));
      runRef.current?.setAttribute('d', laneTicks(t, TRACE_WINDOW_MS, BLINK_CYCLE_MS, 21, 3, 3));
    };
    if (reducedMotion) {
      setLed(true);
      draw(STILL_T_MS);
      return undefined;
    }
    if (!active) return undefined;
    let raf = 0;
    let last: boolean | null = null;
    const start = performance.now();
    const tick = (now: number) => {
      const t = now - start + TRACE_WINDOW_MS;
      const level = ledLevel(t);
      if (level !== last) {
        last = level;
        setLed(level);
      }
      draw(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, reducedMotion, boardId, round]);

  // Explanation-layer loop: next platform every DWELL_MS; after a pick, HOLD_MS before it resumes.
  useEffect(() => {
    if (!active || reducedMotion) return undefined;
    const timer = window.setTimeout(
      () => {
        setHeld(false);
        setBoardId((id) => nextBoard(id));
        setRound((n) => n + 1);
      },
      held ? HOLD_MS : DWELL_MS,
    );
    return () => window.clearTimeout(timer);
  }, [active, reducedMotion, boardId, round, held]);

  const select = useCallback((id: BoardId, focus = false) => {
    setHeld(true);
    setBoardId(id);
    setRound((n) => n + 1);
    if (focus) {
      const i = BOARDS.findIndex((b) => b.id === id);
      tabRefs.current[i]?.focus();
    }
  }, []);

  const onTabKey = (event: React.KeyboardEvent) => {
    let target: BoardId | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') target = nextBoard(boardId, 1);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') target = nextBoard(boardId, -1);
    else if (event.key === 'Home') target = BOARDS[0].id;
    else if (event.key === 'End') target = BOARDS[BOARDS.length - 1].id;
    if (target) {
      event.preventDefault();
      select(target, true);
    }
  };

  const unchanged = translate({ id: 'showcase.SameCode.unchanged', message: '改动 0 行' });
  const panelId = 'samecode-panel';
  const lane = laneText(board);
  const flash = round > 0;
  const zeroTag = (
    <span key={round} className={flash ? styles.zeroFlash : undefined}>
      <Tag variant="solid">{unchanged}</Tag>
    </span>
  );

  return (
    <div className={`${styles.root} ${reducedMotion ? styles.still : ''}`}>
      <div
        className={styles.tabs}
        role="tablist"
        aria-label={translate({ id: 'showcase.SameCode.tablist', message: '选择硬件与系统' })}
        onKeyDown={onTabKey}
      >
        {BOARDS.map((b, i) => {
          const selected = b.id === boardId;
          return (
            <button
              key={b.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`samecode-tab-${b.id}`}
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              className={`${styles.tab} ${selected ? styles.tabSelected : ''}`}
              onClick={() => select(b.id)}
            >
              <span className={styles.tabPlatform}>{b.platform}</span>
              {b.system !== 'linux' ? <span className={styles.tabSystem}>{systemName(b)}</span> : null}
            </button>
          );
        })}
      </div>

      <div className={styles.body} id={panelId} role="tabpanel" aria-labelledby={`samecode-tab-${board.id}`}>
        <div className={styles.boardColumn}>
          <BoardStage board={board} led={led} drawing={drawings[board.id]} round={round} />
          <div className={styles.trace}>
            <span className={styles.traceName}>{REGISTERED_NAME}</span>
            <svg className={styles.traceSvg} viewBox={`0 0 ${TRACE_WINDOW_MS} 24`} preserveAspectRatio="none" aria-hidden="true">
              <line className={styles.traceBase} x1={0} y1={21} x2={TRACE_WINDOW_MS} y2={21} />
              <polyline ref={traceRef} className={styles.traceLine} points={tracePoints(STILL_T_MS, TRACE_WINDOW_MS, 3, 21)} />
            </svg>
            <span className={styles.traceNote}>
              {translate(
                { id: 'showcase.SameCode.traceNote', message: '每 {ms} ms 翻转' },
                { ms: String(BLINK_CYCLE_MS) },
              )}
            </span>
          </div>
          <div className={styles.trace} role="img" aria-label={lane.aria} title={lane.aria}>
            <span className={styles.laneName}>{lane.name}</span>
            <svg className={styles.traceSvg} viewBox={`0 0 ${TRACE_WINDOW_MS} 24`} preserveAspectRatio="none" aria-hidden="true">
              {board.scheduling === 'loop' ? (
                <rect className={styles.laneBand} x={0} y={16} width={TRACE_WINDOW_MS} height={5} />
              ) : (
                <path ref={wakeRef} className={styles.laneWake} d={laneTicks(STILL_T_MS, TRACE_WINDOW_MS, LANE_STEP_MS, 21, 15, 15)} />
              )}
              <path ref={runRef} className={styles.laneRun} d={laneTicks(STILL_T_MS, TRACE_WINDOW_MS, BLINK_CYCLE_MS, 21, 3, 3)} />
            </svg>
            <span className={styles.traceNote}>{lane.note}</span>
          </div>
        </div>

        <div className={styles.codeColumn}>
          <Panel file={MODULE_FILE} aside={zeroTag}>
            <MarkedCode code={MODULE_CODE} cpp />
          </Panel>
          <Panel file={`${CONFIG_FILE} · blinkled_0`} aside={zeroTag}>
            <MarkedCode key={round} code={CONFIG_CODE.split('\n').slice(2).join('\n')} cpp={false} flash={flash} />
          </Panel>
          <Panel
            key={`${board.id}-${round}`}
            file={board.entryFile}
            flash={flash}
            aside={
              <Tag>
                {board.generated
                  ? translate({ id: 'showcase.SameCode.generated', message: '由 libxr gen --xrobot 生成' })
                  : translate({ id: 'showcase.SameCode.handwritten', message: 'BSP 入口源文件' })}
              </Tag>
            }
          >
            <MarkedCode code={board.entry} cpp flash={flash} />
          </Panel>
        </div>
      </div>

      <p className={styles.caption}>
        {inlineCode(
          translate({
            id: 'showcase.SameCode.caption',
            message: '模块按类型声明需要的 GPIO，配置按名字 `LED` 绑定，各平台的入口源文件用 `XR_REGISTER` 注册这个名字。',
          }),
        )}
      </p>
    </div>
  );
}

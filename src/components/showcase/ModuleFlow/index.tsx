/**
 * ModuleFlow: fetching, locking and main-function generation, replayed step by step.
 *
 * Left: a terminal that replays what xrobot 1.0.0 printed in an empty BSP (sim.ts, checked against
 * the real logs in sim.test.mjs). Right: the four files the steps touch, as each step leaves them,
 * with the lines that step added or rewrote marked; the commit each Module is locked to is shown
 * inverted in xrobot.lock.
 *
 * - Steps: add a Module → setup (fetch and lock) → configure instances → gen. The tabs select a
 *   step directly; the loop starts by itself whenever the widget is `active` and keeps going at one even rhythm: the
 *   lines of a step appear (CMD_MS / OUT_MS each), the finished step holds HOLD_MS (the last one LAP_HOLD_MS), then the
 *   next step follows; a lap ends at step 0 again with the BMI088 choice flipped (sim.test.mjs: a lap within 20 s).
 * - A press, key or focus on the widget pauses the loop (autoplay.ts) and it resumes RESUME_AFTER_INPUT_MS after the
 *   last one. Hovering does not pause it: a pointer resting over the widget while the page scrolls would otherwise
 *   hold the loop indefinitely. The pause button is the reader's own explicit stop and stays until pressed again.
 * - The checkbox adds the IMU driver BMI088 as a second Module (variant 2).
 * - `reducedMotion`: the last step, fully shown, no playback.
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { translate } from '@docusaurus/Translate';
import { highlightCpp, inlineCode } from '@site/src/components/xr';
import type { ShowcaseWidgetProps } from '../Showcase';
import { UserIdle } from '../autoplay';
import {
  COMMIT_LINE,
  FILE_IDS,
  FILE_NAME,
  FILE_PATH,
  HOLD_MS,
  LAP_HOLD_MS,
  nextVariant,
  RESUME_AFTER_INPUT_MS,
  STEPS,
  STEP_COUNT,
  fileText,
  fileView,
  lineDelay,
  nextStep,
  stepChanges,
  transcript,
  type FileChange,
  type FileId,
  type Output,
  type StepId,
  type TermLine,
  type Variant,
} from './sim';
import styles from './styles.module.css';

const LAST = STEP_COUNT - 1;
/** `  // <id>: <owner/Repo> (<config>:<line>)`: the comment xrobot gen writes before each instance. */
const INSTANCE_COMMENT = /^ {2}\/\/ \w+: [\w-]+\/[\w-]+ \(/;
/** `  owner/Repo:` under `modules:` in xrobot.lock: one locked Module. */
const LOCKED_MODULE = /^ {2}[\w-]+\/[\w-]+:$/;

function stepLabel(id: StepId): string {
  switch (id) {
    case 'add':
      return translate({ id: 'showcase.ModuleFlow.step.add', message: '添加模块' });
    case 'setup':
      return translate({ id: 'showcase.ModuleFlow.step.setup', message: '拉取与锁定' });
    case 'instance':
      return translate({ id: 'showcase.ModuleFlow.step.instance', message: '配置实例' });
    default:
      return translate({ id: 'showcase.ModuleFlow.step.gen', message: '生成主函数' });
  }
}

function stepCaption(id: StepId): string {
  switch (id) {
    case 'add':
      return translate({
        id: 'showcase.ModuleFlow.caption.add',
        message: '`xrobot module add` 把模块请求写入 `Modules/modules.yaml`。',
      });
    case 'setup':
      return translate({
        id: 'showcase.ModuleFlow.caption.setup',
        message: '`xrobot setup` 拉取模块，把每个模块锁定到 `xrobot.lock` 中的具体提交，并生成 `User/xrobot_main.hpp`。',
      });
    case 'instance':
      return translate({
        id: 'showcase.ModuleFlow.caption.instance',
        message: '`xrobot instance add` 按构造函数写出参数和默认值，`xrobot instance set` 把依赖参数填写为入口源文件中注册的对象名。',
      });
    default:
      return translate({
        id: 'showcase.ModuleFlow.caption.gen',
        message: '`xrobot gen` 根据 `User/xrobot.yaml` 生成主函数 `XRobotMain`，每个实例是按配置顺序构造的静态对象。',
      });
  }
}

/** One output line in the page language; the wording is the CLI's own (XR_LANG=zh / en). */
function outputText(o: Output): string {
  switch (o.kind) {
    case 'moduleAdded':
      return translate(
        { id: 'showcase.ModuleFlow.out.moduleAdded', message: '已添加 {req}；请运行 `xrobot setup` 获取它' },
        { req: o.req },
      );
    case 'resolved':
      return o.n === 1
        ? translate({ id: 'showcase.ModuleFlow.out.resolvedOne', message: '已解析 {n} 个模块提交' }, { n: String(o.n) })
        : translate({ id: 'showcase.ModuleFlow.out.resolvedMany', message: '已解析 {n} 个模块提交' }, { n: String(o.n) });
    case 'setupDone':
      return translate({
        id: 'showcase.ModuleFlow.out.setupDone',
        message: '已检查 1 个配置；已为 User/xrobot.yaml 生成 User/xrobot_main.hpp',
      });
    case 'instanceAdded':
      return translate(
        { id: 'showcase.ModuleFlow.out.instanceAdded', message: '已将 {id} 添加到 User/xrobot.yaml；生成前请填写值为空的依赖参数' },
        { id: o.id },
      );
    case 'candidates':
      return translate(
        { id: 'showcase.ModuleFlow.out.candidates', message: '  {arg}（{type}）：{names}' },
        {
          arg: o.arg,
          type: o.type,
          names: o.names.join(translate({ id: 'showcase.ModuleFlow.out.listSep', message: '、' })),
        },
      );
    case 'set':
      return translate(
        { id: 'showcase.ModuleFlow.out.set', message: '已修改 User/xrobot.yaml 中 {id} 的 {path}' },
        { id: o.id, path: o.path },
      );
    default:
      return translate({ id: 'showcase.ModuleFlow.out.genDone', message: '已为 User/xrobot.yaml 生成 User/xrobot_main.hpp' });
  }
}

function changeLabel(change: FileChange): string {
  switch (change.state) {
    case 'absent':
      return translate({ id: 'showcase.ModuleFlow.file.absent', message: '尚未生成' });
    case 'new':
      return translate({ id: 'showcase.ModuleFlow.file.new', message: '新文件' });
    case 'unchanged':
      return translate({ id: 'showcase.ModuleFlow.file.unchanged', message: '未变化' });
    default:
      return `+${change.added} −${change.removed}`;
  }
}

function Term({ lines, past }: { lines: TermLine[]; past: boolean }): JSX.Element {
  return (
    <>
      {lines.map((line, i) =>
        'cmd' in line ? (
          <div key={i} className={`${styles.termLine} ${past ? styles.past : ''}`}>
            <span className={styles.prompt}>$ </span>
            <span className={styles.cmd}>{line.cmd}</span>
          </div>
        ) : (
          <div key={i} className={`${styles.termLine} ${past ? styles.past : ''}`}>
            {outputText(line.out)}
          </div>
        ),
      )}
    </>
  );
}

function yamlLine(text: string): React.ReactNode {
  if (/^\s*#/.test(text)) return <span className="xr-tk-com">{text}</span>;
  const commit = COMMIT_LINE.exec(text);
  if (commit) {
    return (
      <>
        {commit[1]}
        <mark className={styles.commit}>{commit[2]}</mark>
      </>
    );
  }
  const m = /^(\s*-?\s*)([A-Za-z_][\w-]*:)(.*)$/.exec(text);
  if (!m) return text;
  const value = m[3];
  return (
    <>
      {m[1]}
      <span className={styles.key}>{m[2]}</span>
      {/^\s*["'].*["']$/.test(value) ? <span className="xr-tk-str">{value}</span> : value}
    </>
  );
}

/** Line to scroll to: the first instance in the header, the first locked Module in the lock, else the first marked line. */
function scrollTarget(lines: string[] | null, marked: Set<number>, file: FileId): number {
  if (!lines || marked.size === 0) return -1;
  const sorted = Array.from(marked).sort((a, b) => a - b); // Array.from: loose-mode spread does not iterate Sets
  const anchor = file === 'main' ? INSTANCE_COMMENT : file === 'lock' ? LOCKED_MODULE : null;
  const hit = anchor ? sorted.find((i) => anchor.test(lines[i])) : undefined;
  return hit ?? sorted[0];
}

export default function ModuleFlow({ active, reducedMotion }: ShowcaseWidgetProps): JSX.Element {
  const [variant, setVariant] = useState<Variant>(1);
  const [step, setStep] = useState(0);
  const [shown, setShown] = useState(0); // transcript lines of the current step on screen
  const [playing, setPlaying] = useState(true);
  const idle = useMemo(() => new UserIdle(RESUME_AFTER_INPUT_MS), []);
  const [tickAt, setTickAt] = useState(0); // a touch re-runs the playback effect at once, so the running timer is cancelled
  const touch = () => { idle.touch(); setTickAt((n) => n + 1); };
  const idleEvents = { onPointerDown: touch, onKeyDown: touch, onFocus: touch };
  const [picked, setPicked] = useState<FileId | null>(null); // file chosen by the reader in this step
  const termRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const lines = transcript(step, variant);
  const full = lines.length;

  // Reduced motion: the last step, complete, no playback.
  useEffect(() => {
    if (!reducedMotion) return;
    setPlaying(false);
    setStep(LAST);
    setShown(Number.MAX_SAFE_INTEGER);
  }, [reducedMotion]);

  // Playback (explanation layer): reveal the step line by line, hold, go on; loops while active. The timer lives only
  // while active and not paused by the reader; a pause is re-checked when the quiet time is over.
  useEffect(() => {
    if (!active || reducedMotion || !playing) return undefined;
    if (idle.paused()) {
      const wake = window.setTimeout(() => setTickAt((n) => n + 1), Math.max(250, idle.waitMs()));
      return () => window.clearTimeout(wake);
    }
    const done = shown >= full;
    const delay = done ? (step === LAST ? LAP_HOLD_MS : HOLD_MS) : lineDelay(lines[shown]);
    const timer = window.setTimeout(() => {
      if (done) {
        if (step === LAST) setVariant((v) => nextVariant(v));
        setStep(nextStep(step));
        setShown(0);
        setPicked(null);
      } else {
        setShown(shown + 1);
      }
    }, delay);
    return () => window.clearTimeout(timer);
    // `lines` follows from step and variant
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reducedMotion, playing, tickAt, shown, full, step, variant, idle]);

  const selectStep = useCallback((s: number, focus = false) => {
    setStep(s);
    setShown(Number.MAX_SAFE_INTEGER);
    setPicked(null);
    if (focus) tabRefs.current[s]?.focus();
  }, []);

  const onTabKey = (event: React.KeyboardEvent) => {
    let target: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') target = (step + 1) % STEP_COUNT;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') target = (step + STEP_COUNT - 1) % STEP_COUNT;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = LAST;
    if (target !== null) {
      event.preventDefault();
      selectStep(target, true);
    }
  };

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (shown >= full && step === LAST) {
      setStep(0);
      setShown(0);
      setPicked(null);
    }
    setPlaying(true);
  };

  const toggleVariant = (event: React.ChangeEvent<HTMLInputElement>) => {
    setVariant(event.target.checked ? 2 : 1);
    setShown(playing && !reducedMotion ? 0 : Number.MAX_SAFE_INTEGER);
  };

  // The files change once the step's command has printed its first line.
  const applied = shown >= Math.min(2, full);
  const changes = stepChanges(variant, step);
  const file = picked ?? STEPS[step].file;
  const view = applied ? fileView(variant, step, file) : null;
  const beforeText = applied ? null : fileText(variant, step, file);
  const codeLines = view ? view.lines : beforeText !== null ? beforeText.split('\n') : null;
  const marked = view ? view.marked : new Set<number>();
  const change: FileChange = applied ? changes[file] : beforeText === null ? { state: 'absent' } : { state: 'unchanged' };
  const cpp = file === 'main';

  // Terminal: keep the newest line in view.
  useLayoutEffect(() => {
    const el = termRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown, step, variant]);

  // File: bring the first marked line near the top (inside the panel only; the page does not move);
  // see scrollTarget.
  const firstMarked = scrollTarget(codeLines, marked, file);
  useLayoutEffect(() => {
    const el = codeRef.current;
    if (!el) return;
    if (firstMarked < 0) {
      el.scrollTop = 0;
      return;
    }
    const row = el.querySelector<HTMLElement>(`[data-line="${firstMarked}"]`);
    if (row) el.scrollTop = Math.max(0, row.offsetTop - 2 * row.offsetHeight);
  }, [firstMarked, file, step, variant, applied]);

  const panelId = 'moduleflow-panel';
  const filePanelId = 'moduleflow-file';

  return (
    <div className={styles.root} {...idleEvents}>
      <div className={styles.frame}>
        <div className={styles.toolbar}>
          <div
            className={styles.steps}
            role="tablist"
            aria-label={translate({ id: 'showcase.ModuleFlow.stepsLabel', message: '步骤' })}
            onKeyDown={onTabKey}
          >
            {STEPS.map((s, i) => {
              const selected = i === step;
              return (
                <button
                  key={s.id}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`moduleflow-step-${s.id}`}
                  aria-selected={selected}
                  aria-controls={panelId}
                  tabIndex={selected ? 0 : -1}
                  className={`${styles.step} ${selected ? styles.stepSelected : ''}`}
                  onClick={() => selectStep(i)}
                >
                  <span className={styles.stepNo}>{i + 1}</span>
                  <span className={styles.stepName}>{stepLabel(s.id)}</span>
                </button>
              );
            })}
          </div>
          {!reducedMotion ? (
            <button type="button" className={styles.play} aria-pressed={playing} onClick={togglePlay}>
              {playing
                ? translate({ id: 'showcase.ModuleFlow.pause', message: '暂停' })
                : translate({ id: 'showcase.ModuleFlow.play', message: '自动播放' })}
            </button>
          ) : null}
        </div>

        <div className={styles.body} id={panelId} role="tabpanel" aria-labelledby={`moduleflow-step-${STEPS[step].id}`}>
          <section className={styles.term} aria-label={translate({ id: 'showcase.ModuleFlow.termLabel', message: '终端' })}>
            <div className={styles.bar}>
              <span className={styles.barTitle}>{translate({ id: 'showcase.ModuleFlow.termTitle', message: 'BSP 根目录' })}</span>
              <span className={styles.barNote}>xrobot 1.0.0</span>
            </div>
            <div ref={termRef} className={styles.screen}>
              {STEPS.slice(0, step).map((s, i) => (
                <Term key={s.id} lines={transcript(i, variant)} past />
              ))}
              <Term lines={lines.slice(0, shown)} past={false} />
              <div className={styles.termLine}>
                <span className={styles.prompt}>$ </span>
                <span className={styles.cursor} aria-hidden="true" />
              </div>
            </div>
          </section>

          <section className={styles.files} aria-label={translate({ id: 'showcase.ModuleFlow.filesLabel', message: '文件' })}>
            <div className={styles.fileTabs} role="tablist" aria-label={translate({ id: 'showcase.ModuleFlow.filesLabel', message: '文件' })}>
              {FILE_IDS.map((f) => {
                const selected = f === file;
                const touched = applied && (changes[f].state === 'new' || changes[f].state === 'changed');
                return (
                  <button
                    key={f}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls={filePanelId}
                    className={`${styles.fileTab} ${selected ? styles.fileTabSelected : ''}`}
                    data-touched={touched ? 'true' : undefined}
                    title={
                      touched
                        ? `${FILE_PATH[f]} · ${translate({ id: 'showcase.ModuleFlow.file.touched', message: '本步改动' })}`
                        : FILE_PATH[f]
                    }
                    onClick={() => setPicked(f)}
                  >
                    {FILE_NAME[f]}
                  </button>
                );
              })}
            </div>
            <div className={styles.fileHead}>
              <span className={styles.filePath}>{FILE_PATH[file]}</span>
              <span className={`xr-tag ${change.state === 'new' || change.state === 'changed' ? 'xr-tag-solid' : ''}`}>
                {changeLabel(change)}
              </span>
            </div>
            <div ref={codeRef} className={styles.code} id={filePanelId} role="tabpanel" tabIndex={0}>
              {codeLines ? (
                <pre className={styles.pre}>
                  <code>
                    {codeLines.map((text, i) => (
                      <span key={i} data-line={i} className={`${styles.line} ${marked.has(i) ? styles.marked : ''}`}>
                        <span className={styles.ln} aria-hidden="true">
                          {i + 1}
                        </span>
                        <span className={styles.text}>{text === '' ? ' ' : cpp ? highlightCpp(text) : yamlLine(text)}</span>
                      </span>
                    ))}
                  </code>
                </pre>
              ) : (
                <p className={styles.absent}>
                  {inlineCode(
                    translate({ id: 'showcase.ModuleFlow.file.absentNote', message: '这个文件由 `xrobot setup` 写出。' }),
                  )}
                </p>
              )}
            </div>
          </section>
        </div>

        <div className={styles.foot}>
          <p className={styles.caption} aria-live={playing ? 'off' : 'polite'}>
            {inlineCode(stepCaption(STEPS[step].id))}
          </p>
          <label className={styles.toggle}>
            <input type="checkbox" checked={variant === 2} onChange={toggleVariant} />
            <span>
              {inlineCode(translate({ id: 'showcase.ModuleFlow.second', message: '同时加入 IMU 驱动 `BMI088`' }))}
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

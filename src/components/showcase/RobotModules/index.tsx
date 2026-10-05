/**
 * RobotModules: robots composed of modules from the official module source.
 *
 * A segmented control picks a robot (quadrotor, wheeled chassis, arm). The drawing is the 2.5D model exported to
 * static/showcase/img/robot-*.svg (inlined, so its faces follow the page theme); every part that carries a module is
 * tagged data-p. The list beside it names the modules of that robot's configuration; pointing at a row or at a part
 * highlights both, and the panel below shows the instance lines of that module in the configuration that
 * `xrobot gen -c` turns into the robot's main function. The modules all three robots use keep the first rows ("共用").
 * While active: autoplay steps through the robots (about 6 s each) and highlights their rows one after another, with
 * the matching part framed on the drawing; pointing, clicking, focus or keys pause it, and it resumes TOUR_IDLE_MS after
 * the last input. Idle motion: groups tagged data-rot turn in their plane (propellers, wheel faces), tyre facets tagged
 * data-tread move their lug pattern with the wheel, the arm's BlinkLED toggles every blink_cycle. The arm itself goes
 * through a slow teach motion (raise, turn the waist, tap with the tool tip, back to rest; ARM_KEYS, about 7 s a loop):
 * its moving part, <g data-arm> of robot-arm.svg, is redrawn about 30 times a second by the drawArm() that exported it
 * (arm.ts, loaded on demand); the loop starts and ends at the pose of the static drawing, and the static markup comes
 * back whenever the motion stops. Reduced motion (the page switch "动画 关"): still frame, no autoplay.
 * Interface: ../README.md.
 */
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import useBaseUrl from "@docusaurus/useBaseUrl";
import { translate } from "@docusaurus/Translate";
import { Tag } from "@site/src/components/xr";
import type { ShowcaseWidgetProps } from "../Showcase";
import "@site/src/css/xrstyle-materials.css";
import {
  BLINK_CYCLE_MS,
  EXCERPTS,
  ROBOTS,
  TOUR_IDLE_MS,
  instanceLines,
  planeRotation,
  robotById,
  rows,
  armPoseAt,
  tourAt,
  tourStart,
  type ModuleId,
  type RobotId,
} from "./sim";
import styles from "./styles.module.css";

function robotName(id: RobotId): string {
  switch (id) {
    case "drone":
      return translate({
        id: "showcase.RobotModules.robot.drone",
        message: "多旋翼",
      });
    case "chassis":
      return translate({
        id: "showcase.RobotModules.robot.chassis",
        message: "轮式底盘",
      });
    default:
      return translate({
        id: "showcase.RobotModules.robot.arm",
        message: "机械臂",
      });
  }
}

function moduleRole(m: ModuleId): string {
  switch (m) {
    case "BMI088":
      return translate({
        id: "showcase.RobotModules.role.BMI088",
        message: "6 轴 IMU",
      });
    case "MadgwickAHRS":
      return translate({
        id: "showcase.RobotModules.role.MadgwickAHRS",
        message: "姿态解算",
      });
    case "R9DS":
      return translate({
        id: "showcase.RobotModules.role.R9DS",
        message: "遥控接收",
      });
    case "IST8310":
      return translate({
        id: "showcase.RobotModules.role.IST8310",
        message: "磁力计",
      });
    case "SPL06":
      return translate({
        id: "showcase.RobotModules.role.SPL06",
        message: "气压计",
      });
    case "LC307":
      return translate({
        id: "showcase.RobotModules.role.LC307",
        message: "光流",
      });
    case "STP23L":
      return translate({
        id: "showcase.RobotModules.role.STP23L",
        message: "激光测距",
      });
    case "GreySensor":
      return translate({
        id: "showcase.RobotModules.role.GreySensor",
        message: "灰度循迹",
      });
    case "ST7735":
      return translate({
        id: "showcase.RobotModules.role.ST7735",
        message: "显示屏",
      });
    case "BuzzerAlarm":
      return translate({
        id: "showcase.RobotModules.role.BuzzerAlarm",
        message: "蜂鸣器",
      });
    case "INA228":
      return translate({
        id: "showcase.RobotModules.role.INA228",
        message: "功率监测",
      });
    default:
      return translate({
        id: "showcase.RobotModules.role.BlinkLED",
        message: "状态 LED",
      });
  }
}

/** Arm rig (arm.ts + the exported beat), loaded once when the arm is first animated. */
type ArmRuntime = { rig: import("./arm").ArmRig; keys: ReadonlyArray<readonly number[]> };
let armLoad: Promise<ArmRuntime> | null = null;
function loadArm(): Promise<ArmRuntime> {
  if (!armLoad) {
    armLoad = import("./arm").then((m) => ({ rig: m.createArmRig(), keys: m.ARM_KEYS }));
    armLoad.catch(() => {
      armLoad = null;
    });
  }
  return armLoad;
}
/** Arm redraw period (ms): about 30 frames a second. */
const ARM_FRAME_MS = 33;

/** Drawings fetched once per page; inlined so CSS variables (theme) and data-p hooks reach the faces. */
const artCache = new Map<string, Promise<string>>();
function loadArt(url: string): Promise<string> {
  let p = artCache.get(url);
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url}: ${r.status}`);
      return r.text();
    });
    artCache.set(url, p);
  }
  return p;
}

type Box = { left: number; top: number; width: number; height: number };

export default function RobotModules({
  active,
  reducedMotion,
}: ShowcaseWidgetProps): JSX.Element {
  const [robotId, setRobotId] = useState<RobotId>("drone");
  const [hover, setHover] = useState<ModuleId | null>(null);
  const [pinned, setPinned] = useState<ModuleId | null>(null);
  const [auto, setAuto] = useState<ModuleId | null>(null);
  // autoplay clock (ms into the cycle), pause bookkeeping
  const tourT = useRef(0);
  const resumeAt = useRef(0);
  const inside = useRef(false);
  const robotRef = useRef<RobotId>("drone");
  robotRef.current = robotId;
  const [svgText, setSvgText] = useState<Record<string, string>>({});
  const [box, setBox] = useState<Box | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const robot = robotById(robotId);
  const list = rows(robot);
  // one hook per drawing (ROBOTS is a constant list)
  const urls: Record<RobotId, string> = {
    drone: useBaseUrl(robotById("drone").art),
    chassis: useBaseUrl(robotById("chassis").art),
    arm: useBaseUrl(robotById("arm").art),
  };
  const hot = hover ?? pinned ?? auto;
  const shown: ModuleId =
    hot && robot.instances.some((i) => i.module === hot)
      ? hot
      : list[list.length > 3 ? 3 : 0].module;
  const hotSlot = hot
    ? (robot.instances.find((i) => i.module === hot)?.slot ?? null)
    : null;

  // Fetch the current drawing (and the others in the background).
  useEffect(() => {
    let alive = true;
    for (const r of [robot, ...ROBOTS.filter((x) => x.id !== robot.id)]) {
      const url = urls[r.id];
      loadArt(url)
        .then((text) => {
          if (alive) setSvgText((s) => (s[r.id] ? s : { ...s, [r.id]: text }));
        })
        .catch((e) => console.warn("[RobotModules]", e));
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [robot.id]);

  // Highlight: dim the drawing, lift the parts of the hot slot, frame them.
  const measure = useCallback(() => {
    const host = artRef.current;
    const stage = stageRef.current;
    const svg = host?.querySelector("svg");
    if (!host || !stage || !svg) return setBox(null);
    svg
      .querySelectorAll("." + styles.hot)
      .forEach((el) => el.classList.remove(styles.hot));
    svg.classList.toggle(styles.dim, !!hotSlot);
    if (!hotSlot) return setBox(null);
    const parts = Array.from(
      svg.querySelectorAll<SVGGraphicsElement>(`[data-p="${hotSlot}"]`),
    );
    if (!parts.length) return setBox(null);
    const sr = stage.getBoundingClientRect();
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (const el of parts) {
      el.classList.add(styles.hot);
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      x0 = Math.min(x0, r.left);
      y0 = Math.min(y0, r.top);
      x1 = Math.max(x1, r.right);
      y1 = Math.max(y1, r.bottom);
    }
    if (!Number.isFinite(x0)) return setBox(null);
    const pad = 4;
    setBox({
      left: x0 - sr.left - pad,
      top: y0 - sr.top - pad,
      width: x1 - x0 + 2 * pad,
      height: y1 - y0 + 2 * pad,
    });
  }, [hotSlot]);

  useLayoutEffect(() => {
    measure();
  }, [measure, svgText, robotId]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => measure());
    ro.observe(stage);
    return () => ro.disconnect();
  }, [measure]);

  // Pointing at a part of the drawing highlights its module.
  const slotModule = useCallback(
    (target: EventTarget | null): ModuleId | null => {
      const el = (target as Element | null)?.closest?.("[data-p]");
      const slot = el?.getAttribute("data-p");
      return robot.instances.find((i) => i.slot === slot)?.module ?? null;
    },
    [robot],
  );

  // Motion while active: plane rotations, tyre lugs, BlinkLED, and the autoplay clock.
  useEffect(() => {
    const svg = artRef.current?.querySelector("svg");
    const rots = svg
      ? Array.from(svg.querySelectorAll<SVGGElement>("[data-rot]")).map((el) => {
          const r = JSON.parse(el.getAttribute("data-rot") || "{}");
          return { el, c: r.c, u: r.u, w: r.w, rate: +r.r || 0 };
        })
      : [];
    const treads = svg
      ? Array.from(svg.querySelectorAll<SVGElement>("[data-tread]")).map((el) => ({
          el,
          ang: +(el.getAttribute("data-tread") || 0),
          rate: +(el.getAttribute("data-rate") || 0),
          step: +(el.getAttribute("data-step") || 1),
        }))
      : [];
    const leds = svg
      ? Array.from(svg.querySelectorAll<SVGElement>('[data-p="led"]'))
      : [];
    const lug = (tr: (typeof treads)[number], t: number) => {
      const k = Math.floor((tr.ang - tr.rate * t) / tr.step);
      tr.el.classList.toggle("lug", ((k % 2) + 2) % 2 === 0);
    };
    const reset = () => {
      rots.forEach((r) => r.el.removeAttribute("transform"));
      treads.forEach((tr) => lug(tr, 0));
      leds.forEach((el) => el.style.removeProperty("opacity"));
    };
    if (!active || reducedMotion) {
      reset();
      setAuto(null);
      return undefined;
    }
    let raf = 0;
    let last = performance.now();
    let running = false;
    let shownRow = -2;
    const t0 = last;
    const tick = (now: number) => {
      // rAF stamps the frame start, which can precede the effect's own performance.now()
      const dt = Math.max(0, Math.min(100, now - last));
      last = Math.max(last, now);
      const t = (now - t0) / 1000;
      for (const r of rots) {
        const m = planeRotation(r.c, r.u, r.w, r.rate * t);
        r.el.setAttribute(
          "transform",
          `matrix(${m.map((v) => v.toFixed(4)).join(" ")})`,
        );
      }
      for (const tr of treads) lug(tr, t);
      const on = Math.floor((now - t0) / BLINK_CYCLE_MS) % 2 === 0;
      leds.forEach((el) => (el.style.opacity = on ? "1" : "0.25"));
      // autoplay
      const go = !inside.current && now >= resumeAt.current;
      if (go && !running) {
        // (re)start with the robot on screen
        tourT.current = tourStart(robotRef.current);
        setHover(null);
        setPinned(null);
      }
      if (!go && running) {
        setAuto(null);
        shownRow = -2;
      }
      running = go;
      if (go) {
        tourT.current += dt;
        const st = tourAt(tourT.current);
        if (st.robot !== robotRef.current) {
          robotRef.current = st.robot;
          setRobotId(st.robot);
          shownRow = -2;
        }
        if (st.row !== shownRow) {
          shownRow = st.row;
          const list = rows(robotById(st.robot));
          setAuto(st.row >= 0 ? (list[st.row]?.module ?? null) : null);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      reset();
    };
  }, [active, reducedMotion, svgText, robotId]);

  // Arm teach motion: while the arm is on screen, active and motion is allowed. Independent of the roll call, which goes
  // on as usual; input does not stop it. The static rest pose comes back when it stops.
  useEffect(() => {
    if (robotId !== "arm" || !active || reducedMotion || !svgText.arm) return undefined;
    const host = artRef.current?.querySelector<SVGGElement>("svg [data-arm]");
    if (!host) return undefined;
    const still = host.innerHTML;
    let raf = 0;
    let alive = true;
    loadArm()
      .then(({ rig, keys }) => {
        if (!alive) return;
        const t0 = performance.now();
        let last = -Infinity;
        const tick = (now: number) => {
          if (now - last >= ARM_FRAME_MS) {
            last = now;
            const pose = armPoseAt(keys, Math.max(0, now - t0));
            const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
            host.innerHTML = rig.draw(pose, theme);
            host.dataset.pose = pose.q.map((v) => v.toFixed(1)).join(" ");
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      })
      .catch((e) => console.warn("[RobotModules] arm", e));
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      host.innerHTML = still;
      delete host.dataset.pose;
    };
  }, [robotId, active, reducedMotion, svgText.arm]);

  // Any input pauses the autoplay; it resumes TOUR_IDLE_MS after the last one (and after the pointer has left).
  const hold = useCallback(() => {
    resumeAt.current = performance.now() + TOUR_IDLE_MS;
    setAuto(null);
  }, []);

  const select = (id: RobotId, focus = false) => {
    robotRef.current = id;
    setRobotId(id);
    setHover(null);
    setPinned((p) =>
      p && robotById(id).instances.some((i) => i.module === p) ? p : null,
    );
    if (focus) tabRefs.current[ROBOTS.findIndex((r) => r.id === id)]?.focus();
  };
  const onTabKey = (event: React.KeyboardEvent) => {
    const i = ROBOTS.findIndex((r) => r.id === robotId);
    let j = -1;
    if (event.key === "ArrowRight" || event.key === "ArrowDown")
      j = (i + 1) % ROBOTS.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
      j = (i + ROBOTS.length - 1) % ROBOTS.length;
    else if (event.key === "Home") j = 0;
    else if (event.key === "End") j = ROBOTS.length - 1;
    if (j >= 0) {
      event.preventDefault();
      select(ROBOTS[j].id, true);
    }
  };

  const shared = translate({
    id: "showcase.RobotModules.shared",
    message: "共用",
  });
  const excerpt = EXCERPTS[shown];
  const panelId = "robotmodules-panel";

  return (
    <div
      className={styles.root}
      onPointerEnter={() => {
        inside.current = true;
        hold();
      }}
      onPointerLeave={() => {
        inside.current = false;
        hold();
      }}
      onPointerDown={hold}
      onKeyDown={hold}
      onFocus={hold}
    >
      <div
        className={styles.tabs}
        role="tablist"
        aria-label={translate({
          id: "showcase.RobotModules.tablist",
          message: "选择机器人",
        })}
        onKeyDown={onTabKey}
      >
        {ROBOTS.map((r, i) => {
          const selected = r.id === robotId;
          return (
            <button
              key={r.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`robotmodules-tab-${r.id}`}
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              className={`${styles.tab} ${selected ? styles.tabSelected : ""}`}
              onClick={() => select(r.id)}
            >
              {robotName(r.id)}
            </button>
          );
        })}
      </div>

      <div
        className={styles.body}
        id={panelId}
        role="tabpanel"
        aria-labelledby={`robotmodules-tab-${robot.id}`}
      >
        <div
          ref={stageRef}
          className={styles.stage}
          onPointerOver={(e) => setHover(slotModule(e.target))}
          onPointerLeave={() => setHover(null)}
          onClick={(e) => {
            const m = slotModule(e.target);
            setPinned((p) => (m && p !== m ? m : null));
          }}
        >
          <div
            key={robot.id}
            ref={artRef}
            className={styles.art}
            role="img"
            aria-label={translate(
              {
                id: "showcase.RobotModules.artAria",
                message: "{robot}：{modules}",
              },
              {
                robot: robotName(robot.id),
                modules: robot.instances.map((i) => i.module).join(", "),
              },
            )}
            dangerouslySetInnerHTML={{ __html: svgText[robot.id] ?? "" }}
          />
          {box && hot ? (
            <div
              className={styles.frame}
              style={{
                left: box.left,
                top: box.top,
                width: box.width,
                height: box.height,
              }}
              aria-hidden="true"
            >
              <span className={styles.frameLabel}>{hot}</span>
            </div>
          ) : null}
        </div>

        <div className={styles.side}>
          <ul
            className={styles.list}
            aria-label={translate({
              id: "showcase.RobotModules.listAria",
              message: "这份配置中的模块",
            })}
          >
            {list.map((row, i) => {
              const on = hot === row.module;
              return (
                <li
                  key={row.shared ? row.module : `${robot.id}-${row.module}`}
                  className={`${styles.row} ${row.shared ? "" : styles.rowOwn}`}
                >
                  <button
                    type="button"
                    className={`${styles.rowButton} ${on ? styles.rowOn : ""} ${pinned === row.module ? styles.rowPinned : ""}`}
                    aria-pressed={pinned === row.module}
                    onPointerEnter={() => setHover(row.module)}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover(row.module)}
                    onBlur={() => setHover(null)}
                    onClick={() =>
                      setPinned((p) => (p === row.module ? null : row.module))
                    }
                    style={{ "--row": i } as React.CSSProperties}
                  >
                    <span className={styles.modName}>{row.module}</span>
                    <span className={styles.modRole}>
                      {moduleRole(row.module)}
                    </span>
                    {row.shared ? (
                      <Tag className={styles.sharedTag}>{shared}</Tag>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className={styles.cfg}>
            <figure className={`xr-code ${styles.config}`}>
              <figcaption className="xr-code-title">
                <span className={styles.file}>{robot.config}</span>
                <span
                  className={styles.aside}
                >{`modules[${robot.instances.findIndex((i) => i.module === shown)}]`}</span>
              </figcaption>
              <pre
                key={`${robot.id}-${shown}`}
                className={`xr-code-pre ${styles.pre}`}
              >
                <code>
                  {instanceLines(shown).join("\n")}
                  {excerpt.rest > 0 ? (
                    <span className={styles.comment}>
                      {"\n    # "}
                      {translate(
                        {
                          id: "showcase.RobotModules.rest",
                          message: "其余 {n} 项",
                        },
                        { n: String(excerpt.rest) },
                      )}
                    </span>
                  ) : null}
                </code>
              </pre>
            </figure>
            <p className={styles.gen}>
              <code>{`xrobot gen -c ${robot.config}`}</code>
              <span aria-hidden="true">→</span>
              <code>User/xrobot_main.hpp</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

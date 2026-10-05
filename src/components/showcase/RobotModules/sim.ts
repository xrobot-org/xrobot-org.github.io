/**
 * RobotModules data: three robots, the modules each configuration instantiates, the part of the drawing each module
 * belongs to, and the configuration lines shown for it. No DOM; tested by sim.test.mjs.
 *
 * Module names, constructor parameter names and the values in the excerpts come from the official module index
 * (xrobot-org/xrobot-modules index.yaml) and each module's header / README configuration example.
 * Drawings: static/showcase/img/robot-*.svg. They are exported from the XRobot Style 2.5D models
 * (the arm together with armRig.js; the quadrotor and the chassis from existing models plus hand-modelled parts).
 * Every part that carries a module is tagged data-p="<slot>".
 */

export type RobotId = "drone" | "chassis" | "arm";

export type ModuleId =
  | "BMI088"
  | "MadgwickAHRS"
  | "R9DS"
  | "IST8310"
  | "SPL06"
  | "LC307"
  | "STP23L"
  | "GreySensor"
  | "ST7735"
  | "BuzzerAlarm"
  | "INA228"
  | "BlinkLED";

export type Instance = { module: ModuleId; slot: string };

export type Robot = {
  id: RobotId;
  /** Drawing under static/. */
  art: string;
  /** Configuration file selected with `xrobot gen -c`. */
  config: string;
  instances: Instance[];
};

/** Modules every robot here instantiates; they keep the first rows of the list. */
export const SHARED: ModuleId[] = ["BMI088", "MadgwickAHRS", "R9DS"];

export const ROBOTS: Robot[] = [
  {
    id: "drone",
    art: "/showcase/img/robot-drone.svg",
    config: "User/quadrotor.yaml",
    instances: [
      { module: "BMI088", slot: "imu" },
      { module: "MadgwickAHRS", slot: "mcu" },
      { module: "R9DS", slot: "rc" },
      { module: "IST8310", slot: "mag" },
      { module: "SPL06", slot: "baro" },
      { module: "LC307", slot: "flow" },
      { module: "STP23L", slot: "range" },
    ],
  },
  {
    id: "chassis",
    art: "/showcase/img/robot-chassis.svg",
    config: "User/chassis.yaml",
    instances: [
      { module: "BMI088", slot: "imu" },
      { module: "MadgwickAHRS", slot: "mcu" },
      { module: "R9DS", slot: "rc" },
      { module: "GreySensor", slot: "grey" },
      { module: "STP23L", slot: "range" },
      { module: "ST7735", slot: "lcd" },
      { module: "BuzzerAlarm", slot: "buzz" },
    ],
  },
  {
    id: "arm",
    art: "/showcase/img/robot-arm.svg",
    config: "User/arm.yaml",
    instances: [
      { module: "BMI088", slot: "imu" },
      { module: "MadgwickAHRS", slot: "mcu" },
      { module: "R9DS", slot: "rc" },
      { module: "ST7735", slot: "lcd" },
      { module: "INA228", slot: "pwr" },
      { module: "BuzzerAlarm", slot: "buzz" },
      { module: "BlinkLED", slot: "led" },
    ],
  },
];

/** BlinkLED blink_cycle in the arm configuration (ms): the board LED toggles at this period. */
export const BLINK_CYCLE_MS = 250;

/**
 * Autoplay ("roll call"): each robot is shown for TOUR_LEAD_MS, then its rows are highlighted one after another for
 * TOUR_STEP_MS each (about 6 s per robot), then the next robot follows. User input pauses it for TOUR_IDLE_MS.
 */
export const TOUR_LEAD_MS = 600;
export const TOUR_STEP_MS = 760;
export const TOUR_IDLE_MS = 8000;

export function robotTourMs(robot: Robot): number {
  return TOUR_LEAD_MS + robot.instances.length * TOUR_STEP_MS;
}

/** Start of a robot's turn within the cycle (ms). */
export function tourStart(id: RobotId): number {
  let t = 0;
  for (const r of ROBOTS) {
    if (r.id === id) return t;
    t += robotTourMs(r);
  }
  return 0;
}

/** Robot and highlighted row (-1 during the lead-in) at time ms of the autoplay cycle. */
export function tourAt(ms: number): { robot: RobotId; row: number } {
  const total = ROBOTS.reduce((s, r) => s + robotTourMs(r), 0);
  let t = ((ms % total) + total) % total;
  for (const r of ROBOTS) {
    const d = robotTourMs(r);
    if (t < d) {
      return {
        robot: r.id,
        row: t < TOUR_LEAD_MS ? -1 : Math.floor((t - TOUR_LEAD_MS) / TOUR_STEP_MS),
      };
    }
    t -= d;
  }
  return { robot: ROBOTS[0].id, row: -1 };
}

/**
 * Configuration excerpt of one instance: the first constructor arguments in declaration order (the configuration lists
 * every argument; `rest` counts the ones after the excerpt).
 */
export type Excerpt = { id: string; lines: string[]; rest: number };

export const EXCERPTS: Record<ModuleId, Excerpt> = {
  BMI088: {
    id: "bmi088",
    lines: [
      "- accl_cs: ACCL_CS",
      "- gyro_cs: GYRO_CS",
      "- gyro_int: GYRO_INT",
      "- spi: spi1",
    ],
    rest: 4,
  },
  MadgwickAHRS: {
    id: "ahrs",
    lines: [
      "- ramfs: ramfs",
      "- param:",
      "    beta: 0.033",
      '    gyro_topic_name: "bmi088_gyro"',
      '    accl_topic_name: "bmi088_accl"',
    ],
    rest: 3,
  },
  R9DS: {
    id: "r9ds",
    lines: [
      "- uart: usart1",
      "- ramfs: ramfs",
      '- data_topic_name: "r9ds_data"',
      '- rc_state_topic_name: "rc_state"',
    ],
    rest: 2,
  },
  IST8310: {
    id: "ist8310",
    lines: [
      "- interrupt: CMPS_INT",
      "- rst: CMPS_RST",
      "- i2c: i2c3",
      "- ramfs: ramfs",
    ],
    rest: 3,
  },
  SPL06: {
    id: "spl06",
    lines: [
      "- spi: spl06_spi",
      "- ramfs: ramfs",
      '- data_topic_name: "spl06_data"',
      "- sample_period_ms: 50",
    ],
    rest: 1,
  },
  LC307: {
    id: "lc307",
    lines: [
      "- uart: usart2",
      "- ramfs: ramfs",
      '- topic_name: "lc307_flow"',
      "- task_stack_depth: 2048",
    ],
    rest: 3,
  },
  STP23L: {
    id: "stp23l",
    lines: [
      "- uart: usart6",
      "- ramfs: ramfs",
      '- topic_name: "stp23l_frame"',
      "- task_stack_depth: 2048",
    ],
    rest: 1,
  },
  GreySensor: {
    id: "grey",
    lines: [
      "- channels: ['&grey_0', '&grey_1',",
      "             '&grey_2', '&grey_3',",
      "             '&grey_4', '&grey_5',",
      "             '&grey_6', '&grey_7']",
      "- active_low: false",
    ],
    rest: 2,
  },
  ST7735: {
    id: "st7735",
    lines: [
      "- spi_cs: st7735_spi_cs",
      "- spi_rs: st7735_spi_rs",
      "- pwm: st7735_pwm",
      "- spi: spi2",
    ],
    rest: 4,
  },
  BuzzerAlarm: {
    id: "buzzer",
    lines: [
      "- pwm: pwm_tim12_ch2",
      "- alarm_freq: 1500",
      "- alarm_duration: 300",
      "- alarm_delay: 300",
    ],
    rest: 0,
  },
  INA228: {
    id: "ina228",
    lines: [
      "- i2c: i2c1",
      "- param:",
      "    i2c_addr: 64",
      "    shunt_resistor_uohm: 5000",
    ],
    rest: 4,
  },
  BlinkLED: {
    id: "blink_led",
    lines: ["- led: LED", `- blink_cycle: ${BLINK_CYCLE_MS}`],
    rest: 0,
  },
};

/** Lines of the instance block, before the "rest" comment. */
export function instanceLines(module: ModuleId): string[] {
  const e = EXCERPTS[module];
  return [
    `- module: xrobot-org/${module}`,
    `  id: ${e.id}`,
    "  args:",
    ...e.lines.map((l) => `    ${l}`),
  ];
}

/** Rows of the list: the shared modules first, in SHARED order, then the robot's own in configuration order. */
export function rows(robot: Robot): Array<Instance & { shared: boolean }> {
  const shared = SHARED.map((m) =>
    robot.instances.find((i) => i.module === m),
  ).filter((i): i is Instance => !!i);
  const own = robot.instances.filter((i) => !SHARED.includes(i.module));
  return [
    ...shared.map((i) => ({ ...i, shared: true })),
    ...own.map((i) => ({ ...i, shared: false })),
  ];
}

export function robotById(id: RobotId): Robot {
  return ROBOTS.find((r) => r.id === id) ?? ROBOTS[0];
}

/**
 * Screen-space matrix (SVG matrix(a b c d e f)) that turns a drawing by `angle` within one plane of the model about the
 * projected point c. u and w are the projected unit axes of that plane (drawings carry them in data-rot): a propeller
 * turns in the horizontal plane, a wheel face in its vertical plane. M = B R B^-1 with B = [u w]; c stays fixed.
 */
export function planeRotation(
  c: [number, number],
  u: [number, number],
  w: [number, number],
  angle: number,
): [number, number, number, number, number, number] {
  const cs = Math.cos(angle);
  const sn = Math.sin(angle);
  const det = u[0] * w[1] - w[0] * u[1];
  // B^-1
  const i11 = w[1] / det,
    i12 = -w[0] / det,
    i21 = -u[1] / det,
    i22 = u[0] / det;
  // B R
  const m11 = u[0] * cs + w[0] * sn,
    m12 = -u[0] * sn + w[0] * cs;
  const m21 = u[1] * cs + w[1] * sn,
    m22 = -u[1] * sn + w[1] * cs;
  const a = m11 * i11 + m12 * i21,
    b = m21 * i11 + m22 * i21;
  const cc = m11 * i12 + m12 * i22,
    d = m21 * i12 + m22 * i22;
  return [a, b, cc, d, c[0] - a * c[0] - cc * c[1], c[1] - b * c[0] - d * c[1]];
}

/**
 * Robot arm teach motion (the keys are ARM_KEYS in armRig.js): each key is
 * [t s, q1 yaw, q2 shoulder, q3 elbow, q4 wrist (deg), grip opening]. Between two keys every value follows a smoothstep,
 * so the arm starts and stops softly at each key; the first and the last key are the rest pose of the static drawing,
 * so the loop closes without a jump. The exporter uses the same interpolation to size the viewBox.
 */
export type ArmKey = readonly number[];
export type ArmPose = { q: number[]; grip: number };

export function armCycleMs(keys: readonly ArmKey[]): number {
  return keys[keys.length - 1][0] * 1000;
}

export function armPoseAt(keys: readonly ArmKey[], ms: number): ArmPose {
  const T = keys[keys.length - 1][0];
  const u = ((ms / 1000) % T + T) % T;
  let i = 0;
  while (i < keys.length - 2 && keys[i + 1][0] <= u) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const x = Math.min(1, Math.max(0, (u - a[0]) / (b[0] - a[0])));
  const f = x * x * (3 - 2 * x);
  const v = [1, 2, 3, 4, 5].map((k) => a[k] + (b[k] - a[k]) * f);
  return { q: v.slice(0, 4), grip: v[4] };
}

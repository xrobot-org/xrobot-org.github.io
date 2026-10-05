# Showcase widgets

Capability widgets for the home page (and for doc pages that want the same widget). Each widget
is one directory here; the shell `Showcase.tsx` loads it lazily and tells it when to animate.

## Files

- `<Name>/index.tsx`: default export, the widget. `<Name>` starts with a capital letter.
- `<Name>/styles.module.css`: its styles, XRobot Style variables only.
- `<Name>/sim.ts` (or `sim.js`): pure logic and data, no DOM, with a test that runs in Node 24
  (`node src/components/showcase/SameCode/sim.test.ts`; Node 22 needs `--experimental-strip-types`).
- Static assets: `static/showcase/<name>/`. Line-art illustrations for sections without a widget:
  `static/showcase/img/`.
- `Showcase.tsx`: the shell. `ShowcaseSection.tsx`: the home-page section layout and `StaticFigure`.

The shell finds widgets with `require.context('./', true, /^\.\/[A-Z][A-Za-z0-9]*\/index\.tsx$/, 'lazy')`:
every matching directory becomes its own chunk, nothing has to be registered, and a name without
a directory renders the section's `fallback` (a static figure) until the widget exists.

## Interface

```tsx
// widget
export default function Widget({ active, reducedMotion }: ShowcaseWidgetProps): JSX.Element;

// shell
<Showcase name="RingBuffer" height={{ desktop: 440, mobile: 560 }} docHref="/docs/..." fallback={...} />
```

- `active`: the frame intersects the viewport and the page is visible. When it turns false the
  widget stops its timers and animation frames; it is not unmounted.
- `reducedMotion`: the page animation switch ("动画 开 / 关" above the first-screen widget, stored in localStorage `xr-motion`, on by default and independent of the OS `prefers-reduced-motion` setting) is off. The widget shows an informative still frame
  and stays interactive.
- `height`: space reserved before the widget mounts, so the page does not move when it appears.
- `docHref`: optional "read the docs" link under the widget, for use in MDX pages. On the home
  page `ShowcaseSection` shows the documentation links next to the widget instead.
- The shell mounts the widget inside `BrowserOnly` + `React.lazy` + `Suspense` when the frame is
  within 400 px of the viewport; module top levels must not touch `window` or `document`.
  A widget that throws is replaced by `fallback`; the page stays usable.
- Size: the width follows the container (320 px to about 960 px); the widget sets its own height,
  360 to 460 px on desktop, taller on narrow screens, with no horizontal scrolling.

## Dependencies

Third-party code is an npm dependency loaded with a dynamic `import()` when the widget first
becomes active, so that it stays out of the server-side build and out of the first page load.
WebTerminal loads `@xterm/xterm` (with `@xterm/xterm/css/xterm.css`) and `@xterm/addon-fit` this way.

## Visual rules and the explanation layer

Widgets use the XRobot Style variables only: `--ink`, `--ink-muted`, `--on-ink`, `--paper`,
`--paper-raised`, `--paper-sunken`, `--line`, `--line-strong`, `--focus`, the channel colours
`--ch0` to `--ch3` (for data only: waveforms, lanes, queue cells) and the status colours (in Status
only); they are defined in `src/css/xrstyle-tokens.css` per `html[data-theme]`. A canvas reads them
with `getComputedStyle` and reads them again when the theme changes. Fonts are the system stacks
`var(--font-sans)` and `var(--font-mono)`.

XRobot Style limits motion to state feedback: at most `duration-base` (160 ms), no infinite loops.
Showcase widgets form an **explanation layer** with one exception:

- An explanation may loop (a blinking LED, a scrolling trace, a step-through of boards) **only
  while the widget is `active`**. Loops run on `requestAnimationFrame` or timers that the widget
  starts when `active` becomes true and cancels when it becomes false; CSS
  `animation-iteration-count: infinite` is still not used.
- With `reducedMotion`, nothing loops: the widget shows a still frame that carries the same
  information (for SameCode: the LED on, the trace frozen over three periods, no auto-advance).
- One-shot transitions inside a widget stay within `duration-base`, as everywhere else.
- Everything else in XRobot Style applies unchanged: tokens only, right angles, 1 px lines,
  no shadows or gradients, channel colours only for data, status colours only in Status.

## Text

All visible text goes through `translate({ id: 'showcase.<Name>.<key>', message: '中文' })`,
including text drawn in SVG or on a canvas; the English is in `i18n/en/code.json`. Copy follows
the documentation voice: neutral written Chinese in the third person, no "你", no statements of
what something is not, no "never" or "always", no warnings nobody asked for; the English is neutral
too. The mechanism shown must match the LibXR and XRobot docs and sources. Competition marks
(RoboMaster, RM, DJI) do not appear.

## Checks

Before a change goes in: the sim tests pass in Node; the home page is checked at 1440 x 900 and
375 x 812, in the light and the dark theme and with the animation switch off; the console shows no
errors; `npx docusaurus build` (both locales) passes its broken-link check.

## SameCode

The first-screen widget. One BlinkLED Module on four boards and systems (STM32 / ThreadX,
CH32 / FreeRTOS, MSPM0 / bare metal, Linux). It follows XRobot 1.0 static assembly: the Module
asks for `LibXR::GPIO&`, `User/xrobot.yaml` binds the argument to the name `LED`, and each
board's entry source registers its own GPIO object under that name with `XR_REGISTER`
(generated by `libxr gen --xrobot` on STM32). Selecting a board joins the name tag to that
board's pin and blinks its LED every 250 ms; the Module and configuration panels show
"0 lines changed". Board drawings and code live in `SameCode/sim.ts`.

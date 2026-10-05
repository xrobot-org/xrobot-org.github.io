// ModuleFlow/sim.ts under node (24+: sim.ts loads with type stripping).
//   node --test src/components/showcase/ModuleFlow/sim.test.mjs
// LOGS: what xrobot 1.0.0 printed in an empty BSP with XR_LANG=zh / XR_LANG=en (variant 1: BlinkLED; variant 2: BlinkLED
// and BMI088), one '### stepN' marker per widget step. The widget's transcript must reproduce them line for line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMIT_LINE, FILE_IDS, STEP_COUNT, diffLines, fileText, fileView, formatOutput, nextStep, stepChanges, transcript,
} from './sim.ts';

const LOGS = {
  "zh": {
    "1": "### step1\n$ xrobot module add xrobot-org/BlinkLED@dev\n已添加 xrobot-org/BlinkLED@dev；请运行 `xrobot setup` 获取它\n### step2\n$ xrobot setup\n已解析 1 个模块提交\n已检查 1 个配置；已为 User/xrobot.yaml 生成 User/xrobot_main.hpp\n### step3\n$ xrobot instance add xrobot-org/BlinkLED\n已将 blinkled_0 添加到 User/xrobot.yaml；生成前请填写值为空的依赖参数\n  led（LibXR::GPIO&）：LED_R、ACCL_CS、GYRO_CS、GYRO_INT\n$ xrobot instance set blinkled_0 args.led LED_R\n已修改 User/xrobot.yaml 中 blinkled_0 的 args.led\n### step4\n$ xrobot gen\n已为 User/xrobot.yaml 生成 User/xrobot_main.hpp",
    "2": "### step1\n$ xrobot module add xrobot-org/BlinkLED@dev\n已添加 xrobot-org/BlinkLED@dev；请运行 `xrobot setup` 获取它\n$ xrobot module add xrobot-org/BMI088@dev\n已添加 xrobot-org/BMI088@dev；请运行 `xrobot setup` 获取它\n### step2\n$ xrobot setup\n已解析 2 个模块提交\n已检查 1 个配置；已为 User/xrobot.yaml 生成 User/xrobot_main.hpp\n### step3\n$ xrobot instance add xrobot-org/BlinkLED\n已将 blinkled_0 添加到 User/xrobot.yaml；生成前请填写值为空的依赖参数\n  led（LibXR::GPIO&）：LED_R、ACCL_CS、GYRO_CS、GYRO_INT\n$ xrobot instance add xrobot-org/BMI088\n已将 bmi088_0 添加到 User/xrobot.yaml；生成前请填写值为空的依赖参数\n  accl_cs（LibXR::GPIO&）：LED_R、ACCL_CS、GYRO_CS、GYRO_INT\n  gyro_cs（LibXR::GPIO&）：LED_R、ACCL_CS、GYRO_CS、GYRO_INT\n  gyro_int（LibXR::GPIO&）：LED_R、ACCL_CS、GYRO_CS、GYRO_INT\n  spi（LibXR::SPI&）：spi1\n  heater_pwm（LibXR::PWM&）：pwm_tim10_ch1\n  database（LibXR::Database&）：database\n  ramfs（LibXR::RamFS&）：ramfs\n$ xrobot instance set blinkled_0 args.led LED_R\n已修改 User/xrobot.yaml 中 blinkled_0 的 args.led\n$ xrobot instance set bmi088_0 args.accl_cs ACCL_CS\n已修改 User/xrobot.yaml 中 bmi088_0 的 args.accl_cs\n$ xrobot instance set bmi088_0 args.gyro_cs GYRO_CS\n已修改 User/xrobot.yaml 中 bmi088_0 的 args.gyro_cs\n$ xrobot instance set bmi088_0 args.gyro_int GYRO_INT\n已修改 User/xrobot.yaml 中 bmi088_0 的 args.gyro_int\n$ xrobot instance set bmi088_0 args.spi spi1\n已修改 User/xrobot.yaml 中 bmi088_0 的 args.spi\n$ xrobot instance set bmi088_0 args.heater_pwm pwm_tim10_ch1\n已修改 User/xrobot.yaml 中 bmi088_0 的 args.heater_pwm\n$ xrobot instance set bmi088_0 args.database database\n已修改 User/xrobot.yaml 中 bmi088_0 的 args.database\n$ xrobot instance set bmi088_0 args.ramfs ramfs\n已修改 User/xrobot.yaml 中 bmi088_0 的 args.ramfs\n### step4\n$ xrobot gen\n已为 User/xrobot.yaml 生成 User/xrobot_main.hpp"
  },
  "en": {
    "1": "### step1\n$ xrobot module add xrobot-org/BlinkLED@dev\nAdded xrobot-org/BlinkLED@dev; run `xrobot setup` to fetch it\n### step2\n$ xrobot setup\nResolved 1 Module commit\nChecked 1 config; generated User/xrobot_main.hpp for User/xrobot.yaml\n### step3\n$ xrobot instance add xrobot-org/BlinkLED\nAdded blinkled_0 to User/xrobot.yaml; fill the null values (dependencies) before generating\n  led (LibXR::GPIO&): LED_R, ACCL_CS, GYRO_CS, GYRO_INT\n$ xrobot instance set blinkled_0 args.led LED_R\nSet args.led of blinkled_0 in User/xrobot.yaml\n### step4\n$ xrobot gen\nGenerated User/xrobot_main.hpp for User/xrobot.yaml",
    "2": "### step1\n$ xrobot module add xrobot-org/BlinkLED@dev\nAdded xrobot-org/BlinkLED@dev; run `xrobot setup` to fetch it\n$ xrobot module add xrobot-org/BMI088@dev\nAdded xrobot-org/BMI088@dev; run `xrobot setup` to fetch it\n### step2\n$ xrobot setup\nResolved 2 Module commits\nChecked 1 config; generated User/xrobot_main.hpp for User/xrobot.yaml\n### step3\n$ xrobot instance add xrobot-org/BlinkLED\nAdded blinkled_0 to User/xrobot.yaml; fill the null values (dependencies) before generating\n  led (LibXR::GPIO&): LED_R, ACCL_CS, GYRO_CS, GYRO_INT\n$ xrobot instance add xrobot-org/BMI088\nAdded bmi088_0 to User/xrobot.yaml; fill the null values (dependencies) before generating\n  accl_cs (LibXR::GPIO&): LED_R, ACCL_CS, GYRO_CS, GYRO_INT\n  gyro_cs (LibXR::GPIO&): LED_R, ACCL_CS, GYRO_CS, GYRO_INT\n  gyro_int (LibXR::GPIO&): LED_R, ACCL_CS, GYRO_CS, GYRO_INT\n  spi (LibXR::SPI&): spi1\n  heater_pwm (LibXR::PWM&): pwm_tim10_ch1\n  database (LibXR::Database&): database\n  ramfs (LibXR::RamFS&): ramfs\n$ xrobot instance set blinkled_0 args.led LED_R\nSet args.led of blinkled_0 in User/xrobot.yaml\n$ xrobot instance set bmi088_0 args.accl_cs ACCL_CS\nSet args.accl_cs of bmi088_0 in User/xrobot.yaml\n$ xrobot instance set bmi088_0 args.gyro_cs GYRO_CS\nSet args.gyro_cs of bmi088_0 in User/xrobot.yaml\n$ xrobot instance set bmi088_0 args.gyro_int GYRO_INT\nSet args.gyro_int of bmi088_0 in User/xrobot.yaml\n$ xrobot instance set bmi088_0 args.spi spi1\nSet args.spi of bmi088_0 in User/xrobot.yaml\n$ xrobot instance set bmi088_0 args.heater_pwm pwm_tim10_ch1\nSet args.heater_pwm of bmi088_0 in User/xrobot.yaml\n$ xrobot instance set bmi088_0 args.database database\nSet args.database of bmi088_0 in User/xrobot.yaml\n$ xrobot instance set bmi088_0 args.ramfs ramfs\nSet args.ramfs of bmi088_0 in User/xrobot.yaml\n### step4\n$ xrobot gen\nGenerated User/xrobot_main.hpp for User/xrobot.yaml"
  }
};

test('transcript reproduces the CLI output in both languages', () => {
  for (const lang of ['zh', 'en']) {
    for (const v of [1, 2]) {
      const lines = [];
      for (let s = 0; s < STEP_COUNT; s++) {
        lines.push(`### step${s + 1}`);
        for (const l of transcript(s, v)) lines.push('cmd' in l ? `$ ${l.cmd}` : formatOutput(l.out, lang));
      }
      assert.equal(lines.join('\n'), LOGS[lang][v], `${lang} variant ${v}`);
    }
  }
});

test('files: what each step creates or changes', () => {
  for (const v of [1, 2]) {
    // add: only modules.yaml changes; lock and header do not exist yet
    let c = stepChanges(v, 0);
    assert.equal(c.modules.state, 'changed');
    assert.equal(c.lock.state, 'absent');
    assert.equal(c.config.state, 'unchanged');
    assert.equal(c.main.state, 'absent');
    // setup: writes the lock and the header
    c = stepChanges(v, 1);
    assert.equal(c.modules.state, 'unchanged');
    assert.equal(c.lock.state, 'new');
    assert.equal(c.main.state, 'new');
    // instance: only the config
    c = stepChanges(v, 2);
    assert.deepEqual(FILE_IDS.filter((f) => c[f].state !== 'unchanged'), ['config']);
    // gen: only the header
    c = stepChanges(v, 3);
    assert.deepEqual(FILE_IDS.filter((f) => c[f].state !== 'unchanged'), ['main']);
  }
  // one line per requested module in modules.yaml
  assert.deepEqual([...fileView(1, 0, 'modules').marked], [1, 2]); // 'modules: []' becomes 'modules:'
  assert.deepEqual([...fileView(2, 0, 'modules').marked], [1, 2, 3]);
  // the lock records one commit per module
  for (const v of [1, 2]) {
    const commits = fileText(v, 2, 'lock').split('\n').filter((l) => COMMIT_LINE.test(l));
    assert.equal(commits.length, v);
  }
  // gen adds the construction of each instance to XRobotMain
  const main1 = fileView(1, 3, 'main');
  const marked1 = [...main1.marked].map((i) => main1.lines[i]);
  assert.ok(marked1.includes('  static BlinkLED blinkled_0(LED_R, 250);'));
  assert.ok(marked1.includes('[[noreturn]] static inline void XRobotMain(LibXR::GPIO& LED_R)'));
  const main2 = fileView(2, 3, 'main');
  const marked2 = [...main2.marked].map((i) => main2.lines[i]);
  assert.ok(marked2.some((l) => l.startsWith('  static BMI088 bmi088_0(ACCL_CS, GYRO_CS, GYRO_INT, spi1')));
  assert.ok(marked2.includes('    bmi088_0.OnMonitor();'));
});

test('diffLines', () => {
  assert.deepEqual(diffLines(['a', 'b'], ['a', 'x', 'b']), { added: new Set([1]), removed: 0 });
  assert.deepEqual(diffLines(['a', 'b', 'c'], ['a', 'c']), { added: new Set(), removed: 1 });
  assert.deepEqual(diffLines(['a()'], ['a(x)']), { added: new Set([0]), removed: 1 });
});

test('steps loop', () => {
  assert.equal(nextStep(0), 1);
  assert.equal(nextStep(STEP_COUNT - 1), 0);
});

test('self-playing: even rhythm, a lap within 20 s, and the BMI088 choice flips every lap', async () => {
  const S = await import('./sim.ts');
  // every finished step holds 1.5-2 s, the lap boundary included
  for (const hold of [S.HOLD_MS, S.LAP_HOLD_MS]) assert.ok(hold >= 1500 && hold <= 2000, `hold ${hold}`);
  for (const v of [1, 2]) assert.ok(S.lapMs(v) <= 20000, `lap ${v}: ${S.lapMs(v)} ms`);
  // no single line waits longer than a command line
  for (const v of [1, 2]) for (let s = 0; s < S.STEP_COUNT; s++) for (const line of S.transcript(s, v)) assert.ok(S.lineDelay(line) <= S.CMD_MS);
  assert.equal(S.nextVariant(1), 2);
  assert.equal(S.nextVariant(2), 1);
  assert.equal(S.nextStep(S.STEP_COUNT - 1), 0);
});

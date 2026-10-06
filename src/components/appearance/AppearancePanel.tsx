/**
 * Appearance settings panel (rendered next to the navbar palette button by the
 * NavbarItem wrapper, fixed under the navbar edge; positioning lives in the
 * CSS module). All options apply immediately: localStorage + html data
 * attribute (+ --xr-hue when needed), per the shared contract with the CSS
 * layer. Initial values are read from localStorage in a mount effect so the
 * SSR output (panel closed / defaults) never mismatches.
 */
import React, { useEffect, useState } from 'react';
import { translate } from '@docusaurus/Translate';
import { readMotionOff, setMotionOff } from '@site/src/utils/motion';
import {
  DEFAULT_SLIDER_HUE,
  readAccentHue,
  readBgMode,
  readCardDecor,
  readFontMode,
  readNavbarMode,
  writeAccentHue,
  writeBgMode,
  writeCardDecor,
  writeFontMode,
  writeNavbarMode,
  type BgMode,
  type CardDecor,
  type FontMode,
  type NavbarMode,
} from '@site/src/utils/appearance';
import styles from './AppearancePanel.module.css';

const HUE_PRESETS: readonly number[] = [25, 55, 145, 195, 250, 300];

export default function AppearancePanel({ onClose }: { onClose: () => void }): JSX.Element {
  const [accent, setAccent] = useState<'mono' | 'hue'>('mono');
  const [hue, setHue] = useState(DEFAULT_SLIDER_HUE);
  const [fontMode, setFontMode] = useState<FontMode>('default');
  const [cardDecor, setCardDecor] = useState<CardDecor>('ink');
  const [navbarMode, setNavbarMode] = useState<NavbarMode>('always');
  const [bgMode, setBgMode] = useState<BgMode>('plain');
  const [motionOn, setMotionOn] = useState(true);

  // Read stored preferences after mount (SSR renders defaults).
  useEffect(() => {
    const storedHue = readAccentHue();
    if (storedHue !== null) {
      setAccent('hue');
      setHue(storedHue);
    }
    setFontMode(readFontMode());
    setCardDecor(readCardDecor());
    setNavbarMode(readNavbarMode());
    setBgMode(readBgMode());
    setMotionOn(!readMotionOff());
  }, []);

  // Esc closes the panel (outside click is handled by the NavbarItem wrapper).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const chooseMono = () => {
    setAccent('mono');
    writeAccentHue(null);
  };

  const chooseHue = (next: number) => {
    setAccent('hue');
    setHue(next);
    writeAccentHue(next);
  };

  const onHueSlider = (event: React.ChangeEvent<HTMLInputElement>) => {
    chooseHue(Number(event.currentTarget.value));
  };

  const pickFont = (mode: FontMode) => {
    setFontMode(mode);
    writeFontMode(mode);
  };

  const pickCardDecor = (decor: CardDecor) => {
    setCardDecor(decor);
    writeCardDecor(decor);
  };

  const pickNavbarMode = (mode: NavbarMode) => {
    setNavbarMode(mode);
    writeNavbarMode(mode);
  };

  const pickBgMode = (mode: BgMode) => {
    setBgMode(mode);
    writeBgMode(mode);
  };

  const pickMotion = (on: boolean) => {
    setMotionOn(on);
    setMotionOff(!on);
  };

  return (
    <div
      className={styles.panel}
      role="dialog"
      aria-label={translate({ id: 'appearance.panelTitle', message: '外观设置' })}>
      {/* 1. 字体样式 */}
      <h3 className={styles.sectionTitle}>
        {translate({ id: 'appearance.fontStyle', message: '字体样式' })}
      </h3>
      <div className={styles.options}>
        <button
          type="button"
          className={`${styles.option} ${fontMode === 'default' ? styles.optionActive : ''}`}
          aria-pressed={fontMode === 'default'}
          onClick={() => pickFont('default')}>
          {translate({ id: 'appearance.fontDefault', message: '默认字体' })}
        </button>
        <button
          type="button"
          className={`${styles.option} ${fontMode === 'wenkai' ? styles.optionActive : ''}`}
          aria-pressed={fontMode === 'wenkai'}
          onClick={() => pickFont('wenkai')}>
          {translate({ id: 'appearance.fontWenkai', message: '霞鹜文楷' })}
        </button>
      </div>

      {/* 2. 主题色相 */}
      <h3 className={styles.sectionTitle}>
        {translate({ id: 'appearance.hue', message: '主题色相' })}
      </h3>
      <div className={styles.swatchRow}>
        <button
          type="button"
          className={`${styles.swatch} ${accent === 'mono' ? styles.swatchActive : ''}`}
          style={{ background: 'var(--ink)' }}
          title={translate({ id: 'appearance.accentMono', message: '水墨' })}
          aria-label={translate({ id: 'appearance.accentMono', message: '水墨' })}
          aria-pressed={accent === 'mono'}
          onClick={chooseMono}
        />
        {HUE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={`${styles.swatch} ${accent === 'hue' && hue === preset ? styles.swatchActive : ''}`}
            style={{ background: `oklch(0.72 0.13 ${preset})` }}
            title={`${translate({ id: 'appearance.hue', message: '主题色相' })} ${preset}`}
            aria-label={`${translate({ id: 'appearance.hue', message: '主题色相' })} ${preset}`}
            aria-pressed={accent === 'hue' && hue === preset}
            onClick={() => chooseHue(preset)}
          />
        ))}
      </div>
      <div className={styles.hueRow}>
        <input
          type="range"
          className={`${styles.hueSlider} ${accent === 'mono' ? styles.hueDimmed : ''}`}
          min={0}
          max={360}
          step={1}
          value={hue}
          aria-label={translate({ id: 'appearance.hue', message: '主题色相' })}
          onChange={onHueSlider}
        />
        <span className={styles.hueBadge}>{accent === 'hue' ? hue : '—'}</span>
        <button
          type="button"
          className={styles.resetBtn}
          title={translate({ id: 'appearance.hueReset', message: '重置' })}
          aria-label={translate({ id: 'appearance.hueReset', message: '重置' })}
          onClick={chooseMono}>
          ↺
        </button>
      </div>

      {/* 3. 卡片装饰 */}
      <h3 className={styles.sectionTitle}>
        {translate({ id: 'appearance.cardDecor', message: '卡片装饰' })}
      </h3>
      <div className={styles.options}>
        <button
          type="button"
          className={`${styles.option} ${styles.decorCard} ${styles.decorCardSharp} ${
            cardDecor === 'ink' ? styles.optionActive : ''
          }`}
          aria-pressed={cardDecor === 'ink'}
          onClick={() => pickCardDecor('ink')}>
          <span className={styles.decorPreview} aria-hidden="true">
            <span className={`${styles.decorChip} ${styles.decorChipSharp}`} />
            <span className={`${styles.decorBtn} ${styles.decorBtnSharp}`} />
          </span>
          {translate({ id: 'appearance.cardDecorSharp', message: '刀锋直角' })}
          <span className={styles.optionDesc}>
            {translate({ id: 'appearance.cardDecorSharpDesc', message: '直角切割，无阴影' })}
          </span>
        </button>
        <button
          type="button"
          className={`${styles.option} ${styles.decorCard} ${styles.decorCardSoft} ${
            cardDecor === 'soft' ? styles.optionActive : ''
          }`}
          aria-pressed={cardDecor === 'soft'}
          onClick={() => pickCardDecor('soft')}>
          <span className={styles.decorPreview} aria-hidden="true">
            <span className={`${styles.decorChip} ${styles.decorChipSoft}`} />
            <span className={`${styles.decorBtn} ${styles.decorBtnSoft}`} />
          </span>
          {translate({ id: 'appearance.cardDecorSoft', message: '柔和圆角' })}
          <span className={styles.optionDesc}>
            {translate({ id: 'appearance.cardDecorSoftDesc', message: '圆角描边，柔和阴影' })}
          </span>
        </button>
      </div>

      {/* 4. 导航栏 */}
      <h3 className={styles.sectionTitle}>
        {translate({ id: 'appearance.navbar', message: '导航栏' })}
      </h3>
      <div className={styles.options}>
        <button
          type="button"
          className={`${styles.option} ${navbarMode === 'autohide' ? styles.optionActive : ''}`}
          aria-pressed={navbarMode === 'autohide'}
          onClick={() => pickNavbarMode('autohide')}>
          {translate({ id: 'appearance.navbarAutohide', message: '滚动收缩' })}
          <span className={styles.optionDesc}>
            {translate({ id: 'appearance.navbarAutohideDesc', message: '下滚隐藏，上滚展开' })}
          </span>
        </button>
        <button
          type="button"
          className={`${styles.option} ${navbarMode === 'always' ? styles.optionActive : ''}`}
          aria-pressed={navbarMode === 'always'}
          onClick={() => pickNavbarMode('always')}>
          {translate({ id: 'appearance.navbarAlways', message: '始终展开' })}
          <span className={styles.optionDesc}>
            {translate({ id: 'appearance.navbarAlwaysDesc', message: '滚动时保持完整导航' })}
          </span>
        </button>
      </div>

      {/* 5. 背景纹理 */}
      <h3 className={styles.sectionTitle}>
        {translate({ id: 'appearance.bgMode', message: '背景纹理' })}
      </h3>
      <div className={styles.options}>
        <button
          type="button"
          className={`${styles.bgBtn} ${bgMode === 'plain' ? styles.optionActive : ''}`}
          aria-pressed={bgMode === 'plain'}
          onClick={() => pickBgMode('plain')}>
          <span className={styles.bgPreview} aria-hidden="true" />
          {translate({ id: 'appearance.bgPlain', message: '纯色' })}
        </button>
        <button
          type="button"
          className={`${styles.bgBtn} ${bgMode === 'grid' ? styles.optionActive : ''}`}
          aria-pressed={bgMode === 'grid'}
          onClick={() => pickBgMode('grid')}>
          <span className={`${styles.bgPreview} ${styles.bgPreviewGrid}`} aria-hidden="true" />
          {translate({ id: 'appearance.bgGrid', message: '网格' })}
        </button>
        <button
          type="button"
          className={`${styles.bgBtn} ${bgMode === 'dots' ? styles.optionActive : ''}`}
          aria-pressed={bgMode === 'dots'}
          onClick={() => pickBgMode('dots')}>
          <span className={`${styles.bgPreview} ${styles.bgPreviewDots}`} aria-hidden="true" />
          {translate({ id: 'appearance.bgDots', message: '点阵' })}
        </button>
      </div>

      {/* 6. 偏好 */}
      <h3 className={styles.sectionTitle}>
        {translate({ id: 'appearance.preferences', message: '偏好' })}
      </h3>
      <div className={styles.options}>
        <button
          type="button"
          className={`${styles.option} ${motionOn ? styles.optionActive : ''}`}
          aria-pressed={motionOn}
          onClick={() => pickMotion(true)}>
          {translate({ id: 'appearance.animations', message: '动画' })} ·{' '}
          {translate({ id: 'appearance.animationsOn', message: '开' })}
        </button>
        <button
          type="button"
          className={`${styles.option} ${!motionOn ? styles.optionActive : ''}`}
          aria-pressed={!motionOn}
          onClick={() => pickMotion(false)}>
          {translate({ id: 'appearance.animations', message: '动画' })} ·{' '}
          {translate({ id: 'appearance.animationsOff', message: '关' })}
        </button>
      </div>
    </div>
  );
}

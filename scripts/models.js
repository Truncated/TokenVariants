export const DEFAULT_ACTIVE_EFFECT_CONFIG = {
  effectName: '',
  imgName: '',
  imgSrc: '',
  priority: 50,
  config: null,
  overlay: false,
  alwaysOn: false,
  disabled: false,
  overlayConfig: null,
  targetActors: null,
  group: 'Default',
};

export const DEFAULT_OVERLAY_CONFIG = {
  img: '',
  alpha: 1,
  scaleX: 1,
  scaleY: 1,
  offsetX: 0,
  offsetY: 0,
  angle: 0,
  filter: 'NONE',
  filterOptions: {},
  inheritTint: false,
  top: false,
  bottom: false,
  underlay: false,
  linkRotation: true,
  linkMirror: true,
  linkOpacity: false,
  linkScale: true,
  mirror: false,
  tint: null,
  loop: true,
  playOnce: false,
  animation: {
    rotate: false,
    duration: 5000,
    clockwise: true,
    relative: false,
  },
  limitedUsers: [],
  alwaysVisible: false,
  text: {
    text: '',
    fontSize: CONFIG.canvasTextStyle.fontSize,
    fontFamily: CONFIG.canvasTextStyle.fontFamily,
    fill: CONFIG.canvasTextStyle.fill,
    dropShadow: CONFIG.canvasTextStyle.dropShadow,
    strokeThickness: CONFIG.canvasTextStyle.strokeThickness,
    stroke: CONFIG.canvasTextStyle.stroke,
    curve: { radius: 0, invert: false },
    letterSpacing: CONFIG.canvasTextStyle.letterSpacing,
  },
  parent: '',
  anchor: { x: 0.5, y: 0.5 },
};

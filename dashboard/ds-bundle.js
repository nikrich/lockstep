/* @ds-bundle: {"format":3,"namespace":"LockstepDesignSystem_e35539","components":[{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Segmented","sourcePath":"components/forms/Segmented.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"FileRow","sourcePath":"components/product/FileRow.jsx"},{"name":"StatBlock","sourcePath":"components/product/StatBlock.jsx"},{"name":"StatusBadge","sourcePath":"components/product/StatusBadge.jsx"}],"sourceHashes":{"components/core/Avatar.jsx":"6196504e5e4f","components/core/Badge.jsx":"9c631970cb60","components/core/Button.jsx":"1ef669c32904","components/core/Card.jsx":"8df67cf30f71","components/core/IconButton.jsx":"56ccb97330c1","components/forms/Input.jsx":"fe58c1b122cc","components/forms/Segmented.jsx":"3d46036e524f","components/forms/Switch.jsx":"bedcf6284153","components/product/FileRow.jsx":"2431e1fd1309","components/product/StatBlock.jsx":"9747ab8e5155","components/product/StatusBadge.jsx":"ff77103582cc","ui_kits/desktop/App.jsx":"4fbdcf68de69","ui_kits/desktop/Shell.jsx":"dc753979e364","ui_kits/desktop/Views.jsx":"67525f1deb89","ui_kits/desktop/data.js":"db74f320c320","ui_kits/marketing/Site.jsx":"cc7b4244901d"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.LockstepDesignSystem_e35539 = window.LockstepDesignSystem_e35539 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** User avatar. Initials fallback with a deterministic tint from the name. */
function Avatar({
  name = '',
  src = null,
  size = 28,
  ring = false,
  style = {},
  ...rest
}) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase() || '?';
  const tints = ['#3b9eff', '#2fcf91', '#9b8cff', '#ffb224', '#ff7a7a', '#46c6c6'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = h * 31 + name.charCodeAt(i) >>> 0;
  const tint = tints[h % tints.length];
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size,
      height: size,
      borderRadius: '50%',
      flex: 'none',
      background: src ? 'transparent' : `color-mix(in srgb, ${tint} 22%, var(--ink-800))`,
      color: tint,
      font: `var(--weight-bold) ${Math.round(size * 0.4)}px/1 var(--font-sans)`,
      boxShadow: ring ? `0 0 0 2px var(--bg-panel), 0 0 0 3.5px ${tint}` : 'none',
      overflow: 'hidden',
      ...style
    }
  }, rest), src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }
  }) : initials);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Compact label. `tone` carries semantic meaning; `solid` for filled style. */
function Badge({
  tone = 'neutral',
  solid = false,
  dot = false,
  children,
  style = {},
  ...rest
}) {
  const map = {
    neutral: {
      fg: 'var(--slate-200)',
      bg: 'rgba(255,255,255,0.06)',
      dotc: 'var(--slate-300)'
    },
    amber: {
      fg: 'var(--amber-300)',
      bg: 'var(--status-locked-bg)',
      dotc: 'var(--status-locked)'
    },
    blue: {
      fg: 'var(--status-mine)',
      bg: 'var(--status-mine-bg)',
      dotc: 'var(--status-mine)'
    },
    green: {
      fg: 'var(--status-synced)',
      bg: 'var(--status-synced-bg)',
      dotc: 'var(--status-synced)'
    },
    red: {
      fg: 'var(--status-conflict)',
      bg: 'var(--status-conflict-bg)',
      dotc: 'var(--status-conflict)'
    },
    violet: {
      fg: 'var(--status-pending)',
      bg: 'var(--status-pending-bg)',
      dotc: 'var(--status-pending)'
    }
  };
  const c = map[tone] || map.neutral;
  const solidBg = {
    amber: 'var(--brand)',
    blue: 'var(--status-mine)',
    green: 'var(--status-synced)',
    red: 'var(--status-conflict)',
    violet: 'var(--status-pending)',
    neutral: 'var(--surface-raised)'
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      height: '20px',
      padding: '0 8px',
      borderRadius: 'var(--radius-pill)',
      font: 'var(--weight-semibold) var(--text-2xs)/1 var(--font-mono)',
      letterSpacing: '0.02em',
      textTransform: 'uppercase',
      color: solid ? tone === 'neutral' ? 'var(--text-body)' : '#15110a' : c.fg,
      background: solid ? solidBg[tone] : c.bg,
      whiteSpace: 'nowrap',
      ...style
    }
  }, rest), dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: solid ? 'currentColor' : c.dotc,
      flex: 'none'
    }
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Lockstep primary button. Variants map to intent; amber is reserved for the
 * single primary action on a surface. All sizing/colour pulls from tokens.
 */
function Button({
  variant = 'primary',
  size = 'md',
  iconLeft = null,
  iconRight = null,
  disabled = false,
  full = false,
  type = 'button',
  children,
  style = {},
  ...rest
}) {
  const heights = {
    sm: 'var(--control-sm)',
    md: 'var(--control-md)',
    lg: 'var(--control-lg)'
  };
  const pads = {
    sm: '0 10px',
    md: '0 14px',
    lg: '0 20px'
  };
  const fonts = {
    sm: 'var(--text-sm)',
    md: 'var(--text-base)',
    lg: 'var(--text-md)'
  };
  const variants = {
    primary: {
      background: 'var(--brand)',
      color: 'var(--brand-contrast)',
      border: '1px solid transparent',
      boxShadow: 'var(--glow-amber)'
    },
    secondary: {
      background: 'var(--surface-raised)',
      color: 'var(--text-body)',
      border: '1px solid var(--border-default)',
      boxShadow: 'var(--shadow-edge)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-secondary)',
      border: '1px solid transparent'
    },
    outline: {
      background: 'transparent',
      color: 'var(--text-body)',
      border: '1px solid var(--border-strong)'
    },
    danger: {
      background: 'var(--status-conflict)',
      color: '#2a0808',
      border: '1px solid transparent'
    }
  };
  const base = {
    display: full ? 'flex' : 'inline-flex',
    width: full ? '100%' : 'auto',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '7px',
    height: heights[size],
    padding: pads[size],
    font: `var(--weight-semibold) ${fonts[size]}/1 var(--font-sans)`,
    letterSpacing: '-0.005em',
    borderRadius: 'var(--radius-md)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    whiteSpace: 'nowrap',
    transition: 'filter var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out)',
    userSelect: 'none',
    ...variants[variant],
    ...style
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: disabled,
    style: base,
    onMouseDown: e => {
      if (!disabled) e.currentTarget.style.transform = 'translateY(0.5px) scale(0.99)';
    },
    onMouseUp: e => {
      e.currentTarget.style.transform = 'none';
    },
    onMouseEnter: e => {
      if (!disabled) e.currentTarget.style.filter = 'brightness(1.08)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.filter = 'none';
      e.currentTarget.style.transform = 'none';
    }
  }, rest), iconLeft, children, iconRight);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Surface container. `pad` controls inner padding; `raised` adds elevation. */
function Card({
  raised = false,
  pad = 'md',
  interactive = false,
  children,
  style = {},
  ...rest
}) {
  const pads = {
    none: 0,
    sm: '12px',
    md: '16px',
    lg: '24px'
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      padding: pads[pad],
      boxShadow: raised ? 'var(--shadow-md), var(--shadow-edge)' : 'var(--shadow-edge)',
      transition: 'border-color var(--dur-base), transform var(--dur-base)',
      cursor: interactive ? 'pointer' : 'default',
      ...style
    },
    onMouseEnter: interactive ? e => {
      e.currentTarget.style.borderColor = 'var(--border-strong)';
    } : undefined,
    onMouseLeave: interactive ? e => {
      e.currentTarget.style.borderColor = 'var(--border-subtle)';
    } : undefined
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Square icon-only button. Used heavily in the desktop app toolbars. */
function IconButton({
  size = 'md',
  variant = 'ghost',
  active = false,
  disabled = false,
  label,
  children,
  style = {},
  ...rest
}) {
  const dims = {
    sm: 28,
    md: 34,
    lg: 42
  };
  const d = dims[size];
  const variants = {
    ghost: {
      background: active ? 'var(--surface-hover)' : 'transparent',
      border: '1px solid transparent'
    },
    solid: {
      background: 'var(--surface-raised)',
      border: '1px solid var(--border-default)'
    },
    amber: {
      background: 'var(--brand)',
      border: '1px solid transparent',
      color: 'var(--brand-contrast)'
    }
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": label,
    title: label,
    disabled: disabled,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: d,
      height: d,
      borderRadius: 'var(--radius-md)',
      color: active ? 'var(--text-strong)' : 'var(--text-secondary)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      transition: 'background var(--dur-fast) var(--ease-out), color var(--dur-fast)',
      ...variants[variant],
      ...style
    },
    onMouseEnter: e => {
      if (!disabled && variant === 'ghost' && !active) e.currentTarget.style.background = 'var(--surface-hover)';
    },
    onMouseLeave: e => {
      if (variant === 'ghost' && !active) e.currentTarget.style.background = 'transparent';
    }
  }, rest), children);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Text input with optional leading icon and label. Dark-surface styling. */
function Input({
  label,
  hint,
  error,
  iconLeft = null,
  size = 'md',
  mono = false,
  id,
  style = {},
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const heights = {
    sm: 'var(--control-sm)',
    md: 'var(--control-md)',
    lg: 'var(--control-lg)'
  };
  const reactId = React.useId();
  const inputId = id || reactId;
  const borderColor = error ? 'var(--status-conflict)' : focus ? 'var(--border-focus)' : 'var(--border-default)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: inputId,
    style: {
      font: 'var(--weight-semibold) var(--text-sm)/1 var(--font-sans)',
      color: 'var(--text-secondary)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      height: heights[size],
      padding: '0 11px',
      background: 'var(--surface-sunken)',
      border: `1px solid ${borderColor}`,
      borderRadius: 'var(--radius-md)',
      boxShadow: focus ? error ? '0 0 0 3px var(--status-conflict-bg)' : 'var(--ring-focus)' : 'none',
      transition: 'border-color var(--dur-fast), box-shadow var(--dur-fast)'
    }
  }, iconLeft && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-muted)',
      display: 'inline-flex',
      flex: 'none'
    }
  }, iconLeft), /*#__PURE__*/React.createElement("input", _extends({
    id: inputId,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      minWidth: 0,
      border: 'none',
      outline: 'none',
      background: 'transparent',
      color: 'var(--text-body)',
      font: `var(--weight-medium) var(--text-base)/1 ${mono ? 'var(--font-mono)' : 'var(--font-sans)'}`
    }
  }, rest))), (hint || error) && /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-xs)/1.4 var(--font-sans)',
      color: error ? 'var(--status-conflict)' : 'var(--text-muted)'
    }
  }, error || hint));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Segmented.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Segmented control — a row of mutually-exclusive options. */
function Segmented({
  options = [],
  value,
  onChange,
  size = 'md',
  style = {},
  ...rest
}) {
  const h = size === 'sm' ? 28 : 34;
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "tablist",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 2,
      padding: 3,
      height: h,
      background: 'var(--surface-sunken)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)',
      ...style
    }
  }, rest), options.map(opt => {
    const val = typeof opt === 'string' ? opt : opt.value;
    const lbl = typeof opt === 'string' ? opt : opt.label;
    const active = val === value;
    return /*#__PURE__*/React.createElement("button", {
      key: val,
      role: "tab",
      "aria-selected": active,
      onClick: () => onChange && onChange(val),
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: '100%',
        padding: '0 12px',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        font: `var(--weight-semibold) ${size === 'sm' ? 'var(--text-sm)' : 'var(--text-base)'}/1 var(--font-sans)`,
        color: active ? 'var(--text-strong)' : 'var(--text-muted)',
        background: active ? 'var(--surface-raised)' : 'transparent',
        boxShadow: active ? 'var(--shadow-edge)' : 'none',
        transition: 'color var(--dur-fast), background var(--dur-fast)'
      }
    }, typeof opt === 'object' && opt.icon, lbl);
  }));
}
Object.assign(__ds_scope, { Segmented });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Segmented.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** On/off switch. Amber when on. */
function Switch({
  checked = false,
  onChange,
  disabled = false,
  label,
  size = 'md',
  style = {},
  ...rest
}) {
  const dims = size === 'sm' ? {
    w: 32,
    h: 18,
    k: 13
  } : {
    w: 40,
    h: 22,
    k: 17
  };
  const toggle = () => {
    if (!disabled && onChange) onChange(!checked);
  };
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 9,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", _extends({
    role: "switch",
    "aria-checked": checked,
    onClick: toggle,
    style: {
      position: 'relative',
      width: dims.w,
      height: dims.h,
      flex: 'none',
      borderRadius: 'var(--radius-pill)',
      background: checked ? 'var(--brand)' : 'var(--ink-700)',
      border: '1px solid',
      borderColor: checked ? 'transparent' : 'var(--border-default)',
      transition: 'background var(--dur-base) var(--ease-out)'
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: '50%',
      left: checked ? dims.w - dims.k - 3 : 2,
      transform: 'translateY(-50%)',
      width: dims.k,
      height: dims.k,
      borderRadius: '50%',
      background: checked ? 'var(--brand-contrast)' : 'var(--slate-200)',
      boxShadow: 'var(--shadow-xs)',
      transition: 'left var(--dur-base) var(--ease-snap)'
    }
  })), label && /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-medium) var(--text-base)/1 var(--font-sans)',
      color: 'var(--text-body)'
    }
  }, label));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/product/StatBlock.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * A big metric block for the storage / cost dashboard. The cost story is core
 * Lockstep messaging, so numbers are rendered in mono with a clear delta.
 */
function StatBlock({
  label,
  value,
  unit = null,
  delta = null,
  deltaTone = 'good',
  hint = null,
  accent = false,
  style = {},
  ...rest
}) {
  const deltaColors = {
    good: 'var(--status-synced)',
    bad: 'var(--status-conflict)',
    neutral: 'var(--text-muted)'
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      padding: 18,
      borderRadius: 'var(--radius-lg)',
      background: accent ? 'color-mix(in srgb, var(--brand) 9%, var(--surface-card))' : 'var(--surface-card)',
      border: '1px solid ' + (accent ? 'color-mix(in srgb, var(--brand) 32%, var(--border-subtle))' : 'var(--border-subtle)'),
      boxShadow: 'var(--shadow-edge)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-semibold) var(--text-2xs)/1 var(--font-mono)',
      letterSpacing: 'var(--tracking-caps)',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-bold) var(--text-4xl)/1 var(--font-display)',
      color: accent ? 'var(--amber-300)' : 'var(--text-strong)',
      letterSpacing: 'var(--tracking-tight)'
    }
  }, value), unit && /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-semibold) var(--text-lg)/1 var(--font-mono)',
      color: 'var(--text-muted)'
    }
  }, unit)), (delta || hint) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, delta && /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-semibold) var(--text-xs)/1 var(--font-mono)',
      color: deltaColors[deltaTone]
    }
  }, delta), hint && /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-xs)/1.3 var(--font-sans)',
      color: 'var(--text-muted)'
    }
  }, hint)));
}
Object.assign(__ds_scope, { StatBlock });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/product/StatBlock.jsx", error: String((e && e.message) || e) }); }

// components/product/StatusBadge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * The core Lockstep status indicator for a file. Encodes lock/sync state with
 * a consistent colour + icon glyph. This is the product's signature element.
 */
function StatusBadge({
  state = 'synced',
  label,
  size = 'md',
  showIcon = true,
  style = {},
  ...rest
}) {
  const map = {
    synced: {
      c: 'var(--status-synced)',
      bg: 'var(--status-synced-bg)',
      glyph: '●',
      text: 'Synced'
    },
    locked: {
      c: 'var(--status-locked)',
      bg: 'var(--status-locked-bg)',
      glyph: '◆',
      text: 'Locked'
    },
    mine: {
      c: 'var(--status-mine)',
      bg: 'var(--status-mine-bg)',
      glyph: '◆',
      text: 'Locked by you'
    },
    conflict: {
      c: 'var(--status-conflict)',
      bg: 'var(--status-conflict-bg)',
      glyph: '▲',
      text: 'Conflict'
    },
    syncing: {
      c: 'var(--status-pending)',
      bg: 'var(--status-pending-bg)',
      glyph: '◐',
      text: 'Syncing'
    },
    modified: {
      c: 'var(--slate-200)',
      bg: 'rgba(255,255,255,0.06)',
      glyph: '○',
      text: 'Modified'
    }
  };
  const s = map[state] || map.synced;
  const sm = size === 'sm';
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: sm ? 19 : 23,
      padding: sm ? '0 8px' : '0 10px',
      borderRadius: 'var(--radius-pill)',
      background: s.bg,
      color: s.c,
      font: `var(--weight-semibold) ${sm ? 'var(--text-2xs)' : 'var(--text-xs)'}/1 var(--font-sans)`,
      letterSpacing: '0.005em',
      whiteSpace: 'nowrap',
      ...style
    }
  }, rest), showIcon && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: sm ? 8 : 9,
      lineHeight: 1,
      transform: 'translateY(0.5px)'
    }
  }, s.glyph), label || s.text);
}
Object.assign(__ds_scope, { StatusBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/product/StatusBadge.jsx", error: String((e && e.message) || e) }); }

// components/product/FileRow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * A single file row in the Lockstep changes / file-tree view. Shows path,
 * lock state, holder, size, and a trailing action slot. The heart of the app.
 */
function FileRow({
  path = '',
  state = 'synced',
  owner = null,
  size = null,
  selected = false,
  depth = 0,
  action = null,
  onClick,
  style = {},
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const parts = path.split('/');
  const name = parts.pop();
  const dir = parts.length ? parts.join('/') + '/' : '';
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  const extTint = {
    uasset: 'var(--status-mine)',
    umap: 'var(--amber-300)',
    fbx: 'var(--status-synced)',
    png: 'var(--status-pending)'
  }[ext] || 'var(--slate-400)';
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      height: 38,
      padding: '0 12px 0 ' + (12 + depth * 16) + 'px',
      background: selected ? 'var(--status-mine-bg)' : hover ? 'var(--surface-hover)' : 'transparent',
      borderLeft: '2px solid ' + (selected ? 'var(--status-mine)' : 'transparent'),
      cursor: 'pointer',
      userSelect: 'none',
      transition: 'background var(--dur-fast)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 18,
      height: 18,
      borderRadius: 'var(--radius-xs)',
      background: 'color-mix(in srgb, ' + extTint + ' 16%, transparent)',
      color: extTint,
      font: 'var(--weight-bold) 8px/18px var(--font-mono)',
      textAlign: 'center',
      flex: 'none',
      textTransform: 'uppercase'
    }
  }, ext.slice(0, 3) || '∙'), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      font: 'var(--weight-medium) var(--text-base)/1 var(--font-mono)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-muted)'
    }
  }, dir), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-body)'
    }
  }, name)), size && /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-xs)/1 var(--font-mono)',
      color: 'var(--text-muted)',
      flex: 'none'
    }
  }, size), owner && state !== 'synced' && /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    name: owner,
    size: 20
  }), /*#__PURE__*/React.createElement(__ds_scope.StatusBadge, {
    state: state,
    size: "sm",
    style: {
      flex: 'none'
    }
  }), action && /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 'none',
      opacity: hover ? 1 : 0.55,
      transition: 'opacity var(--dur-fast)'
    }
  }, action));
}
Object.assign(__ds_scope, { FileRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/product/FileRow.jsx", error: String((e && e.message) || e) }); }

// ui_kits/desktop/App.jsx
try { (() => {
// Lockstep desktop — app shell
const {
  useState: useAppState
} = React;
function App() {
  const [view, setView] = useAppState('changes');
  const [data, setData] = useAppState(window.LS_DATA);
  const [syncing, setSyncing] = useAppState(false);
  const [toast, setToast] = useAppState(null);
  const flash = (msg, tone) => {
    setToast({
      msg,
      tone
    });
    setTimeout(() => setToast(null), 2400);
  };
  const sync = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      flash('Up to date — 0 blobs through server', 'synced');
    }, 1400);
  };
  const lockToggle = path => {
    setData(d => ({
      ...d,
      changes: d.changes.map(c => c.path === path ? {
        ...c,
        state: c.state === 'mine' ? 'modified' : 'mine',
        owner: c.state === 'mine' ? undefined : 'You'
      } : c)
    }));
    flash('Lock updated · ' + path.split('/').pop(), 'mine');
  };
  const force = path => {
    flash('Lock action sent · ' + path.split('/').pop(), 'locked');
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-app)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement(Titlebar, {
    repo: data.repo,
    syncing: syncing,
    onSync: sync
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement(Sidebar, {
    view: view,
    setView: setView,
    data: data
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      minWidth: 0,
      background: 'var(--bg-app)'
    }
  }, view === 'changes' && /*#__PURE__*/React.createElement(ChangesView, {
    data: data,
    onLockToggle: lockToggle
  }), view === 'locks' && /*#__PURE__*/React.createElement(LocksView, {
    data: data,
    onForce: force
  }), view === 'history' && /*#__PURE__*/React.createElement(HistoryView, {
    data: data
  }), view === 'storage' && /*#__PURE__*/React.createElement(StorageView, {
    data: data
  }))), toast && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 16px',
      background: 'var(--ink-700)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-pill)',
      boxShadow: 'var(--shadow-lg)',
      zIndex: 800,
      animation: 'ls-rise 0.3s var(--ease-out)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: 'var(--status-' + toast.tone + ')'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-medium) var(--text-sm)/1 var(--font-sans)',
      color: 'var(--text-body)'
    }
  }, toast.msg)));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/desktop/App.jsx", error: String((e && e.message) || e) }); }

// ui_kits/desktop/Shell.jsx
try { (() => {
// Lockstep desktop — shared Icon + window chrome (Titlebar, Sidebar)
const {
  useState,
  useRef,
  useEffect
} = React;
const {
  Avatar,
  StatusBadge,
  IconButton
} = window.LockstepDesignSystem_e35539;
function Icon({
  n,
  s = 16,
  color,
  style = {}
}) {
  const r = useRef(null);
  useEffect(() => {
    if (r.current) {
      r.current.innerHTML = '';
      const e = document.createElement('i');
      e.setAttribute('data-lucide', n);
      r.current.appendChild(e);
      window.lucide.createIcons({
        attrs: {
          width: s,
          height: s,
          'stroke-width': 1.75
        }
      });
    }
  }, [n, s]);
  return /*#__PURE__*/React.createElement("span", {
    ref: r,
    style: {
      display: 'inline-flex',
      color: color || 'currentColor',
      ...style
    }
  });
}
function Titlebar({
  repo,
  syncing,
  onSync
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 'var(--titlebar-h)',
      flex: 'none',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '0 12px',
      background: 'var(--ink-950)',
      borderBottom: '1px solid var(--hairline)',
      WebkitAppRegion: 'drag',
      userSelect: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 12,
      height: 12,
      borderRadius: '50%',
      background: '#ff5f57'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 12,
      height: 12,
      borderRadius: '50%',
      background: '#febc2e'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 12,
      height: 12,
      borderRadius: '50%',
      background: '#28c840'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-mark.svg",
    height: "15"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-semibold) var(--text-sm)/1 var(--font-sans)',
      color: 'var(--text-secondary)'
    }
  }, repo.name), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-muted)',
      font: 'var(--text-xs)/1 var(--font-mono)'
    }
  }, "/"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      font: 'var(--weight-medium) var(--text-xs)/1 var(--font-mono)',
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "git-branch",
    s: 12
  }), " ", repo.branch)), /*#__PURE__*/React.createElement("button", {
    onClick: onSync,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 24,
      padding: '0 10px',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border-default)',
      background: 'var(--surface-raised)',
      color: 'var(--text-secondary)',
      cursor: 'pointer',
      font: 'var(--weight-semibold) var(--text-xs)/1 var(--font-sans)',
      WebkitAppRegion: 'no-drag'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "refresh-cw",
    s: 12,
    style: {
      animation: syncing ? 'ls-spin 0.8s linear infinite' : 'none'
    }
  }), syncing ? 'Syncing…' : 'Sync'));
}
function NavItem({
  icon,
  label,
  count,
  active,
  onClick
}) {
  const [h, setH] = useState(false);
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      width: '100%',
      height: 34,
      padding: '0 10px',
      border: 'none',
      borderRadius: 'var(--radius-md)',
      cursor: 'pointer',
      textAlign: 'left',
      background: active ? 'var(--surface-raised)' : h ? 'var(--surface-hover)' : 'transparent',
      color: active ? 'var(--text-strong)' : 'var(--text-secondary)',
      font: `${active ? 'var(--weight-semibold)' : 'var(--weight-medium)'} var(--text-base)/1 var(--font-sans)`,
      boxShadow: active ? 'var(--shadow-edge)' : 'none'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: icon,
    s: 17,
    color: active ? 'var(--amber-400)' : 'var(--text-muted)'
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, label), count != null && /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-semibold) var(--text-2xs)/1 var(--font-mono)',
      color: active ? 'var(--amber-300)' : 'var(--text-muted)',
      background: active ? 'var(--status-locked-bg)' : 'rgba(255,255,255,0.05)',
      padding: '3px 6px',
      borderRadius: 'var(--radius-pill)'
    }
  }, count));
}
function Sidebar({
  view,
  setView,
  data
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 'var(--sidebar-w)',
      flex: 'none',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-panel)',
      borderRight: '1px solid var(--hairline)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 12,
      borderBottom: '1px solid var(--hairline)'
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      width: '100%',
      height: 44,
      padding: '0 10px',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)',
      cursor: 'pointer',
      background: 'var(--surface-card)',
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 26,
      height: 26,
      borderRadius: 'var(--radius-sm)',
      background: 'color-mix(in srgb, var(--amber-400) 18%, var(--ink-800))',
      color: 'var(--amber-400)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "box",
    s: 15
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--weight-semibold) var(--text-sm)/1.2 var(--font-sans)',
      color: 'var(--text-strong)'
    }
  }, data.repo.name), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--text-2xs)/1.2 var(--font-mono)',
      color: 'var(--text-muted)'
    }
  }, data.repo.provider)), /*#__PURE__*/React.createElement(Icon, {
    n: "chevrons-up-down",
    s: 14,
    color: "var(--text-muted)"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: 10,
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--weight-semibold) var(--text-2xs)/1 var(--font-mono)',
      letterSpacing: 'var(--tracking-caps)',
      textTransform: 'uppercase',
      color: 'var(--text-muted)',
      padding: '8px 10px 6px'
    }
  }, "Workspace"), /*#__PURE__*/React.createElement(NavItem, {
    icon: "git-pull-request",
    label: "Changes",
    count: data.changes.length,
    active: view === 'changes',
    onClick: () => setView('changes')
  }), /*#__PURE__*/React.createElement(NavItem, {
    icon: "lock",
    label: "Locks",
    count: data.locks.length,
    active: view === 'locks',
    onClick: () => setView('locks')
  }), /*#__PURE__*/React.createElement(NavItem, {
    icon: "history",
    label: "History",
    active: view === 'history',
    onClick: () => setView('history')
  }), /*#__PURE__*/React.createElement(NavItem, {
    icon: "hard-drive",
    label: "Storage",
    active: view === 'storage',
    onClick: () => setView('storage')
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--weight-semibold) var(--text-2xs)/1 var(--font-mono)',
      letterSpacing: 'var(--tracking-caps)',
      textTransform: 'uppercase',
      color: 'var(--text-muted)',
      padding: '14px 10px 6px'
    }
  }, "Team \xB7 ", data.team.length), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6,
      padding: '4px 10px'
    }
  }, data.team.map(m => /*#__PURE__*/React.createElement(Avatar, {
    key: m.name,
    name: m.name === 'You' ? 'You Me' : m.name,
    size: 28,
    ring: m.you
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 12,
      borderTop: '1px solid var(--hairline)',
      display: 'flex',
      alignItems: 'center',
      gap: 9
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: 'var(--status-synced)',
      boxShadow: '0 0 8px var(--status-synced)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      font: 'var(--text-xs)/1.3 var(--font-sans)',
      color: 'var(--text-muted)'
    }
  }, "Coordination server online"), /*#__PURE__*/React.createElement(IconButton, {
    size: "sm",
    label: "Settings"
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "settings",
    s: 15
  }))));
}
Object.assign(window, {
  Icon,
  Titlebar,
  Sidebar
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/desktop/Shell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/desktop/Views.jsx
try { (() => {
// Lockstep desktop — main content views
const {
  useState: useStateV
} = React;
const {
  Button,
  IconButton: IconBtn,
  StatusBadge: SBadge,
  FileRow,
  StatBlock,
  Avatar: Av,
  Badge: Bdg,
  Input: Inp,
  Segmented: Seg
} = window.LockstepDesignSystem_e35539;
function Toolbar({
  children,
  title,
  sub
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 52,
      flex: 'none',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '0 16px',
      borderBottom: '1px solid var(--hairline)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--weight-semibold) var(--text-md)/1.1 var(--font-sans)',
      color: 'var(--text-strong)'
    }
  }, title), sub && /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--text-xs)/1.2 var(--font-mono)',
      color: 'var(--text-muted)',
      marginTop: 2
    }
  }, sub)), children);
}

// ---------- Changes ----------
function ChangesView({
  data,
  onLockToggle
}) {
  const [sel, setSel] = useStateV(data.changes[0].path);
  const [msg, setMsg] = useStateV('');
  const staged = data.changes.filter(c => c.staged);
  const unstaged = data.changes.filter(c => !c.staged);
  const cur = data.changes.find(c => c.path === sel);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement(Toolbar, {
    title: "Changes",
    sub: data.changes.length + ' files · ' + staged.length + ' staged'
  }, /*#__PURE__*/React.createElement(IconBtn, {
    label: "Refresh"
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "refresh-cw",
    s: 15
  })), /*#__PURE__*/React.createElement(IconBtn, {
    label: "Filter"
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "list-filter",
    s: 15
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement(SectionLabel, {
    n: "check",
    label: 'Staged · ' + staged.length,
    tint: "var(--status-synced)"
  }), staged.map(c => /*#__PURE__*/React.createElement(FileRow, {
    key: c.path,
    path: c.path,
    state: c.state,
    owner: c.owner,
    size: c.size,
    selected: sel === c.path,
    onClick: () => setSel(c.path),
    action: /*#__PURE__*/React.createElement(IconBtn, {
      size: "sm",
      label: "Unstage"
    }, /*#__PURE__*/React.createElement(Icon, {
      n: "minus",
      s: 14
    }))
  })), /*#__PURE__*/React.createElement(SectionLabel, {
    n: "pencil",
    label: 'Changed · ' + unstaged.length,
    tint: "var(--slate-300)"
  }), unstaged.map(c => /*#__PURE__*/React.createElement(FileRow, {
    key: c.path,
    path: c.path,
    state: c.state,
    owner: c.owner,
    size: c.size,
    selected: sel === c.path,
    onClick: () => setSel(c.path),
    action: /*#__PURE__*/React.createElement(IconBtn, {
      size: "sm",
      label: "Stage"
    }, /*#__PURE__*/React.createElement(Icon, {
      n: "plus",
      s: 14
    }))
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 'var(--inspector-w)',
      flex: 'none',
      borderLeft: '1px solid var(--hairline)',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-panel)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16,
      borderBottom: '1px solid var(--hairline)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--weight-medium) var(--text-sm)/1.4 var(--font-mono)',
      color: 'var(--text-body)',
      wordBreak: 'break-all'
    }
  }, cur ? cur.path : '—'), cur && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(SBadge, {
    state: cur.state,
    size: "sm"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-xs)/1 var(--font-mono)',
      color: 'var(--text-muted)'
    }
  }, cur.size)), cur && (cur.state === 'mine' ? /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "sm",
    full: true,
    style: {
      marginTop: 12
    },
    iconLeft: /*#__PURE__*/React.createElement(Icon, {
      n: "unlock",
      s: 14
    }),
    onClick: () => onLockToggle(cur.path)
  }, "Release lock") : /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "sm",
    full: true,
    style: {
      marginTop: 12
    },
    iconLeft: /*#__PURE__*/React.createElement(Icon, {
      n: "lock",
      s: 14
    }),
    onClick: () => onLockToggle(cur.path)
  }, "Lock to edit"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16,
      borderTop: '1px solid var(--hairline)',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("textarea", {
    value: msg,
    onChange: e => setMsg(e.target.value),
    placeholder: "Summary of this change\u2026",
    rows: 3,
    style: {
      width: '100%',
      boxSizing: 'border-box',
      resize: 'none',
      border: '1px solid var(--border-default)',
      background: 'var(--surface-sunken)',
      borderRadius: 'var(--radius-md)',
      padding: 10,
      color: 'var(--text-body)',
      font: 'var(--weight-regular) var(--text-base)/1.5 var(--font-sans)',
      outline: 'none'
    }
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    full: true,
    disabled: !msg.trim(),
    iconLeft: /*#__PURE__*/React.createElement(Icon, {
      n: "git-commit-horizontal",
      s: 16
    })
  }, `Commit ${staged.length} file${staged.length === 1 ? '' : 's'}`))));
}
function SectionLabel({
  n,
  label,
  tint
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      padding: '12px 16px 6px',
      font: 'var(--weight-semibold) var(--text-2xs)/1 var(--font-mono)',
      letterSpacing: 'var(--tracking-caps)',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: n,
    s: 12,
    color: tint
  }), " ", label);
}

// ---------- Locks ----------
function LocksView({
  data,
  onForce
}) {
  const [scope, setScope] = useStateV('all');
  const rows = scope === 'mine' ? data.locks.filter(l => l.state === 'mine') : scope === 'stale' ? data.locks.filter(l => l.stale) : data.locks;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(Toolbar, {
    title: "Locks",
    sub: data.locks.length + ' active · ' + data.locks.filter(l => l.stale).length + ' stale'
  }, /*#__PURE__*/React.createElement(Seg, {
    value: scope,
    onChange: setScope,
    size: "sm",
    options: [{
      value: 'all',
      label: 'All'
    }, {
      value: 'mine',
      label: 'Mine'
    }, {
      value: 'stale',
      label: 'Stale'
    }]
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      background: 'var(--surface-card)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 150px 90px 120px',
      alignItems: 'center',
      gap: 12,
      padding: '10px 16px',
      borderBottom: '1px solid var(--hairline)',
      font: 'var(--weight-semibold) var(--text-2xs)/1 var(--font-mono)',
      letterSpacing: 'var(--tracking-caps)',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement("span", null, "File"), /*#__PURE__*/React.createElement("span", null, "Holder"), /*#__PURE__*/React.createElement("span", null, "Held"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: 'right'
    }
  }, "Action")), rows.map(l => /*#__PURE__*/React.createElement("div", {
    key: l.path,
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 150px 90px 120px',
      alignItems: 'center',
      gap: 12,
      padding: '11px 16px',
      borderBottom: '1px solid var(--hairline)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--weight-medium) var(--text-sm)/1.3 var(--font-mono)',
      color: 'var(--text-body)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, l.path), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--text-2xs)/1 var(--font-mono)',
      color: 'var(--text-muted)',
      marginTop: 3
    }
  }, l.size)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Av, {
    name: l.owner === 'You' ? 'You Me' : l.owner,
    size: 22,
    ring: l.state === 'mine'
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-medium) var(--text-sm)/1 var(--font-sans)',
      color: l.state === 'mine' ? 'var(--status-mine)' : 'var(--text-secondary)'
    }
  }, l.owner)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-sm)/1 var(--font-mono)',
      color: l.stale ? 'var(--status-conflict)' : 'var(--text-muted)'
    }
  }, l.age), l.stale && /*#__PURE__*/React.createElement(Bdg, {
    tone: "red"
  }, "stale")), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, l.state === 'mine' ? /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    iconLeft: /*#__PURE__*/React.createElement(Icon, {
      n: "unlock",
      s: 13
    }),
    onClick: () => onForce(l.path)
  }, "Release") : /*#__PURE__*/React.createElement(Button, {
    variant: l.stale ? 'danger' : 'outline',
    size: "sm",
    onClick: () => onForce(l.path)
  }, l.stale ? 'Force' : 'Request')))))));
}

// ---------- History ----------
function HistoryView({
  data
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(Toolbar, {
    title: "History",
    sub: data.repo.branch
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '8px 16px'
    }
  }, data.history.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: c.hash,
    style: {
      display: 'flex',
      gap: 14,
      padding: '12px 6px',
      borderBottom: i < data.history.length - 1 ? '1px solid var(--hairline)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Av, {
    name: c.author === 'You' ? 'You Me' : c.author,
    size: 28
  }), i < data.history.length - 1 && /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      width: 2,
      background: 'var(--hairline)',
      marginTop: 6
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--weight-medium) var(--text-base)/1.4 var(--font-sans)',
      color: 'var(--text-strong)'
    }
  }, c.msg), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginTop: 5,
      font: 'var(--text-xs)/1 var(--font-mono)',
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-secondary)'
    }
  }, c.author), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--status-mine)'
    }
  }, c.hash), /*#__PURE__*/React.createElement("span", null, c.when), /*#__PURE__*/React.createElement("span", null, "\xB7 ", c.files, " files")))))));
}

// ---------- Storage ----------
function StorageView({
  data
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(Toolbar, {
    title: "Storage",
    sub: data.repo.provider + ' · ' + data.repo.bucket
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "sm",
    iconLeft: /*#__PURE__*/React.createElement(Icon, {
      n: "external-link",
      s: 14
    })
  }, "Open bucket")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(StatBlock, {
    label: "Monthly cost",
    value: "$6",
    unit: "/mo",
    accent: true,
    delta: "\u221294% vs Git LFS",
    deltaTone: "good",
    hint: "estimated"
  }), /*#__PURE__*/React.createElement(StatBlock, {
    label: "Egress billed",
    value: "$0",
    hint: "bytes skip the server"
  }), /*#__PURE__*/React.createElement(StatBlock, {
    label: "Stored",
    value: "104",
    unit: "GB",
    hint: "2,418 blobs"
  }), /*#__PURE__*/React.createElement(StatBlock, {
    label: "Active locks",
    value: "6",
    delta: "2 stale",
    deltaTone: "neutral"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--weight-semibold) var(--text-md)/1 var(--font-sans)',
      color: 'var(--text-strong)',
      marginBottom: 4
    }
  }, "Cost vs hosted Git LFS"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--text-xs)/1 var(--font-mono)',
      color: 'var(--text-muted)',
      marginBottom: 18
    }
  }, "100 GB game \xB7 active team \xB7 per month"), [{
    label: 'GitHub Git LFS',
    val: 350,
    color: 'var(--status-conflict)',
    disp: '$78–350+'
  }, {
    label: 'Lockstep + R2',
    val: 6,
    color: 'var(--amber-400)',
    disp: '~$6'
  }, {
    label: 'Lockstep + B2 + CDN',
    val: 2.4,
    color: 'var(--status-synced)',
    disp: '~$2'
  }].map(b => /*#__PURE__*/React.createElement("div", {
    key: b.label,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 150,
      flex: 'none',
      font: 'var(--weight-medium) var(--text-sm)/1 var(--font-sans)',
      color: 'var(--text-secondary)'
    }
  }, b.label), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 22,
      background: 'var(--surface-sunken)',
      borderRadius: 'var(--radius-sm)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: b.val / 350 * 100 + '%',
      minWidth: 8,
      height: '100%',
      background: b.color,
      borderRadius: 'var(--radius-sm)'
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 80,
      flex: 'none',
      textAlign: 'right',
      font: 'var(--weight-semibold) var(--text-sm)/1 var(--font-mono)',
      color: b.color
    }
  }, b.disp))))));
}
Object.assign(window, {
  ChangesView,
  LocksView,
  HistoryView,
  StorageView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/desktop/Views.jsx", error: String((e && e.message) || e) }); }

// ui_kits/desktop/data.js
try { (() => {
// Lockstep desktop — demo data. Attached to window for cross-file babel scope.
window.LS_DATA = {
  repo: {
    name: 'aurora-rpg',
    branch: 'feature/arena-pass',
    provider: 'Cloudflare R2',
    bucket: 'aurora-assets'
  },
  team: [{
    name: 'You',
    you: true
  }, {
    name: 'Kai Renner'
  }, {
    name: 'Theo Park'
  }, {
    name: 'Mara Voss'
  }, {
    name: 'Juno Sandak'
  }],
  changes: [{
    path: 'Content/Maps/Arena.umap',
    state: 'mine',
    size: '248 MB',
    owner: 'You',
    staged: true
  }, {
    path: 'Content/Characters/Hero/Hero.uasset',
    state: 'mine',
    size: '61 MB',
    owner: 'You',
    staged: true
  }, {
    path: 'Source/Gameplay/Player.cpp',
    state: 'modified',
    size: '14 KB',
    staged: false
  }, {
    path: 'Source/Gameplay/Player.h',
    state: 'modified',
    size: '3 KB',
    staged: false
  }, {
    path: 'Config/DefaultGame.ini',
    state: 'modified',
    size: '8 KB',
    staged: false
  }],
  locks: [{
    path: 'Content/Maps/Arena.umap',
    state: 'mine',
    owner: 'You',
    age: '12m',
    size: '248 MB'
  }, {
    path: 'Content/Characters/Hero/Hero.uasset',
    state: 'mine',
    owner: 'You',
    age: '12m',
    size: '61 MB'
  }, {
    path: 'Content/FX/Explosion.uasset',
    state: 'locked',
    owner: 'Kai Renner',
    age: '1h 40m',
    size: '33 MB'
  }, {
    path: 'Content/Maps/Lobby.umap',
    state: 'locked',
    owner: 'Theo Park',
    age: '3h 02m',
    size: '180 MB'
  }, {
    path: 'Content/Audio/Boss/Theme.fbx',
    state: 'locked',
    owner: 'Mara Voss',
    age: '5h 18m',
    size: '12 MB',
    stale: true
  }, {
    path: 'Content/Vehicles/Tank/Tank.uasset',
    state: 'locked',
    owner: 'Juno Sandak',
    age: '22h',
    size: '94 MB',
    stale: true
  }],
  history: [{
    msg: 'Block out arena upper ring + cover',
    author: 'You',
    hash: '9f2ac01',
    when: '14m ago',
    files: 4
  }, {
    msg: 'Hero idle + run anim retarget',
    author: 'Mara Voss',
    hash: '3b71e0d',
    when: '2h ago',
    files: 11
  }, {
    msg: 'Lock heartbeat TTL → 90s',
    author: 'Kai Renner',
    hash: 'c014b8a',
    when: '5h ago',
    files: 2
  }, {
    msg: 'Explosion VFX pass, new flipbook',
    author: 'Theo Park',
    hash: 'd9f3120',
    when: 'Yesterday',
    files: 6
  }, {
    msg: 'Presigned PUT for multipart blobs',
    author: 'Kai Renner',
    hash: '77a9e41',
    when: 'Yesterday',
    files: 3
  }]
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/desktop/data.js", error: String((e && e.message) || e) }); }

// ui_kits/marketing/Site.jsx
try { (() => {
// Lockstep marketing landing page
const {
  useState: useM
} = React;
const {
  Button,
  Badge,
  StatBlock,
  StatusBadge,
  FileRow
} = window.LockstepDesignSystem_e35539;
function MIcon({
  n,
  s = 18,
  color,
  sw = 1.75
}) {
  const r = React.useRef(null);
  React.useEffect(() => {
    if (r.current) {
      r.current.innerHTML = '';
      const e = document.createElement('i');
      e.setAttribute('data-lucide', n);
      r.current.appendChild(e);
      window.lucide.createIcons({
        attrs: {
          width: s,
          height: s,
          'stroke-width': sw
        }
      });
    }
  }, [n, s]);
  return /*#__PURE__*/React.createElement("span", {
    ref: r,
    style: {
      display: 'inline-flex',
      color: color || 'currentColor'
    }
  });
}
function Nav() {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 200,
      height: 64,
      display: 'flex',
      alignItems: 'center',
      gap: 24,
      padding: '0 32px',
      background: 'color-mix(in srgb, var(--ink-990) 82%, transparent)',
      backdropFilter: 'blur(14px)',
      borderBottom: '1px solid var(--hairline)'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-wordmark-dark.svg",
    height: "26"
  }), /*#__PURE__*/React.createElement("nav", {
    style: {
      flex: 1,
      display: 'flex',
      gap: 26,
      marginLeft: 18
    }
  }, ['Pricing', 'How it works', 'Locking', 'Docs'].map(l => /*#__PURE__*/React.createElement("a", {
    key: l,
    href: "#",
    style: {
      font: 'var(--weight-medium) var(--text-base)/1 var(--font-sans)',
      color: 'var(--text-secondary)',
      textDecoration: 'none'
    }
  }, l))), /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      font: 'var(--weight-medium) var(--text-base)/1 var(--font-sans)',
      color: 'var(--text-secondary)',
      textDecoration: 'none'
    }
  }, "Sign in"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "sm",
    iconLeft: /*#__PURE__*/React.createElement(MIcon, {
      n: "download",
      s: 15
    })
  }, "Download"));
}
function Hero() {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      position: 'relative',
      padding: '88px 32px 72px',
      textAlign: 'center',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(255,178,36,0.10), transparent 70%)',
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      maxWidth: 860,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 14px',
      borderRadius: 'var(--radius-pill)',
      border: '1px solid var(--border-default)',
      background: 'var(--surface-card)',
      font: 'var(--weight-semibold) var(--text-xs)/1 var(--font-mono)',
      color: 'var(--text-secondary)',
      marginBottom: 26
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: 'var(--status-synced)'
    }
  }), " Fair-source \xB7 free under $1M/year"), /*#__PURE__*/React.createElement("h1", {
    style: {
      font: 'var(--weight-bold) var(--text-7xl)/1.02 var(--font-display)',
      letterSpacing: '-0.03em',
      color: 'var(--text-strong)',
      margin: '0 0 22px'
    }
  }, "Own your bytes.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--amber-400)'
    }
  }, "Pennies, not hundreds.")), /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--weight-regular) var(--text-xl)/1.55 var(--font-sans)',
      color: 'var(--text-secondary)',
      maxWidth: 620,
      margin: '0 auto 32px'
    }
  }, "Git-based source control for Unreal & Unity. Keep code in git, stream giant binary assets to a bucket ", /*#__PURE__*/React.createElement("em", {
    style: {
      fontStyle: 'normal',
      color: 'var(--text-strong)'
    }
  }, "you own"), ", and lock files like Perforce."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      justifyContent: 'center',
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    iconLeft: /*#__PURE__*/React.createElement(MIcon, {
      n: "download",
      s: 17
    })
  }, "Download for macOS"), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "lg",
    iconLeft: /*#__PURE__*/React.createElement(MIcon, {
      n: "github",
      s: 17
    })
  }, "Star on GitHub")), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--text-sm)/1 var(--font-mono)',
      color: 'var(--text-muted)'
    }
  }, "Works with Cloudflare R2 \xB7 Backblaze B2 \xB7 Wasabi \xB7 MinIO \xB7 S3")));
}
function AppPeek() {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      padding: '0 32px 80px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 920,
      margin: '0 auto',
      borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--border-default)',
      background: 'var(--bg-panel)',
      boxShadow: 'var(--shadow-xl)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 36,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '0 14px',
      borderBottom: '1px solid var(--hairline)',
      background: 'var(--ink-950)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 11,
      height: 11,
      borderRadius: '50%',
      background: '#ff5f57'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 11,
      height: 11,
      borderRadius: '50%',
      background: '#febc2e'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 11,
      height: 11,
      borderRadius: '50%',
      background: '#28c840'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 12,
      font: 'var(--text-xs)/1 var(--font-mono)',
      color: 'var(--text-muted)'
    }
  }, "aurora-rpg \xB7 feature/arena-pass")), /*#__PURE__*/React.createElement(FileRow, {
    path: "Content/Maps/Arena.umap",
    state: "mine",
    owner: "You",
    size: "248 MB"
  }), /*#__PURE__*/React.createElement(FileRow, {
    path: "Content/FX/Explosion.uasset",
    state: "locked",
    owner: "Kai Renner",
    size: "33 MB"
  }), /*#__PURE__*/React.createElement(FileRow, {
    path: "Source/Gameplay/Player.cpp",
    state: "modified",
    size: "14 KB"
  }), /*#__PURE__*/React.createElement(FileRow, {
    path: "Content/Audio/Theme.fbx",
    state: "synced",
    size: "5 MB"
  }), /*#__PURE__*/React.createElement(FileRow, {
    path: "Content/Vehicles/Tank.uasset",
    state: "conflict",
    owner: "Juno Sandak",
    size: "94 MB"
  })));
}
function CostSection() {
  const rows = [{
    label: 'GitHub Git LFS',
    storage: '$39–149',
    bw: '$39–199',
    total: '$78–350+',
    bad: true
  }, {
    label: 'Lockstep + Cloudflare R2',
    storage: '$6',
    bw: '$0',
    total: '~$6',
    star: true
  }, {
    label: 'Lockstep + Backblaze B2 + CDN',
    storage: '$2.40',
    bw: '$0',
    total: '~$2'
  }];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      padding: '20px 32px 90px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 920,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement(SectionHead, {
    eyebrow: "The cost story",
    title: "A 100 GB game, an active team",
    sub: "Hosted LFS bills your entire history plus egress on every clone. Bring-your-own object storage is flat \u2014 and you control retention."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 14,
      marginBottom: 28
    }
  }, /*#__PURE__*/React.createElement(StatBlock, {
    label: "Lockstep + R2",
    value: "~$6",
    unit: "/mo",
    accent: true,
    delta: "\u221294% vs Git LFS",
    deltaTone: "good",
    hint: "same 100 GB"
  }), /*#__PURE__*/React.createElement(StatBlock, {
    label: "Egress billed",
    value: "$0",
    hint: "bytes never touch our server"
  }), /*#__PURE__*/React.createElement(StatBlock, {
    label: "Typical saving",
    value: "10\u201340\xD7",
    hint: "gap widens as history grows"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      background: 'var(--surface-card)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.6fr 1fr 1fr 1fr',
      padding: '12px 18px',
      borderBottom: '1px solid var(--hairline)',
      font: 'var(--weight-semibold) var(--text-2xs)/1 var(--font-mono)',
      letterSpacing: 'var(--tracking-caps)',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null, "Storage/mo"), /*#__PURE__*/React.createElement("span", null, "Bandwidth/mo"), /*#__PURE__*/React.createElement("span", null, "Total/mo")), rows.map(r => /*#__PURE__*/React.createElement("div", {
    key: r.label,
    style: {
      display: 'grid',
      gridTemplateColumns: '1.6fr 1fr 1fr 1fr',
      alignItems: 'center',
      padding: '15px 18px',
      borderBottom: '1px solid var(--hairline)',
      background: r.star ? 'color-mix(in srgb, var(--amber-400) 7%, transparent)' : 'transparent'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      font: 'var(--weight-semibold) var(--text-base)/1.2 var(--font-sans)',
      color: r.star ? 'var(--amber-300)' : 'var(--text-body)'
    }
  }, r.star && /*#__PURE__*/React.createElement(MIcon, {
    n: "lock",
    s: 15,
    color: "var(--amber-400)"
  }), r.label), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-medium) var(--text-base)/1 var(--font-mono)',
      color: 'var(--text-secondary)'
    }
  }, r.storage), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-medium) var(--text-base)/1 var(--font-mono)',
      color: r.bw === '$0' ? 'var(--status-synced)' : 'var(--text-secondary)'
    }
  }, r.bw), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-bold) var(--text-lg)/1 var(--font-mono)',
      color: r.bad ? 'var(--status-conflict)' : r.star ? 'var(--amber-300)' : 'var(--status-synced)'
    }
  }, r.total))))));
}
function SectionHead({
  eyebrow,
  title,
  sub
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginBottom: 40,
      maxWidth: 640,
      marginLeft: 'auto',
      marginRight: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--weight-semibold) var(--text-xs)/1 var(--font-mono)',
      letterSpacing: 'var(--tracking-caps)',
      textTransform: 'uppercase',
      color: 'var(--amber-400)',
      marginBottom: 14
    }
  }, eyebrow), /*#__PURE__*/React.createElement("h2", {
    style: {
      font: 'var(--weight-bold) var(--text-4xl)/1.1 var(--font-display)',
      letterSpacing: '-0.02em',
      color: 'var(--text-strong)',
      margin: '0 0 14px'
    }
  }, title), sub && /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--text-lg)/1.55 var(--font-sans)',
      color: 'var(--text-secondary)',
      margin: 0
    }
  }, sub));
}
function Features() {
  const items = [{
    icon: 'bucket',
    title: 'Bring your own storage',
    body: 'One S3-compatible path covers R2, B2, Wasabi, MinIO and AWS. Your bucket, your retention, your bill.'
  }, {
    icon: 'route-off',
    title: 'Zero egress, zero proxying',
    body: 'Blob bytes go client ↔ bucket directly via short-lived presigned URLs. Nothing to meter.'
  }, {
    icon: 'lock',
    title: 'Perforce-grade locking',
    body: 'Exclusive checkout for unmergeable .uasset / .umap / .fbx — enforced right inside the editor.'
  }, {
    icon: 'gamepad-2',
    title: 'Native engine plugins',
    body: 'Checkout, submit and lock without leaving Unreal. A Unity package follows.'
  }, {
    icon: 'git-branch',
    title: 'It\u2019s just git',
    body: 'Built on git + the Git LFS protocol — every git client and existing provider keeps working.'
  }, {
    icon: 'heart-handshake',
    title: 'Fair-source',
    body: 'Free for indies and studios under $1M/year. Every release converts to Apache 2.0 after four years.'
  }];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      padding: '20px 32px 90px',
      borderTop: '1px solid var(--hairline)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 980,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement(SectionHead, {
    eyebrow: "What you get",
    title: "Built for game teams who own their data"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 16
    }
  }, items.map(it => /*#__PURE__*/React.createElement("div", {
    key: it.title,
    style: {
      padding: 22,
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-subtle)',
      background: 'var(--surface-card)',
      boxShadow: 'var(--shadow-edge)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 38,
      height: 38,
      borderRadius: 'var(--radius-md)',
      background: 'color-mix(in srgb, var(--amber-400) 14%, var(--ink-800))',
      color: 'var(--amber-400)',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(MIcon, {
    n: it.icon,
    s: 19
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--weight-semibold) var(--text-lg)/1.3 var(--font-sans)',
      color: 'var(--text-strong)',
      marginBottom: 7
    }
  }, it.title), /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--text-base)/1.55 var(--font-sans)',
      color: 'var(--text-muted)',
      margin: 0
    }
  }, it.body))))));
}
function CTA() {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      padding: '80px 32px 100px',
      borderTop: '1px solid var(--hairline)',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-mark.svg",
    height: "48",
    style: {
      marginBottom: 22
    }
  }), /*#__PURE__*/React.createElement("h2", {
    style: {
      font: 'var(--weight-bold) var(--text-5xl)/1.05 var(--font-display)',
      letterSpacing: '-0.025em',
      color: 'var(--text-strong)',
      margin: '0 0 16px'
    }
  }, "Stop renting your data back", /*#__PURE__*/React.createElement("br", null), "by the gigabyte."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      justifyContent: 'center',
      marginTop: 28
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    iconLeft: /*#__PURE__*/React.createElement(MIcon, {
      n: "download",
      s: 17
    })
  }, "Download Lockstep"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "lg",
    iconRight: /*#__PURE__*/React.createElement(MIcon, {
      n: "arrow-right",
      s: 17
    })
  }, "Read the docs")));
}
function Footer() {
  return /*#__PURE__*/React.createElement("footer", {
    style: {
      padding: '32px',
      borderTop: '1px solid var(--hairline)',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-mark.svg",
    height: "22"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-sm)/1 var(--font-mono)',
      color: 'var(--text-muted)'
    }
  }, "\xA9 2026 Lockstep \xB7 BSL 1.1 \u2192 Apache 2.0"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 20
    }
  }, ['GitHub', 'Docs', 'License', 'Contact'].map(l => /*#__PURE__*/React.createElement("a", {
    key: l,
    href: "#",
    style: {
      font: 'var(--weight-medium) var(--text-sm)/1 var(--font-sans)',
      color: 'var(--text-muted)',
      textDecoration: 'none'
    }
  }, l))));
}
function Site() {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Nav, null), /*#__PURE__*/React.createElement(Hero, null), /*#__PURE__*/React.createElement(AppPeek, null), /*#__PURE__*/React.createElement(CostSection, null), /*#__PURE__*/React.createElement(Features, null), /*#__PURE__*/React.createElement(CTA, null), /*#__PURE__*/React.createElement(Footer, null));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(Site, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing/Site.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Segmented = __ds_scope.Segmented;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.FileRow = __ds_scope.FileRow;

__ds_ns.StatBlock = __ds_scope.StatBlock;

__ds_ns.StatusBadge = __ds_scope.StatusBadge;

})();

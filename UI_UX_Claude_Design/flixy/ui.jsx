// Flixy — Shared UI components
// Exports: TabBar, StatusBar, ServiceBadge, GenreChip, ActionButton, FlixyButton, MovieCard, GrainOverlay, SwipeStamp

const { useState, useEffect, useRef, useCallback } = React;
const C = window.FlixyTokens.colors;

/* ── Grain overlay ── */
function GrainOverlay() {
  return React.createElement('div', {
    style: {
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 999,
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
      opacity: 0.025,
      borderRadius: 'inherit',
    }
  });
}

/* ── Status bar ── */
function StatusBar({ light }) {
  const color = light ? 'rgba(245,245,240,0.9)' : 'rgba(245,245,240,0.9)';
  return React.createElement('div', {
    style: { height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', flexShrink: 0, zIndex: 10, position: 'relative' }
  },
    React.createElement('span', { style: { fontSize: 15, fontWeight: 600, color, fontFamily: "'Space Grotesk', sans-serif" } }, '9:41'),
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
      React.createElement('span', { style: { fontSize: 12, color } }, '●●●'),
      React.createElement('span', { style: { fontSize: 12, color } }, '▶'),
      React.createElement('span', { style: { fontSize: 12, color } }, '▮▮▮▮'),
    )
  );
}

/* ── Tab bar ── */
function TabBar({ active, onTab }) {
  const tabs = [
    { id: 'discover', label: 'Discover', icon: '◈' },
    { id: 'watchlist', label: 'Watchlist', icon: '♥' },
    { id: 'search', label: 'Search', icon: '◎' },
    { id: 'profile', label: 'Profile', icon: '◉' },
  ];
  return React.createElement('div', {
    style: {
      height: 82, flexShrink: 0,
      background: C.surface,
      borderTop: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      padding: '0 8px 16px',
    }
  },
    ...tabs.map(t =>
      React.createElement('button', {
        key: t.id,
        onClick: () => onTab(t.id),
        style: {
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 3, background: 'none', border: 'none', cursor: 'pointer',
          padding: '8px 0',
        }
      },
        React.createElement('span', {
          style: {
            fontSize: 20,
            color: active === t.id ? C.accent : C.textMuted,
            transition: 'color 0.2s',
            lineHeight: 1,
          }
        }, t.icon),
        React.createElement('span', {
          style: {
            fontSize: 10, fontWeight: 600, letterSpacing: '0.04em',
            fontFamily: "'Space Grotesk', sans-serif",
            color: active === t.id ? C.accent : C.textDim,
            transition: 'color 0.2s',
          }
        }, t.label)
      )
    )
  );
}

/* ── Service badge ── */
function ServiceBadge({ name, size = 'sm', owned = true }) {
  const svcMap = {
    'Netflix': { color: '#E50914', letter: 'N' },
    'Prime':   { color: '#00A8E1', letter: 'P' },
    'Disney+': { color: '#0063E5', letter: 'D' },
    'Max':     { color: '#002BE7', letter: 'M' },
    'Apple TV+': { color: '#555', letter: 'A' },
    'MUBI':    { color: '#4F4FDE', letter: 'U' },
    'Hulu':    { color: '#1CE783', letter: 'H' },
    'Paramount+': { color: '#0064FF', letter: 'P' },
  };
  const s = svcMap[name] || { color: '#666', letter: name[0] };
  const sz = size === 'sm' ? 22 : size === 'md' ? 28 : 36;
  return React.createElement('div', {
    title: name,
    style: {
      width: sz, height: sz, borderRadius: sz * 0.28,
      background: owned ? s.color : 'rgba(255,255,255,0.08)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: sz * 0.45, fontWeight: 700, color: owned ? '#fff' : 'rgba(255,255,255,0.3)',
      fontFamily: "'Space Grotesk', sans-serif",
      flexShrink: 0,
      border: owned ? 'none' : `1px solid ${C.border}`,
      opacity: owned ? 1 : 0.5,
    }
  }, s.letter);
}

/* ── Genre chip ── */
function GenreChip({ label, selected, onPress, small }) {
  return React.createElement('button', {
    onClick: onPress,
    style: {
      padding: small ? '4px 10px' : '6px 14px',
      borderRadius: 20,
      border: `1px solid ${selected ? C.accent : C.border2}`,
      background: selected ? C.accentDim : 'transparent',
      color: selected ? C.accent : C.textMuted,
      fontSize: small ? 11 : 13,
      fontWeight: 500,
      fontFamily: "'Space Grotesk', sans-serif",
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      transition: 'all 0.15s',
      flexShrink: 0,
    }
  }, label);
}

/* ── Primary button ── */
function FlixyButton({ label, onPress, variant = 'primary', fullWidth, icon, disabled }) {
  const styles = {
    primary:     { bg: C.accent, color: '#fff', border: 'none' },
    secondary:   { bg: 'transparent', color: C.text, border: `1px solid ${C.border2}` },
    ghost:       { bg: 'transparent', color: C.textMuted, border: 'none' },
    destructive: { bg: 'rgba(224,92,75,0.15)', color: C.left, border: `1px solid rgba(224,92,75,0.3)` },
  };
  const s = styles[variant] || styles.primary;
  return React.createElement('button', {
    onClick: onPress,
    disabled,
    style: {
      width: fullWidth ? '100%' : 'auto',
      padding: '14px 24px',
      borderRadius: 14,
      background: disabled ? 'rgba(255,255,255,0.08)' : s.bg,
      color: disabled ? C.textDim : s.color,
      border: s.border || 'none',
      fontSize: 15, fontWeight: 600,
      fontFamily: "'Space Grotesk', sans-serif",
      cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      transition: 'opacity 0.15s',
    }
  },
    icon && React.createElement('span', { style: { fontSize: 18 } }, icon),
    label
  );
}

/* ── Action button (swipe equivalent) ── */
function ActionButton({ dir, onPress, size = 'lg', label }) {
  const configs = {
    left:  { color: C.left,  bg: C.leftBg,  icon: '✕', lbl: 'Pass' },
    right: { color: C.right, bg: C.rightBg, icon: '♥', lbl: 'Save' },
    up:    { color: C.up,    bg: C.upBg,    icon: '★', lbl: 'Top' },
    down:  { color: C.down,  bg: C.downBg,  icon: '✓', lbl: 'Seen' },
    undo:  { color: C.textMuted, bg: C.surface2, icon: '↩', lbl: 'Undo' },
  };
  const c = configs[dir];
  const sz = size === 'lg' ? 52 : size === 'md' ? 44 : 36;
  return React.createElement('button', {
    onClick: onPress,
    style: {
      width: sz, height: sz, borderRadius: '50%',
      background: c.bg,
      border: `1.5px solid ${c.color}22`,
      color: c.color,
      fontSize: size === 'lg' ? 20 : 16,
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      transition: 'transform 0.1s, opacity 0.1s',
    },
    onMouseEnter: e => e.currentTarget.style.transform = 'scale(1.08)',
    onMouseLeave: e => e.currentTarget.style.transform = 'scale(1)',
    'aria-label': c.lbl,
  }, c.icon);
}

/* ── Swipe stamp overlay ── */
function SwipeStamp({ dir, opacity }) {
  if (!dir || opacity < 0.05) return null;
  const configs = {
    right: { color: C.right, label: 'WATCHLIST', rotation: '-18deg', x: '10%', y: '18%' },
    left:  { color: C.left,  label: 'PASS',      rotation: '18deg',  x: 'auto', y: '18%', right: '10%' },
    up:    { color: C.up,    label: 'TOP PICK',  rotation: '-10deg', x: '50%', y: '15%', translateX: '-50%' },
    down:  { color: C.down,  label: 'SEEN',      rotation: '10deg',  x: '50%', y: '60%', translateX: '-50%' },
  };
  const cfg = configs[dir];
  if (!cfg) return null;
  return React.createElement('div', {
    style: {
      position: 'absolute',
      left: cfg.x, right: cfg.right, top: cfg.y,
      transform: `rotate(${cfg.rotation})${cfg.translateX ? ` translateX(${cfg.translateX})` : ''}`,
      border: `3px solid ${cfg.color}`,
      color: cfg.color,
      fontSize: 22, fontWeight: 800,
      fontFamily: "'Space Grotesk', sans-serif",
      letterSpacing: '0.1em',
      padding: '6px 14px',
      borderRadius: 6,
      opacity: Math.min(opacity * 1.5, 1),
      pointerEvents: 'none',
      zIndex: 10,
      textShadow: `0 0 20px ${cfg.color}44`,
    }
  }, cfg.label);
}

/* ── Movie card (the swipe card itself) ── */
function MovieCardFace({ movie, userServices, small }) {
  const ownedServices = movie.services.filter(s => userServices.includes(s));
  const displayServices = ownedServices.length ? ownedServices : movie.services.slice(0, 2);
  return React.createElement('div', {
    style: {
      width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
      borderRadius: small ? 12 : 20,
      background: movie.gradient,
      userSelect: 'none',
    }
  },
    // Poster art (emoji + glow)
    React.createElement('div', {
      style: {
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }
    },
      React.createElement('span', {
        style: {
          fontSize: small ? 64 : 96,
          filter: `drop-shadow(0 0 40px ${movie.accent}88)`,
          opacity: 0.8,
        }
      }, movie.emoji)
    ),
    // Bottom gradient
    React.createElement('div', {
      style: {
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(10,10,11,0.98) 0%, rgba(10,10,11,0.6) 40%, transparent 70%)',
      }
    }),
    // Top gradient (for badges)
    React.createElement('div', {
      style: {
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(10,10,11,0.5) 0%, transparent 30%)',
      }
    }),
    // Top badges
    React.createElement('div', {
      style: {
        position: 'absolute', top: 14, right: 14,
        display: 'flex', gap: 6, alignItems: 'center',
      }
    },
      React.createElement('div', {
        style: {
          background: 'rgba(10,10,11,0.7)', padding: '3px 8px', borderRadius: 6,
          fontSize: 10, fontWeight: 600, color: 'rgba(245,245,240,0.7)',
          fontFamily: "'Space Grotesk', sans-serif",
          border: `1px solid ${C.border}`,
        }
      }, movie.type),
    ),
    // Content bottom
    React.createElement('div', {
      style: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: small ? 14 : 20 }
    },
      // Hook
      !small && React.createElement('div', {
        style: {
          fontSize: 12, color: movie.accent, fontWeight: 600, letterSpacing: '0.04em',
          fontFamily: "'Space Grotesk', sans-serif",
          marginBottom: 6, opacity: 0.9,
        }
      }, `"${movie.hook}"`),
      // Title
      React.createElement('div', {
        style: {
          fontFamily: "'Playfair Display', serif",
          fontStyle: 'italic',
          fontWeight: 900,
          fontSize: small ? 20 : 28,
          lineHeight: 1.05,
          color: C.text,
          marginBottom: 6,
          letterSpacing: '-0.01em',
        }
      }, movie.title),
      // Meta
      React.createElement('div', {
        style: {
          fontSize: 11, color: 'rgba(245,245,240,0.55)',
          fontFamily: "'Space Grotesk', sans-serif",
          marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap',
        }
      },
        React.createElement('span', null, movie.year),
        React.createElement('span', { style: { color: C.border2 } }, '·'),
        React.createElement('span', null, movie.runtime),
        React.createElement('span', { style: { color: C.border2 } }, '·'),
        React.createElement('span', null, movie.rating),
      ),
      // Bottom row: genres + services
      React.createElement('div', {
        style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
      },
        // Genre chips
        React.createElement('div', { style: { display: 'flex', gap: 4, flexWrap: 'wrap' } },
          ...movie.genres.slice(0, 2).map(g =>
            React.createElement('span', {
              key: g,
              style: {
                fontSize: 10, padding: '3px 8px', borderRadius: 4,
                background: 'rgba(255,255,255,0.1)',
                color: 'rgba(245,245,240,0.6)',
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 500, letterSpacing: '0.02em',
              }
            }, g)
          )
        ),
        // Service badges
        React.createElement('div', { style: { display: 'flex', gap: 5 } },
          ...displayServices.slice(0, 3).map(svc =>
            React.createElement(ServiceBadge, { key: svc, name: svc, size: 'sm', owned: ownedServices.includes(svc) })
          ),
          displayServices.length > 3 && React.createElement('div', {
            style: {
              width: 22, height: 22, borderRadius: 6, background: C.surface3,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, color: C.textMuted, fontFamily: "'Space Grotesk', sans-serif",
            }
          }, `+${displayServices.length - 3}`)
        )
      )
    ),
    React.createElement(GrainOverlay, null)
  );
}

/* ── Ratings row ── */
function RatingsRow({ movie }) {
  return React.createElement('div', {
    style: { display: 'flex', gap: 16, alignItems: 'center' }
  },
    React.createElement('div', { style: { textAlign: 'center' } },
      React.createElement('div', { style: { fontSize: 18, fontWeight: 700, color: C.up, fontFamily: "'Space Grotesk',sans-serif" } }, movie.imdb),
      React.createElement('div', { style: { fontSize: 10, color: C.textMuted, fontFamily: "'Space Grotesk',sans-serif", letterSpacing: '0.06em', textTransform: 'uppercase' } }, 'IMDb'),
    ),
    React.createElement('div', { style: { width: 1, height: 28, background: C.border } }),
    React.createElement('div', { style: { textAlign: 'center' } },
      React.createElement('div', { style: { fontSize: 18, fontWeight: 700, color: C.right, fontFamily: "'Space Grotesk',sans-serif" } }, `${movie.rt}%`),
      React.createElement('div', { style: { fontSize: 10, color: C.textMuted, fontFamily: "'Space Grotesk',sans-serif", letterSpacing: '0.06em', textTransform: 'uppercase' } }, 'RT'),
    ),
  );
}

Object.assign(window, {
  GrainOverlay, StatusBar, TabBar, ServiceBadge, GenreChip,
  FlixyButton, ActionButton, SwipeStamp, MovieCardFace, RatingsRow,
});

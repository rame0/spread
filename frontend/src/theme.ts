import { createTheme } from '@mui/material';
import '@fontsource-variable/onest';

const tokens = {
  dark: {
    bg: '#0b0d10',
    surface: '#12151a',
    surface2: '#181c22',
    line: '#222730',
    text: '#e8ebef',
    muted: '#8b94a1',
    faint: '#5c6470',
    accent: '#7aa2ff',
    onAccent: '#0b0d10',
    pos: '#3ccb8a',
    neg: '#f06a6a',
    warn: '#f2b34a',
    charts: ['#7aa2ff', '#3ccb8a', '#f2b34a', '#c08cff', '#f06a6a', '#4fd1c5'],
  },
  light: {
    bg: '#f5f6f8',
    surface: '#ffffff',
    surface2: '#f0f2f5',
    line: '#e3e6eb',
    text: '#14171c',
    muted: '#646d7a',
    faint: '#9aa2ad',
    accent: '#2f5fe0',
    onAccent: '#ffffff',
    pos: '#12935a',
    neg: '#d33b3b',
    warn: '#b7791f',
    charts: ['#2f5fe0', '#12935a', '#b7791f', '#8b3fd9', '#d33b3b', '#0f8f86'],
  },
} as const;

type Tokens = (typeof tokens)[keyof typeof tokens];

const palette = (c: Tokens) => ({
  primary: { main: c.accent, contrastText: c.onAccent },
  secondary: { main: c.accent, contrastText: c.onAccent },
  success: { main: c.pos, contrastText: c.onAccent },
  warning: { main: c.warn, contrastText: c.onAccent },
  error: { main: c.neg, contrastText: c.onAccent },
  info: { main: c.accent, contrastText: c.onAccent },
  background: { default: c.bg, paper: c.surface },
  text: { primary: c.text, secondary: c.muted, disabled: c.faint },
  divider: c.line,
});

/** Short CSS variables used by pages and charts, one set per color scheme. */
const cssVars = (c: Tokens) => ({
  '--bg': c.bg,
  '--surface': c.surface,
  '--surface-2': c.surface2,
  '--surface-input': c.surface2,
  '--border': c.line,
  '--text-primary': c.text,
  '--text-secondary': c.muted,
  '--text-faint': c.faint,
  '--accent': c.accent,
  '--accent-hover': c.accent,
  '--accent-soft': `color-mix(in srgb, ${c.accent} 12%, transparent)`,
  '--status-ok': c.pos,
  '--status-warning': c.warn,
  '--status-danger': c.neg,
  ...Object.fromEntries(c.charts.map((color, index) => [`--chart-${index + 1}`, color])),
});

export const COLOR_SCHEME_ATTRIBUTE = 'data-color-scheme';

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: COLOR_SCHEME_ATTRIBUTE },
  colorSchemes: {
    light: { palette: palette(tokens.light) },
    dark: { palette: palette(tokens.dark) },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '"Onest Variable", Onest, system-ui, -apple-system, "Segoe UI", sans-serif',
    h4: { fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.2, letterSpacing: '-0.01em' },
    h5: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.2 },
    h6: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.25 },
    subtitle1: { fontSize: '0.9375rem', fontWeight: 600 },
    body1: { fontSize: '0.875rem' },
    body2: { fontSize: '0.875rem' },
    caption: { fontSize: '0.78rem' },
    button: { textTransform: 'none', fontWeight: 500 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ':root': { ...cssVars(tokens.light), '--radius': '12px' },
        [`[${COLOR_SCHEME_ATTRIBUTE}="dark"]`]: cssVars(tokens.dark),
        body: {
          backgroundColor: 'var(--bg)',
          fontFeatureSettings: "'tnum' 1",
          WebkitFontSmoothing: 'antialiased',
        },
        '#root': { minHeight: '100vh' },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          boxShadow: 'none',
        },
      },
    },
    MuiMenu: {
      styleOverrides: { paper: { boxShadow: '0 12px 32px rgba(0, 0, 0, .18)' } },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: 16 } },
    },
    MuiAppBar: {
      defaultProps: { color: 'inherit' },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'var(--surface)',
          boxShadow: 'none',
          border: 0,
          borderBottom: '1px solid var(--border)',
          borderRadius: 0,
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 9, minHeight: 38, paddingInline: 14 },
        outlined: {
          borderColor: 'var(--border)',
          color: 'var(--text-primary)',
          backgroundColor: 'var(--surface)',
          '&:hover': { borderColor: 'var(--border)', backgroundColor: 'var(--surface-2)' },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { borderRadius: 10 } },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 6, fontWeight: 500 },
        sizeSmall: { height: 22, fontSize: '0.75rem' },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 40, borderBottom: '1px solid var(--border)' },
        indicator: { height: 2 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 40,
          minWidth: 0,
          paddingInline: 0,
          marginRight: 22,
          fontWeight: 500,
          color: 'var(--text-secondary)',
          '&.Mui-selected': { color: 'var(--text-primary)' },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          border: 0,
          borderRadius: 7,
          paddingBlock: 5,
          paddingInline: 12,
          fontWeight: 500,
          color: 'var(--text-secondary)',
          '&.Mui-selected, &.Mui-selected:hover': {
            backgroundColor: 'var(--surface)',
            color: 'var(--text-primary)',
            boxShadow: '0 1px 2px rgba(0, 0, 0, .2)',
          },
        },
      },
    },
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: { backgroundColor: 'var(--surface-2)', borderRadius: 9, padding: 3, gap: 2 },
        grouped: { '&:not(:first-of-type)': { borderRadius: 7, marginLeft: 0, borderLeft: 0 } },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 9,
          '&.Mui-selected, &.Mui-selected:hover': { backgroundColor: 'var(--surface-2)' },
        },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'filled' },
    },
    MuiSelect: {
      defaultProps: { variant: 'filled' },
    },
    MuiFilledInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: 'var(--surface-2)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          '&:before, &:after': { display: 'none' },
          '&:hover': { backgroundColor: 'var(--surface-2)' },
          '&.Mui-focused': {
            backgroundColor: 'var(--surface-2)',
            borderColor: 'var(--accent)',
            boxShadow: '0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent)',
          },
        },
        input: { paddingTop: 11, paddingBottom: 11 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: 'var(--surface-2)',
          '& fieldset': { borderColor: 'var(--border)' },
          '&:hover fieldset': { borderColor: 'color-mix(in srgb, var(--text-primary) 16%, transparent)' },
          '&.Mui-focused fieldset': { borderColor: 'var(--accent)' },
        },
        input: { paddingTop: 11, paddingBottom: 11 },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: 'var(--text-secondary)',
          '&.Mui-focused, &.MuiFormLabel-filled': { color: 'var(--text-secondary)' },
        },
        filled: {
          transform: 'translate(14px, 14px) scale(1)',
          '&.MuiInputLabel-shrink': { transform: 'translate(14px, -7px) scale(0.75)' },
        },
        outlined: {
          transform: 'translate(14px, 14px) scale(1)',
          '&.MuiInputLabel-shrink': { transform: 'translate(14px, -7px) scale(0.75)' },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottomColor: 'var(--border)', paddingTop: 10, paddingBottom: 10, fontVariantNumeric: 'tabular-nums' },
        head: {
          color: 'var(--text-secondary)',
          fontWeight: 500,
          fontSize: '0.78rem',
          position: 'sticky',
          top: 0,
          zIndex: 1,
          backgroundColor: 'var(--surface)',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: { '&:hover': { backgroundColor: 'color-mix(in srgb, var(--text-primary) 3%, transparent)' } },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 'var(--radius)' },
        standardInfo: {
          color: 'var(--text-secondary)',
          backgroundColor: 'var(--surface-2)',
          border: 0,
          '& .MuiAlert-icon': { color: 'var(--accent)' },
        },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: { root: { backgroundColor: 'transparent', height: 60 } },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          minWidth: 0,
          color: 'var(--text-secondary)',
          '&.Mui-selected': { color: 'var(--text-primary)' },
        },
        label: { fontSize: '0.6875rem', fontWeight: 500, '&.Mui-selected': { fontSize: '0.6875rem' } },
      },
    },
  },
});

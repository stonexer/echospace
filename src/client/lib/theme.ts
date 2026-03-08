export type Mode = 'light' | 'dark';
export type Theme = 'retro' | 'dusk' | 'ember' | 'slate';

export const LIGHT_THEMES: { key: Theme; label: string }[] = [
  { key: 'retro', label: 'Retro' },
  { key: 'dusk', label: 'Dusk' },
];

export const DARK_THEMES: { key: Theme; label: string }[] = [
  { key: 'ember', label: 'Ember' },
  { key: 'slate', label: 'Slate' },
];

const MODE_KEY = 'echospace-mode';
const THEME_KEY = 'echospace-theme';
const VALID_THEMES: Theme[] = ['retro', 'dusk', 'ember', 'slate'];

function themeToMode(theme: Theme): Mode {
  return theme === 'retro' || theme === 'dusk' ? 'light' : 'dark';
}

function defaultThemeForMode(mode: Mode): Theme {
  return mode === 'light' ? 'retro' : 'ember';
}

export function getMode(): Mode {
  const stored = localStorage.getItem(MODE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  // Migrate from old theme-only storage
  const theme = getTheme();
  return themeToMode(theme);
}

export function getTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY) as Theme | null;
  return stored && VALID_THEMES.includes(stored) ? stored : 'retro';
}

export function setMode(mode: Mode): void {
  localStorage.setItem(MODE_KEY, mode);
  // Switch to saved theme for this mode, or default
  const current = getTheme();
  if (themeToMode(current) !== mode) {
    const saved = localStorage.getItem(`echospace-theme-${mode}`) as Theme | null;
    const theme = saved && VALID_THEMES.includes(saved) ? saved : defaultThemeForMode(mode);
    setTheme(theme);
  }
}

export function setTheme(theme: Theme): void {
  const mode = themeToMode(theme);
  localStorage.setItem(THEME_KEY, theme);
  localStorage.setItem(MODE_KEY, mode);
  localStorage.setItem(`echospace-theme-${mode}`, theme);
  applyTheme(theme);
}

function applyTheme(theme: Theme): void {
  const el = document.documentElement;
  if (theme === 'retro') {
    delete el.dataset.theme;
  } else {
    el.dataset.theme = theme;
  }
}

export function initTheme(): void {
  applyTheme(getTheme());
}

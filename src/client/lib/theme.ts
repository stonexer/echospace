export type Theme = 'retro' | 'dusk' | 'ember' | 'slate';

const STORAGE_KEY = 'echospace-theme';
const VALID_THEMES: Theme[] = ['retro', 'dusk', 'ember', 'slate'];

export function getTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
  return stored && VALID_THEMES.includes(stored) ? stored : 'retro';
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}

function applyTheme(theme: Theme): void {
  if (theme === 'retro') {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }
}

// Call at module load to apply persisted theme before first paint
export function initTheme(): void {
  applyTheme(getTheme());
}

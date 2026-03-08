export type Theme = 'retro' | 'dusk';

const STORAGE_KEY = 'echospace-theme';

export function getTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'dusk' ? 'dusk' : 'retro';
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}

function applyTheme(theme: Theme): void {
  if (theme === 'dusk') {
    document.documentElement.dataset.theme = 'dusk';
  } else {
    delete document.documentElement.dataset.theme;
  }
}

// Call at module load to apply persisted theme before first paint
export function initTheme(): void {
  applyTheme(getTheme());
}

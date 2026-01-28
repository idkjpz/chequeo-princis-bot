// Theme Presets
const THEMES = {
    dark: {
        name: 'Dark',
        icon: '🌙',
        colors: {
            '--bg-primary': '#0f172a',
            '--bg-secondary': '#1e293b',
            '--bg-card': '#1e293b',
            '--bg-hover': '#334155',
            '--text-primary': '#f1f5f9',
            '--text-secondary': '#94a3b8',
            '--accent': '#6366f1',
            '--border-color': '#334155',
            '--success': '#10b981',
            '--warning': '#f59e0b',
            '--danger': '#ef4444'
        }
    },
    light: {
        name: 'Light',
        icon: '☀️',
        colors: {
            '--bg-primary': '#ffffff',
            '--bg-secondary': '#f8fafc',
            '--bg-card': '#ffffff',
            '--bg-hover': '#f1f5f9',
            '--text-primary': '#0f172a',
            '--text-secondary': '#64748b',
            '--accent': '#6366f1',
            '--border-color': '#e2e8f0',
            '--success': '#10b981',
            '--warning': '#f59e0b',
            '--danger': '#ef4444'
        }
    },
    ocean: {
        name: 'Blue Ocean',
        icon: '🌊',
        colors: {
            '--bg-primary': '#0c1e2e',
            '--bg-secondary': '#1a3a52',
            '--bg-card': '#1a3a52',
            '--bg-hover': '#2d5573',
            '--text-primary': '#e0f2fe',
            '--text-secondary': '#7dd3fc',
            '--accent': '#0ea5e9',
            '--border-color': '#2d5573',
            '--success': '#06b6d4',
            '--warning': '#fbbf24',
            '--danger': '#f87171'
        }
    },
    purple: {
        name: 'Purple Dream',
        icon: '💜',
        colors: {
            '--bg-primary': '#1e1b2e',
            '--bg-secondary': '#2d2640',
            '--bg-card': '#2d2640',
            '--bg-hover': '#3d3554',
            '--text-primary': '#f5f3ff',
            '--text-secondary': '#c4b5fd',
            '--accent': '#a855f7',
            '--border-color': '#3d3554',
            '--success': '#8b5cf6',
            '--warning': '#fbbf24',
            '--danger': '#f472b6'
        }
    },
    forest: {
        name: 'Forest Green',
        icon: '🌲',
        colors: {
            '--bg-primary': '#0a1f1a',
            '--bg-secondary': '#1a3a2e',
            '--bg-card': '#1a3a2e',
            '--bg-hover': '#2d5548',
            '--text-primary': '#ecfdf5',
            '--text-secondary': '#86efac',
            '--accent': '#10b981',
            '--border-color': '#2d5548',
            '--success': '#22c55e',
            '--warning': '#fbbf24',
            '--danger': '#f87171'
        }
    },
    sunset: {
        name: 'Sunset Red',
        icon: '🌅',
        colors: {
            '--bg-primary': '#2e1410',
            '--bg-secondary': '#3d1f1a',
            '--bg-card': '#3d1f1a',
            '--bg-hover': '#5a2e26',
            '--text-primary': '#fef2f2',
            '--text-secondary': '#fca5a5',
            '--accent': '#ef4444',
            '--border-color': '#5a2e26',
            '--success': '#10b981',
            '--warning': '#fbbf24',
            '--danger': '#dc2626'
        }
    }
};

// Apply theme
function applyTheme(themeName) {
    const theme = THEMES[themeName];
    if (!theme) return;

    const root = document.documentElement;
    Object.entries(theme.colors).forEach(([property, value]) => {
        root.style.setProperty(property, value);
    });

    // Save preference
    localStorage.setItem('selectedTheme', themeName);
}

// Get current theme
function getCurrentTheme() {
    return localStorage.getItem('selectedTheme') || 'dark';
}

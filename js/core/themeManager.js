// js/core/themeManager.js
import { tenantManager } from './tenantManager.js';

export const THEMES = {
    'phoenix': {
        id: 'phoenix',
        name: 'Phoenix (Predeterminado)',
        bgDark: '#011816',
        bgMedium: '#012623',
        bgLight: '#023859',
        primary: '#68F205',
        secondary: '#C3D91E',
        accent: '#088C4F'
    },
    'xx': {
        id: 'xx',
        name: 'XX (Double Cross)',
        bgDark: '#090014',
        bgMedium: '#120126',
        bgLight: '#2A0259',
        primary: '#FF007F',
        secondary: '#FF00FF',
        accent: '#9D00FF'
    },
    'prime2': {
        id: 'prime2',
        name: 'Prime 2',
        bgDark: '#010514',
        bgMedium: '#010C26',
        bgLight: '#33000F',
        primary: '#E50020',
        secondary: '#FFD700',
        accent: '#990015'
    },
    'prime': {
        id: 'prime',
        name: 'Prime (1)',
        bgDark: '#00041A',
        bgMedium: '#000B33',
        bgLight: '#002266',
        primary: '#00E5FF',
        secondary: '#2D70FF',
        accent: '#00B2CC'
    },
    'fiesta2': {
        id: 'fiesta2',
        name: 'Fiesta 2',
        bgDark: '#140500',
        bgMedium: '#260A00',
        bgLight: '#400000',
        primary: '#FF5500',
        secondary: '#FFCC00',
        accent: '#CC3300'
    },
    'classic': {
        id: 'classic',
        name: 'Exceed / Zero (Classic)',
        bgDark: '#000000',
        bgMedium: '#110000',
        bgLight: '#220000',
        primary: '#CC0000',
        secondary: '#00FF00',
        accent: '#990000'
    },
    'nextgen': {
        id: 'nextgen',
        name: 'Next Gen (Silver & Green)',
        bgDark: '#0D0E11',
        bgMedium: '#1A1C23',
        bgLight: '#2D3139',
        primary: '#00FF66',
        secondary: '#FFFFFF',
        accent: '#00CC52'
    },
    'pro': {
        id: 'pro',
        name: 'Professional (Blue & Red)',
        bgDark: '#070B14',
        bgMedium: '#0F172A',
        bgLight: '#1E1B4B',
        primary: '#FF3333',
        secondary: '#3388FF',
        accent: '#CC2929'
    },
    'endless': {
        id: 'endless',
        name: 'Endless (White & Orange)',
        bgDark: '#E2E8F0', // Temas claros necesitan fondos claros
        bgMedium: '#F8FAFC',
        bgLight: '#E0F2FE',
        primary: '#FF7B00',
        secondary: '#00D4FF',
        accent: '#CC6200'
    }
};

class ThemeManager {
    constructor() {
        this.currentThemeId = null;
    }

    init() {
        // Suscribirse a cambios de tenant (local activo)
        tenantManager.subscribe((activeBusiness) => {
            if (activeBusiness) {
                this.applyTheme(activeBusiness.themeId);
            }
        });

        // Aplicar tema inicial si ya hay un negocio activo
        const initialBusiness = tenantManager.getActiveBusiness();
        if (initialBusiness) {
            this.applyTheme(initialBusiness.themeId);
        } else {
            this.applyTheme('phoenix'); // Fallback
        }
    }

    applyTheme(themeId) {
        const theme = THEMES[themeId] || THEMES['phoenix'];
        
        if (this.currentThemeId === theme.id) return; // Ya aplicado
        this.currentThemeId = theme.id;

        const root = document.documentElement;
        
        // Asignar variables CSS
        root.style.setProperty('--theme-bg-dark', theme.bgDark);
        root.style.setProperty('--theme-bg-medium', theme.bgMedium);
        root.style.setProperty('--theme-bg-light', theme.bgLight);
        root.style.setProperty('--theme-primary', theme.primary);
        root.style.setProperty('--theme-secondary', theme.secondary);
        root.style.setProperty('--theme-accent', theme.accent);
        
        // Dependiendo del tema, ajustamos textos principales (útil para el tema claro Endless)
        if (theme.id === 'endless') {
            root.style.setProperty('--theme-text-main', '#0f172a');
            root.style.setProperty('--theme-text-muted', '#475569');
            root.style.setProperty('--theme-text-dimmed', '#94a3b8');
            root.style.setProperty('--theme-bg-glass', 'rgba(255, 255, 255, 0.88)');
            root.style.setProperty('--theme-bg-glass-card', 'rgba(240, 248, 255, 0.85)');
        } else {
            // Valores por defecto (modo oscuro)
            root.style.setProperty('--theme-text-main', '#f0fdf4');
            root.style.setProperty('--theme-text-muted', '#9bb7ad');
            root.style.setProperty('--theme-text-dimmed', '#52756a');
            
            // Reutilizamos el bgMedium para el glass pero con opacidad
            // Convertimos el hex a rgba de forma simple (asumiendo formato #RRGGBB)
            const r = parseInt(theme.bgMedium.slice(1, 3), 16);
            const g = parseInt(theme.bgMedium.slice(3, 5), 16);
            const b = parseInt(theme.bgMedium.slice(5, 7), 16);
            
            root.style.setProperty('--theme-bg-glass', `rgba(${r}, ${g}, ${b}, 0.88)`);
            
            const rL = parseInt(theme.bgLight.slice(1, 3), 16);
            const gL = parseInt(theme.bgLight.slice(3, 5), 16);
            const bL = parseInt(theme.bgLight.slice(5, 7), 16);
            root.style.setProperty('--theme-bg-glass-card', `rgba(${rL}, ${gL}, ${bL}, 0.85)`);
        }
    }
}

export const themeManager = new ThemeManager();

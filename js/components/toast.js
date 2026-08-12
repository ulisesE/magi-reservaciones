// js/components/toast.js
// Sistema de notificaciones estilo Cyberpunk / Arcade

class ToastManager {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    }

    show(message, type = 'info', duration = 4000) {
        const toast = document.createElement('div');
        toast.className = `toast-item toast-${type} animate-slide-in`;

        const icons = {
            success: '✅',
            error: '🚨',
            warning: '⚠️',
            info: '⚡'
        };

        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || '⚡'}</div>
            <div class="toast-content">
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" aria-label="Cerrar">&times;</button>
        `;

        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.onclick = () => this.dismiss(toast);

        this.container.appendChild(toast);

        setTimeout(() => {
            this.dismiss(toast);
        }, duration);
    }

    dismiss(toast) {
        toast.classList.add('animate-fade-out');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.parentElement.removeChild(toast);
            }
        }, 300);
    }

    success(msg, duration) { this.show(msg, 'success', duration); }
    error(msg, duration) { this.show(msg, 'error', duration); }
    warning(msg, duration) { this.show(msg, 'warning', duration); }
    info(msg, duration) { this.show(msg, 'info', duration); }
}

export const toast = new ToastManager();

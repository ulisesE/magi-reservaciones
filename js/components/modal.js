// js/components/modal.js
// Sistema de modales modulares y accesibles

class ModalManager {
    constructor() {
        this.activeModal = null;
        this.backdrop = null;
        this.init();
    }

    init() {
        if (!document.getElementById('modal-root')) {
            const root = document.createElement('div');
            root.id = 'modal-root';
            root.className = 'modal-root';
            document.body.appendChild(root);
        }
    }

    /**
     * Abre un modal con título, contenido HTML y acciones
     */
    open({ title, icon = '🕹️', contentHtml, footerHtml = '', maxWidth = '560px', onClose = null }) {
        this.close(); // Cerrar modal anterior si había uno

        const root = document.getElementById('modal-root');
        
        const modalEl = document.createElement('div');
        modalEl.className = 'modal-backdrop animate-fade-in';
        modalEl.innerHTML = `
            <div class="modal-card animate-scale-up" style="max-width: ${maxWidth}">
                <div class="modal-header">
                    <div class="modal-title">
                        <span class="modal-icon">${icon}</span>
                        <h3>${title}</h3>
                    </div>
                    <button class="modal-close-btn" id="modal-close-action" aria-label="Cerrar">&times;</button>
                </div>
                <div class="modal-body">
                    ${contentHtml}
                </div>
                ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
            </div>
        `;

        root.appendChild(modalEl);
        this.activeModal = { el: modalEl, onClose };

        // Eventos de cierre
        const closeBtn = modalEl.querySelector('#modal-close-action');
        if (closeBtn) {
            closeBtn.onclick = () => this.close();
        }

        modalEl.addEventListener('click', (e) => {
            if (e.target === modalEl) {
                this.close();
            }
        });

        // Bloquear scroll de body
        document.body.style.overflow = 'hidden';

        return modalEl;
    }

    close() {
        if (this.activeModal && this.activeModal.el) {
            const el = this.activeModal.el;
            const onClose = this.activeModal.onClose;
            
            el.classList.add('animate-fade-out');
            setTimeout(() => {
                if (el.parentElement) {
                    el.parentElement.removeChild(el);
                }
                if (onClose) onClose();
            }, 200);
            
            this.activeModal = null;
        }
        document.body.style.overflow = '';
    }
}

export const modal = new ModalManager();


export const Dialog = {
    overlay: null,
    titleEl: null,
    messageEl: null,
    iconEl: null,
    footerEl: null,
    closeBtn: null,
    resolvePromise: null, // Function to call when dialog is closed

    init() {
        if (this.overlay) return; // Already initialized

        this.overlay = document.getElementById('custom-dialog-modal');
        this.titleEl = document.getElementById('custom-dialog-title');
        this.messageEl = document.getElementById('custom-dialog-message');
        this.iconEl = document.getElementById('custom-dialog-icon');
        this.footerEl = document.getElementById('custom-dialog-footer');
        this.closeBtn = document.getElementById('btn-close-custom-dialog');

        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => {
                this.close(false); // Treat X as cancellation/false
            });
        }
    },

    /**
     * Show an alert dialog (informational).
     * @param {string} message 
     * @param {string} type - 'info', 'error', 'success', 'warning'
     * @returns {Promise<void>}
     */
    alert(message, type = 'info') {
        this.init();
        return new Promise((resolve) => {
            this.setupDialog(message, type, false);
            this.resolvePromise = resolve;
            this.show();
        });
    },

    /**
     * Show a confirmation dialog (question).
     * @param {string} message 
     * @returns {Promise<boolean>} - true if confirmed, false otherwise
     */
    confirm(message) {
        this.init();
        return new Promise((resolve) => {
            this.setupDialog(message, 'question', true);
            this.resolvePromise = resolve;
            this.show();
        });
    },

    setupDialog(message, type, isConfirm) {
        // 1. Text
        this.messageEl.textContent = message;

        // 2. Icon & Title & Color
        let iconName = '';
        let color = '';
        let title = '';

        switch (type) {
            case 'error':
                iconName = 'error_outline';
                color = '#f44336';
                title = 'Błąd';
                break;
            case 'success':
                iconName = 'check_circle_outline';
                color = '#4caf50';
                title = 'Sukces';
                break;
            case 'warning':
                iconName = 'warning_amber';
                color = '#ff9800';
                title = 'Uwaga';
                break;
            case 'question':
                iconName = 'help_outline';
                color = '#3771c8';
                title = 'Potwierdzenie';
                break;
            case 'info':
            default:
                iconName = 'info_outline';
                color = '#3771c8';
                title = 'Informacja';
                break;
        }

        this.titleEl.textContent = title;
        this.iconEl.innerHTML = `<span class="material-icons" style="font-size: 48px; color: ${color};">${iconName}</span>`;

        // 3. Buttons
        this.footerEl.innerHTML = '';

        if (isConfirm) {
            // Cancel Button
            const btnCancel = document.createElement('button');
            btnCancel.className = 'btn outline';
            btnCancel.textContent = 'Anuluj';
            btnCancel.addEventListener('click', () => this.close(false));
            this.footerEl.appendChild(btnCancel);

            // Confirm Button
            const btnConfirm = document.createElement('button');
            btnConfirm.className = 'btn primary';
            btnConfirm.textContent = 'Tak';
            btnConfirm.addEventListener('click', () => this.close(true));
            this.footerEl.appendChild(btnConfirm);

            // Auto focus confirm button for UX
            setTimeout(() => btnConfirm.focus(), 50);

        } else {
            // OK Button
            const btnOk = document.createElement('button');
            btnOk.className = 'btn primary';
            btnOk.textContent = 'OK';
            btnOk.addEventListener('click', () => this.close(true)); // alert resolves to void/true, doesn't matter
            this.footerEl.appendChild(btnOk);

            // Auto focus OK button
            setTimeout(() => btnOk.focus(), 50);
        }
    },

    show() {
        this.overlay.classList.remove('hidden');
        // Trap focus could be implemented here, but simple start with auto-focus on button is good.
    },

    close(result) {
        this.overlay.classList.add('hidden');
        if (this.resolvePromise) {
            this.resolvePromise(result);
            this.resolvePromise = null;
        }
    }
};

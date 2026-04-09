
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

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.overlay && !this.overlay.classList.contains('hidden')) {
                this.close(false);
            }
        });
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

    confirm(message, type = 'question') {
        this.init();
        return new Promise((resolve) => {
            this.setupDialog(message, type, true);
            this.resolvePromise = resolve;
            this.show();
        });
    },

    /**
     * Show an input prompt dialog.
     * @param {string} message - Label above the input
     * @param {string} [defaultValue=''] - Pre-filled default value
     * @returns {Promise<string|null>} - Entered string or null if cancelled
     */
    prompt(message, defaultValue = '') {
        this.init();
        return new Promise((resolve) => {
            this.titleEl.textContent = 'Wprowadź dane';
            this.messageEl.textContent = message;
            this.iconEl.innerHTML = `<span class="material-icons" style="font-size: 48px; color: #3771c8;">edit</span>`;

            // Create input
            const input = document.createElement('input');
            input.type = 'text';
            input.value = defaultValue;
            input.style.cssText = 'width:100%; margin-top:12px; padding:8px 12px; background:var(--bg-input, #2a2a2e); border:1px solid var(--border, #444); border-radius:6px; color:var(--text-main, #fff); font-size:14px; box-sizing:border-box;';
            this.messageEl.after(input);

            this.footerEl.innerHTML = '';

            const btnCancel = document.createElement('button');
            btnCancel.className = 'btn outline';
            btnCancel.textContent = 'Anuluj';
            btnCancel.addEventListener('click', () => {
                input.remove();
                this.close(null);
            });

            const btnOk = document.createElement('button');
            btnOk.className = 'btn primary';
            btnOk.textContent = 'OK';
            btnOk.addEventListener('click', () => {
                const val = input.value.trim();
                input.remove();
                this.close(val || null);
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') btnOk.click();
                if (e.key === 'Escape') btnCancel.click();
            });

            this.footerEl.appendChild(btnCancel);
            this.footerEl.appendChild(btnOk);

            this.resolvePromise = resolve;
            this.show();
            setTimeout(() => input.focus(), 50);
        });
    },

    /**
     * Show a custom dialog with specific buttons.
     * @param {string} message 
     * @param {Array<{label: string, value: any, class: string}>} buttons 
     * @returns {Promise<any>} - Returns value of clicked button, or null/false if cancelled
     */
    custom(message, buttons) {
        this.init();
        return new Promise((resolve) => {
            // 1. Setup Content
            this.titleEl.textContent = 'Wybór akcji';
            this.messageEl.textContent = message;
            this.iconEl.innerHTML = `<span class="material-icons" style="font-size: 48px; color: #3771c8;">help_outline</span>`;

            // 2. Setup Buttons
            this.footerEl.innerHTML = '';

            buttons.forEach(btnConfig => {
                const btn = document.createElement('button');
                btn.textContent = btnConfig.label;
                btn.className = btnConfig.class || 'btn outline';
                btn.addEventListener('click', () => this.close(btnConfig.value));
                this.footerEl.appendChild(btn);
            });

            // 3. Show
            this.resolvePromise = resolve;
            this.show();
        });
    },

    setupDialog(message, type, isConfirm) {
        // ALWAYS use textContent to prevent XSS. 
        // If we really need HTML (e.g. specialized formatting), 
        // we should use a proper sanitizer or explicit elements.
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

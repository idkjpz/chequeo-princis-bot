// ==========================================
// TIEMPO REAL - Frontend Logic
// ==========================================

class TiempoRealManager {
    constructor() {
        this.refreshInterval = null;
        this.currentFilter = 'all';
        this.statusEmojis = {
            'activo': '✅',
            'desconectado': '🔴',
            'crm': '⚠️',
            'server': '🔧',
            'none': '⚪'
        };
        this.statusLabels = {
            'activo': 'Activo',
            'desconectado': 'Desconectado',
            'crm': 'En CRM',
            'server': 'En Server',
            'none': 'Sin chequear'
        };
    }

    async init() {
        console.log('🔴 Initializing Tiempo Real Manager...');
        await this.loadData();
        this.startAutoRefresh();
        this.attachEventListeners();
    }

    async loadData() {
        try {
            const response = await Auth.fetchWithAuth('/api/tiempo-real');
            const data = await response.json();
            this.renderPrincipals(data);
            this.updateSummary(data);
        } catch (error) {
            console.error('Error loading tiempo-real data:', error);
            showNotification('Error al cargar datos de tiempo real', 'error');
        }
    }

    renderPrincipals(data) {
        const container = document.getElementById('tiempoRealList');
        if (!container) return;

        const principals = [];

        // Create array of all 26 principals
        for (let i = 1; i <= 26; i++) {
            const principal = data[i] || {
                phone: i,
                status: 'none',
                mensaje: '',
                updatedBy: '',
                timestamp: null
            };
            principals.push(principal);
        }

        // Apply filter
        const filtered = this.filterPrincipals(principals);

        // Render
        container.innerHTML = filtered.map(p => this.createPrincipalCard(p)).join('');
    }

    filterPrincipals(principals) {
        if (this.currentFilter === 'all') {
            return principals;
        }
        return principals.filter(p => p.status === this.currentFilter);
    }

    createPrincipalCard(principal) {
        const emoji = this.statusEmojis[principal.status] || '📱';
        const label = this.statusLabels[principal.status] || 'Desconocido';
        const timeAgo = this.getTimeAgo(principal.timestamp);
        const statusClass = this.getStatusClass(principal.status);

        return `
            <div class="tiempo-real-card ${statusClass}" data-phone="${principal.phone}">
                <div class="card-header">
                    <div class="phone-number">
                        <span class="phone-icon">📱</span>
                        <span class="phone-text">Principal #${principal.phone}</span>
                    </div>
                    <div class="status-badge ${statusClass}">
                        <span class="status-emoji">${emoji}</span>
                        <span class="status-text">${label}</span>
                    </div>
                </div>
                
                ${principal.mensaje ? `
                    <div class="card-message">
                        <span class="message-icon">💬</span>
                        <span class="message-text">${this.escapeHtml(principal.mensaje)}</span>
                    </div>
                ` : ''}
                
                <div class="card-footer">
                    <div class="card-meta">
                        ${principal.timestamp ? `
                            <span class="meta-item">
                                <span class="meta-icon">⏱️</span>
                                <span class="meta-text">${timeAgo}</span>
                            </span>
                        ` : ''}
                        ${principal.updatedBy ? `
                            <span class="meta-item">
                                <span class="meta-icon">👤</span>
                                <span class="meta-text">${principal.updatedBy}</span>
                            </span>
                        ` : ''}
                    </div>
                    
                    <div class="card-actions">
                        <select class="status-selector" data-phone="${principal.phone}">
                            <option value="">Cambiar estado...</option>
                            <option value="activo">✅ Activo</option>
                            <option value="desconectado">🔴 Desconectado</option>
                            <option value="crm">⚠️ En CRM</option>
                            <option value="server">🔧 En Server</option>
                            <option value="none">⚪ Limpiar</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    }

    getStatusClass(status) {
        const classes = {
            'activo': 'status-activo',
            'desconectado': 'status-desconectado',
            'crm': 'status-crm',
            'server': 'status-server',
            'none': 'status-none'
        };
        return classes[status] || 'status-none';
    }

    getTimeAgo(timestamp) {
        if (!timestamp) return 'nunca';

        const now = new Date();
        const then = new Date(timestamp);
        const diffMs = now - then;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'hace menos de 1 min';
        if (diffMins === 1) return 'hace 1 min';
        if (diffMins < 60) return `hace ${diffMins} mins`;

        const diffHours = Math.floor(diffMins / 60);
        if (diffHours === 1) return 'hace 1 hora';
        if (diffHours < 24) return `hace ${diffHours} horas`;

        const diffDays = Math.floor(diffHours / 24);
        if (diffDays === 1) return 'hace 1 día';
        return `hace ${diffDays} días`;
    }

    updateSummary(data) {
        const counts = {
            activo: 0,
            desconectado: 0,
            crm: 0,
            server: 0,
            none: 0
        };

        for (let i = 1; i <= 26; i++) {
            const principal = data[i];
            if (principal && principal.status) {
                counts[principal.status]++;
            } else {
                counts.none++;
            }
        }

        // Update summary badges
        document.getElementById('countActivo').textContent = counts.activo;
        document.getElementById('countDesconectado').textContent = counts.desconectado;
        document.getElementById('countCrm').textContent = counts.crm;
        document.getElementById('countServer').textContent = counts.server;
        document.getElementById('countNone').textContent = counts.none;
    }

    attachEventListeners() {
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.target.dataset.filter;
                this.setFilter(filter);
            });
        });

        // Status selectors (delegated event)
        document.getElementById('tiempoRealList').addEventListener('change', async (e) => {
            if (e.target.classList.contains('status-selector')) {
                const phone = e.target.dataset.phone;
                const status = e.target.value;

                if (status) {
                    await this.updatePrincipalStatus(phone, status);
                    e.target.value = ''; // Reset selector
                }
            }
        });

        // Manual refresh button
        const refreshBtn = document.getElementById('refreshTiempoReal');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadData());
        }
    }

    setFilter(filter) {
        this.currentFilter = filter;

        // Update active button
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        // Reload data with filter
        this.loadData();
    }

    async updatePrincipalStatus(phone, status) {
        try {
            const response = await Auth.fetchWithAuth(`/api/tiempo-real/${phone}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status,
                    updatedBy: Auth.getUser()?.username || 'web'
                })
            });

            if (response.ok) {
                showNotification(`Principal #${phone} actualizado a ${this.statusLabels[status]}`, 'success');
                await this.loadData();
            } else {
                throw new Error('Failed to update');
            }
        } catch (error) {
            console.error('Error updating principal:', error);
            showNotification('Error al actualizar el principal', 'error');
        }
    }

    startAutoRefresh() {
        // Refresh every 5 seconds
        this.refreshInterval = setInterval(() => {
            this.loadData();
        }, 5000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    destroy() {
        this.stopAutoRefresh();
    }
}

// Global instance
let tiempoRealManager = null;

// Initialize when section is shown
function initTiempoReal() {
    if (!tiempoRealManager) {
        tiempoRealManager = new TiempoRealManager();
        tiempoRealManager.init();
    }
}

// Cleanup when section is hidden
function destroyTiempoReal() {
    if (tiempoRealManager) {
        tiempoRealManager.destroy();
        tiempoRealManager = null;
    }
}

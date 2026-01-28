const AdminUI = {
    init() {
        const user = Auth.getUser();
        if (!user || user.role !== 'admin') return;

        // Show Admin-only elements
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'flex';
            el.classList.remove('hidden');
        });

        this.setupEventListeners();
    },

    setupEventListeners() {
        // Users Management Modal
        const usersBtn = document.getElementById('usersAdminBtn');
        const usersModal = document.getElementById('usersModal');
        const usersClose = document.getElementById('usersClose');
        const addNewUserBtn = document.getElementById('addNewUserBtn');

        if (usersBtn) {
            usersBtn.addEventListener('click', () => {
                this.loadUsers();
                usersModal.classList.add('active');
            });
        }

        if (usersClose) {
            usersClose.addEventListener('click', () => {
                usersModal.classList.remove('active');
            });
        }

        // Add/Edit User Form
        const userFormModal = document.getElementById('userFormModal');
        const userFormClose = document.getElementById('userFormClose');
        const cancelUserBtn = document.getElementById('cancelUserBtn');
        const userForm = document.getElementById('userForm');

        if (addNewUserBtn) {
            addNewUserBtn.addEventListener('click', () => {
                userForm.reset();
                document.getElementById('userFormTitle').textContent = 'Crear Nuevo Usuario';
                document.getElementById('passwordGroup').style.display = 'block';
                document.getElementById('userUsername').disabled = false;
                userFormModal.classList.add('active');
            });
        }

        if (userFormClose) userFormClose.onclick = () => userFormModal.classList.remove('active');
        if (cancelUserBtn) cancelUserBtn.onclick = () => userFormModal.classList.remove('active');

        if (userForm) {
            userForm.addEventListener('submit', (e) => this.handleUserSubmit(e));
        }

        // Close modals on outside click
        window.addEventListener('click', (e) => {
            if (e.target === usersModal) usersModal.classList.remove('active');
            if (e.target === userFormModal) userFormModal.classList.remove('active');
        });
    },

    async loadUsers() {
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">Cargando usuarios...</td></tr>';

        try {
            const response = await Auth.fetchWithAuth('/api/users');
            const users = await response.json();

            tbody.innerHTML = '';
            users.forEach(user => {
                const tr = document.createElement('tr');
                tr.className = 'user-row';

                const shiftIcons = { morning: '🌅', afternoon: '☀️', night: '🌙' };
                const shiftsHtml = (user.assignedShifts || [])
                    .map(s => `<span class="shift-tag">${shiftIcons[s] || ''} ${this.formatShift(s)}</span>`)
                    .join('');

                tr.innerHTML = `
                    <td><strong>${user.username}</strong></td>
                    <td><span class="badge-role role-${user.role}">${user.role}</span></td>
                    <td><div class="shifts-list">${shiftsHtml}</div></td>
                    <td>
                        <button class="btn-delete" title="Eliminar" onclick="AdminUI.deleteUser('${user.username}')">
                            🗑️
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--error)">Error al cargar usuarios</td></tr>';
        }
    },

    formatShift(shift) {
        const map = { morning: 'Mañana', afternoon: 'Tarde', night: 'Noche' };
        return map[shift] || shift;
    },

    async handleUserSubmit(e) {
        e.preventDefault();
        const username = document.getElementById('userUsername').value;
        const password = document.getElementById('userPassword').value;
        const role = document.getElementById('userRole').value;

        const shiftCheckboxes = document.querySelectorAll('.shifts-selection input:checked');
        const assignedShifts = Array.from(shiftCheckboxes).map(cb => cb.value);

        if (assignedShifts.length === 0) {
            alert('Debes asignar al menos un turno');
            return;
        }

        try {
            const response = await Auth.fetchWithAuth('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, role, assignedShifts })
            });

            const data = await response.json();
            if (response.ok) {
                document.getElementById('userFormModal').classList.remove('active');
                this.loadUsers();
                showNotification(`Usuario ${username} creado con éxito`, 'success');
            } else {
                alert(data.error || 'Error al crear usuario');
            }
        } catch (error) {
            alert('Error de conexión');
        }
    },

    async deleteUser(username) {
        if (!confirm(`¿Estás seguro de eliminar al usuario "${username}"?`)) return;

        try {
            const response = await Auth.fetchWithAuth(`/api/users/${username}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.loadUsers();
                showNotification('Usuario eliminado', 'info');
            } else {
                const data = await response.json();
                alert(data.error || 'Error al eliminar');
            }
        } catch (error) {
            alert('Error de conexión');
        }
    }
};

// Initialize Admin UI
document.addEventListener('DOMContentLoaded', () => {
    AdminUI.init();
});

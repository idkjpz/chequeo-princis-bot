// Configuration
const TOTAL_PHONES = 26;
const TIME_SLOTS = {
    morning: ['0630', '0800', '1000', '1200', '1400'],
    afternoon: ['1430', '1600', '1800', '2000', '2200'],
    night: ['2230', '0000', '0200', '0430', '0600']
};

// Global State
let phoneData = {};
let currentDate = new Date().toISOString().split('T')[0];
let currentModal = null;
let currentShift = 'all';
let currentTheme = 'dark';
let currentView = 'grid'; // View mode: grid, list, compact, expanded
let mainSection = 'chequeos'; // Navigation section: chequeos, tiempo-real


// ============================================
// NOTES FUNCTIONALITY
// ============================================

let currentNotesPhone = null;

// Open notes modal
async function openNotesModal(phoneNumber) {
    currentNotesPhone = phoneNumber;
    const modal = document.getElementById('notesModal');
    const title = document.getElementById('notesTitle');
    const textarea = document.getElementById('notesTextarea');

    title.textContent = `📝 Notas - Principal ${phoneNumber}`;

    // Load existing note
    try {
        const response = await Auth.fetchWithAuth(`/api/notes/${phoneNumber}`);
        const data = await response.json();
        textarea.value = data.note || '';
    } catch (error) {
        console.error('Error loading note:', error);
        textarea.value = '';
    }

    modal.style.display = 'block';
    textarea.focus();
}

// Save note
async function saveNote() {
    if (!currentNotesPhone) return;

    const textarea = document.getElementById('notesTextarea');
    const note = textarea.value.trim();

    try {
        const response = await Auth.fetchWithAuth(`/api/notes/${currentNotesPhone}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note })
        });

        if (response.ok) {
            closeNotesModal();
            updateNotesIndicator(currentNotesPhone, note);
            showNotification('Nota guardada correctamente', 'success');
        }
    } catch (error) {
        console.error('Error saving note:', error);
        showNotification('Error al guardar la nota', 'error');
    }
}

// Close notes modal
function closeNotesModal() {
    const modal = document.getElementById('notesModal');
    modal.style.display = 'none';
    currentNotesPhone = null;
}

// Update notes indicator
function updateNotesIndicator(phoneNumber, note) {
    const indicator = document.getElementById(`notes-indicator-${phoneNumber}`);
    if (indicator) {
        indicator.style.display = note ? 'block' : 'none';
    }
}

// Load all notes indicators
async function loadNotesIndicators() {
    for (let i = 1; i <= TOTAL_PHONES; i++) {
        try {
            const response = await Auth.fetchWithAuth(`/api/notes/${i}`);
            const data = await response.json();
            if (data.note) {
                updateNotesIndicator(i, data.note);
            }
        } catch (error) {
            console.error(`Error loading note for phone ${i}:`, error);
        }
    }
}

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
    initializeDateFilter();
    initializeShiftFilter();
    initializeViewMode();
    initializeThemeToggle();
    initializePhoneGrid();
    loadDataFromStorage();
    setupEventListeners();
    renderPhones();
    // Initialize chat
    initializeChat();

    // Notes modal event listeners
    const notesClose = document.getElementById('notesClose');
    const notesSaveBtn = document.getElementById('notesSaveBtn');
    const notesCancelBtn = document.getElementById('notesCancelBtn');
    const notesModal = document.getElementById('notesModal');

    if (notesClose) notesClose.onclick = closeNotesModal;
    if (notesSaveBtn) notesSaveBtn.onclick = saveNote;
    if (notesCancelBtn) notesCancelBtn.onclick = closeNotesModal;

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === notesModal) {
            closeNotesModal();
        }
    });

    // Load notes indicators
    loadNotesIndicators();
});

// Date Filter
function initializeDateFilter() {
    const dateInput = document.getElementById('dateFilter');
    dateInput.value = currentDate;

    dateInput.addEventListener('change', (e) => {
        currentDate = e.target.value;
        loadDataFromStorage();
        renderPhones();
        applyCompactView();
    });
}

// Shift Filter with Time Selector
function initializeShiftFilter() {
    const shiftFilter = document.getElementById('shiftFilter');
    const timeSelector = document.getElementById('timeSelector');
    const timeFilter = document.getElementById('timeFilter');

    // Get user info
    const user = Auth.getUser();
    if (!user) return; // Should be handled by Auth.checkAuth redirect

    // Only allow assigned shifts in the filter
    const assignedShifts = user.assignedShifts || [];
    const isAdmin = user.role === 'admin';

    // Clear and rebuild filter options
    shiftFilter.innerHTML = '';

    if (isAdmin) {
        const optAll = document.createElement('option');
        optAll.value = 'all';
        optAll.textContent = 'Todos los Turnos';
        shiftFilter.appendChild(optAll);
    }

    const shiftMap = { morning: 'Mañana', afternoon: 'Tarde', night: 'Noche' };
    assignedShifts.forEach(shift => {
        const opt = document.createElement('option');
        opt.value = shift;
        opt.textContent = shiftMap[shift] || shift;
        shiftFilter.appendChild(opt);
    });

    // Default shift
    let savedShift = localStorage.getItem('selectedShift');
    if (!savedShift || (savedShift !== 'all' && !assignedShifts.includes(savedShift))) {
        savedShift = isAdmin ? 'all' : assignedShifts[0];
    } else if (savedShift === 'all' && !isAdmin) {
        savedShift = assignedShifts[0];
    }

    currentShift = savedShift;
    shiftFilter.value = savedShift;
    localStorage.setItem('selectedShift', savedShift);

    const savedTime = localStorage.getItem('selectedTime') || 'all';

    // Populate time options if a shift is selected
    if (currentShift !== 'all') {
        populateTimeOptions(currentShift);
        timeSelector.style.display = 'flex';
        timeFilter.value = savedTime;
    } else {
        timeSelector.style.display = 'none';
    }

    shiftFilter.addEventListener('change', (e) => {
        currentShift = e.target.value;
        localStorage.setItem('selectedShift', currentShift);

        if (currentShift === 'all') {
            timeSelector.style.display = 'none';
            localStorage.setItem('selectedTime', 'all');
            applyFilters();
        } else {
            populateTimeOptions(currentShift);
            timeSelector.style.display = 'flex';
            timeFilter.value = 'all';
            localStorage.setItem('selectedTime', 'all');
            applyFilters();
        }
    });

    timeFilter.addEventListener('change', (e) => {
        localStorage.setItem('selectedTime', e.target.value);
        applyFilters();
    });

    // Apply initial filter
    applyFilters();
}

function populateTimeOptions(shift) {
    const timeFilter = document.getElementById('timeFilter');
    const times = TIME_SLOTS[shift] || [];

    timeFilter.innerHTML = '<option value="all">Todos los horarios</option>';

    times.forEach(time => {
        const option = document.createElement('option');
        option.value = time;
        option.textContent = formatTimeDisplay(time);
        timeFilter.appendChild(option);
    });
}

function formatTimeDisplay(time) {
    // Convert "0630" to "06:30"
    return time.slice(0, 2) + ':' + time.slice(2);
}

function applyFilters() {
    const selectedTime = document.getElementById('timeFilter')?.value || 'all';
    const user = Auth.getUser();
    if (!user) return;

    const isAdmin = user.role === 'admin';
    const assignedShifts = user.assignedShifts || [];

    // Hide all sections first
    const sections = document.querySelectorAll('.time-section');
    sections.forEach(section => section.classList.add('hidden'));

    // Hide all time columns first
    const timeColumns = document.querySelectorAll('.time-column');
    timeColumns.forEach(col => col.classList.add('hidden'));

    if (currentShift === 'all' && isAdmin) {
        // Show all sections and columns if Admin
        sections.forEach(section => section.classList.remove('hidden'));
        timeColumns.forEach(col => col.classList.remove('hidden'));
    } else {
        // Double check permissions: if currentShift is not in assigned, default to first assigned
        let effectiveShift = currentShift;
        if (effectiveShift === 'all' || !assignedShifts.includes(effectiveShift)) {
            effectiveShift = assignedShifts[0];
        }

        // Show only selected shift section
        const selectedSection = document.querySelector(`.time-section.${effectiveShift}`);
        if (selectedSection) {
            selectedSection.classList.remove('hidden');

            if (selectedTime === 'all') {
                // Show all time columns in this shift
                const columnsInShift = selectedSection.querySelectorAll('.time-column');
                columnsInShift.forEach(col => col.classList.remove('hidden'));
            } else {
                // Show only selected time column
                const container = document.getElementById(`phones-${effectiveShift}-${selectedTime}`);
                if (container) {
                    const timeColumn = container.closest('.time-column');
                    if (timeColumn) {
                        timeColumn.classList.remove('hidden');
                    }
                }
            }
        }
    }
}

// View Mode Filter
function initializeViewMode() {
    // Load saved view mode
    const savedView = localStorage.getItem('viewMode') || 'grid';
    currentView = savedView;
    applyViewMode(currentView);

    // Set active button
    document.querySelectorAll('.view-btn').forEach(btn => {
        if (btn.dataset.view === currentView) {
            btn.classList.add('active');
        }
    });

    // Add click handlers
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            switchViewMode(view);
        });
    });
}

function switchViewMode(view) {
    currentView = view;
    localStorage.setItem('viewMode', view);

    // Update active button
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });

    applyViewMode(view);
}

function applyViewMode(view) {
    const grids = document.querySelectorAll('.phones-grid');
    grids.forEach(grid => {
        // Remove all view classes
        grid.classList.remove('view-grid', 'view-list', 'view-compact', 'view-expanded');
        // Add current view class
        grid.classList.add(`view-${view}`);
    });
}

// Theme Selector
function initializeThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    const themeDropdown = document.getElementById('themeDropdown');
    const themeOptions = document.querySelectorAll('.theme-option');
    const themeIcon = document.querySelector('.theme-icon');

    // Load saved theme
    const savedTheme = getCurrentTheme();
    applyTheme(savedTheme);
    updateThemeIcon(savedTheme);
    updateActiveThemeOption(savedTheme);

    // Toggle dropdown
    themeToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        themeDropdown.classList.toggle('active');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!themeToggle.contains(e.target) && !themeDropdown.contains(e.target)) {
            themeDropdown.classList.remove('active');
        }
    });

    // Theme option click
    themeOptions.forEach(option => {
        option.addEventListener('click', () => {
            const theme = option.dataset.theme;
            applyTheme(theme);
            updateThemeIcon(theme);
            updateActiveThemeOption(theme);
            themeDropdown.classList.remove('active');
        });
    });
}

function updateThemeIcon(themeName) {
    const themeIcon = document.querySelector('.theme-icon');
    const theme = THEMES[themeName];
    if (theme && themeIcon) {
        themeIcon.textContent = theme.icon;
    }
}

function updateActiveThemeOption(themeName) {
    document.querySelectorAll('.theme-option').forEach(option => {
        option.classList.toggle('active', option.dataset.theme === themeName);
    });
}

// Compact View
function applyCompactView() {
    applyFilters();
}

// Initialize Phone Grid
function initializePhoneGrid() {
    Object.keys(TIME_SLOTS).forEach(period => {
        TIME_SLOTS[period].forEach(time => {
            const containerId = `phones-${period}-${time}`;
            const container = document.getElementById(containerId);

            if (container) {
                for (let i = 1; i <= TOTAL_PHONES; i++) {
                    const phoneItem = createPhoneElement(i, period, time);
                    container.appendChild(phoneItem);
                }
            }
        });
    });
}

// Create Phone Element
function createPhoneElement(phoneNumber, period, time) {
    const div = document.createElement('div');
    div.className = 'phone-item';
    div.dataset.phone = phoneNumber;
    div.dataset.period = period;
    div.dataset.time = time;

    const phoneLabel = document.createElement('div');
    phoneLabel.className = 'phone-label';
    phoneLabel.textContent = `Principal ${phoneNumber}`;

    // Actions container
    const phoneActions = document.createElement('div');
    phoneActions.className = 'phone-actions';

    // Notes button
    const notesBtn = document.createElement('button');
    notesBtn.className = 'btn-action-icon';
    notesBtn.innerHTML = '📝';
    notesBtn.title = 'Ver/editar notas';
    notesBtn.onclick = (e) => {
        e.stopPropagation();
        openNotesModal(phoneNumber);
    };

    // History button
    const historyBtn = document.createElement('button');
    historyBtn.className = 'btn-action-icon';
    historyBtn.innerHTML = '📜';
    historyBtn.title = 'Ver historial de cambios';
    historyBtn.onclick = (e) => {
        e.stopPropagation();
        openHistoryModal(phoneNumber);
    };

    // Notes indicator (hidden by default)
    const notesIndicator = document.createElement('div');
    notesIndicator.className = 'notes-indicator';
    notesIndicator.id = `notes-indicator-${phoneNumber}`;
    notesIndicator.style.display = 'none';

    phoneActions.appendChild(notesBtn);
    phoneActions.appendChild(historyBtn);

    div.appendChild(phoneLabel);
    div.appendChild(notesIndicator);
    div.appendChild(phoneActions);

    const statusSpan = document.createElement('span');
    statusSpan.className = 'phone-status';
    statusSpan.textContent = '○';

    div.appendChild(statusSpan);

    div.addEventListener('click', () => openStatusModal(phoneNumber, period, time));

    return div;
}

// Modal Management
function openStatusModal(phoneNumber, period, time) {
    const modal = document.getElementById('statusModal');
    const modalInfo = document.getElementById('modalPhoneInfo');

    currentModal = { phoneNumber, period, time };

    const timeFormatted = time.slice(0, 2) + ':' + time.slice(2);
    modalInfo.textContent = `Principal ${phoneNumber} - ${timeFormatted}`;

    modal.classList.add('active');
}

function closeStatusModal() {
    const modal = document.getElementById('statusModal');
    modal.classList.remove('active');
    currentModal = null;
}

// Status Selection
function setPhoneStatus(status) {
    if (!currentModal) return;

    const { phoneNumber, period, time } = currentModal;
    const key = `${currentDate}_${phoneNumber}_${period}_${time}`;

    // Get operator name from chat settings
    const operatorName = localStorage.getItem('chatUserName') || 'Usuario';

    if (!phoneData[currentDate]) {
        phoneData[currentDate] = {};
    }

    const dataObj = {
        phone: phoneNumber,
        period,
        time,
        status,
        timestamp: new Date().toISOString(),
        userName: operatorName
    };

    phoneData[currentDate][key] = dataObj;

    // Save to server
    updateStatusOnServer(currentDate, phoneNumber, period, time, status, operatorName);

    saveDataToStorage();
    updatePhoneDisplay(phoneNumber, period, time, status);
    applyCompactView(); // Update compact view after status change
    closeStatusModal();
}

async function updateStatusOnServer(date, phone, period, time, status, userName) {
    try {
        await Auth.fetchWithAuth('/api/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date, phone, period, time, status, userName })
        });
    } catch (error) {
        console.error('Error updating status on server:', error);
    }
}

// Update Phone Display
function updatePhoneDisplay(phoneNumber, period, time, status) {
    const phoneItem = document.querySelector(
        `.phone-item[data-phone="${phoneNumber}"][data-period="${period}"][data-time="${time}"]`
    );

    if (!phoneItem) return;

    const statusSpan = phoneItem.querySelector('.phone-status');
    const statusConfig = {
        activo: { symbol: '●', class: 'active' },
        desconectado: { symbol: '●', class: 'disconnected' },
        crm: { symbol: '●', class: 'crm' },
        server: { symbol: '●', class: 'server' },
        none: { symbol: '○', class: 'none' }
    };

    const config = statusConfig[status] || statusConfig.none;
    statusSpan.textContent = config.symbol;
    statusSpan.className = `phone-status status-badge ${config.class}`;

    phoneItem.classList.add('checked');
    setTimeout(() => phoneItem.classList.remove('checked'), 300);
}

// Render All Phones
function renderPhones() {
    const dateData = phoneData[currentDate] || {};

    // Reset all phones
    document.querySelectorAll('.phone-item').forEach(item => {
        const statusSpan = item.querySelector('.phone-status');
        statusSpan.textContent = '○';
        statusSpan.className = 'phone-status status-badge none';
    });

    // Update with saved data
    Object.values(dateData).forEach(data => {
        updatePhoneDisplay(data.phone, data.period, data.time, data.status);
    });

    // Load notes
    loadNotes();
}

// Storage Management
function saveDataToStorage() {
    try {
        localStorage.setItem('phoneMonitoringData', JSON.stringify(phoneData));
    } catch (e) {
        console.error('Error saving to localStorage:', e);
    }
}

function loadDataFromStorage() {
    try {
        const saved = localStorage.getItem('phoneMonitoringData');
        if (saved) {
            phoneData = JSON.parse(saved);
        }
    } catch (e) {
        console.error('Error loading from localStorage:', e);
        phoneData = {};
    }
}

// Notes Management
function saveNotes() {
    const notesInput = document.getElementById('notesInput');
    const notes = notesInput.value.trim();

    if (!phoneData[currentDate]) {
        phoneData[currentDate] = {};
    }

    phoneData[currentDate]._notes = notes;
    saveDataToStorage();

    showNotification('Notas guardadas correctamente', 'success');
}

function loadNotes() {
    const notesInput = document.getElementById('notesInput');
    const dateData = phoneData[currentDate] || {};
    notesInput.value = dateData._notes || '';
}

function clearNotes() {
    const notesInput = document.getElementById('notesInput');
    notesInput.value = '';

    if (phoneData[currentDate]) {
        delete phoneData[currentDate]._notes;
        saveDataToStorage();
    }

    showNotification('Notas eliminadas', 'info');
}

// Utility Functions
function formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('es-ES', options);
}

// Generate Discord Report as Embed
function generateReport() {
    const dateData = phoneData[currentDate] || {};
    const notes = dateData._notes || '';

    // Group phones by their most recent status
    const phonesByStatus = {
        activo: new Set(),
        desconectado: new Set(),
        crm: new Set(),
        server: new Set()
    };

    // Collect all checked phones and their latest status
    Object.values(dateData).forEach(data => {
        if (data.phone && data.status && !data.phone.toString().startsWith('_')) {
            // Only add if the status is valid
            if (phonesByStatus[data.status]) {
                phonesByStatus[data.status].add(data.phone);
            }
        }
    });

    // Build embed fields
    const fields = [];

    // ACTIVOS
    if (phonesByStatus.activo.size > 0) {
        const phones = Array.from(phonesByStatus.activo).sort((a, b) => a - b);
        const phoneList = phones.map(p => `PRINCI ${p}`).join('\n');
        fields.push({
            name: '✅ ACTIVOS',
            value: phoneList,
            inline: true
        });
    }

    // DESCONECTADOS
    if (phonesByStatus.desconectado.size > 0) {
        const phones = Array.from(phonesByStatus.desconectado).sort((a, b) => a - b);
        const phoneList = phones.map(p => `PRINCI ${p}`).join('\n');
        fields.push({
            name: '🔴 DESCONECTADO',
            value: phoneList,
            inline: true
        });
    }

    // EN CRM
    if (phonesByStatus.crm.size > 0) {
        const phones = Array.from(phonesByStatus.crm).sort((a, b) => a - b);
        const phoneList = phones.map(p => `PRINCI ${p}`).join('\n');
        fields.push({
            name: '⚠️ EN CRM',
            value: phoneList,
            inline: true
        });
    }

    // EN SERVER
    if (phonesByStatus.server.size > 0) {
        const phones = Array.from(phonesByStatus.server).sort((a, b) => a - b);
        const phoneList = phones.map(p => `PRINCI ${p}`).join('\n');
        fields.push({
            name: '🔧 EN SERVER',
            value: phoneList,
            inline: true
        });
    }

    // Summary
    const totalChecked = phonesByStatus.activo.size +
        phonesByStatus.desconectado.size +
        phonesByStatus.crm.size +
        phonesByStatus.server.size;

    const summary = `**Total:** ${totalChecked} principales\n` +
        `**Activos:** ${phonesByStatus.activo.size} | ` +
        `**Desconectados:** ${phonesByStatus.desconectado.size}\n` +
        `**En CRM:** ${phonesByStatus.crm.size} | ` +
        `**En Server:** ${phonesByStatus.server.size}`;

    fields.push({
        name: '📊 RESUMEN',
        value: summary,
        inline: false
    });

    // Notes
    if (notes && notes.trim() !== '') {
        fields.push({
            name: '📝 NOTAS',
            value: notes,
            inline: false
        });
    }

    // Create Discord Embed
    const embed = {
        title: '📱 CONTROL DE PRINCIPALES',
        description: `**Fecha:** ${formatDate(currentDate)}\n**Hora:** ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`,
        color: 0x6366f1, // Purple color (hex: #6366f1)
        fields: fields,
        footer: {
            text: 'Sistema de Monitoreo de Principales'
        },
        timestamp: new Date().toISOString()
    };

    return embed;
}

// Generate Telegram Report (HTML formatted)
function generateTelegramReport() {
    const dateData = phoneData[currentDate] || {};
    const notes = dateData._notes || '';

    // Group phones by their most recent status
    const phonesByStatus = {
        activo: new Set(),
        desconectado: new Set(),
        crm: new Set(),
        server: new Set()
    };

    // Collect all checked phones and their latest status
    Object.values(dateData).forEach(data => {
        if (data.phone && data.status && !data.phone.toString().startsWith('_')) {
            if (phonesByStatus[data.status]) {
                phonesByStatus[data.status].add(data.phone);
            }
        }
    });

    // Build message
    let message = `📱 <b>CONTROL DE PRINCIPALES</b>\n\n`;
    message += `📅 <b>Fecha:</b> ${formatDate(currentDate)}\n`;
    message += `🕐 <b>Hora:</b> ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}\n\n`;

    // ACTIVOS
    if (phonesByStatus.activo.size > 0) {
        const phones = Array.from(phonesByStatus.activo).sort((a, b) => a - b);
        message += `✅ <b>ACTIVOS</b>\n`;
        phones.forEach(p => message += `   • PRINCI ${p}\n`);
        message += `\n`;
    }

    // DESCONECTADOS
    if (phonesByStatus.desconectado.size > 0) {
        const phones = Array.from(phonesByStatus.desconectado).sort((a, b) => a - b);
        message += `🔴 <b>DESCONECTADO</b>\n`;
        phones.forEach(p => message += `   • PRINCI ${p}\n`);
        message += `\n`;
    }

    // EN CRM
    if (phonesByStatus.crm.size > 0) {
        const phones = Array.from(phonesByStatus.crm).sort((a, b) => a - b);
        message += `⚠️ <b>EN CRM</b>\n`;
        phones.forEach(p => message += `   • PRINCI ${p}\n`);
        message += `\n`;
    }

    // EN SERVER
    if (phonesByStatus.server.size > 0) {
        const phones = Array.from(phonesByStatus.server).sort((a, b) => a - b);
        message += `🔧 <b>EN SERVER</b>\n`;
        phones.forEach(p => message += `   • PRINCI ${p}\n`);
        message += `\n`;
    }

    // Summary
    const totalChecked = phonesByStatus.activo.size +
        phonesByStatus.desconectado.size +
        phonesByStatus.crm.size +
        phonesByStatus.server.size;

    message += `📊 <b>RESUMEN</b>\n`;
    message += `<b>Total:</b> ${totalChecked} principales\n`;
    message += `<b>Activos:</b> ${phonesByStatus.activo.size} | <b>Desconectados:</b> ${phonesByStatus.desconectado.size}\n`;
    message += `<b>En CRM:</b> ${phonesByStatus.crm.size} | <b>En Server:</b> ${phonesByStatus.server.size}\n`;

    // Notes
    if (notes && notes.trim() !== '') {
        message += `\n📝 <b>NOTAS</b>\n${notes}`;
    }

    return message;
}

// Get Status Summary for a Phone
function getStatusSummary(checks, expectedTimes) {
    if (checks.length === 0) {
        return 'Sin chequear';
    }

    // Count status types
    const statusCount = {};
    checks.forEach(check => {
        statusCount[check.status] = (statusCount[check.status] || 0) + 1;
    });

    // Get most common status
    const sortedStatuses = Object.entries(statusCount)
        .sort((a, b) => b[1] - a[1]);

    if (sortedStatuses.length === 0) {
        return 'Sin chequear';
    }

    const [mainStatus, count] = sortedStatuses[0];
    const total = expectedTimes.length;

    const statusNames = {
        activo: 'Activo',
        desconectado: 'Desconectado',
        crm: 'En CRM',
        server: 'En Server'
    };

    const statusName = statusNames[mainStatus] || mainStatus;

    if (count === total) {
        return statusName;
    } else {
        return `${statusName} (${count}/${total} checks)`;
    }
}

// Send Report to Discord
async function sendToDiscord() {
    const embedData = generateReport();

    // Check if there's anything to report
    const dateData = phoneData[currentDate] || {};
    const hasChecks = Object.keys(dateData).some(key => !key.startsWith('_'));

    if (!hasChecks) {
        showNotification('No hay chequeos para enviar', 'error');
        return;
    }

    try {
        const response = await Auth.fetchWithAuth('/api/send-discord', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                embedData: embedData
            })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            showNotification('Informe enviado a Discord correctamente', 'success');

            // Ask user if they want to reset the data
            setTimeout(() => {
                if (confirm('¿Deseas reiniciar los datos del día actual? Esto limpiará todos los chequeos y notas.')) {
                    resetCurrentDayData();
                }
            }, 1000);
        } else {
            throw new Error(result.error || 'Error al enviar el informe');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al enviar el informe a Discord', 'error');

        // Show report in console as fallback
        console.log('Report:', embedData);
        alert('No se pudo enviar a Discord. Verifica que el webhook esté configurado en el archivo .env');
    }
}

// Show Notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#6366f1'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        font-weight: 500;
        animation: slideInRight 0.3s ease;
    `;

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Clear All Selections
function clearAllSelections() {
    if (!phoneData[currentDate] || Object.keys(phoneData[currentDate]).length === 0) {
        showNotification('No hay selecciones para limpiar', 'info');
        return;
    }

    // Confirm before clearing
    if (confirm('¿Estás seguro de que deseas desmarcar todos los teléfonos? Esta acción no se puede deshacer.')) {
        // Clear all data for current date
        delete phoneData[currentDate];
        saveDataToStorage();
        renderPhones();
        showNotification('Todas las selecciones han sido limpiadas', 'success');
    }
}

// Reset Current Day Data
function resetCurrentDayData() {
    if (phoneData[currentDate]) {
        delete phoneData[currentDate];
        saveDataToStorage();
        renderPhones();
        showNotification('Datos del día reiniciados correctamente', 'success');
    }
}

// Get Status Emoji
function getStatusEmoji(summary) {
    if (summary.includes('Activo')) return '✅';
    if (summary.includes('Desconectado')) return '❌';
    if (summary.includes('CRM')) return '⚠️';
    if (summary.includes('Server')) return '🔧';
    return '⚪';
}

// Send Report to Discord and Telegram
async function sendToDiscord() {
    const embedData = generateReport();
    const telegramMessage = generateTelegramReport();

    // Check if there's anything to report
    const dateData = phoneData[currentDate] || {};
    const hasChecks = Object.keys(dateData).some(key => !key.startsWith('_'));

    if (!hasChecks) {
        showNotification('No hay chequeos para enviar', 'error');
        return;
    }

    let discordSuccess = false;
    let telegramSuccess = false;

    try {
        // Send to Discord
        try {
            const discordResponse = await Auth.fetchWithAuth('/api/send-discord', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    embedData: embedData
                })
            });

            const discordResult = await discordResponse.json();

            if (discordResponse.ok && discordResult.success) {
                discordSuccess = true;
            }
        } catch (error) {
            console.error('Error sending to Discord:', error);
        }

        // Send to Telegram
        try {
            const telegramResponse = await Auth.fetchWithAuth('/api/send-telegram', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: telegramMessage
                })
            });

            const telegramResult = await telegramResponse.json();

            if (telegramResponse.ok && telegramResult.success) {
                telegramSuccess = true;
            }
        } catch (error) {
            console.error('Error sending to Telegram:', error);
        }

        // Show notification based on results
        if (discordSuccess && telegramSuccess) {
            showNotification('Informe enviado a Discord y Telegram correctamente', 'success');
        } else if (discordSuccess) {
            showNotification('Informe enviado a Discord (Telegram no configurado)', 'success');
        } else if (telegramSuccess) {
            showNotification('Informe enviado a Telegram (Discord falló)', 'success');
        } else {
            throw new Error('No se pudo enviar a ninguna plataforma');
        }

        // Automatically reset the data after successful send
        if (discordSuccess || telegramSuccess) {
            setTimeout(() => {
                resetCurrentDayData();
            }, 1000);
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al enviar el informe', 'error');

        // Show report in console as fallback
        console.log('Discord Report:', embedData);
        console.log('Telegram Report:', telegramMessage);
    }
}

// Reset current day data
function resetCurrentDayData() {
    if (phoneData[currentDate]) {
        delete phoneData[currentDate];
        saveDataToStorage();
        renderPhones();
        showNotification('Datos del día reiniciados correctamente', 'success');
    }
}

// Utility Functions
function formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('es-ES', options);
}

function showNotification(message, type = 'info') {
    // Simple notification (you can enhance this with a toast library)
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#6366f1'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Event Listeners Setup
function setupEventListeners() {
    // Modal close
    document.querySelectorAll('.close').forEach(btn => {
        btn.addEventListener('click', () => {
            closeStatusModal();
            closeNotesModal();
            closeHistoryModal();
        });
    });

    const statusModal = document.getElementById('statusModal');
    statusModal.addEventListener('click', (e) => {
        if (e.target === statusModal) closeStatusModal();
    });

    const historyModal = document.getElementById('historyModal');
    historyModal.addEventListener('click', (e) => {
        if (e.target === historyModal) closeHistoryModal();
    });

    // Status buttons
    document.querySelectorAll('.status-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const status = btn.dataset.status;
            setPhoneStatus(status);
        });
    });

    // Notes buttons
    document.getElementById('saveNotesBtn').addEventListener('click', saveNotes);
    document.getElementById('clearNotesBtn').addEventListener('click', clearNotes);

    // Clear all button
    document.getElementById('clearAllBtn').addEventListener('click', clearAllSelections);

    // Send report button
    document.getElementById('sendReportBtn').addEventListener('click', sendToDiscord);

    // Tiempo Real button
    const tiempoRealBtn = document.getElementById('tiempoRealBtn');
    if (tiempoRealBtn) {
        tiempoRealBtn.addEventListener('click', () => {
            switchView('tiempo-real');
        });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeStatusModal();
            closeNotesModal();
            closeHistoryModal();
        }
    });
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// History Management
async function openHistoryModal(phoneNumber) {
    const modal = document.getElementById('historyModal');
    const title = document.getElementById('historyTitle');
    const timeline = document.getElementById('historyTimeline');

    title.textContent = `📜 Historial - Principal ${phoneNumber}`;
    timeline.innerHTML = '<div class="loading-history">Cargando historial...</div>';

    modal.classList.add('active');

    try {
        const response = await Auth.fetchWithAuth(`/api/history/${phoneNumber}`);
        const data = await response.json();

        if (data.success && data.history && data.history.length > 0) {
            renderHistoryTimeline(data.history);
        } else {
            timeline.innerHTML = '<div class="loading-history">No hay historial disponible para este principal.</div>';
        }
    } catch (error) {
        console.error('Error fetching history:', error);
        timeline.innerHTML = '<div class="loading-history">Error al cargar el historial.</div>';
    }
}

function closeHistoryModal() {
    const modal = document.getElementById('historyModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function renderHistoryTimeline(history) {
    const timeline = document.getElementById('historyTimeline');
    timeline.innerHTML = '';

    history.forEach(entry => {
        const item = document.createElement('div');
        item.className = 'history-item';

        const date = new Date(entry.timestamp);
        const dateStr = date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeStr = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        // Map period internal names to labels
        const periodLabels = { morning: 'Mañana', afternoon: 'Tarde', night: 'Noche' };
        const periodLabel = periodLabels[entry.periodLabel] || entry.periodLabel;
        const timeFormatted = entry.timeLabel.slice(0, 2) + ':' + entry.timeLabel.slice(2);

        item.innerHTML = `
            <div class="history-marker"></div>
            <div class="history-content">
                <span class="history-time">${dateStr} ${timeStr}</span>
                <div class="history-action">
                    <span class="history-user">${entry.user}</span>
                    cambió el estado de las ${timeFormatted} (${periodLabel})
                </div>
                <div class="history-status-change">
                    <span class="history-status-label status-label-${entry.fromStatus.toLowerCase()}">${entry.fromStatus}</span>
                    <span>→</span>
                    <span class="history-status-label status-label-${entry.toStatus.toLowerCase()}">${entry.toStatus}</span>
                </div>
            </div>
        `;
        timeline.appendChild(item);
    });
}

// ============================================
// NAVIGATION & VIEW SWITCHING
// ============================================

function switchView(section) {
    const chequeosSection = document.getElementById('mainContent') || document.querySelector('.container');
    const introSection = document.querySelector('.intro-section');
    const infoSection = document.querySelector('.info-section');
    const tiempoRealSection = document.getElementById('tiempoRealSection');
    const tiempoRealBtn = document.getElementById('tiempoRealBtn');

    if (section === 'tiempo-real') {
        // Hide Chequeos
        if (chequeosSection) chequeosSection.style.display = 'none';
        if (introSection) introSection.style.display = 'none';
        if (infoSection) infoSection.style.display = 'none';

        // Show Tiempo Real
        if (tiempoRealSection) {
            tiempoRealSection.style.display = 'block';
            initTiempoReal(); // Function from tiempo-real.js
        }

        // Update Button
        if (tiempoRealBtn) {
            tiempoRealBtn.innerHTML = '<span class="icon">📊</span> Ver Chequeos';
            tiempoRealBtn.classList.remove('btn-accent');
            tiempoRealBtn.classList.add('btn-secondary');
            tiempoRealBtn.onclick = () => switchView('chequeos');
        }

        mainSection = 'tiempo-real';
    } else {
        // Show Chequeos
        if (chequeosSection) chequeosSection.style.display = 'block';
        if (introSection) introSection.style.display = 'block';
        if (infoSection) infoSection.style.display = 'block';

        // Hide Tiempo Real
        if (tiempoRealSection) {
            tiempoRealSection.style.display = 'none';
            destroyTiempoReal(); // Function from tiempo-real.js
        }

        // Update Button
        if (tiempoRealBtn) {
            tiempoRealBtn.innerHTML = '<span class="icon">🔴</span> Tiempo Real';
            tiempoRealBtn.classList.remove('btn-secondary');
            tiempoRealBtn.classList.add('btn-accent');
            tiempoRealBtn.onclick = () => switchView('tiempo-real');
        }

        mainSection = 'chequeos';
    }
}

// ============================================
// TELEGRAM CHAT FUNCTIONALITY
// ============================================
// Chat functions are defined in chat-functions.js
// (Loaded separately to keep code organized)

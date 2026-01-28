const axios = require('axios');
const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');

class TelegramBot {
    constructor(token, chatId) {
        console.log('🔧 TelegramBot constructor called');
        this.token = token;
        this.chatId = chatId;
        this.baseUrl = `https://api.telegram.org/bot${token}`;
        this.offset = 0;
        this.messagesFile = path.join(__dirname, 'data', 'messages.json');
        this.reportsFile = path.join(__dirname, 'data', 'active-reports.json');
        this.isPolling = false;
        console.log('✅ TelegramBot constructor completed');
    }

    // Start polling for updates
    async start() {
        console.log('🔧 TelegramBot.start() called');
        try {
            console.log('🔧 Creating data directory...');
            // Ensure data directory exists
            const dataDir = path.join(__dirname, 'data');
            try {
                await fsPromises.mkdir(dataDir, { recursive: true });
                console.log('✅ Data directory ready');
            } catch (mkdirErr) {
                console.log('⚠️ Data directory already exists or error:', mkdirErr.message);
            }

            // Initialize messages file if it doesn't exist
            console.log('🔧 Initializing messages file...');
            try {
                await fsPromises.access(this.messagesFile);
                console.log('✅ Messages file already exists');
            } catch {
                await fsPromises.writeFile(this.messagesFile, JSON.stringify([]));
                console.log('✅ Messages file created');
            }

            // Initialize reports file if it doesn't exist
            console.log('🔧 Initializing reports file...');
            try {
                await fsPromises.access(this.reportsFile);
                console.log('✅ Reports file already exists');
            } catch {
                await fsPromises.writeFile(this.reportsFile, JSON.stringify([]));
                console.log('✅ Reports file created');
            }

            console.log('✅ Telegram bot initialized');
            await this.setBotCommands();
            this.isPolling = true;
            return true;
        } catch (error) {
            console.error('❌ Error in start():', error.message);
            console.error('Stack:', error.stack);
            throw error;
        }
    }

    // Stop polling
    stopPolling() {
        this.isPolling = false;
        console.log('⏸️ Stopped Telegram polling');
    }

    async setBotCommands() {
        console.log('🔧 Setting bot commands...');
        const commands = [
            { command: 'start', description: '🏠 Iniciar bot' },
            { command: 'help', description: '❓ Ver ayuda y comandos' },
            { command: 'cambiar', description: '🔴 Tiempo Real: Cambiar estado' },
            { command: 'estado', description: '📊 Tiempo Real: Ver estados' },
            { command: 'limpiar', description: '🧹 Tiempo Real: Limpiar estado' },
            { command: 'status', description: '📈 Resumen de chequeos del día' },
            { command: 'reporte', description: '🚨 Reportar a Discord y Guardar' },
            { command: 'ver_reportes', description: '📋 Ver todos los reportes actuales' },
            { command: 'limpiar_reportes', description: '🗑️ Borrar todos los reportes' }
        ];

        try {
            await axios.post(`${this.baseUrl}/setMyCommands`, { commands });
            console.log('✅ Bot commands registered successfully');
        } catch (error) {
            console.error('⚠️ Error setting bot commands:', error.message);
        }
    }

    // Poll for updates
    async poll() {
        if (!this.isPolling) return;

        try {
            const response = await axios.get(`${this.baseUrl}/getUpdates`, {
                params: {
                    offset: this.offset,
                    timeout: 30
                }
            });

            const updates = response.data.result;

            for (const update of updates) {
                this.offset = update.update_id + 1;
                await this.handleUpdate(update);
            }
        } catch (error) {
            console.error('Error polling Telegram:', error.message);
        }

        // Continue polling
        setTimeout(() => this.poll(), 1000);
    }

    // Handle incoming update
    async handleUpdate(update) {
        if (!update.message) return;

        const message = update.message;
        const from = message.from;
        const chatId = message.chat.id;

        // Debug logging
        console.log(`📩 Message received:`);
        console.log(`   From: ${from.first_name}`);
        console.log(`   Chat ID: ${chatId}`);
        console.log(`   Configured Chat ID: ${this.chatId}`);
        console.log(`   Match: ${chatId.toString() === this.chatId.toString()}`);

        // Only process messages from configured chat
        if (chatId.toString() !== this.chatId.toString()) {
            console.log(`⚠️ Ignoring message from chat ${chatId} (expected ${this.chatId}). If this is your group, update TELEGRAM_CHAT_ID in .env`);
            return;
        }

        // Extract message text or description based on type
        let text = '';
        let photoUrl = null;

        if (message.text) {
            text = message.text;
        } else if (message.photo) {
            // Get the largest photo
            const photo = message.photo[message.photo.length - 1];
            text = message.caption || '📷 Foto';

            // Download photo
            photoUrl = await this._downloadPhoto(photo);
        } else if (message.sticker) {
            text = `🎨 [Sticker: ${message.sticker.emoji || ''}]`;
        } else if (message.document) {
            text = `📄 [Documento: ${message.document.file_name || 'archivo'}]`;
        } else if (message.video) {
            text = message.caption || '🎥 [Video]';
        } else if (message.voice) {
            text = '🎤 [Mensaje de voz]';
        } else if (message.audio) {
            text = `🎵 [Audio: ${message.audio.title || 'audio'}]`;
        } else if (message.location) {
            text = '📍 [Ubicación]';
        } else if (message.contact) {
            text = `👤 [Contacto: ${message.contact.first_name}]`;
        } else {
            text = '[Mensaje no soportado]';
        }

        console.log(`📨 Received from ${from.first_name}: "${text}"`);

        // Prepare reply info if message is a reply
        let replyTo = null;
        if (message.reply_to_message) {
            replyTo = {
                messageId: message.reply_to_message.message_id,
                from: message.reply_to_message.from.first_name || message.reply_to_message.from.username || 'Usuario',
                text: message.reply_to_message.text || '[Archivo/Media]'
            };
        }

        // Save message to history
        await this.saveMessage({
            messageId: message.message_id,
            from: from.first_name || from.username || 'Usuario',
            text: text,
            photoUrl: photoUrl,
            replyTo: replyTo,
            timestamp: new Date(message.date * 1000).toISOString(),
            isBot: false
        });

        // Handle commands (only for text messages)
        if (message.text && message.text.startsWith('/')) {
            await this.handleCommand(message.text, chatId);
        } else if (message.text) {
            // Handle auto-responses (only for text messages)
            await this.handleAutoResponse(message.text, chatId);
        }
    }

    // Handle bot commands
    async handleCommand(command, chatId) {
        const cmd = command.toLowerCase().split(' ')[0];

        switch (cmd) {
            case '/start':
                await this.sendMessage('¡Hola! 👋\n\nSoy el bot de Control de Principales.\n\nUsa /help para ver los comandos disponibles.', chatId);
                break;

            case '/help':
                const helpText = `📱 <b>Comandos disponibles:</b>\n\n` +
                    `<b>🔴 Tiempo Real:</b>\n` +
                    `/cambiar [número] [estado] - Cambiar estado de un principal\n` +
                    `  Estados: activo, desconectado, crm, server\n` +
                    `  Ejemplo: /cambiar 17 activo\n` +
                    `/estado - Ver todos los principales en tiempo real\n` +
                    `/estado [número] - Ver un principal específico\n` +
                    `/limpiar [número] - Limpiar estado de un principal\n\n` +
                    `<b>📊 Otros:</b>\n` +
                    `/status - Ver resumen de chequeos del día\n` +
                    `/reporte [número] [mensaje] - Reportar a Discord y Guardar\n` +
                    `/ver_reportes - Ver lista de reportes actuales\n` +
                    `/limpiar_reportes - Borrar todos los reportes grabados\n` +
                    `/help - Mostrar este mensaje`;
                await this.sendMessage(helpText, chatId);
                break;

            case '/status':
                await this.sendStatusSummary(chatId);
                break;

            case '/reporte':
                // Check if it's a specific principal report
                const reportArgs = command.split(' ').slice(1);
                if (reportArgs.length >= 2) {
                    // /reporte [número] [mensaje]
                    await this.handleReporteCommand(reportArgs, chatId);
                } else {
                    await this.sendMessage('📊 \u003cb\u003eUso del comando:\u003c/b\u003e\\n\\n' +
                        '/reporte [número] [mensaje]\\n\\n' +
                        '\u003cb\u003eEjemplos:\u003c/b\u003e\\n' +
                        '• /reporte 17 está en revisión\\n' +
                        '• /reporte 5 desconectado desde las 14:00\\n' +
                        '• /reporte 23 problema con la línea', chatId);
                }
                break;

            case '/cambiar':
                const cambiarArgs = command.split(' ').slice(1);
                if (cambiarArgs.length >= 2) {
                    await this.handleCambiarCommand(cambiarArgs, chatId);
                } else {
                    await this.sendMessage('🔄 <b>Uso del comando:</b>\n\n' +
                        '/cambiar [número] [estado] [mensaje opcional]\n\n' +
                        '<b>Estados válidos:</b>\n' +
                        '• activo\n' +
                        '• desconectado\n' +
                        '• crm\n' +
                        '• server\n\n' +
                        '<b>Ejemplos:</b>\n' +
                        '• /cambiar 17 activo\n' +
                        '• /cambiar 5 desconectado no responde\n' +
                        '• /cambiar 12 crm problema', chatId);
                }
                break;

            case '/estado':
                const estadoArgs = command.split(' ').slice(1);
                if (estadoArgs.length > 0) {
                    await this.handleEstadoCommand(estadoArgs[0], chatId);
                } else {
                    await this.handleEstadoCommand(null, chatId);
                }
                break;

            case '/limpiar':
                const limpiarArgs = command.split(' ').slice(1);
                if (limpiarArgs.length > 0) {
                    await this.handleLimpiarCommand(limpiarArgs[0], chatId);
                } else {
                    await this.sendMessage('🧹 <b>Uso del comando:</b>\n\n' +
                        '/limpiar [número]\n\n' +
                        '<b>Ejemplo:</b>\n' +
                        '• /limpiar 17', chatId);
                }
                break;

            case '/ver_reportes':
                await this.handleVerReportesCommand(chatId);
                break;

            case '/limpiar_reportes':
                await this.handleLimpiarReportesCommand(chatId);
                break;

            default:
                await this.sendMessage('❓ Comando no reconocido. Usa /help para ver los comandos disponibles.', chatId);
        }
    }

    // Handle auto-responses
    async handleAutoResponse(text, chatId) {
        const lowerText = text.toLowerCase();

        if (lowerText.includes('hola') || lowerText.includes('buenos días') || lowerText.includes('buenas tardes')) {
            await this.sendMessage('¡Hola! 👋 ¿En qué puedo ayudarte?', chatId);
        } else if (lowerText.includes('ayuda') || lowerText.includes('menu') || lowerText.includes('menú')) {
            await this.sendMessage('📱 <b>Menú de Ayuda</b>\n\nUsa /help para ver todos los comandos disponibles.', chatId);
        } else if (lowerText.includes('estado')) {
            await this.sendStatusSummary(chatId);
        }
    }

    // Send status summary
    async sendStatusSummary(chatId) {
        try {
            // Load phone data
            const dataPath = path.join(__dirname, 'data', 'phone-data.json');
            const data = JSON.parse(await fs.readFile(dataPath, 'utf-8'));
            const today = new Date().toISOString().split('T')[0];
            const todayData = data[today] || {};

            // Count statuses
            const statusCount = { activo: 0, desconectado: 0, crm: 0, server: 0 };
            Object.values(todayData).forEach(entry => {
                if (entry.status && statusCount.hasOwnProperty(entry.status)) {
                    statusCount[entry.status]++;
                }
            });

            const total = Object.values(statusCount).reduce((a, b) => a + b, 0);

            const message = `📊 <b>Estado Actual</b>\n\n` +
                `✅ Activos: ${statusCount.activo}\n` +
                `🔴 Desconectados: ${statusCount.desconectado}\n` +
                `⚠️ En CRM: ${statusCount.crm}\n` +
                `🔧 En Server: ${statusCount.server}\n\n` +
                `<b>Total:</b> ${total} principales chequeados`;

            await this.sendMessage(message, chatId);
        } catch (error) {
            await this.sendMessage('❌ Error al obtener el estado. Verifica que haya datos disponibles.', chatId);
        }
    }

    // Handle /reporte command for specific principal
    async handleReporteCommand(args, chatId) {
        try {
            const principalNum = parseInt(args[0]);
            const mensaje = args.slice(1).join(' ');

            // Validate principal number
            if (isNaN(principalNum) || principalNum < 1 || principalNum > 26) {
                await this.sendMessage('❌ Número de principal inválido. Usa un número entre 1 y 26.', chatId);
                return;
            }

            // Get user info
            const message = await this.sendMessage('📤 Enviando reporte a Discord...', chatId);

            // Load current status if available
            let estadoActual = 'No disponible';
            try {
                const dataPath = path.join(__dirname, 'data.json');
                const data = JSON.parse(await fsPromises.readFile(dataPath, 'utf-8'));
                const today = new Date().toISOString().split('T')[0];
                const todayData = data[today] || {};

                // Find the principal's current status
                for (const key in todayData) {
                    if (todayData[key].phone === principalNum) {
                        const status = todayData[key].status;
                        const statusMap = {
                            'activo': '✅ Activo',
                            'desconectado': '🔴 Desconectado',
                            'crm': '⚠️ En CRM',
                            'server': '🔧 En Server',
                            'none': '⚪ Sin chequear'
                        };
                        estadoActual = statusMap[status] || status;
                        break;
                    }
                }
            } catch (error) {
                console.log('No se pudo cargar el estado actual');
            }

            // Format timestamp
            const now = new Date();
            const timestamp = now.toLocaleString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            // Create Discord embed
            const embed = {
                title: '🚨 REPORTE DE PRINCIPAL',
                color: 0xFF6B6B, // Red color
                fields: [
                    {
                        name: '📱 Principal',
                        value: `#${principalNum}`,
                        inline: true
                    },
                    {
                        name: '📊 Estado Actual',
                        value: estadoActual,
                        inline: true
                    },
                    {
                        name: '📝 Reporte',
                        value: mensaje,
                        inline: false
                    },
                    {
                        name: '👤 Reportado por',
                        value: 'Telegram',
                        inline: true
                    },
                    {
                        name: '🕐 Hora',
                        value: timestamp,
                        inline: true
                    }
                ],
                footer: {
                    text: 'Control de Principales - Reporte desde Telegram'
                },
                timestamp: now.toISOString()
            };

            // Send to Discord
            require('dotenv').config();
            const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

            if (!webhookUrl) {
                await this.sendMessage('❌ Discord webhook no configurado.', chatId);
                return;
            }

            await axios.post(webhookUrl, {
                embeds: [embed]
            });

            // Save report locally
            await this.saveActiveReport({
                principal: principalNum,
                mensaje: mensaje,
                estado: estadoActual,
                timestamp: timestamp,
                user: 'Telegram'
            });

            await this.sendMessage(`✅ Reporte del Principal #${principalNum} enviado a Discord y guardado correctamente.`, chatId);

        } catch (error) {
            console.error('Error in handleReporteCommand:', error);
            await this.sendMessage('❌ Error al enviar el reporte. Intenta nuevamente.', chatId);
        }
    }

    // Save report to active-reports.json
    async saveActiveReport(reportData) {
        try {
            const data = await fsPromises.readFile(this.reportsFile, 'utf-8');
            const reports = JSON.parse(data);
            reports.push({
                id: Date.now(),
                ...reportData
            });
            await fsPromises.writeFile(this.reportsFile, JSON.stringify(reports, null, 2));
        } catch (error) {
            console.error('Error saving active report:', error);
        }
    }

    // Handle /ver_reportes command
    async handleVerReportesCommand(chatId) {
        try {
            const data = await fsPromises.readFile(this.reportsFile, 'utf-8');
            const reports = JSON.parse(data);

            if (reports.length === 0) {
                await this.sendMessage('📋 No hay reportes activos registrados.', chatId);
                return;
            }

            let message = '📋 <b>Lista de Reportes Activos:</b>\n\n';
            reports.forEach((r, index) => {
                const timeStr = new Date(r.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                message += `<b>${index + 1}. Principal #${r.principal}</b>\n`;
                message += `   🔸 Estado: ${r.estado}\n`;
                message += `   📝 ${r.mensaje}\n`;
                message += `   🕒 ${timeStr}\n\n`;
            });

            await this.sendMessage(message, chatId);
        } catch (error) {
            console.error('Error in handleVerReportesCommand:', error);
            await this.sendMessage('❌ Error al leer los reportes.', chatId);
        }
    }

    // Handle /limpiar_reportes command
    async handleLimpiarReportesCommand(chatId) {
        try {
            await fsPromises.writeFile(this.reportsFile, JSON.stringify([]));
            await this.sendMessage('🗑️ Todos los reportes han sido borrados correctamente.', chatId);
        } catch (error) {
            console.error('Error in handleLimpiarReportesCommand:', error);
            await this.sendMessage('❌ Error al borrar los reportes.', chatId);
        }
    }

    // Handle /cambiar command
    async handleCambiarCommand(args, chatId) {
        try {
            const principalNum = parseInt(args[0]);
            const status = args[1].toLowerCase();
            const mensaje = args.slice(2).join(' ');

            // Validate principal number
            if (isNaN(principalNum) || principalNum < 1 || principalNum > 26) {
                await this.sendMessage('❌ Número de principal inválido. Usa un número entre 1 y 26.', chatId);
                return;
            }

            // Validate status
            const validStatuses = ['activo', 'desconectado', 'crm', 'server'];
            if (!validStatuses.includes(status)) {
                await this.sendMessage('❌ Estado inválido. Usa: activo, desconectado, crm, o server', chatId);
                return;
            }

            // Read current data
            const fsPromises = require('fs').promises;
            const dataPath = path.join(__dirname, 'data', 'principales-tiempo-real.json');
            let data = {};

            try {
                const fileContent = await fsPromises.readFile(dataPath, 'utf-8');
                data = JSON.parse(fileContent);
            } catch (error) {
                // File doesn't exist or is empty, start with empty object
            }

            // Update principal
            data[principalNum] = {
                phone: principalNum,
                status,
                mensaje,
                updatedBy: 'Telegram',
                timestamp: new Date().toISOString()
            };

            // Save
            await fsPromises.writeFile(dataPath, JSON.stringify(data, null, 2));

            // Status emoji map
            const statusEmoji = {
                'activo': '✅',
                'desconectado': '🔴',
                'crm': '⚠️',
                'server': '🔧'
            };

            const emoji = statusEmoji[status] || '📱';
            const statusText = status.charAt(0).toUpperCase() + status.slice(1);

            let response = `${emoji} <b>Principal #${principalNum} actualizado</b>\n\n`;
            response += `Estado: ${statusText}`;
            if (mensaje) {
                response += `\nMensaje: ${mensaje}`;
            }

            await this.sendMessage(response, chatId);

        } catch (error) {
            console.error('Error in handleCambiarCommand:', error);
            await this.sendMessage('❌ Error al cambiar el estado. Intenta nuevamente.', chatId);
        }
    }

    // Handle /estado command
    async handleEstadoCommand(phone, chatId) {
        try {
            const fsPromises = require('fs').promises;
            const dataPath = path.join(__dirname, 'data', 'principales-tiempo-real.json');
            let data = {};

            try {
                const fileContent = await fsPromises.readFile(dataPath, 'utf-8');
                data = JSON.parse(fileContent);
            } catch (error) {
                // File doesn't exist or is empty
            }

            // If specific phone requested
            if (phone) {
                const principalNum = parseInt(phone);
                if (isNaN(principalNum) || principalNum < 1 || principalNum > 26) {
                    await this.sendMessage('❌ Número de principal inválido. Usa un número entre 1 y 26.', chatId);
                    return;
                }

                const principal = data[principalNum];
                if (!principal || principal.status === 'none') {
                    await this.sendMessage(`📱 <b>Principal #${principalNum}</b>\n\n⚪ Sin chequear`, chatId);
                    return;
                }

                const statusEmoji = {
                    'activo': '✅',
                    'desconectado': '🔴',
                    'crm': '⚠️',
                    'server': '🔧'
                };

                const emoji = statusEmoji[principal.status] || '📱';
                const statusText = principal.status.charAt(0).toUpperCase() + principal.status.slice(1);
                const timeAgo = this.getTimeAgo(principal.timestamp);

                let response = `📱 <b>Principal #${principalNum}</b>\n\n`;
                response += `${emoji} ${statusText}\n`;
                if (principal.mensaje) {
                    response += `💬 ${principal.mensaje}\n`;
                }
                response += `⏱️ ${timeAgo}\n`;
                response += `👤 Por: ${principal.updatedBy}`;

                await this.sendMessage(response, chatId);
                return;
            }

            // Show all principals
            const statusCount = { activo: 0, desconectado: 0, crm: 0, server: 0, none: 0 };

            // Count statuses
            for (let i = 1; i <= 26; i++) {
                const principal = data[i];
                if (principal && principal.status) {
                    statusCount[principal.status]++;
                } else {
                    statusCount.none++;
                }
            }

            let response = `🔴 <b>PRINCIPALES - TIEMPO REAL</b>\n\n`;
            response += `📊 <b>Resumen:</b>\n`;
            response += `✅ Activos: ${statusCount.activo}\n`;
            response += `🔴 Desconectados: ${statusCount.desconectado}\n`;
            response += `⚠️ En CRM: ${statusCount.crm}\n`;
            response += `🔧 En Server: ${statusCount.server}\n`;
            response += `⚪ Sin chequear: ${statusCount.none}\n\n`;

            // Show principals with issues (not activo or none)
            const problematicos = [];
            for (let i = 1; i <= 26; i++) {
                const principal = data[i];
                if (principal && principal.status && principal.status !== 'activo' && principal.status !== 'none') {
                    problematicos.push(principal);
                }
            }

            if (problematicos.length > 0) {
                response += `<b>⚠️ Principales con problemas:</b>\n`;
                problematicos.forEach(p => {
                    const statusEmoji = {
                        'desconectado': '🔴',
                        'crm': '⚠️',
                        'server': '🔧'
                    };
                    const emoji = statusEmoji[p.status] || '📱';
                    const timeAgo = this.getTimeAgo(p.timestamp);
                    response += `${emoji} #${p.phone} - ${p.status} (${timeAgo})\n`;
                });
            } else {
                response += `✅ <b>No hay principales con problemas</b>`;
            }

            await this.sendMessage(response, chatId);

        } catch (error) {
            console.error('Error in handleEstadoCommand:', error);
            await this.sendMessage('❌ Error al obtener el estado. Intenta nuevamente.', chatId);
        }
    }

    // Handle /limpiar command
    async handleLimpiarCommand(phone, chatId) {
        try {
            const principalNum = parseInt(phone);
            if (isNaN(principalNum) || principalNum < 1 || principalNum > 26) {
                await this.sendMessage('❌ Número de principal inválido. Usa un número entre 1 y 26.', chatId);
                return;
            }

            const fsPromises = require('fs').promises;
            const dataPath = path.join(__dirname, 'data', 'principales-tiempo-real.json');
            let data = {};

            try {
                const fileContent = await fsPromises.readFile(dataPath, 'utf-8');
                data = JSON.parse(fileContent);
            } catch (error) {
                // File doesn't exist or is empty
            }

            // Remove principal from data
            delete data[principalNum];

            // Save
            await fsPromises.writeFile(dataPath, JSON.stringify(data, null, 2));

            await this.sendMessage(`🧹 <b>Principal #${principalNum} limpiado</b>\n\nEstado: ⚪ Sin chequear`, chatId);

        } catch (error) {
            console.error('Error in handleLimpiarCommand:', error);
            await this.sendMessage('❌ Error al limpiar el principal. Intenta nuevamente.', chatId);
        }
    }

    // Helper function to get time ago
    getTimeAgo(timestamp) {
        if (!timestamp) return 'nunca';

        const now = new Date();
        const then = new Date(timestamp);
        const diffMs = now - then;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'hace menos de 1 minuto';
        if (diffMins === 1) return 'hace 1 minuto';
        if (diffMins < 60) return `hace ${diffMins} minutos`;

        const diffHours = Math.floor(diffMins / 60);
        if (diffHours === 1) return 'hace 1 hora';
        if (diffHours < 24) return `hace ${diffHours} horas`;

        const diffDays = Math.floor(diffHours / 24);
        if (diffDays === 1) return 'hace 1 día';
        return `hace ${diffDays} días`;
    }

    // Send message to Telegram
    async sendMessage(text, chatId = null, replyToMessageId = null) {
        try {
            const targetChatId = chatId || this.chatId;
            const payload = {
                chat_id: targetChatId,
                text: text,
                parse_mode: 'HTML'
            };

            if (replyToMessageId) {
                payload.reply_to_message_id = replyToMessageId;
            }

            const response = await axios.post(`${this.baseUrl}/sendMessage`, payload);

            // Save sent message to history
            if (response.data.ok) {
                const message = response.data.result;
                let replyTo = null;

                if (message.reply_to_message) {
                    replyTo = {
                        messageId: message.reply_to_message.message_id,
                        from: message.reply_to_message.from.first_name || 'Bot',
                        text: message.reply_to_message.text || '[Archivo/Media]'
                    };
                }

                await this.saveMessage({
                    messageId: message.message_id,
                    from: 'Bot',
                    text: text,
                    replyTo: replyTo,
                    timestamp: new Date().toISOString(),
                    isBot: true
                });
            }

            return response.data;
        } catch (error) {
            console.error('Error sending message:', error.response?.data || error.message);
            throw error;
        }
    }

    // Send photo to Telegram
    async sendPhoto(photoPath, caption = '', chatId = null, replyToMessageId = null) {
        try {
            const targetChatId = chatId || this.chatId;
            const FormData = require('form-data');
            const form = new FormData();

            form.append('chat_id', targetChatId);
            form.append('photo', fs.createReadStream(photoPath));

            if (caption) {
                form.append('caption', caption);
                form.append('parse_mode', 'HTML');
            }

            if (replyToMessageId) {
                form.append('reply_to_message_id', replyToMessageId);
            }

            const response = await axios.post(`${this.baseUrl}/sendPhoto`, form, {
                headers: form.getHeaders()
            });

            if (response.data.ok) {
                const message = response.data.result;
                const photo = message.photo[message.photo.length - 1];
                const photoUrl = await this._downloadPhoto(photo);

                let replyTo = null;
                if (message.reply_to_message) {
                    replyTo = {
                        messageId: message.reply_to_message.message_id,
                        from: message.reply_to_message.from.first_name || 'Bot',
                        text: message.reply_to_message.text || '[Archivo/Media]'
                    };
                }

                await this.saveMessage({
                    messageId: message.message_id,
                    from: 'Bot',
                    text: caption || '📷 Foto',
                    photoUrl: photoUrl,
                    replyTo: replyTo,
                    timestamp: new Date().toISOString(),
                    isBot: true
                });
            }

            console.log('📷 Photo sent successfully');
            return response.data;
        } catch (error) {
            console.error('Error sending photo:', error.response?.data || error.message);
            throw error;
        }
    }

    // Send document to Telegram
    async sendDocument(documentPath, caption = '', chatId = null, replyToMessageId = null) {
        try {
            const targetChatId = chatId || this.chatId;
            const FormData = require('form-data');
            const form = new FormData();

            form.append('chat_id', targetChatId);
            form.append('document', fs.createReadStream(documentPath));

            if (caption) {
                form.append('caption', caption);
                form.append('parse_mode', 'HTML');
            }

            if (replyToMessageId) {
                form.append('reply_to_message_id', replyToMessageId);
            }

            const response = await axios.post(`${this.baseUrl}/sendDocument`, form, {
                headers: form.getHeaders()
            });

            if (response.data.ok) {
                const message = response.data.result;

                let replyTo = null;
                if (message.reply_to_message) {
                    replyTo = {
                        messageId: message.reply_to_message.message_id,
                        from: message.reply_to_message.from.first_name || 'Bot',
                        text: message.reply_to_message.text || '[Archivo/Media]'
                    };
                }

                await this.saveMessage({
                    messageId: message.message_id,
                    from: 'Bot',
                    text: caption || `📄 [Documento: ${message.document.file_name || 'archivo'}]`,
                    replyTo: replyTo,
                    timestamp: new Date().toISOString(),
                    isBot: true
                });
            }

            console.log('📄 Document sent successfully');
            return response.data;
        } catch (error) {
            console.error('Error sending document:', error.response?.data || error.message);
            throw error;
        }
    }

    // Helper to download photo from Telegram
    async _downloadPhoto(photo) {
        try {
            const fileInfo = await axios.get(`${this.baseUrl}/getFile`, {
                params: { file_id: photo.file_id }
            });

            if (fileInfo.data.ok) {
                const telegramFilePath = fileInfo.data.result.file_path;
                const fileUrl = `https://api.telegram.org/file/bot${this.token}/${telegramFilePath}`;

                console.log('📷 Downloading photo from Telegram...');
                const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });

                const uploadsDir = path.join(__dirname, 'public', 'uploads');
                try {
                    await fsPromises.mkdir(uploadsDir, { recursive: true });
                } catch (err) { }

                const fileName = `photo_${Date.now()}_${photo.file_id}.jpg`;
                const localFilePath = path.join(uploadsDir, fileName);

                await fsPromises.writeFile(localFilePath, response.data);
                return `/uploads/${fileName}`;
            }
        } catch (error) {
            console.error('Error in _downloadPhoto:', error.message);
        }
        return null;
    }

    // Save message to history
    async saveMessage(message) {
        try {
            const messagesPath = path.join(__dirname, 'data', 'messages.json');

            let messages = [];
            try {
                const data = await fsPromises.readFile(messagesPath, 'utf-8');
                messages = JSON.parse(data);
            } catch (error) {
                // File doesn't exist yet, start with empty array
                try {
                    await fsPromises.mkdir(path.dirname(messagesPath), { recursive: true });
                } catch (mkdirErr) {
                    // Directory might already exist
                }
            }

            messages.push(message);

            // Keep only last 100 messages
            if (messages.length > 100) {
                messages = messages.slice(-100);
            }

            await fsPromises.writeFile(messagesPath, JSON.stringify(messages, null, 2));
        } catch (error) {
            console.error('Error saving message:', error);
        }
    }

    // Get all messages
    async getMessages() {
        try {
            const messagesPath = path.join(__dirname, 'data', 'messages.json');
            const data = await fsPromises.readFile(messagesPath, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            return [];
        }
    }

    // Get new messages since timestamp
    async getNewMessages(since) {
        try {
            const messages = await this.getMessages();
            if (!since) return messages;

            return messages.filter(msg => new Date(msg.timestamp) > new Date(since));
        } catch (error) {
            return [];
        }
    }
}

module.exports = TelegramBot;

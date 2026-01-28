# 📱 Sistema de Control de Principales

Sistema web para monitorear el estado de 26 teléfonos principales a lo largo del día, con chequeos programados y reportes automáticos a Discord.

## 🌟 Características

- ✅ Monitoreo de 26 teléfonos principales
- 🕐 Chequeos por horarios (Mañana, Tarde, Noche)
- 📊 4 estados posibles: Activo, Desconectado, En CRM, En Server
- 📝 Sistema de notas y observaciones
- 📅 Filtro por fecha
- 💾 Persistencia de datos local y en servidor
- 📤 Envío de informes a Discord via webhook
- 🎨 Interfaz moderna con tema oscuro
- 📱 Diseño responsive

## 📋 Horarios de Chequeo

### 🌅 MAÑANA
- 6:30
- 8:00
- 10:00
- 12:00
- 14:00

### ☀️ TARDE
- 14:30
- 16:00
- 18:00
- 20:00
- 22:00

### 🌙 NOCHE
- 22:30
- 0:00
- 2:00
- 4:30
- 6:00

## 🚀 Instalación

### Requisitos Previos
- Node.js (versión 14 o superior)
- npm (incluido con Node.js)

### Pasos de Instalación

1. **Navegar al directorio del proyecto:**
```bash
cd "c:\Users\admin\Desktop\chequeos principales-discord-web"
```

2. **Instalar dependencias:**
```bash
npm install
```

3. **Configurar variables de entorno (opcional):**
```bash
copy .env.example .env
```
Edita el archivo `.env` y agrega tu webhook URL de Discord si deseas reportes automáticos.

4. **Iniciar el servidor:**
```bash
npm start
```

5. **Abrir en el navegador:**
```
http://localhost:3000
```

## 🔧 Configuración de Discord Webhook

### Obtener Webhook URL

1. Abre Discord y ve al servidor donde quieres recibir los reportes
2. Haz clic derecho en el canal deseado → **Editar Canal**
3. Ve a **Integraciones** → **Webhooks**
4. Haz clic en **Nuevo Webhook**
5. Personaliza el nombre y avatar (opcional)
6. Copia la **URL del Webhook**
7. Guarda los cambios

### Usar el Webhook

Cuando hagas clic en "Enviar Informe a Discord", el sistema te pedirá la URL del webhook. Pégala y el informe se enviará automáticamente.

## 📖 Uso

### Realizar un Chequeo

1. Selecciona la fecha en el filtro (por defecto es hoy)
2. Haz clic en cualquier teléfono en el horario correspondiente
3. Selecciona el estado del teléfono:
   - ✅ **Activo**: El teléfono está funcionando correctamente
   - ❌ **Desconectado**: El teléfono está desconectado
   - ⚠️ **En CRM**: El teléfono está en el sistema CRM
   - 🔧 **En Server**: El teléfono está en el servidor
4. El estado se guardará automáticamente

### Agregar Notas

1. Escribe observaciones en el área de "Notas y Observaciones"
2. Haz clic en "Guardar Notas"
3. Las notas se asociarán con la fecha seleccionada

### Enviar Informe a Discord

1. Completa los chequeos del día
2. Agrega notas si es necesario
3. Haz clic en "Enviar Informe a Discord"
4. Ingresa la URL del webhook
5. El informe se enviará automáticamente

### Formato del Informe

El informe incluye:
- Fecha del control
- Estado de cada teléfono por período (Mañana, Tarde, Noche)
- Resumen de chequeos realizados
- Notas y observaciones del día

## 🗂️ Estructura del Proyecto

```
chequeos principales-discord-web/
├── index.html          # Interfaz principal
├── styles.css          # Estilos y diseño
├── app.js             # Lógica del frontend
├── server.js          # Servidor backend
├── package.json       # Dependencias del proyecto
├── data.json          # Almacenamiento de datos (se crea automáticamente)
├── .env.example       # Plantilla de variables de entorno
├── .gitignore         # Archivos ignorados por Git
└── README.md          # Esta documentación
```

## 💾 Almacenamiento de Datos

El sistema utiliza dos métodos de almacenamiento:

1. **LocalStorage (Frontend)**: Los datos se guardan en el navegador para acceso rápido y funcionamiento offline
2. **Archivo JSON (Backend)**: Los datos se persisten en `data.json` en el servidor

## 🔄 Reportes Automáticos (Opcional)

Para habilitar reportes automáticos diarios:

1. Configura `DISCORD_WEBHOOK_URL` en el archivo `.env`
2. Descomenta las líneas de código en `server.js` (líneas 115-123)
3. Reinicia el servidor

El sistema enviará un reporte automático todos los días a las 23:00.

## 🎨 Personalización

### Cambiar Horarios de Chequeo

Edita el objeto `TIME_SLOTS` en `app.js`:

```javascript
const TIME_SLOTS = {
    morning: ['0630', '0800', '1000', '1200', '1400'],
    afternoon: ['1430', '1600', '1800', '2000', '2200'],
    night: ['2230', '0000', '0200', '0430', '0600']
};
```

### Cambiar Número de Teléfonos

Modifica la constante `TOTAL_PHONES` en `app.js`:

```javascript
const TOTAL_PHONES = 26; // Cambia este número
```

### Personalizar Colores

Edita las variables CSS en `styles.css`:

```css
:root {
    --morning-primary: #4ade80;
    --afternoon-primary: #fb923c;
    --night-primary: #60a5fa;
    /* ... más colores */
}
```

## 🐛 Solución de Problemas

### El servidor no inicia
- Verifica que Node.js esté instalado: `node --version`
- Asegúrate de haber ejecutado `npm install`
- Verifica que el puerto 3000 no esté en uso

### Los datos no se guardan
- Verifica que el servidor esté corriendo
- Revisa la consola del navegador para errores
- Asegúrate de tener permisos de escritura en el directorio

### El webhook de Discord no funciona
- Verifica que la URL del webhook sea correcta
- Asegúrate de que el webhook esté activo en Discord
- Revisa la consola del navegador para errores

## 📝 Notas Técnicas

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Node.js, Express.js
- **Almacenamiento**: LocalStorage + JSON file
- **Notificaciones**: Discord Webhooks
- **Diseño**: Responsive, Mobile-friendly

## 🔒 Seguridad

- No compartas tu URL de webhook públicamente
- El archivo `.env` está en `.gitignore` para proteger credenciales
- Los datos se almacenan localmente en el servidor

## 📄 Licencia

MIT License - Uso libre para proyectos personales y comerciales.

---

**Desarrollado con ❤️ para el control eficiente de principales**

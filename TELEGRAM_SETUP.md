# Cómo configurar el Bot de Telegram

## Paso 1: Crear un Bot de Telegram

1. Abre Telegram y busca **@BotFather**
2. Envía el comando `/newbot`
3. Sigue las instrucciones:
   - Elige un nombre para tu bot (ej: "Control Principales Bot")
   - Elige un username (debe terminar en 'bot', ej: "control_principales_bot")
4. BotFather te dará un **token**. Guárdalo, lo necesitarás.

## Paso 2: Obtener tu Chat ID

### Opción A: Usando un bot helper
1. Busca **@userinfobot** en Telegram
2. Envíale cualquier mensaje
3. Te responderá con tu **Chat ID**

### Opción B: Crear un grupo
1. Crea un grupo en Telegram
2. Agrega tu bot al grupo
3. Envía un mensaje en el grupo
4. Visita: `https://api.telegram.org/bot<TU_TOKEN>/getUpdates`
5. Busca el campo `"chat":{"id":` - ese es tu Chat ID

## Paso 3: Configurar el archivo .env

Abre el archivo `.env` y reemplaza:

```env
TELEGRAM_BOT_TOKEN=tu_token_aqui
TELEGRAM_CHAT_ID=tu_chat_id_aqui
```

### Ejemplo:
```env
TELEGRAM_BOT_TOKEN=7123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw
TELEGRAM_CHAT_ID=123456789
```

## Paso 4: Reiniciar el servidor

1. Detén el servidor (Ctrl+C en la terminal)
2. Ejecuta `npm start` de nuevo

## ¡Listo!

Ahora cuando envíes un informe, se enviará automáticamente a:
- ✅ Discord (si está configurado)
- ✅ Telegram (si está configurado)

Si solo uno está configurado, funcionará solo con ese.

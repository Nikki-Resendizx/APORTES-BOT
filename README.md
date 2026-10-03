# APORTES-BOT

Bot de Telegram para recibir aportes y entregarlos a uno o varios administradores.

## Render

**Build Command**
```
npm install
```

**Start Command**
```
npm start
```

## Variables de entorno

Configura en Render:

```
BOT_TOKEN=TOKEN_DEL_BOT
ADMIN_IDS=123456789,987654321
ADMIN_CHAT_ID=
```

- `BOT_TOKEN`: token entregado por BotFather.
- `ADMIN_IDS`: IDs de administradores separados por comas.
- `ADMIN_CHAT_ID`: opcional; chat, grupo o canal adicional de recepción.

## Funciones

- /start
- /help
- /cancel
- Menú principal con botones inline
- Envío de texto
- Envío de fotos
- Envío de videos
- Envío de documentos
- Envío de audio
- Envío de notas de voz
- Identificación básica del usuario
- Varios administradores
- Cancelación de operaciones
- Manejo de errores
- Telegram file_id para multimedia
- Sin Firebase
- Sin base de datos innecesaria
- Estado temporal en memoria

## Estructura

```
APORTES-BOT/
├── src/
│   └── bot.js
├── package.json
├── README.md
└── .gitignore
```

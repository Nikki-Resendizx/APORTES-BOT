# APORTES-BOT

Bot de contacto Telegram y plataforma multi-bot.

## Infraestructura
- Hosting: FadeHost
- Node.js >=20
- Telegram Topics/Temas como centro de atención
- Sin Firebase ni base de datos externa
- Estado local en `data/state.json`

## Variables de entorno
- `BOT_TOKEN`: token del bot principal.
- `STORE_CHAT_ID`: ID del grupo de foro principal.
- `ADMIN_IDS`: IDs de administradores separados por coma.
- `TIMEZONE`: opcional; por defecto `America/Mexico_City`.
- `PREMIUM_1M_STARS`: precio Premium de 1 mes en Telegram Stars; defecto 100.
- `PREMIUM_3M_STARS`: precio Premium de 3 meses; defecto 250.
- `PREMIUM_12M_STARS`: precio Premium de 1 año; defecto 800.
- `RESET_USER_REGISTRY`: limpieza inicial de registros; usar solo temporalmente.

## Crear clones desde Telegram

Cualquier usuario puede usar `/crearbot`.

1. Crear un bot con @BotFather.
2. Enviar el BOT TOKEN al APORTES-BOT.
3. El sistema valida el token con Telegram.
4. El clon se inicia automáticamente.
5. Añadir el clon como administrador de un grupo con Topics.
6. Escribir `/vincular` dentro del grupo.
7. Ese grupo queda como STORE del clon.

Cada clon tiene aislamiento lógico de:
- propietario
- token
- grupo de Topics
- usuarios
- temas
- baneos
- estado

El plan FREE incluye 1 bot. Los bots adicionales requieren Premium.

## Premium

El sistema incluye:
- Plan FREE / PREMIUM
- Suscripciones mediante Telegram Stars
- Vencimiento automático
- Códigos promocionales
- Otorgamiento manual por administrador

Comandos de administración:
- `/premiumgrant ID DIAS`
- `/promocode CODIGO DIAS USOS`

Comandos de usuario:
- `/premium`
- `/crearbot`

## Puesta en marcha

1. Crear un grupo de Telegram con Topics/Temas.
2. Añadir el bot principal como administrador con permisos para gestionar temas y enviar mensajes.
3. Configurar las variables de entorno.
4. Ejecutar `npm start`.

El contenido de las conversaciones no se almacena en una base externa. El estado mínimo se mantiene localmente.

# APORTES-BOT

Bot de contacto Telegram.

## Variables de entorno
- BOT_TOKEN: token de BotFather.
- STORE_CHAT_ID: ID del grupo de foro donde se crean los temas.
- ADMIN_IDS: IDs de administradores separados por coma.
- TIMEZONE: opcional; por defecto America/Mexico_City.

## Puesta en marcha
1. Crear un grupo de Telegram con Topics/Temas.
2. Añadir el bot como administrador con permisos para gestionar temas y enviar mensajes.
3. Obtener el ID del grupo y configurarlo como STORE_CHAT_ID.
4. Configurar BOT_TOKEN y ADMIN_IDS en el hosting.
5. Ejecutar npm start.

No se guarda el contenido de las conversaciones en una base de datos externa. El estado mínimo usuario -> tema se mantiene en data/state.json.

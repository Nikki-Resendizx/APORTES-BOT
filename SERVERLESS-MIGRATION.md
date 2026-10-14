# APORTES-BOT — Telegram Serverless migration

This branch is a separate migration workspace. The existing `main` branch and FadeHost version are intentionally unchanged.

## Important status

This is the migration foundation, **not yet a complete replacement** for the existing bot. Do not switch the bot over until every feature is ported and tested.

Telegram Serverless runs JavaScript modules in an isolated V8 runtime. It does not provide Node.js filesystem access, `process.env`, or arbitrary npm packages. The existing Telegraf process and `data/state.json` therefore cannot be copied as-is. Runtime code belongs under `tgcloud/` and uses `sdk`, `sdk/db`, and relative imports ending in `.js`.

## Existing features to port and test

- Private /start welcome, configurable welcome media/text/buttons, /help, /info, /status and /cancel.
- One forum topic per user, registration/profile card and profile photo.
- Private-message to forum-topic routing, preserving forwarded messages and albums.
- Forum-topic replies back to the matching private user.
- Admin callbacks for ban/unban/info and configurable registration buttons.
- Admin menus, editable command texts/templates, quick responses, welcome editor, preview and deletion.
- Empty-topic cleanup without deleting topics that have active conversations.
- Migration of users, bans, welcome configuration, templates, buttons and quick responses.

## Configuration required before deployment

Edit `tgcloud/lib/config.js` and set:
- `STORE_CHAT_ID`: numeric ID of the forum group.
- `ADMIN_IDS`: array of numeric Telegram user IDs.

Do not put the regular BotFather HTTP API token or Serverless CLI access token in source control. Serverless handlers call Telegram through the built-in SDK.

## Database

`tgcloud/schema.js` declares persistent tables for user/topic mappings, settings, bans and album batching. Deploying code does not itself apply schema changes; review and run the database migration separately.

## CLI workflow

On a computer with Node.js 18+:
1. Obtain the **Serverless CLI Access token** in @BotFather → your bot → Serverless → CLI Access. It is different from the normal bot token.
2. Install/use the official CLI documented at https://blogfork.telegram.org/bots/serverless.
3. Link this project with `npx tgcloud login`.
4. Run `npx tgcloud status` and `npx tgcloud diff`.
5. Validate handlers with `npx tgcloud run`.
6. Deploy modules with `npx tgcloud push`.
7. Review schema changes and apply them with `npx tgcloud migrate`.

Do not run `push` from a folder that does not contain the intended complete `tgcloud/` tree: the deployed module set mirrors that folder, and omitted deployed modules may be removed.

## Cutover checklist

- Export the current `data/state.json` from the old host if it is still accessible. Never overwrite it with an empty file.
- Import the existing user-to-topic mappings and settings into Serverless before cutover.
- Test the bot using the same Telegram bot identity, group and topic IDs.
- Ensure only one runtime processes updates at a time to avoid duplicate replies/topics.
- Keep the old state export and source branch until the Serverless version passes acceptance tests.

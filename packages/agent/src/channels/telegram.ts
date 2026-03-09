import fs from 'fs';
import path from 'path';

import { Bot, InputFile } from 'grammy';

import { ASSISTANT_NAME, TRIGGER_PATTERN, GROUPS_DIR } from '../config.js';
import { readEnvFile } from '../env.js';
import { logger } from '../logger.js';
import { registerChannel, ChannelOpts } from './registry.js';
import {
  Channel,
  OnChatMetadata,
  OnInboundMessage,
  RegisteredGroup,
} from '../types.js';

// --- Don Claudio Middleware ---

const COOLDOWN_MS = 30_000;
const MAX_MESSAGES = 100;
const MAX_MESSAGE_LENGTH = 2000;

interface UserState {
  messageCount: number;
  lastMessageAt: number;
}

const userStates = new Map<string, UserState>();

function checkRateLimit(userId: string): { allowed: boolean; reply?: string } {
  const now = Date.now();
  let state = userStates.get(userId);
  if (!state) {
    state = { messageCount: 0, lastMessageAt: 0 };
    userStates.set(userId, state);
  }

  if (state.messageCount >= MAX_MESSAGES) {
    return { allowed: false, reply: 'Se te acabaron los mensajes, che. 100 intentos y el fuego sigue firme. \u{1F525}' };
  }

  const elapsed = now - state.lastMessageAt;
  if (elapsed < COOLDOWN_MS) {
    const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
    return { allowed: false, reply: `Tranquilo, che. Dej\u{00E1} que las brasas respiren. Volv\u{00E9} en ${remaining} segundos.` };
  }

  state.messageCount++;
  state.lastMessageAt = now;
  return { allowed: true };
}

const INJECTION_MARKERS = [
  '<system>', '</system>', '<|system|>', '<|im_start|>', '<|im_end|>',
  '[INST]', '[/INST]', '<<SYS>>', '<</SYS>>', '###System', '### System',
  '###Instruction', '### Instruction',
  'ADMIN:', 'SYSTEM:', 'DEVELOPER:', 'ANTHROPIC:', 'OVERRIDE:', 'ROOT:', 'SUDO:',
  '```system', '```instruction', '<system-prompt>', '</system-prompt>',
  '<instructions>', '</instructions>',
];

function sanitizeInput(input: string): { ok: boolean; message: string; reply?: string } {
  if (input.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, message: '', reply: 'Message too long. Keep it under 2000 characters, che.' };
  }
  if (input.trim().length === 0) {
    return { ok: false, message: '' };
  }

  let cleaned = input;
  for (const marker of INJECTION_MARKERS) {
    const regex = new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    cleaned = cleaned.replace(regex, '');
  }

  // Reject long base64/hex blocks (but allow ETH addresses which are 42 chars)
  const words = cleaned.split(/\s+/);
  const suspiciousEncoded = words.some(
    (w) => (/^[A-Za-z0-9+/]{50,}={0,2}$/.test(w)) || (/^(0x)?[0-9a-fA-F]{43,}$/.test(w))
  );
  if (suspiciousEncoded) {
    return { ok: false, message: '', reply: 'No me mandes c\u{00F3}digos raros, che. Hablame en criollo.' };
  }

  return { ok: true, message: cleaned.trim() };
}

const CANARY_STRINGS = [
  'CANARY_FUEGO_SAGRADO_7x9k',
  'CANARY_DON_CLAUDIO_MINT_q3m2',
  'CANARY_SYSTEM_LEAK_p8w1',
];

function checkOutputForCanaries(text: string): string | null {
  for (const canary of CANARY_STRINGS) {
    if (text.includes(canary)) {
      return 'Epa, algo se me quem\u{00F3}. Volv\u{00E9} a preguntar, che.';
    }
  }
  return null;
}

export interface TelegramChannelOpts {
  onMessage: OnInboundMessage;
  onChatMetadata: OnChatMetadata;
  registeredGroups: () => Record<string, RegisteredGroup>;
  onRegisterGroup: (jid: string, group: RegisteredGroup) => void;
}

export class TelegramChannel implements Channel {
  name = 'telegram';

  private bot: Bot | null = null;
  private opts: TelegramChannelOpts;
  private botToken: string;

  constructor(botToken: string, opts: TelegramChannelOpts) {
    this.botToken = botToken;
    this.opts = opts;
  }

  async connect(): Promise<void> {
    this.bot = new Bot(this.botToken);

    // Command to get chat ID (useful for registration)
    this.bot.command('chatid', (ctx) => {
      const chatId = ctx.chat.id;
      const chatType = ctx.chat.type;
      const chatName =
        chatType === 'private'
          ? ctx.from?.first_name || 'Private'
          : (ctx.chat as any).title || 'Unknown';

      ctx.reply(
        `Chat ID: \`tg:${chatId}\`\nName: ${chatName}\nType: ${chatType}`,
        { parse_mode: 'Markdown' },
      );
    });

    // Command to check bot status
    this.bot.command('ping', (ctx) => {
      ctx.reply(`${ASSISTANT_NAME} is online.`);
    });

    this.bot.on('message:text', async (ctx) => {
      // Skip commands
      if (ctx.message.text.startsWith('/')) return;

      const chatJid = `tg:${ctx.chat.id}`;
      let content = ctx.message.text;
      const timestamp = new Date(ctx.message.date * 1000).toISOString();
      const senderName =
        ctx.from?.first_name ||
        ctx.from?.username ||
        ctx.from?.id.toString() ||
        'Unknown';
      const sender = ctx.from?.id.toString() || '';
      const msgId = ctx.message.message_id.toString();

      // Don Claudio middleware: rate limit (disabled for testing)
      // const rateResult = checkRateLimit(sender);
      // if (!rateResult.allowed) {
      //   ctx.reply(rateResult.reply!);
      //   return;
      // }

      // Don Claudio middleware: sanitize input
      const sanitizeResult = sanitizeInput(content);
      if (!sanitizeResult.ok) {
        if (sanitizeResult.reply) ctx.reply(sanitizeResult.reply);
        return;
      }
      content = sanitizeResult.message;

      // Determine chat name
      const chatName =
        ctx.chat.type === 'private'
          ? senderName
          : (ctx.chat as any).title || chatJid;

      // Translate Telegram @bot_username mentions into TRIGGER_PATTERN format.
      // Telegram @mentions (e.g., @andy_ai_bot) won't match TRIGGER_PATTERN
      // (e.g., ^@Andy\b), so we prepend the trigger when the bot is @mentioned.
      const botUsername = ctx.me?.username?.toLowerCase();
      if (botUsername) {
        const entities = ctx.message.entities || [];
        const isBotMentioned = entities.some((entity) => {
          if (entity.type === 'mention') {
            const mentionText = content
              .substring(entity.offset, entity.offset + entity.length)
              .toLowerCase();
            return mentionText === `@${botUsername}`;
          }
          return false;
        });
        if (isBotMentioned && !TRIGGER_PATTERN.test(content)) {
          content = `@${ASSISTANT_NAME} ${content}`;
        }
      }

      // Store chat metadata for discovery
      const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
      this.opts.onChatMetadata(chatJid, timestamp, chatName, 'telegram', isGroup);

      // Auto-register private chats (Don Claudio responds to anyone who DMs)
      let group = this.opts.registeredGroups()[chatJid];
      if (!group) {
        if (ctx.chat.type === 'private') {
          // Each user gets a unique folder so they have isolated IPC and sessions.
          // The CLAUDE.md is symlinked from the don-claudio template folder.
          const userId = ctx.from?.id?.toString() || ctx.chat.id.toString();
          const userFolder = `dc-${userId}`;
          const userFolderPath = path.join(GROUPS_DIR, userFolder);
          const templateClaudeMd = path.join(GROUPS_DIR, 'don-claudio', 'CLAUDE.md');

          if (!fs.existsSync(userFolderPath)) {
            fs.mkdirSync(path.join(userFolderPath, 'logs'), { recursive: true });
            // Symlink CLAUDE.md from template so all users share the same personality
            if (fs.existsSync(templateClaudeMd)) {
              fs.symlinkSync(templateClaudeMd, path.join(userFolderPath, 'CLAUDE.md'));
            }
          }

          const newGroup: RegisteredGroup = {
            name: chatName,
            folder: userFolder,
            trigger: `@${ASSISTANT_NAME}`,
            added_at: new Date().toISOString(),
            requiresTrigger: false,
          };
          this.opts.onRegisterGroup(chatJid, newGroup);
          group = newGroup;
          logger.info({ chatJid, chatName, folder: userFolder }, 'Auto-registered private Telegram chat');
        } else {
          logger.debug(
            { chatJid, chatName },
            'Message from unregistered Telegram group',
          );
          return;
        }
      }

      // Deliver message — startMessageLoop() will pick it up
      this.opts.onMessage(chatJid, {
        id: msgId,
        chat_jid: chatJid,
        sender,
        sender_name: senderName,
        content,
        timestamp,
        is_from_me: false,
      });

      logger.info(
        { chatJid, chatName, sender: senderName },
        'Telegram message stored',
      );
    });

    // Handle non-text messages with placeholders so the agent knows something was sent
    const storeNonText = (ctx: any, placeholder: string) => {
      const chatJid = `tg:${ctx.chat.id}`;
      const group = this.opts.registeredGroups()[chatJid];
      if (!group) return;

      const timestamp = new Date(ctx.message.date * 1000).toISOString();
      const senderName =
        ctx.from?.first_name ||
        ctx.from?.username ||
        ctx.from?.id?.toString() ||
        'Unknown';
      const caption = ctx.message.caption ? ` ${ctx.message.caption}` : '';

      const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
      this.opts.onChatMetadata(chatJid, timestamp, undefined, 'telegram', isGroup);
      this.opts.onMessage(chatJid, {
        id: ctx.message.message_id.toString(),
        chat_jid: chatJid,
        sender: ctx.from?.id?.toString() || '',
        sender_name: senderName,
        content: `${placeholder}${caption}`,
        timestamp,
        is_from_me: false,
      });
    };

    this.bot.on('message:photo', (ctx) => storeNonText(ctx, '[Photo]'));
    this.bot.on('message:video', (ctx) => storeNonText(ctx, '[Video]'));
    this.bot.on('message:voice', (ctx) =>
      storeNonText(ctx, '[Voice message]'),
    );
    this.bot.on('message:audio', (ctx) => storeNonText(ctx, '[Audio]'));
    this.bot.on('message:document', (ctx) => {
      const name = ctx.message.document?.file_name || 'file';
      storeNonText(ctx, `[Document: ${name}]`);
    });
    this.bot.on('message:sticker', (ctx) => {
      const emoji = ctx.message.sticker?.emoji || '';
      storeNonText(ctx, `[Sticker ${emoji}]`);
    });
    this.bot.on('message:location', (ctx) => storeNonText(ctx, '[Location]'));
    this.bot.on('message:contact', (ctx) => storeNonText(ctx, '[Contact]'));

    // Handle errors gracefully
    this.bot.catch((err) => {
      logger.error({ err: err.message }, 'Telegram bot error');
    });

    // Set bot profile photo if avatar file exists
    const avatarPath = path.join(GROUPS_DIR, 'don-claudio', 'avatar.png');
    if (fs.existsSync(avatarPath)) {
      try {
        await this.bot.api.setMyProfilePhoto({
          type: 'static',
          photo: new InputFile(avatarPath),
        });
        logger.info('Bot profile photo set');
      } catch (err) {
        logger.debug({ err }, 'Could not set bot profile photo (may already be set)');
      }
    }

    // Start polling — returns a Promise that resolves when started
    return new Promise<void>((resolve) => {
      this.bot!.start({
        onStart: (botInfo) => {
          logger.info(
            { username: botInfo.username, id: botInfo.id },
            'Telegram bot connected',
          );
          console.log(`\n  Telegram bot: @${botInfo.username}`);
          console.log(
            `  Send /chatid to the bot to get a chat's registration ID\n`,
          );
          resolve();
        },
      });
    });
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    if (!this.bot) {
      logger.warn('Telegram bot not initialized');
      return;
    }

    try {
      // Don Claudio middleware: check for canary leaks
      const canaryReplace = checkOutputForCanaries(text);
      if (canaryReplace) {
        text = canaryReplace;
      }

      const numericId = jid.replace(/^tg:/, '');

      // Telegram has a 4096 character limit per message — split if needed
      const MAX_LENGTH = 4096;
      if (text.length <= MAX_LENGTH) {
        await this.bot.api.sendMessage(numericId, text);
      } else {
        for (let i = 0; i < text.length; i += MAX_LENGTH) {
          await this.bot.api.sendMessage(
            numericId,
            text.slice(i, i + MAX_LENGTH),
          );
        }
      }
      logger.info({ jid, length: text.length }, 'Telegram message sent');
    } catch (err) {
      logger.error({ jid, err }, 'Failed to send Telegram message');
    }
  }

  isConnected(): boolean {
    return this.bot !== null;
  }

  ownsJid(jid: string): boolean {
    return jid.startsWith('tg:');
  }

  async disconnect(): Promise<void> {
    if (this.bot) {
      this.bot.stop();
      this.bot = null;
      logger.info('Telegram bot stopped');
    }
  }

  async setTyping(jid: string, isTyping: boolean): Promise<void> {
    if (!this.bot || !isTyping) return;
    try {
      const numericId = jid.replace(/^tg:/, '');
      await this.bot.api.sendChatAction(numericId, 'typing');
    } catch (err) {
      logger.debug({ jid, err }, 'Failed to send Telegram typing indicator');
    }
  }
}

registerChannel('telegram', (opts: ChannelOpts) => {
  const envVars = readEnvFile(['TELEGRAM_BOT_TOKEN']);
  const token =
    process.env.TELEGRAM_BOT_TOKEN || envVars.TELEGRAM_BOT_TOKEN || '';
  if (!token) {
    logger.warn('Telegram: TELEGRAM_BOT_TOKEN not set');
    return null;
  }
  return new TelegramChannel(token, opts);
});

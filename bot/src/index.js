import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import Redis from "ioredis";
import { Telegraf, Markup } from "telegraf";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

const botToken = process.env.BOT_TOKEN;
const botMode = (process.env.BOT_MODE || "polling").toLowerCase();
const botPort = Number(process.env.BOT_PORT) || 7001;
const botWebhookPath = process.env.BOT_WEBHOOK_PATH || "/telegram/webhook";
const botWebhookUrl = (process.env.BOT_WEBHOOK_URL || "").replace(/\/$/, "");
const openAiApiKey = process.env.OPENAI_API_KEY || "";
const openAiModel = process.env.OPENAI_MODEL || "gpt-4o-mini";
const memoryWindowSize = Math.max(4, Number(process.env.BOT_MEMORY_WINDOW) || 12);

if (!botToken) {
  throw new Error("BOT_TOKEN is required to start the Telegram bot");
}

mongoose.set("strictQuery", true);

const chatStateSchema = new mongoose.Schema(
  {
    chatId: { type: String, unique: true, index: true, required: true },
    title: { type: String, default: "" },
    type: { type: String, default: "private" },
    memory: {
      type: [
        {
          senderId: String,
          senderName: String,
          role: { type: String, enum: ["user", "assistant", "system"], default: "user" },
          kind: { type: String, default: "text" },
          content: { type: String, default: "" },
          extra: { type: mongoose.Schema.Types.Mixed, default: {} },
          createdAt: { type: Date, default: Date.now }
        }
      ],
      default: []
    },
    flow: {
      name: { type: String, default: "" },
      step: { type: String, default: "" },
      data: { type: mongoose.Schema.Types.Mixed, default: {} }
    },
    settings: {
      welcomeMessage: { type: String, default: "Welcome, {name}. Use /help to see what I can do." },
      antiSpamEnabled: { type: Boolean, default: true },
      replyKeyboardEnabled: { type: Boolean, default: true },
      permissionLevel: { type: String, default: "user" }
    },
    roles: {
      type: [
        {
          userId: String,
          role: { type: String, enum: ["user", "moderator", "admin"], default: "user" }
        }
      ],
      default: []
    }
  },
  { timestamps: true }
);

const reminderSchema = new mongoose.Schema(
  {
    chatId: { type: String, index: true, required: true },
    userId: { type: String, index: true, required: true },
    text: { type: String, required: true },
    runAt: { type: Date, index: true, required: true },
    status: { type: String, default: "pending", index: true },
    sourceMessageId: { type: String, default: "" }
  },
  { timestamps: true }
);

const ChatState = mongoose.model("ChatState", chatStateSchema);
const Reminder = mongoose.model("Reminder", reminderSchema);

const app = express();
app.disable("x-powered-by");
app.get("/healthz", (_, res) => res.json({ status: "ok", mode: botMode }));

const bot = new Telegraf(botToken);
const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    })
  : null;

const memoryText = (state) => {
  const recent = (state.memory || []).slice(-memoryWindowSize).filter((entry) => entry.content);
  if (!recent.length) return "No shared context yet.";
  return recent
    .map((entry, index) => `${index + 1}. ${entry.senderName || entry.senderId || "Someone"}: ${entry.content}`)
    .join("\n");
};

const trimText = (value, limit = 160) => {
  const text = String(value || "").trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1)}…`;
};

const splitArgs = (text = "") => {
  const parts = text.trim().split(/\s+/);
  return { command: parts.shift() || "", args: parts };
};

const parseDuration = (input = "") => {
  const durationPattern = /^(\d+)([smhd])$/i;
  const match = durationPattern.exec(String(input).trim());
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return amount * multipliers[unit];
};

const weatherCodeToText = (code) => {
  const map = {
    0: "Clear",
    1: "Mostly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Rime fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Dense drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    80: "Rain showers",
    81: "Heavy showers",
    82: "Violent showers",
    95: "Thunderstorm"
  };
  return map[code] || `Weather code ${code}`;
};

const getDisplayName = (user = {}) => {
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.join(" ") || user.username || `user:${user.id}`;
};

const getOrCreateState = async (ctx) => {
  const chatId = String(ctx.chat?.id || ctx.from?.id);
  const title = ctx.chat?.title || ctx.chat?.username || getDisplayName(ctx.from);
  const type = ctx.chat?.type || "private";
  return ChatState.findOneAndUpdate(
    { chatId },
    {
      $setOnInsert: {
        chatId,
        title,
        type
      },
      $set: {
        title,
        type,
        updatedAt: new Date()
      }
    },
    { upsert: true, new: true }
  );
};

const persistMemory = async (ctx, state, entry) => {
  state.memory = [...(state.memory || []), entry].slice(-20);
  state.updatedAt = new Date();
  await state.save();
  if (ctx.chat?.type === "private") {
    await state.populate?.();
  }
};

const updateFlow = async (state, flow) => {
  state.flow = flow;
  state.updatedAt = new Date();
  await state.save();
};

const updateSettings = async (state, patch) => {
  state.settings = { ...state.settings.toObject?.() || state.settings, ...patch };
  state.updatedAt = new Date();
  await state.save();
};

const upsertRole = async (state, userId, role) => {
  const roles = Array.isArray(state.roles) ? [...state.roles] : [];
  const existing = roles.find((item) => String(item.userId) === String(userId));
  if (existing) existing.role = role;
  else roles.push({ userId: String(userId), role });
  state.roles = roles;
  state.updatedAt = new Date();
  await state.save();
};

const getRole = (state, userId) => state.roles?.find((item) => String(item.userId) === String(userId))?.role || "user";

const isGroupChat = (ctx) => ["group", "supergroup"].includes(ctx.chat?.type);

const isTelegramAdmin = async (ctx, userId) => {
  if (!isGroupChat(ctx)) return true;
  const member = await ctx.telegram.getChatMember(ctx.chat.id, userId);
  return ["creator", "administrator"].includes(member?.status);
};

const isBotAdmin = async (ctx) => {
  if (!isGroupChat(ctx)) return true;
  const me = await ctx.telegram.getChatMember(ctx.chat.id, ctx.botInfo.id);
  return ["creator", "administrator"].includes(me?.status);
};

const canModerate = async (ctx, state) => {
  if (!isGroupChat(ctx)) return false;
  const telegramAdmin = await isTelegramAdmin(ctx, ctx.from.id);
  const customRole = ["moderator", "admin"].includes(getRole(state, ctx.from.id));
  return telegramAdmin || customRole;
};

const addMemoryTurn = async (ctx, state, role, content, kind = "text", extra = {}) => {
  await persistMemory(ctx, state, {
    senderId: String(ctx.from?.id || ""),
    senderName: getDisplayName(ctx.from),
    role,
    kind,
    content: trimText(content, 500),
    extra,
    createdAt: new Date()
  });
};

const callOpenAi = async (messages) => {
  if (!openAiApiKey) return null;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: openAiModel,
      messages,
      temperature: 0.5
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
};

const respondWithContext = async (ctx, state, promptText) => {
  const history = (state.memory || []).slice(-memoryWindowSize).map((entry) => ({
    role: entry.role === "assistant" ? "assistant" : "user",
    content: `${entry.senderName || entry.senderId}: ${entry.content}`
  }));

  const systemPrompt = {
    role: "system",
    content:
      "You are ChatWave's Telegram bot. Keep replies short, useful, and aware of the recent conversation window. If the user asks for a reminder or moderation action, explain the next step."
  };

  const aiReply = await callOpenAi([systemPrompt, ...history, { role: "user", content: promptText }]).catch(() => null);
  if (aiReply) return aiReply;

  const recent = memoryText(state);
  return [
    `I stored your message: ${trimText(promptText, 120)}`,
    `Recent context:\n${recent}`
  ].join("\n\n");
};

const helpText = [
  "Available commands:",
  "/start [payload] - start the bot or trigger a deep link flow",
  "/help - show this message",
  "/survey - guided conversation flow",
  "/ask - force-reply question flow",
  "/memory - show recent context window",
  "/reset - clear conversation memory",
  "/weather <city> - get current weather",
  "/news - fetch top tech/news headlines",
  "/ai <prompt> - ask the AI model when OPENAI_API_KEY is set",
  "/remind <10m|2h|1d> <text> - schedule a reminder",
  "/welcome <text> - set group welcome message",
  "/antispam on|off - toggle group spam filtering",
  "/role <userId> <user|moderator|admin> - set custom role",
  "/ban, /kick, /mute, /unmute - group moderation commands"
].join("\n");

const mainKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback("Survey", "menu:survey"), Markup.button.callback("Memory", "menu:memory")],
  [Markup.button.callback("Weather", "menu:weather"), Markup.button.callback("News", "menu:news")],
  [Markup.button.callback("Ask flow", "menu:ask"), Markup.button.callback("Help", "menu:help")]
]);

const privateReplyKeyboard = Markup.keyboard([["/survey", "/memory"], ["/weather Dhaka", "/news"]]).resize();

const replyWithMenu = async (ctx, state, extraText = "") => {
  const welcome = extraText || state.settings.welcomeMessage.replace("{name}", getDisplayName(ctx.from));
  await ctx.reply(welcome, { ...mainKeyboard.reply_markup ? { reply_markup: mainKeyboard.reply_markup } : {} , ...privateReplyKeyboard });
};

const startSurveyFlow = async (ctx, state, payload = {}) => {
  await updateFlow(state, { name: "survey", step: "name", data: payload });
  await ctx.reply("Let's start the survey. What should I call you?", Markup.forceReply());
};

const startAskFlow = async (ctx, state) => {
  await updateFlow(state, { name: "ask", step: "question", data: {} });
  await ctx.reply("Reply with your question. I will answer using the recent context window.", Markup.forceReply());
};

const finishSurvey = async (ctx, state) => {
  const { name, language, goal } = state.flow?.data || {};
  await updateFlow(state, { name: "", step: "", data: {} });
  await ctx.reply(
    [
      "Survey complete.",
      `Name: ${name || "-"}`,
      `Language: ${language || "-"}`,
      `Goal: ${goal || "-"}`
    ].join("\n")
  );
};

const handleFlow = async (ctx, state) => {
  const flow = state.flow || {};
  if (!flow.name || !ctx.message?.text || ctx.message.text.startsWith("/")) return false;

  const text = ctx.message.text.trim();

  if (flow.name === "survey") {
    if (flow.step === "name") {
      flow.data = { ...(flow.data || {}), name: text };
      flow.step = "language";
      await updateFlow(state, flow);
      await ctx.reply("What language do you prefer?", Markup.forceReply());
      return true;
    }

    if (flow.step === "language") {
      flow.data = { ...(flow.data || {}), language: text };
      flow.step = "goal";
      await updateFlow(state, flow);
      await ctx.reply("What do you want to achieve with the bot?", Markup.forceReply());
      return true;
    }

    if (flow.step === "goal") {
      flow.data = { ...(flow.data || {}), goal: text };
      flow.step = "confirm";
      await updateFlow(state, flow);
      await ctx.reply(
        `Summary:\nName: ${flow.data.name}\nLanguage: ${flow.data.language}\nGoal: ${flow.data.goal}`,
        Markup.inlineKeyboard([
          [Markup.button.callback("Confirm", "survey:confirm"), Markup.button.callback("Restart", "survey:restart")]
        ])
      );
      return true;
    }
  }

  if (flow.name === "ask" && flow.step === "question") {
    await updateFlow(state, { name: "", step: "", data: {} });
    const answer = await respondWithContext(ctx, state, text);
    await ctx.reply(answer);
    await addMemoryTurn(ctx, state, "assistant", answer);
    return true;
  }

  return false;
};

const handleWeather = async (ctx, query) => {
  if (!query) {
    await ctx.reply("Usage: /weather <city>");
    return;
  }

  const geoResponse = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`, {
    headers: { "User-Agent": "ChatWaveBot/1.0" }
  });
  const geoData = await geoResponse.json();
  if (!geoData.length) {
    await ctx.reply(`I couldn't find ${query}.`);
    return;
  }

  const place = geoData[0];
  const weatherResponse = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&current=temperature_2m,weather_code,wind_speed_10m`
  );
  const weatherData = await weatherResponse.json();
  const current = weatherData.current || {};

  await ctx.reply(
    [
      `${place.display_name}`,
      `${weatherCodeToText(current.weather_code)} | ${current.temperature_2m}°C | wind ${current.wind_speed_10m} km/h`
    ].join("\n")
  );
};

const handleNews = async (ctx) => {
  const response = await fetch("https://hn.algolia.com/api/v1/search?tags=front_page");
  const data = await response.json();
  const items = (data.hits || []).slice(0, 5);

  if (!items.length) {
    await ctx.reply("No headlines found right now.");
    return;
  }

  await ctx.reply(
    items
      .map((item, index) => {
        const urlSuffix = item.url ? `\n${item.url}` : "";
        return `${index + 1}. ${item.title}${urlSuffix}`;
      })
      .join("\n\n")
  );
};

const handleReminderCommand = async (ctx, args) => {
  if (args.length < 2) {
    await ctx.reply("Usage: /remind <10m|2h|1d> <text>");
    return;
  }

  const delay = parseDuration(args[0]);
  if (!delay) {
    await ctx.reply("Use a duration like 30s, 10m, 2h, or 1d.");
    return;
  }

  const text = args.slice(1).join(" ");
  const runAt = new Date(Date.now() + delay);
  await Reminder.create({
    chatId: String(ctx.chat.id),
    userId: String(ctx.from.id),
    text,
    runAt,
    status: "pending",
    sourceMessageId: String(ctx.message.message_id)
  });

  await ctx.reply(`Reminder saved for ${runAt.toLocaleString()}.`);
};

const handleMembershipMessage = async (ctx, state) => {
  const message = ctx.message || {};

  if (message.new_chat_members?.length) {
    for (const member of message.new_chat_members) {
      const welcome = (state.settings?.welcomeMessage || "Welcome, {name}.").replace("{name}", getDisplayName(member));
      await ctx.reply(welcome);
      await addMemoryTurn(ctx, state, "system", `Welcomed ${getDisplayName(member)}`, "join");
    }
    return true;
  }

  if (message.left_chat_member) {
    await addMemoryTurn(ctx, state, "system", `${getDisplayName(message.left_chat_member)} left the chat`, "leave");
    return true;
  }

  return false;
};

const handleMediaMessage = async (ctx, state) => {
  const message = ctx.message || {};
  const mediaHandlers = [
    ["photo", message.photo?.at(-1)?.file_id],
    ["video", message.video?.file_id],
    ["audio", message.audio?.file_id],
    ["document", message.document?.file_id],
    ["sticker", message.sticker?.file_id],
    ["animation", message.animation?.file_id],
    ["voice", message.voice?.file_id]
  ];

  const [kind, fileId] = mediaHandlers.find(([, id]) => id) || [];
  if (!kind || !fileId) return false;

  const caption = message.caption || `${kind} received`;
  await addMemoryTurn(ctx, state, "user", caption, kind, { fileId });

  if (kind === "voice") {
    try {
      const transcript = await handleInlineVoiceTranscription(ctx, fileId);
      if (transcript) {
        await addMemoryTurn(ctx, state, "assistant", transcript, "transcription");
        await ctx.reply(`Transcript: ${transcript}`);
      }
    } catch (error) {
      await ctx.reply(`Voice note received, but transcription failed: ${error.message}`);
    }
  }

  await echoMediaIfPrivate(ctx, kind, fileId, caption);
  return true;
};

const handleTextMessage = async (ctx, state) => {
  const text = ctx.message?.text?.trim();
  if (!text || text.startsWith("/")) return false;

  if (await handleFlow(ctx, state)) return true;
  if (await handleSpamCheck(ctx, state)) return true;

  await addMemoryTurn(ctx, state, "user", text);

  if (ctx.chat?.type === "private") {
    const answer = await respondWithContext(ctx, state, text);
    await addMemoryTurn(ctx, state, "assistant", answer);
    await ctx.reply(answer, privateReplyKeyboard);
  }

  return true;
};

const handleIncomingMessage = async (ctx) => {
  const state = await getOrCreateState(ctx);
  if (await handleMembershipMessage(ctx, state)) return;
  if (await handleTextMessage(ctx, state)) return;
  await handleMediaMessage(ctx, state);
};

const moderationActions = {
  ban: async (ctx, target) => {
    await ctx.telegram.banChatMember(ctx.chat.id, target);
    await ctx.reply("Member banned.");
  },
  kick: async (ctx, target) => {
    await ctx.telegram.banChatMember(ctx.chat.id, target);
    await ctx.telegram.unbanChatMember(ctx.chat.id, target);
    await ctx.reply("Member removed.");
  },
  mute: async (ctx, target) => {
    await ctx.telegram.restrictChatMember(ctx.chat.id, target, {
      permissions: {
        can_send_messages: false,
        can_send_audios: false,
        can_send_documents: false,
        can_send_photos: false,
        can_send_videos: false,
        can_send_video_notes: false,
        can_send_voice_notes: false,
        can_send_polls: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false,
        can_change_info: false,
        can_invite_users: false,
        can_pin_messages: false,
        can_manage_topics: false
      }
    });
    await ctx.reply("Member muted.");
  },
  unmute: async (ctx, target) => {
    await ctx.telegram.restrictChatMember(ctx.chat.id, target, {
      permissions: {
        can_send_messages: true,
        can_send_audios: true,
        can_send_documents: true,
        can_send_photos: true,
        can_send_videos: true,
        can_send_video_notes: true,
        can_send_voice_notes: true,
        can_send_polls: true,
        can_send_other_messages: true,
        can_add_web_page_previews: true,
        can_change_info: false,
        can_invite_users: true,
        can_pin_messages: false,
        can_manage_topics: false
      }
    });
    await ctx.reply("Member unmuted.");
  }
};

const handleModeration = async (ctx, state, mode) => {
  if (!isGroupChat(ctx)) {
    return ctx.reply("Moderation commands only work in groups.");
  }

  if (!(await canModerate(ctx, state))) {
    return ctx.reply("Only admins or custom moderators can use this command.");
  }

  if (!(await isBotAdmin(ctx))) {
    return ctx.reply("I need admin permissions in this group to moderate members.");
  }

  const target = ctx.message.reply_to_message?.from?.id || Number(splitArgs(ctx.message.text).args[0]);
  if (!target) {
    return ctx.reply(`Reply to a message or provide a user id for /${mode}.`);
  }

  const action = moderationActions[mode];
  if (action) {
    await action(ctx, target);
  }
};

const handleRoleCommand = async (ctx, state, args) => {
  if (!isGroupChat(ctx)) {
    await ctx.reply("Role management is available in groups only.");
    return;
  }

  if (!(await canModerate(ctx, state))) {
    await ctx.reply("Only admins or custom moderators can assign roles.");
    return;
  }

  if (args.length < 2) {
    await ctx.reply("Usage: /role <userId> <user|moderator|admin>");
    return;
  }

  const [userId, role] = args;
  if (!["user", "moderator", "admin"].includes(role)) {
    await ctx.reply("Role must be user, moderator, or admin.");
    return;
  }

  await upsertRole(state, userId, role);
  await ctx.reply(`Updated role for ${userId} to ${role}.`);
};

const handleGroupSettings = async (ctx, state, command, args) => {
  if (!isGroupChat(ctx)) {
    await ctx.reply("This command is for groups only.");
    return;
  }

  if (!(await canModerate(ctx, state))) {
    await ctx.reply("Only admins or custom moderators can change group settings.");
    return;
  }

  if (command === "welcome") {
    const message = args.join(" ").trim();
    if (!message) {
      await ctx.reply("Usage: /welcome <text>");
      return;
    }
    await updateSettings(state, { welcomeMessage: message });
    await ctx.reply("Welcome message updated.");
    return;
  }

  if (command === "antispam") {
    const value = (args[0] || "").toLowerCase();
    if (!["on", "off"].includes(value)) {
      await ctx.reply("Usage: /antispam on|off");
      return;
    }
    await updateSettings(state, { antiSpamEnabled: value === "on" });
    await ctx.reply(`Anti-spam ${value === "on" ? "enabled" : "disabled"}.`);
  }
};

const handleInlineVoiceTranscription = async (ctx, fileId) => {
  if (!openAiApiKey) {
    return "Voice transcription is not configured. Set OPENAI_API_KEY to enable it.";
  }

  const file = await ctx.telegram.getFile(fileId);
  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
  const fileResponse = await fetch(fileUrl);
  const arrayBuffer = await fileResponse.arrayBuffer();
  const formData = new FormData();
  formData.append("file", new Blob([arrayBuffer]), "voice.ogg");
  formData.append("model", process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`
    },
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Transcription failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.text || "";
};

const mediaRepliers = {
  photo: (ctx, id, caption) => ctx.replyWithPhoto(id, { caption: caption || "Photo received." }),
  video: (ctx, id, caption) => ctx.replyWithVideo(id, { caption: caption || "Video received." }),
  audio: (ctx, id, caption) => ctx.replyWithAudio(id, { caption: caption || "Audio received." }),
  document: (ctx, id, caption) => ctx.replyWithDocument(id, { caption: caption || "Document received." }),
  sticker: (ctx, id) => ctx.replyWithSticker(id),
  animation: (ctx, id, caption) => ctx.replyWithAnimation(id, { caption: caption || "GIF received." }),
  voice: (ctx) => ctx.reply("Voice note received.")
};

const echoMediaIfPrivate = async (ctx, kind, fileId, caption) => {
  if (ctx.chat?.type !== "private") return;
  const replier = mediaRepliers[kind];
  if (replier) {
    await replier(ctx, fileId, caption);
  }
};

const processDueReminders = async () => {
  const dueReminders = await Reminder.find({ status: "pending", runAt: { $lte: new Date() } }).limit(25);
  for (const reminder of dueReminders) {
    try {
      await bot.telegram.sendMessage(reminder.chatId, `⏰ Reminder: ${reminder.text}`);
      reminder.status = "sent";
      await reminder.save();
    } catch (error) {
      console.error("Failed to send reminder", error); // NOSONAR
    }
  }
};

const handleSpamCheck = async (ctx, state) => {
  if (!redis || !isGroupChat(ctx) || !state.settings?.antiSpamEnabled || ctx.message.text.startsWith("/")) return false;

  const key = `chatwave:spam:${ctx.chat.id}:${ctx.from.id}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 10);

  if (count > 5) {
    if (await isBotAdmin(ctx)) {
      try {
        await ctx.deleteMessage();
      } catch {
        // Ignore delete failures when the bot lacks permission for a specific message.
      }
    }
    return true;
  }

  return false;
};

bot.start(async (ctx) => {
  const state = await getOrCreateState(ctx);
  const payload = ctx.startPayload || "";
  const deepLink = payload ? payload.trim() : "";

  if (deepLink.startsWith("survey")) {
    await startSurveyFlow(ctx, state, { deepLink });
    return;
  }

  if (deepLink.startsWith("ask")) {
    await startAskFlow(ctx, state);
    return;
  }

  await replyWithMenu(ctx, state);
});

bot.help(async (ctx) => {
  await ctx.reply(helpText, privateReplyKeyboard);
});

bot.command("memory", async (ctx) => {
  const state = await getOrCreateState(ctx);
  await ctx.reply(memoryText(state));
});

bot.command("reset", async (ctx) => {
  const state = await getOrCreateState(ctx);
  await updateFlow(state, { name: "", step: "", data: {} });
  state.memory = [];
  await state.save();
  await ctx.reply("Conversation memory cleared.");
});

bot.command("survey", async (ctx) => {
  const state = await getOrCreateState(ctx);
  await startSurveyFlow(ctx, state);
});

bot.command("ask", async (ctx) => {
  const state = await getOrCreateState(ctx);
  await startAskFlow(ctx, state);
});

bot.command("weather", async (ctx) => {
  const query = ctx.message.text.replace(/^\/weather\s*/i, "").trim();
  await handleWeather(ctx, query);
});

bot.command("news", async (ctx) => {
  await handleNews(ctx);
});

bot.command("ai", async (ctx) => {
  const state = await getOrCreateState(ctx);
  const prompt = ctx.message.text.replace(/^\/ai\s*/i, "").trim();
  if (!prompt) {
    await ctx.reply("Usage: /ai <prompt>");
    return;
  }
  const answer = await respondWithContext(ctx, state, prompt);
  await ctx.reply(answer);
  await addMemoryTurn(ctx, state, "assistant", answer);
});

bot.command("remind", async (ctx) => {
  const payload = ctx.message.text.replace(/^\/remind\s*/i, "").trim();
  const [durationToken, ...messageParts] = payload.split(/\s+/);
  await handleReminderCommand(ctx, [durationToken, ...messageParts]);
});

bot.command("welcome", async (ctx) => {
  const state = await getOrCreateState(ctx);
  await handleGroupSettings(ctx, state, "welcome", splitArgs(ctx.message.text).args);
});

bot.command("antispam", async (ctx) => {
  const state = await getOrCreateState(ctx);
  await handleGroupSettings(ctx, state, "antispam", splitArgs(ctx.message.text).args);
});

bot.command("role", async (ctx) => {
  const state = await getOrCreateState(ctx);
  await handleRoleCommand(ctx, state, splitArgs(ctx.message.text).args);
});

for (const mode of ["ban", "kick", "mute", "unmute", "unban"]) {
  bot.command(mode, async (ctx) => {
    const state = await getOrCreateState(ctx);
    await handleModeration(ctx, state, mode);
  });
}

bot.action("menu:help", async (ctx) => {
  await ctx.answerCbQuery("Showing help");
  await ctx.reply(helpText, privateReplyKeyboard);
});

bot.action("menu:memory", async (ctx) => {
  const state = await getOrCreateState(ctx);
  await ctx.answerCbQuery("Showing memory");
  await ctx.reply(memoryText(state));
});

bot.action("menu:survey", async (ctx) => {
  const state = await getOrCreateState(ctx);
  await ctx.answerCbQuery("Starting survey");
  await startSurveyFlow(ctx, state);
});

bot.action("menu:ask", async (ctx) => {
  const state = await getOrCreateState(ctx);
  await ctx.answerCbQuery("Starting ask flow");
  await startAskFlow(ctx, state);
});

bot.action("menu:weather", async (ctx) => {
  await ctx.answerCbQuery("Use /weather <city>");
});

bot.action("menu:news", async (ctx) => {
  await ctx.answerCbQuery("Use /news");
});

bot.action("survey:confirm", async (ctx) => {
  const state = await getOrCreateState(ctx);
  await ctx.answerCbQuery("Survey confirmed");
  await finishSurvey(ctx, state);
});

bot.action("survey:restart", async (ctx) => {
  const state = await getOrCreateState(ctx);
  await ctx.answerCbQuery("Restarting survey");
  await startSurveyFlow(ctx, state);
});

bot.on("inline_query", async (ctx) => {
  const query = ctx.inlineQuery.query.trim();
  const state = await ChatState.findOne({ chatId: String(ctx.from.id) });
  const snippets = (state?.memory || []).slice(-3).map((entry, index) => ({
    type: "article",
    id: `memory-${index}`,
    title: `${entry.senderName || entry.senderId}: ${trimText(entry.content, 40)}`,
    description: entry.kind,
    input_message_content: {
      message_text: `${entry.senderName || entry.senderId}: ${entry.content}`
    }
  }));

  const fallback = [
    {
      type: "article",
      id: "search-help",
      title: `Search ${query || "memory"}`,
      description: "Send a quick context card",
      input_message_content: {
        message_text: query ? `Inline query: ${query}` : "Inline query received."
      }
    }
  ];

  await ctx.answerInlineQuery(snippets.length ? snippets : fallback, { cache_time: 0, is_personal: true });
});

bot.on("message", handleIncomingMessage);

const boot = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  if (redis) {
    redis.on("error", (error) => console.warn("Redis error:", error.message)); // NOSONAR
  }

  app.use(bot.webhookCallback(botWebhookPath));

  const server = app.listen(botPort, () => {
    console.log(`ChatWave bot health server listening on ${botPort}`); // NOSONAR
  });

  const stop = async () => {
    try {
      await bot.stop();
    } catch {
      // Ignore shutdown errors.
    }
    await mongoose.connection.close();
    if (redis) await redis.quit();
    server.close();
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  setInterval(() => {
    processDueReminders().catch((error) => console.error("Reminder worker error:", error)); // NOSONAR
  }, 30_000);

  await processDueReminders();

  if (botMode === "webhook") {
    if (!botWebhookUrl) {
      throw new Error("BOT_WEBHOOK_URL is required when BOT_MODE=webhook");
    }

    await bot.telegram.setWebhook(`${botWebhookUrl}${botWebhookPath}`);
    console.log(`Telegram bot webhook configured at ${botWebhookUrl}${botWebhookPath}`); // NOSONAR
  } else {
    await bot.launch({ dropPendingUpdates: true });
    console.log("Telegram bot started in polling mode"); // NOSONAR
  }
};

await boot();
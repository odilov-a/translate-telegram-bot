const TelegramBot = require("node-telegram-bot-api");
const translate = require("google-translate-api-x");
const crypto = require("crypto");
require("dotenv").config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const textStorage = new Map();
const userSettings = new Map();

bot.onText(/\/start/, (msg) => {
  const name = msg.from.first_name || "foydalanuvchi";
  bot.sendMessage(
    msg.chat.id,
    `👋 Salom, *${name}*!\n\nBu bot sizga matnlarni quyidagi tillar o‘rtasida tez va oson tarjima qilish imkonini beradi:
    
🔄 Rus ↔ O‘zbek  
🔄 Rus ↔ Ingliz  
🔄 O‘zbek ↔ Ingliz

✍️ Tarjimani boshlash uchun, matn yuboring.

⚙️ /settings — doimiy til yo‘nalishini tanlash

`,
    { parse_mode: "Markdown" }
  );
});

bot.onText(/\/settings/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `⚙️ Til yo‘nalishini tanlang:`, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🇷🇺 Rus → 🇺🇿 O‘z", callback_data: "set_ru-uz" },
          { text: "🇷🇺 Rus → 🇬🇧 Eng", callback_data: "set_ru-en" },
        ],
        [
          { text: "🇺🇿 O‘z → 🇷🇺 Rus", callback_data: "set_uz-ru" },
          { text: "🇺🇿 O‘z → 🇬🇧 Eng", callback_data: "set_uz-en" },
        ],
        [
          { text: "🇬🇧 Eng → 🇷🇺 Rus", callback_data: "set_en-ru" },
          { text: "🇬🇧 Eng → 🇺🇿 O‘z", callback_data: "set_en-uz" },
        ],
        [{ text: "❌ O‘chirish", callback_data: "set_off" }],
      ],
    },
  });
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (text.startsWith("/")) return;

  const setting = userSettings.get(userId);

  if (setting) {
    const { from, to } = setting;
    try {
      bot.sendChatAction(chatId, "typing");
      const res = await translate(text, { from, to });
      return bot.sendMessage(
        chatId,
        `🌐 *Tarjima* (${from.toUpperCase()} → ${to.toUpperCase()}):\n\n*${
          res.text
        }*`,
        { parse_mode: "Markdown" }
      );
    } catch (err) {
      console.error(err);
      return bot.sendMessage(chatId, "❌ Tarjima qilishda xatolik yuz berdi.");
    }
  }

  const id = crypto.randomBytes(8).toString("hex");
  textStorage.set(id, text);

  bot.sendMessage(
    chatId,
    `📩 Siz yuborgan matn:\n\n"${text}"\n\n🔽 Tilni tanlang:`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🇷🇺 Rus → 🇺🇿 O‘z", callback_data: `ru-uz|${id}` },
            { text: "🇷🇺 Rus → 🇬🇧 Eng", callback_data: `ru-en|${id}` },
          ],
          [
            { text: "🇺🇿 O‘z → 🇷🇺 Rus", callback_data: `uz-ru|${id}` },
            { text: "🇺🇿 O‘z → 🇬🇧 Eng", callback_data: `uz-en|${id}` },
          ],
          [
            { text: "🇬🇧 Eng → 🇷🇺 Rus", callback_data: `en-ru|${id}` },
            { text: "🇬🇧 Eng → 🇺🇿 O‘z", callback_data: `en-uz|${id}` },
          ],
        ],
      },
    }
  );
});

bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data;

  if (data.startsWith("set_")) {
    const value = data.replace("set_", "");
    if (value === "off") {
      userSettings.delete(userId);
      return bot.sendMessage(chatId, "✅ Doimiy til yo‘nalishi o‘chirildi.");
    }
    const [from, to] = value.split("-");
    userSettings.set(userId, { from, to });
    return bot.sendMessage(
      chatId,
      `✅ Endi barcha matnlar avtomatik ravishda *${from.toUpperCase()} → ${to.toUpperCase()}* tarjima qilinadi.`,
      { parse_mode: "Markdown" }
    );
  }

  const [langPair, id] = data.split("|");
  const [from, to] = langPair.split("-");

  const originalText = textStorage.get(id);
  if (!originalText) {
    return bot.sendMessage(chatId, "❌ Matn topilmadi yoki muddati tugagan.");
  }

  try {
    bot.sendChatAction(chatId, "typing");
    const res = await translate(originalText, { from, to });
    bot.sendMessage(
      chatId,
      `🌐 *Tarjima* (${from.toUpperCase()} → ${to.toUpperCase()}):\n\n📝 *${
        res.text
      }*`,
      { parse_mode: "Markdown" }
    );
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, "❌ Tarjima qilishda xatolik yuz berdi.");
  }

  textStorage.delete(id);
});

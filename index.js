const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionsBitField
} = require("discord.js");
const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "config.json");

const defaultConfig = {
  prefix: "!",
  logChannel: "",
  welcomeTitle: "ㅤ⼃ 𖽓 ׅ welcome⠀. ♡⃪⠀꒰ᐢ. ̯ .ᐢ꒱",
  welcomeDescription: "ㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤ ㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤ ㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤ
ㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤ    ㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤ    ㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤ
ㅤㅤ˚　 <a:014White_Sparkles:1482140688731865241>　　 ⿻   　﹕  　˳     {user}　 ﹒    ⊹
　　⠀ ﹒　seja  bem-vindo  à  Roleplay ⠀ ❛⠀⠀<:bunnyzani:1482141259522113628>
　　　˳⠀⠀⯎　leia nossas regras do servidor​⠀❜ ₊
　　ㅤㅤ⠀︶︶    .    ︶︶     .    ︶︶     .   ︶︶     .    ︶
ㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤ    ㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤ    ㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤ",
  welcomeImage: "",
  welcomeChannel: ""
};

function ensureConfigFile() {
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(
      configPath,
      JSON.stringify(defaultConfig, null, 2),
      "utf8"
    );
  }
}

function loadConfig() {
  ensureConfigFile();
  const raw = fs.readFileSync(configPath, "utf8");
  return { ...defaultConfig, ...JSON.parse(raw) };
}

let config = loadConfig();

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error("TOKEN não definida no ambiente.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.MessageContent
  ]
});

const joinTimestamps = new Map();

function reloadConfig() {
  config = loadConfig();
}

function saveConfig() {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
  reloadConfig();
}

function createPinkEmbed(title, description) {
  return new EmbedBuilder()
    .setColor("#ffb6c1")
    .setTitle(title)
    .setDescription(description);
}

function log(guild, title, description) {
  const channel = guild.channels.cache.get(config.logChannel);
  if (!channel || !channel.isTextBased()) return;

  const embed = createPinkEmbed(title, description);
  channel.send({ embeds: [embed] }).catch(() => {});
}

function isValidUrl(text) {
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function createWelcomePreviewEmbed(guild) {
  const embed = new EmbedBuilder()
    .setColor("#ffb6c1")
    .setTitle(config.welcomeTitle || "novo membro")
    .setDescription(
      (config.welcomeDescription || "{user} entrou em {server}")
        .replaceAll("{user}", "@usuário")
        .replaceAll("{username}", "usuário")
        .replaceAll("{server}", guild.name)
    );

  const image = (config.welcomeImage || "").trim();

  if (image !== "" && isValidUrl(image)) {
    embed.setImage(image);
  }

  return embed;
}

function createWelcomePanel() {
  const embed = new EmbedBuilder()
    .setColor("#ffb6c1")
    .setTitle("configuração do welcome")
    .setDescription("use os botões abaixo para editar o embed de boas-vindas.")
    .addFields(
      { name: "título", value: config.welcomeTitle || "não definido" },
      { name: "descrição", value: config.welcomeDescription || "não definida" },
      {
        name: "imagem",
        value:
          config.welcomeImage && config.welcomeImage.trim() !== ""
            ? config.welcomeImage
            : "vazia"
      },
      { name: "id do canal", value: config.welcomeChannel || "não definido" }
    )
    .setFooter({
      text: "variáveis disponíveis: {user} | {username} | {server}"
    });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("welcome_title")
      .setLabel("título")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("welcome_description")
      .setLabel("descrição")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("welcome_image")
      .setLabel("imagem")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("welcome_channel")
      .setLabel("id canal")
      .setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("welcome_preview")
      .setLabel("prévia")
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row, row2] };
}

client.once("clientReady", () => {
  console.log(`${client.user.tag} online`);
});

client.on("guildMemberAdd", async (member) => {
  const now = Date.now();
  const joins = joinTimestamps.get(member.guild.id) || [];

  const filtered = joins.filter((t) => now - t < 10000);
  filtered.push(now);
  joinTimestamps.set(member.guild.id, filtered);

  if (filtered.length >= 5) {
    try {
      await member.guild.members.fetch();

      const recentMembers = member.guild.members.cache.filter(
        (m) =>
          m.joinedTimestamp &&
          now - m.joinedTimestamp < 10000 &&
          !m.user.bot
      );

      for (const [, raidMember] of recentMembers) {
        await raidMember.kick("anti raid").catch(() => {});
      }

      log(
        member.guild,
        "raid detectado",
        `${recentMembers.size} contas entraram em pouco tempo`
      );
    } catch (error) {
      console.error("erro no anti raid:", error);
    }
  }

  const welcomeChannel = member.guild.channels.cache.get(config.welcomeChannel);
  if (!welcomeChannel || !welcomeChannel.isTextBased()) return;

  const title = config.welcomeTitle || "novo membro";

  const desc = (config.welcomeDescription || "{user} entrou em {server}")
    .replaceAll("{user}", `${member}`)
    .replaceAll("{username}", member.user.username)
    .replaceAll("{server}", member.guild.name);

  const embed = new EmbedBuilder()
    .setColor("#ffb6c1")
    .setTitle(title)
    .setDescription(desc);

  const welcomeImage = (config.welcomeImage || "").trim();

  if (welcomeImage !== "" && isValidUrl(welcomeImage)) {
    embed.setImage(welcomeImage);
  }

  await welcomeChannel.send({
    embeds: [embed]
  }).catch(() => {});
});

client.login(TOKEN);

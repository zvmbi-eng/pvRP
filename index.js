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
  welcomeTitle: "novo membro",
  welcomeDescription: "{user} entrou em {server}",
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
    .setDescription(description)
    .setTimestamp();
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
    )
    .setTimestamp();

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
      {
        name: "título",
        value: config.welcomeTitle || "não definido"
      },
      {
        name: "descrição",
        value: config.welcomeDescription || "não definida"
      },
      {
        name: "imagem",
        value:
          config.welcomeImage && config.welcomeImage.trim() !== ""
            ? config.welcomeImage
            : "vazia"
      },
      {
        name: "id do canal",
        value: config.welcomeChannel || "não definido"
      }
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

  return {
    embeds: [embed],
    components: [row, row2]
  };
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
        (m) => m.joinedTimestamp && now - m.joinedTimestamp < 10000 && !m.user.bot
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
    .setDescription(desc)
    .setTimestamp();

  const welcomeImage = (config.welcomeImage || "").trim();

  if (welcomeImage !== "" && isValidUrl(welcomeImage)) {
    embed.setImage(welcomeImage);
  }

  await welcomeChannel.send({
    content: `${member}`,
    embeds: [embed]
  }).catch(() => {});
});

client.on("guildBanAdd", async (ban) => {
  try {
    log(
      ban.guild,
      "ban detectado",
      `usuário banido: <@${ban.user.id}>`
    );
  } catch (error) {
    console.error("erro no log de ban:", error);
  }
});

client.on("messageCreate", async (message) => {
  if (!message.guild) return;
  if (message.author.bot) return;

  const inviteRegex =
    /(https?:\/\/)?(www\.)?(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/[a-zA-Z0-9-]+/gi;

  if (inviteRegex.test(message.content)) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      await message.delete().catch(() => {});

      await message.guild.members.ban(message.author.id, {
        reason: "divulgação de servidor"
      }).catch(() => {});

      log(
        message.guild,
        "usuário banido",
        `usuário: <@${message.author.id}>
motivo: divulgação
mensagem: ${message.content}`
      );

      return;
    }
  }

  if (!message.content.startsWith(config.prefix)) return;

  const args = message.content.slice(config.prefix.length).trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();

  if (command === "help") {
    const embed = new EmbedBuilder()
      .setColor("#ffb6c1")
      .setTitle("painel de ajuda")
      .setDescription("comandos disponíveis")
      .addFields(
        { name: `${config.prefix}ban @usuário motivo`, value: "bane um usuário" },
        { name: `${config.prefix}unban id`, value: "remove o ban de um usuário pelo id" },
        { name: `${config.prefix}kick @usuário motivo`, value: "expulsa um usuário" },
        { name: `${config.prefix}nuke`, value: "clona e limpa o canal atual" },
        { name: `${config.prefix}welcome`, value: "abre o painel de configuração do welcome" }
      )
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  if (command === "welcome") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("você não tem permissão para isso.");
    }

    return message.reply(createWelcomePanel());
  }

  if (command === "ban") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return message.reply("você não tem permissão para banir.");
    }

    if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return message.reply("eu não tenho permissão para banir.");
    }

    const target = message.mentions.members.first();
    if (!target) {
      return message.reply("mencione um usuário.");
    }

    if (target.id === message.author.id) {
      return message.reply("você não pode banir a si mesmo.");
    }

    if (!target.bannable) {
      return message.reply("não consigo banir esse usuário.");
    }

    const reason = args.join(" ") || "sem motivo informado";

    await target.ban({ reason }).catch(() => {});
    await message.reply(`usuário banido: ${target.user.tag}`);

    log(
      message.guild,
      "ban manual",
      `moderador: <@${message.author.id}>
usuário: <@${target.id}>
motivo: ${reason}`
    );

    return;
  }

  if (command === "unban") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return message.reply("você não tem permissão para desbanir.");
    }

    if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return message.reply("eu não tenho permissão para desbanir.");
    }

    const userId = args[0];
    if (!userId) {
      return message.reply("informe o id do usuário.");
    }

    try {
      const bans = await message.guild.bans.fetch();
      const bannedUser = bans.get(userId);

      if (!bannedUser) {
        return message.reply("esse usuário não está banido.");
      }

      await message.guild.members.unban(userId);
      await message.reply(`usuário desbanido: ${bannedUser.user.tag}`);

      log(
        message.guild,
        "unban executado",
        `moderador: <@${message.author.id}>
usuário: <@${bannedUser.user.id}>`
      );
    } catch (error) {
      console.error("erro ao desbanir:", error);
      return message.reply("não consegui desbanir esse usuário.");
    }

    return;
  }

  if (command === "kick") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      return message.reply("você não tem permissão para expulsar.");
    }

    if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      return message.reply("eu não tenho permissão para expulsar.");
    }

    const target = message.mentions.members.first();
    if (!target) {
      return message.reply("mencione um usuário.");
    }

    if (target.id === message.author.id) {
      return message.reply("você não pode expulsar a si mesmo.");
    }

    if (!target.kickable) {
      return message.reply("não consigo expulsar esse usuário.");
    }

    const reason = args.join(" ") || "sem motivo informado";

    await target.kick(reason).catch(() => {});
    await message.reply(`usuário expulso: ${target.user.tag}`);

    log(
      message.guild,
      "kick executado",
      `moderador: <@${message.author.id}>
usuário: <@${target.id}>
motivo: ${reason}`
    );

    return;
  }

  if (command === "nuke") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return message.reply("você não tem permissão para isso.");
    }

    if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return message.reply("eu não tenho permissão para gerenciar canais.");
    }

    const oldChannel = message.channel;
    const newChannel = await oldChannel.clone().catch(() => null);

    if (!newChannel) {
      return message.reply("não consegui clonar o canal.");
    }

    await newChannel.setPosition(oldChannel.position).catch(() => {});
    await oldChannel.delete().catch(() => {});
    await newChannel.send("canal resetado.").catch(() => {});

    log(
      message.guild,
      "nuke executado",
      `canal: ${oldChannel.name}
responsável: <@${message.author.id}>`
    );

    return;
  }
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isButton()) {
    if (!interaction.guild) return;

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({
        content: "você não tem permissão para isso.",
        ephemeral: true
      });
    }

    if (interaction.customId === "welcome_preview") {
      return interaction.reply({
        embeds: [createWelcomePreviewEmbed(interaction.guild)],
        ephemeral: true
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(interaction.customId)
      .setTitle("configurar welcome");

    if (interaction.customId === "welcome_title") {
      const input = new TextInputBuilder()
        .setCustomId("value")
        .setLabel("título")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(config.welcomeTitle || "novo membro");

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    if (interaction.customId === "welcome_description") {
      const input = new TextInputBuilder()
        .setCustomId("value")
        .setLabel("descrição")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setValue(config.welcomeDescription || "{user} entrou em {server}");

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    if (interaction.customId === "welcome_image") {
      const input = new TextInputBuilder()
        .setCustomId("value")
        .setLabel("imagem opcional")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(config.welcomeImage || "");

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    if (interaction.customId === "welcome_channel") {
      const input = new TextInputBuilder()
        .setCustomId("value")
        .setLabel("id do canal de boas-vindas")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(config.welcomeChannel || "");

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }
  }

  if (interaction.isModalSubmit()) {
    if (!interaction.guild) return;

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({
        content: "você não tem permissão para isso.",
        ephemeral: true
      });
    }

    const value = interaction.fields.getTextInputValue("value");

    if (interaction.customId === "welcome_title") {
      config.welcomeTitle = value;
      saveConfig();

      return interaction.reply({
        content: "título atualizado.",
        ephemeral: true
      });
    }

    if (interaction.customId === "welcome_description") {
      config.welcomeDescription = value;
      saveConfig();

      return interaction.reply({
        content: "descrição atualizada.",
        ephemeral: true
      });
    }

    if (interaction.customId === "welcome_image") {
      const imageValue = value.trim();

      if (imageValue !== "" && !isValidUrl(imageValue)) {
        return interaction.reply({
          content:
            "coloque uma url válida começando com http:// ou https://, ou deixe vazio para remover.",
          ephemeral: true
        });
      }

      config.welcomeImage = imageValue;
      saveConfig();

      return interaction.reply({
        content: imageValue ? "imagem atualizada." : "imagem removida.",
        ephemeral: true
      });
    }

    if (interaction.customId === "welcome_channel") {
      const channel = interaction.guild.channels.cache.get(value.trim());

      if (!channel || !channel.isTextBased()) {
        return interaction.reply({
          content: "esse id de canal não existe neste servidor.",
          ephemeral: true
        });
      }

      config.welcomeChannel = value.trim();
      saveConfig();

      return interaction.reply({
        content: "canal de boas-vindas atualizado.",
        ephemeral: true
      });
    }
  }
});

client.login(TOKEN);

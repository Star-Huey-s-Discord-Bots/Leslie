require("dotenv").config();

import { 
  Client, 
  GatewayIntentBits as Intents, 
  Partials, 
  Events, 
  ActivityType, 
  ChannelType, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  PermissionFlagsBits, 
  DiscordAPIError, 
  CategoryChannel, 
  GuildMember, 
  Message, 
  DMChannel, 
  MessageCreateOptions, 
  MessagePayload, 
  MessageReplyOptions, 
  CategoryChildChannel
} from "discord.js";

import fs from "node:fs";

import $ from "./modules/logger";

const client = new Client({
  intents: [
    Intents.Guilds,
    Intents.GuildMessages,
    Intents.GuildMembers,
    Intents.GuildIntegrations,
    Intents.GuildMessageReactions,
    Intents.GuildEmojisAndStickers,
    Intents.MessageContent,
    Intents.GuildVoiceStates,
    Intents.GuildMessageTyping,
    Intents.GuildWebhooks,
    Intents.GuildPresences,
    Intents.GuildModeration,
    Intents.DirectMessages,
    Intents.DirectMessageReactions,
    Intents.DirectMessageTyping
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.ThreadMember,
    Partials.GuildMember,
    Partials.User
  ]
});

client.login(process.env.BOT_TOKEN);

client.on(Events.ClientReady, async (client) => {
  $(`Connected client &n@${client.user.tag}&r`);

  client.user.setPresence({
    activities: [
      { name: `Direct Messages`, type: ActivityType.Watching }
    ],
    status: "dnd"
  });
});

// command
client.on(Events.MessageCreate, async (msg) => {
  if (msg.author.bot) return;
  if (msg.guild) if (msg.guild.id != process.env.BACKSTAGE_GUILD_ID) return;
  if (!msg.content.startsWith(process.env.COMMAND_PREFIX)) return;

  let bGuild = client.guilds.cache.get(process.env.BACKSTAGE_GUILD_ID);
  let bCategory = bGuild.channels.cache.get(process.env.BACKSTAGE_CATEGORY_ID) as CategoryChannel;

  let args: string[];
  try {
    args = customSplit(msg.content.slice(process.env.COMMAND_PREFIX.length));
  }
  catch (err) {
    if (err instanceof SlightError) {
      msg.reply(err.message + ".");
      return;
    }
    throw err;
  }

  let transferTable = JSON.parse(fs.readFileSync("./data/TransferTable.json").toString());

  switch (args[0]) {
    case "send": {
      await msg.reply("% The `%send` command is deprecated and will be removed sooner or later!");

      let userId = args[1];
      if (!userId) {
        await msg.reply("% User ID is missing!");
        return;
      }

      let targetUser = client.users.cache.get(userId);
      if (!targetUser) {
        await msg.reply(
          "% Failed to find DM channel"
        );
        return;
      }
      if (targetUser.bot) {
        await msg.reply(
          "% Could not send DM message to a bot!"
        );
        return;
      }

      let content = args[2];
      if (!content) {
        await msg.reply(
          "% Could not send empty message."
        );
        return;
      }

      targetUser.send(content);

      msg.reply("% Successfully sent message.");
      break;
    }
    case "create": {
      let userId = args[1];
      if (!userId) {
        await msg.reply("% User ID is missing!");
        return;
      }

      if (transferTable[userId]) {
        await msg.reply("% The DM link channel already exists!");
        return;
      }

      let theUser = client.users.cache.get(userId);
      if (!theUser) {
        await msg.reply("% Could not find the user by the given ID.");
        return;
      }
      if (theUser.bot) {
        await msg.reply(
          "% Could not send DM message to a bot!"
        );
        return;
      }

      const modifiedUserTag = theUser.tag.replace("#", "＃");

      let targetChannel = await bCategory.children.create({
        name: modifiedUserTag,
        type: ChannelType.GuildText
      });
      targetChannel.setPosition(0);

      transferTable[userId] = targetChannel.id;

      msg.reply(`% Successfully created channel, here it is: <#${targetChannel.id}>`);
      break;
    }
    case "remove": {
      let targetUserId = Object.keys(transferTable).find(key =>
        transferTable[key] == msg.channel.id
      );

      delete transferTable[targetUserId];

      msg.reply({
        content: "% Successfully removed DM link to this channel.",
        components: [
          new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setCustomId("delete_this_channel")
                .setStyle(ButtonStyle.Danger)
                .setLabel("Delete this channel")
            )
        ]
      });
      break;
    }
  }

  fs.writeFileSync("./data/TransferTable.json", JSON.stringify(transferTable, null, 4));
});

// button
client.on(Events.InteractionCreate, async (itr) => {
  if (!itr.isButton()) return;
  if (itr.guild.id != process.env.BACKSTAGE_GUILD_ID) return;

  switch (itr.customId) {
    case "delete_this_channel":
      if (!itr.channel.permissionsFor(itr.member as GuildMember).has(PermissionFlagsBits.ManageChannels)) {
        itr.reply({
          content: "You don't have the permission to do this!",
          ephemeral: true
        });
        return;
      }
      if (!itr.channel.permissionsFor(client.user).has(PermissionFlagsBits.ManageChannels)) {
        itr.reply({
          content: "I don't have the permission to do this...",
          ephemeral: true
        });
        return;
      }

      await itr.reply("Goodbye!");

      await itr.channel.delete();
      break;
  }
});

const transferMessages = new Array();

// user start typing
client.on(Events.TypingStart, async (typing) => {
  if (typing.user.bot) return;

  let bGuild = client.guilds.cache.get(process.env.BACKSTAGE_GUILD_ID);
  let bCategory = bGuild.channels.cache.get(process.env.BACKSTAGE_CATEGORY_ID) as CategoryChannel;

  let transferTable = JSON.parse(fs.readFileSync("./data/TransferTable.json").toString());

  if (typing.channel.type == ChannelType.DM) {
    let targetChannel: CategoryChildChannel;
    if (transferTable[typing.user.id]) {
      targetChannel = bCategory.children.cache.get(transferTable[typing.user.id]);
    }
    else return;

    if (targetChannel.isTextBased())
      await targetChannel.sendTyping();
  }
  else if (typing.channel.type == ChannelType.GuildText) {
    if (!typing.channel.parent) return;
    if (typing.channel.parent.id != bCategory.id) return;

    let targetUser = client.users.cache.get(Object.keys(transferTable).find(key =>
      transferTable[key] == typing.channel.id
    ));
    if (!targetUser) return;
    if (!targetUser.dmChannel) return;

    targetUser.dmChannel.sendTyping();
  }

  fs.writeFileSync("./data/TransferTable.json", JSON.stringify(transferTable, null, 4));
});

// user send message
client.on(Events.MessageCreate, async (msg) => {
  if (msg.author.bot) return;
  if (msg.content.startsWith(process.env.COMMAND_PREFIX)) return;

  let bGuild = client.guilds.cache.get(process.env.BACKSTAGE_GUILD_ID);
  let bCategory = bGuild.channels.cache.get(process.env.BACKSTAGE_CATEGORY_ID) as CategoryChannel;

  let transferTable = JSON.parse(fs.readFileSync("./data/TransferTable.json").toString());

  if (msg.channel.type == ChannelType.DM) {
    const modifiedUserTag = msg.author.tag.replace("#", "＃");

    let targetChannel: CategoryChildChannel;
    if (transferTable[msg.author.id]) {
      targetChannel = bCategory.children.cache.get(transferTable[msg.author.id]);
    
      if (targetChannel.name.toLowerCase() != modifiedUserTag.toLowerCase())
        targetChannel.edit({ name: modifiedUserTag });
    }
    else {
      targetChannel = await bCategory.children.create({
        name: modifiedUserTag,
        type: ChannelType.GuildText
      });

      transferTable[msg.author.id] = targetChannel.id;
    }

    let sendAction: (args: string | MessagePayload | MessageCreateOptions | MessageReplyOptions) => any 
      = (args) => targetChannel.isTextBased() ? targetChannel.send(args) : null;

    let refMsg: Message;
    if (msg.reference) {
      let table = transferMessages.find(t =>
        t.originalMsgId == msg.reference.messageId
        || t.targetMsgId == msg.reference.messageId
      );

      if (table) {
        refMsg = targetChannel.messages.cache.get(
          table.originalMsgId == msg.reference.messageId ?
            table.targetMsgId
            :
            table.originalMsgId
        );

        if (refMsg)
          sendAction = (args) => refMsg.reply(args);
      }
    }

    let imageUrls = new Array();
    for (let atm of msg.attachments.values())
      imageUrls.push(atm.url);

    if (!imageUrls.length && !msg.stickers.size && !msg.content) return;

    targetChannel.setPosition(0);

    await sendAction({
      content: msg.content,
      files: imageUrls,
      stickers: msg.stickers.size ? [msg.stickers.first()?.id] : undefined
    }).then((sentMsg: Message) => {
      transferMessages.push({
        type: "from",
        userId: msg.author.id,
        channelId: targetChannel.id,
        originalMsgId: msg.id,
        targetMsgId: sentMsg.id,
        DMSideMsgId: msg.id,
        GuildSideMsgId: sentMsg.id,
        timestamp: new Date().valueOf()
      });
    }).catch((err: Error) => {
      if (err instanceof DiscordAPIError) {
        if (targetChannel.isTextBased())
          targetChannel.send(`% Error while transfering message: ${err.message}.`);
        return;
      }
      throw err;
    });
  }
  else if (msg.channel.type == ChannelType.GuildText) {
    if (!msg.channel.parent) return;
    if (msg.channel.parent.id != bCategory.id) return;

    let targetUser = client.users.cache.get(Object.keys(transferTable).find(key =>
      transferTable[key] == msg.channel.id
    ));
    if (!targetUser) {
      await msg.reply(
        "Failed to find the user."
      );
      return;
    }

    let sendAction: (args: string | MessagePayload | MessageCreateOptions | MessageReplyOptions) => any 
      = (args) => targetUser.send(args);

    let refMsg: Message;
    if (msg.reference && targetUser.dmChannel) {
      let table = transferMessages.find(t =>
        t.originalMsgId == msg.reference.messageId
        || t.targetMsgId == msg.reference.messageId
      );

      if (table) {
        refMsg = targetUser.dmChannel.messages.cache.get(
          table.originalMsgId == msg.reference.messageId ?
            table.targetMsgId
            :
            table.originalMsgId
        );

        if (refMsg)
          sendAction = async (...args) => await refMsg.reply(...args);
      }
    }

    let imageUrls = new Array();
    for (let atm of msg.attachments.values())
      imageUrls.push(atm.url);

    if (!imageUrls.length && !msg.stickers.size && !msg.content) return;

    msg.channel.setPosition(0);

    await sendAction({
      content: msg.content,
      files: imageUrls,
      stickers: msg.stickers.size ? [msg.stickers.first()?.id] : undefined
    }).then((sentMsg: Message) => {
      transferMessages.push({
        type: "to",
        userId: targetUser.id,
        channelId: msg.channel.id,
        originalMsgId: msg.id,
        targetMsgId: sentMsg.id,
        DMSideMsgId: sentMsg.id,
        GuildSideMsgId: msg.id,
        timestamp: new Date().valueOf()
      });
    }).catch(err => {
      if (err instanceof DiscordAPIError) {
        msg.reply(`% Failed to send message: ${err.message}.`);
        return;
      }
      throw err;
    });
  }

  fs.writeFileSync("./data/TransferTable.json", JSON.stringify(transferTable, null, 4));
});

// user edit message
client.on(Events.MessageUpdate, async (oldMsg, newMsg) => {
  if (newMsg.author.bot) return;
  if (newMsg.content.startsWith(process.env.COMMAND_PREFIX)) return;
  if (oldMsg.content == newMsg.content) return;

  let bGuild = client.guilds.cache.get(process.env.BACKSTAGE_GUILD_ID);
  let bCategory = bGuild.channels.cache.get(process.env.BACKSTAGE_CATEGORY_ID) as CategoryChannel;

  let table = transferMessages.find(t => t.originalMsgId == newMsg.id);
  if (!table) return;

  let channel: DMChannel | CategoryChildChannel;
  if (table.type == "from")
    channel = bCategory.children.cache.get(table.channelId);
  else
    channel = client.users.cache.get(table.userId).dmChannel;

  if (!channel) return;

  let targetMsg = channel.messages.cache.get(table.targetMsgId);
  if (!targetMsg) return;

  let imageUrls = new Array();
  for (let atm of newMsg.attachments.values())
    imageUrls.push(atm.url);

  if (!imageUrls.length && !newMsg.content) return;

  await targetMsg.edit({
    content: newMsg.content,
    files: imageUrls
  });
});

// user delete message
client.on(Events.MessageDelete, async (msg) => {
  if (!msg.author) return;
  if (msg.author.bot) return;
  if (msg.content.startsWith(process.env.COMMAND_PREFIX)) return;

  let bGuild = client.guilds.cache.get(process.env.BACKSTAGE_GUILD_ID);
  let bCategory = bGuild.channels.cache.get(process.env.BACKSTAGE_CATEGORY_ID) as CategoryChannel;

  let tableIndex = transferMessages.findIndex(t => t.originalMsgId == msg.id);
  if (tableIndex == -1) return;
  let table = transferMessages[tableIndex];

  let channel: DMChannel | CategoryChildChannel;
  if (table.type == "from")
    channel = bCategory.children.cache.get(table.channelId);
  else
    channel = client.users.cache.get(table.userId).dmChannel;

  if (!channel) return;

  let targetMsg = channel.messages.cache.get(table.targetMsgId);
  if (!targetMsg) return;

  await targetMsg.delete();
  transferMessages.splice(tableIndex);
});

// user add reaction
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;

  let bGuild = client.guilds.cache.get(process.env.BACKSTAGE_GUILD_ID);
  let bCategory = bGuild.channels.cache.get(process.env.BACKSTAGE_CATEGORY_ID) as CategoryChannel;

  let transferTable = JSON.parse(fs.readFileSync("./data/TransferTable.json").toString());

  let targetChannel: DMChannel | CategoryChildChannel;
  if (reaction.message.channel.type == ChannelType.DM) {
    if (transferTable[user.id]) {
      targetChannel = bCategory.children.cache.get(transferTable[user.id]);
    }
    else
      return;
  }
  else if (reaction.message.channel.type == ChannelType.GuildText) {
    if (!reaction.message.channel.parent) return;
    if (reaction.message.channel.parent.id != bCategory.id) return;

    let targetUser = client.users.cache.get(Object.keys(transferTable).find(key =>
      transferTable[key] == reaction.message.channel.id
    ));
    if (!targetUser)
      return;
    if (!targetUser.dmChannel)
      return;

    targetChannel = targetUser.dmChannel;
  }

  let table = transferMessages.find(t =>
    t.originalMsgId == reaction.message.id
    || t.targetMsgId == reaction.message.id
  );
  if (!table) return;

  let targetMsg = targetChannel.messages.cache.get(
    table.originalMsgId == reaction.message.id ?
      table.targetMsgId
      :
      table.originalMsgId
  );

  await targetMsg.react(reaction.emoji);
});

// user remove reaction
client.on(Events.MessageReactionRemove, async (reaction, user) => {
  if (user.bot) return;

  let bGuild = client.guilds.cache.get(process.env.BACKSTAGE_GUILD_ID);
  let bCategory = bGuild.channels.cache.get(process.env.BACKSTAGE_CATEGORY_ID) as CategoryChannel;

  let transferTable = JSON.parse(fs.readFileSync("./data/TransferTable.json").toString());

  let targetChannel: DMChannel | CategoryChildChannel;
  if (reaction.message.channel.type == ChannelType.DM) {
    if (transferTable[user.id]) {
      targetChannel = bCategory.children.cache.get(transferTable[user.id]);
    }
    else
      return;
  }
  else if (reaction.message.channel.type == ChannelType.GuildText) {
    if (!reaction.message.channel.parent) return;
    if (reaction.message.channel.parent.id != bCategory.id) return;

    let targetUser = client.users.cache.get(Object.keys(transferTable).find(key =>
      transferTable[key] == reaction.message.channel.id
    ));
    if (!targetUser)
      return;
    if (!targetUser.dmChannel)
      return;

    targetChannel = targetUser.dmChannel;
  }

  let table = transferMessages.find(t =>
    t.originalMsgId == reaction.message.id
    || t.targetMsgId == reaction.message.id
  );
  if (!table) return;

  let targetMsg = targetChannel.messages.cache.get(
    table.originalMsgId == reaction.message.id ?
      table.targetMsgId
      :
      table.originalMsgId
  );

  let messageReaction = targetMsg.reactions.cache
    .find((mr: { emoji: { id: string; }; }) => mr.emoji.id == reaction.emoji.id);
  await messageReaction.users.remove(client.user);
});

setInterval(() => {
  let now = new Date().valueOf();

  for (let i = transferMessages.length - 1; i >= 0; --i)
    if (now - transferMessages[i].timestamp > 7 * 24 * 60 * 60 * 1000)
      transferMessages.splice(i, 1);
}, 60_000);

// ======= functions =======

class SlightError extends Error {
  constructor(message = "Unknown") {
    super(message);
    this.name = "SlightError";
  }
}

const customSplit = function (str: string) {
  let arr = str.split(/\u0020|\u3000/g);
  let result = new Array();

  let inside = false, lastLeft = -1;
  for (let [i, str] of arr.entries()) {
    let isLeft = false, isRight = false;
    if (str.startsWith("[")) isLeft = true;
    if (str.endsWith("]")) isRight = true;

    if (isLeft && isRight) {
      result.push(str.slice(1, -1));
      continue;
    }
    if (isLeft) {
      if (inside) throw new SlightError("Invalid left bracket");
      lastLeft = i, inside = true;
      continue;
    }
    if (isRight) {
      if (!inside) throw new SlightError("Invalid right bracket");
      result.push(
        arr
          .slice(lastLeft, i + 1)
          .join(" ")
          .replace("[", "")
          .replace("]", "")
      );
      inside = false;
      continue;
    }
    if (!inside)
      result.push(str.trim());
  }

  result = result.filter(s => s != "");
  return result;
}

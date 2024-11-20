"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv").config();
const discord_js_1 = require("discord.js");
const node_fs_1 = __importDefault(require("node:fs"));
const logger_1 = __importDefault(require("./modules/logger"));
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.GuildMembers,
        discord_js_1.GatewayIntentBits.GuildIntegrations,
        discord_js_1.GatewayIntentBits.GuildMessageReactions,
        discord_js_1.GatewayIntentBits.GuildEmojisAndStickers,
        discord_js_1.GatewayIntentBits.MessageContent,
        discord_js_1.GatewayIntentBits.GuildVoiceStates,
        discord_js_1.GatewayIntentBits.GuildMessageTyping,
        discord_js_1.GatewayIntentBits.GuildWebhooks,
        discord_js_1.GatewayIntentBits.GuildPresences,
        discord_js_1.GatewayIntentBits.GuildModeration,
        discord_js_1.GatewayIntentBits.DirectMessages,
        discord_js_1.GatewayIntentBits.DirectMessageReactions,
        discord_js_1.GatewayIntentBits.DirectMessageTyping
    ],
    partials: [
        discord_js_1.Partials.Message,
        discord_js_1.Partials.Channel,
        discord_js_1.Partials.Reaction,
        discord_js_1.Partials.ThreadMember,
        discord_js_1.Partials.GuildMember,
        discord_js_1.Partials.User
    ]
});
client.login(process.env.BOT_TOKEN);
client.on(discord_js_1.Events.ClientReady, async (client) => {
    (0, logger_1.default)(`Connected client &n@${client.user.tag}&r`);
    client.user.setPresence({
        activities: [
            { name: `Direct Messages`, type: discord_js_1.ActivityType.Watching }
        ],
        status: "dnd"
    });
});
// command
client.on(discord_js_1.Events.MessageCreate, async (msg) => {
    if (msg.author.bot)
        return;
    if (msg.guild)
        if (msg.guild.id != process.env.BACKSTAGE_GUILD_ID)
            return;
    if (!msg.content.startsWith(process.env.COMMAND_PREFIX))
        return;
    let bGuild = client.guilds.cache.get(process.env.BACKSTAGE_GUILD_ID);
    let bCategory = bGuild.channels.cache.get(process.env.BACKSTAGE_CATEGORY_ID);
    let args;
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
    let transferTable = JSON.parse(node_fs_1.default.readFileSync("./data/TransferTable.json").toString());
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
                await msg.reply("% Failed to find DM channel");
                return;
            }
            if (targetUser.bot) {
                await msg.reply("% Could not send DM message to a bot!");
                return;
            }
            let content = args[2];
            if (!content) {
                await msg.reply("% Could not send empty message.");
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
                await msg.reply("% Could not send DM message to a bot!");
                return;
            }
            const modifiedUserTag = theUser.tag.replace("#", "＃");
            let targetChannel = await bCategory.children.create({
                name: modifiedUserTag,
                type: discord_js_1.ChannelType.GuildText
            });
            targetChannel.setPosition(0);
            transferTable[userId] = targetChannel.id;
            msg.reply(`% Successfully created channel, here it is: <#${targetChannel.id}>`);
            break;
        }
        case "remove": {
            let targetUserId = Object.keys(transferTable).find(key => transferTable[key] == msg.channel.id);
            delete transferTable[targetUserId];
            msg.reply({
                content: "% Successfully removed DM link to this channel.",
                components: [
                    new discord_js_1.ActionRowBuilder()
                        .addComponents(new discord_js_1.ButtonBuilder()
                        .setCustomId("delete_this_channel")
                        .setStyle(discord_js_1.ButtonStyle.Danger)
                        .setLabel("Delete this channel"))
                ]
            });
            break;
        }
    }
    node_fs_1.default.writeFileSync("./data/TransferTable.json", JSON.stringify(transferTable, null, 4));
});
// button
client.on(discord_js_1.Events.InteractionCreate, async (itr) => {
    if (!itr.isButton())
        return;
    if (itr.guild.id != process.env.BACKSTAGE_GUILD_ID)
        return;
    switch (itr.customId) {
        case "delete_this_channel":
            if (!itr.channel.permissionsFor(itr.member).has(discord_js_1.PermissionFlagsBits.ManageChannels)) {
                itr.reply({
                    content: "You don't have the permission to do this!",
                    ephemeral: true
                });
                return;
            }
            if (!itr.channel.permissionsFor(client.user).has(discord_js_1.PermissionFlagsBits.ManageChannels)) {
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
client.on(discord_js_1.Events.TypingStart, async (typing) => {
    if (typing.user.bot)
        return;
    let bGuild = client.guilds.cache.get(process.env.BACKSTAGE_GUILD_ID);
    let bCategory = bGuild.channels.cache.get(process.env.BACKSTAGE_CATEGORY_ID);
    let transferTable = JSON.parse(node_fs_1.default.readFileSync("./data/TransferTable.json").toString());
    if (typing.channel.type == discord_js_1.ChannelType.DM) {
        let targetChannel;
        if (transferTable[typing.user.id]) {
            targetChannel = bCategory.children.cache.get(transferTable[typing.user.id]);
        }
        else
            return;
        if (targetChannel.isTextBased())
            await targetChannel.sendTyping();
    }
    else if (typing.channel.type == discord_js_1.ChannelType.GuildText) {
        if (!typing.channel.parent)
            return;
        if (typing.channel.parent.id != bCategory.id)
            return;
        let targetUser = client.users.cache.get(Object.keys(transferTable).find(key => transferTable[key] == typing.channel.id));
        if (!targetUser)
            return;
        if (!targetUser.dmChannel)
            return;
        targetUser.dmChannel.sendTyping();
    }
    node_fs_1.default.writeFileSync("./data/TransferTable.json", JSON.stringify(transferTable, null, 4));
});
// user send message
client.on(discord_js_1.Events.MessageCreate, async (msg) => {
    if (msg.author.bot)
        return;
    let bGuild = client.guilds.cache.get(process.env.BACKSTAGE_GUILD_ID);
    let bCategory = bGuild.channels.cache.get(process.env.BACKSTAGE_CATEGORY_ID);
    let transferTable = JSON.parse(node_fs_1.default.readFileSync("./data/TransferTable.json").toString());
    if (msg.channel.type == discord_js_1.ChannelType.DM) {
        const modifiedUserTag = msg.author.tag.replace("#", "＃");
        let targetChannel;
        if (transferTable[msg.author.id]) {
            targetChannel = bCategory.children.cache.get(transferTable[msg.author.id]);
            if (targetChannel.name.toLowerCase() != modifiedUserTag.toLowerCase())
                targetChannel.edit({ name: modifiedUserTag });
        }
        else {
            targetChannel = await bCategory.children.create({
                name: modifiedUserTag,
                type: discord_js_1.ChannelType.GuildText
            });
            transferTable[msg.author.id] = targetChannel.id;
        }
        let sendAction = (args) => targetChannel.isTextBased() ? targetChannel.send(args) : null;
        let refMsg;
        if (msg.reference) {
            let table = transferMessages.find(t => t.originalMsgId == msg.reference.messageId
                || t.targetMsgId == msg.reference.messageId);
            if (table) {
                refMsg = targetChannel.messages.cache.get(table.originalMsgId == msg.reference.messageId ?
                    table.targetMsgId
                    :
                        table.originalMsgId);
                if (refMsg)
                    sendAction = (args) => refMsg.reply(args);
            }
        }
        let imageUrls = new Array();
        for (let atm of msg.attachments.values())
            imageUrls.push(atm.url);
        if (!imageUrls.length && !msg.stickers.size && !msg.content)
            return;
        targetChannel.setPosition(0);
        await sendAction({
            content: msg.content,
            files: imageUrls,
            stickers: msg.stickers.size ? [msg.stickers.first()?.id] : undefined
        }).then((sentMsg) => {
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
        }).catch((err) => {
            if (err instanceof discord_js_1.DiscordAPIError) {
                if (targetChannel.isTextBased())
                    targetChannel.send(`% Error while transfering message: ${err.message}.`);
                return;
            }
            throw err;
        });
    }
    else if (msg.channel.type == discord_js_1.ChannelType.GuildText) {
        if (msg.content.startsWith(process.env.COMMAND_PREFIX))
            return;
        if (!msg.channel.parent)
            return;
        if (msg.channel.parent.id != bCategory.id)
            return;
        let targetUser = client.users.cache.get(Object.keys(transferTable).find(key => transferTable[key] == msg.channel.id));
        if (!targetUser) {
            await msg.reply("Failed to find the user.");
            return;
        }
        let sendAction = (args) => targetUser.send(args);
        let refMsg;
        if (msg.reference && targetUser.dmChannel) {
            let table = transferMessages.find(t => t.originalMsgId == msg.reference.messageId
                || t.targetMsgId == msg.reference.messageId);
            if (table) {
                refMsg = targetUser.dmChannel.messages.cache.get(table.originalMsgId == msg.reference.messageId ?
                    table.targetMsgId
                    :
                        table.originalMsgId);
                if (refMsg)
                    sendAction = async (...args) => await refMsg.reply(...args);
            }
        }
        let imageUrls = new Array();
        for (let atm of msg.attachments.values())
            imageUrls.push(atm.url);
        if (!imageUrls.length && !msg.stickers.size && !msg.content)
            return;
        msg.channel.setPosition(0);
        await sendAction({
            content: msg.content,
            files: imageUrls,
            stickers: msg.stickers.size ? [msg.stickers.first()?.id] : undefined
        }).then((sentMsg) => {
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
            if (err instanceof discord_js_1.DiscordAPIError) {
                msg.reply(`% Failed to send message: ${err.message}.`);
                return;
            }
            throw err;
        });
    }
    node_fs_1.default.writeFileSync("./data/TransferTable.json", JSON.stringify(transferTable, null, 4));
});
// user edit message
client.on(discord_js_1.Events.MessageUpdate, async (oldMsg, newMsg) => {
    if (newMsg.author.bot)
        return;
    if (newMsg.content.startsWith(process.env.COMMAND_PREFIX))
        return;
    if (oldMsg.content == newMsg.content)
        return;
    let bGuild = client.guilds.cache.get(process.env.BACKSTAGE_GUILD_ID);
    let bCategory = bGuild.channels.cache.get(process.env.BACKSTAGE_CATEGORY_ID);
    let table = transferMessages.find(t => t.originalMsgId == newMsg.id);
    if (!table)
        return;
    let channel;
    if (table.type == "from")
        channel = bCategory.children.cache.get(table.channelId);
    else
        channel = client.users.cache.get(table.userId).dmChannel;
    if (!channel)
        return;
    let targetMsg = channel.messages.cache.get(table.targetMsgId);
    if (!targetMsg)
        return;
    let imageUrls = new Array();
    for (let atm of newMsg.attachments.values())
        imageUrls.push(atm.url);
    if (!imageUrls.length && !newMsg.content)
        return;
    await targetMsg.edit({
        content: newMsg.content,
        files: imageUrls
    });
});
// user delete message
client.on(discord_js_1.Events.MessageDelete, async (msg) => {
    if (!msg.author)
        return;
    if (msg.author.bot)
        return;
    if (msg.content.startsWith(process.env.COMMAND_PREFIX))
        return;
    let bGuild = client.guilds.cache.get(process.env.BACKSTAGE_GUILD_ID);
    let bCategory = bGuild.channels.cache.get(process.env.BACKSTAGE_CATEGORY_ID);
    let tableIndex = transferMessages.findIndex(t => t.originalMsgId == msg.id);
    if (tableIndex == -1)
        return;
    let table = transferMessages[tableIndex];
    let channel;
    if (table.type == "from")
        channel = bCategory.children.cache.get(table.channelId);
    else
        channel = client.users.cache.get(table.userId).dmChannel;
    if (!channel)
        return;
    let targetMsg = channel.messages.cache.get(table.targetMsgId);
    if (!targetMsg)
        return;
    await targetMsg.delete();
    transferMessages.splice(tableIndex);
});
// user add reaction
client.on(discord_js_1.Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot)
        return;
    let bGuild = client.guilds.cache.get(process.env.BACKSTAGE_GUILD_ID);
    let bCategory = bGuild.channels.cache.get(process.env.BACKSTAGE_CATEGORY_ID);
    let transferTable = JSON.parse(node_fs_1.default.readFileSync("./data/TransferTable.json").toString());
    let targetChannel;
    if (reaction.message.channel.type == discord_js_1.ChannelType.DM) {
        if (transferTable[user.id]) {
            targetChannel = bCategory.children.cache.get(transferTable[user.id]);
        }
        else
            return;
    }
    else if (reaction.message.channel.type == discord_js_1.ChannelType.GuildText) {
        if (!reaction.message.channel.parent)
            return;
        if (reaction.message.channel.parent.id != bCategory.id)
            return;
        let targetUser = client.users.cache.get(Object.keys(transferTable).find(key => transferTable[key] == reaction.message.channel.id));
        if (!targetUser)
            return;
        if (!targetUser.dmChannel)
            return;
        targetChannel = targetUser.dmChannel;
    }
    let table = transferMessages.find(t => t.originalMsgId == reaction.message.id
        || t.targetMsgId == reaction.message.id);
    if (!table)
        return;
    let targetMsg = targetChannel.messages.cache.get(table.originalMsgId == reaction.message.id ?
        table.targetMsgId
        :
            table.originalMsgId);
    await targetMsg.react(reaction.emoji);
});
// user remove reaction
client.on(discord_js_1.Events.MessageReactionRemove, async (reaction, user) => {
    if (user.bot)
        return;
    let bGuild = client.guilds.cache.get(process.env.BACKSTAGE_GUILD_ID);
    let bCategory = bGuild.channels.cache.get(process.env.BACKSTAGE_CATEGORY_ID);
    let transferTable = JSON.parse(node_fs_1.default.readFileSync("./data/TransferTable.json").toString());
    let targetChannel;
    if (reaction.message.channel.type == discord_js_1.ChannelType.DM) {
        if (transferTable[user.id]) {
            targetChannel = bCategory.children.cache.get(transferTable[user.id]);
        }
        else
            return;
    }
    else if (reaction.message.channel.type == discord_js_1.ChannelType.GuildText) {
        if (!reaction.message.channel.parent)
            return;
        if (reaction.message.channel.parent.id != bCategory.id)
            return;
        let targetUser = client.users.cache.get(Object.keys(transferTable).find(key => transferTable[key] == reaction.message.channel.id));
        if (!targetUser)
            return;
        if (!targetUser.dmChannel)
            return;
        targetChannel = targetUser.dmChannel;
    }
    let table = transferMessages.find(t => t.originalMsgId == reaction.message.id
        || t.targetMsgId == reaction.message.id);
    if (!table)
        return;
    let targetMsg = targetChannel.messages.cache.get(table.originalMsgId == reaction.message.id ?
        table.targetMsgId
        :
            table.originalMsgId);
    let messageReaction = targetMsg.reactions.cache
        .find((mr) => mr.emoji.id == reaction.emoji.id);
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
const customSplit = function (str) {
    let arr = str.split(/\u0020|\u3000/g);
    let result = new Array();
    let inside = false, lastLeft = -1;
    for (let [i, str] of arr.entries()) {
        let isLeft = false, isRight = false;
        if (str.startsWith("["))
            isLeft = true;
        if (str.endsWith("]"))
            isRight = true;
        if (isLeft && isRight) {
            result.push(str.slice(1, -1));
            continue;
        }
        if (isLeft) {
            if (inside)
                throw new SlightError("Invalid left bracket");
            lastLeft = i, inside = true;
            continue;
        }
        if (isRight) {
            if (!inside)
                throw new SlightError("Invalid right bracket");
            result.push(arr
                .slice(lastLeft, i + 1)
                .join(" ")
                .replace("[", "")
                .replace("]", ""));
            inside = false;
            continue;
        }
        if (!inside)
            result.push(str.trim());
    }
    result = result.filter(s => s != "");
    return result;
};

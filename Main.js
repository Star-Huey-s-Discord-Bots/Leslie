require("dotenv").config();

const { 
    Client, 
    GatewayIntentBits: Intents, 
    Partials, 
    Events, 
    ActivityType, 
    ChannelType, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits, 
    DiscordAPIError 
} = require("discord.js");

const fs = require("node:fs");

const $ = require("./Modules/Logger");

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

    var bGuild = client.guilds.cache.get(process.env.BACKSTAGE_GUILD_ID);
    var bCategory = bGuild.channels.cache.get(process.env.BACKSTAGE_CATEGORY_ID);

    var args;
    try{
        args = customSplit(msg.content.slice(process.env.COMMAND_PREFIX.length))
    }   
    catch (err) {
        if (err instanceof SlightError) {
            msg.reply(err.message + ".");
            return;
        }
        throw err;
    }
    
    var transferTable = JSON.parse(fs.readFileSync("./Data/TransferTable.json"));

    switch (args[0]) {

    case "send":
        var userId = args[1];
        if (!userId) {
            await msg.reply("% User ID is missing!");
            return;
        }

        var targetUser = client.users.cache.get(userId);
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

        var content = args[2];
        if (!content) {
            await msg.reply(
                "% Could not send empty message."
            );
            return;
        }

        targetUser.send(content);

        msg.reply("% Successfully sent message.");
        break;

    case "create":
        var userId = args[1];
        if (!userId) {
            await msg.reply("% User ID is missing!");
            return;
        }

        if (transferTable[userId]) {
            await msg.reply("% The DM link channel already exists!");
            return;
        }

        var theUser = client.users.cache.get(userId);
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

        targetChannel = await bCategory.children.create({ 
            name: modifiedUserTag, 
            type: ChannelType.GuildText 
        });

        transferTable[userId] = targetChannel.id;

        msg.reply(`% Successfully created channel, here it is: <#${targetChannel.id}>`);
        break;

    case "remove":
        var targetUserId = Object.keys(transferTable).find(key => 
            transferTable[key] == msg.channel.id
        );

        delete transferTable[targetUserId];

        msg.reply({
            content: "% Successfully removed DM link to this channel.",
            components: [
                new ActionRowBuilder()
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

    fs.writeFileSync("./Data/TransferTable.json", JSON.stringify(transferTable, null, 4));
});

// button
client.on(Events.InteractionCreate, async (itr) => {
    if (!itr.isButton()) return;
    if (itr.guild.id != process.env.BACKSTAGE_GUILD_ID) return;

    switch (itr.customId) {

    case "delete_this_channel":
        if (!itr.channel.permissionsFor(itr.member).has(PermissionFlagsBits.ManageChannels)) {
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

    var bGuild = client.guilds.cache.get(process.env.BACKSTAGE_GUILD_ID);
    var bCategory = bGuild.channels.cache.get(process.env.BACKSTAGE_CATEGORY_ID);

    var transferTable = JSON.parse(fs.readFileSync("./Data/TransferTable.json"));

    if (typing.channel.type == ChannelType.DM) {
        var targetChannel;
        if (transferTable[typing.user.id]) {
            targetChannel = bCategory.children.cache.get(transferTable[typing.user.id]);
        }
        else
            return;

        await targetChannel.sendTyping();
    }
    else if (typing.channel.type == ChannelType.GuildText) {
        if (!typing.channel.parent) return;
        if (typing.channel.parent.id != bCategory.id) return;

        var targetUser = client.users.cache.get(Object.keys(transferTable).find(key => 
            transferTable[key] == typing.channel.id
        ));
        if (!targetUser) return;
        if (!targetUser.dmChannel) return;

        targetUser.dmChannel.sendTyping();
    }

    fs.writeFileSync("./Data/TransferTable.json", JSON.stringify(transferTable, null, 4));
});

// user send message
client.on(Events.MessageCreate, async (msg) => {
    if (msg.author.bot) return;
    if (msg.content.startsWith(process.env.COMMAND_PREFIX)) return;

    var bGuild = client.guilds.cache.get(process.env.BACKSTAGE_GUILD_ID);
    var bCategory = bGuild.channels.cache.get(process.env.BACKSTAGE_CATEGORY_ID);

    var transferTable = JSON.parse(fs.readFileSync("./Data/TransferTable.json"));

    if (msg.channel.type == ChannelType.DM) {
        const modifiedUserTag = msg.author.tag.replace("#", "＃");

        var targetChannel;
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

        var sendAction = async (...args) => await targetChannel.send(...args);

        var refMsg;
        if (msg.reference) {
            var table = transferMessages.find(t => 
                t.originalMsgId == msg.reference.messageId
             || t  .targetMsgId == msg.reference.messageId
            );

            if (table) {
                refMsg = targetChannel.messages.cache.get(
                    table.originalMsgId == msg.reference.messageId ?
                        table.targetMsgId
                    :
                        table.originalMsgId
                );

                if (refMsg)
                    sendAction = async (...args) => await refMsg.reply(...args);
            }
        }

        var imageUrls = new Array();
        for (let atm of msg.attachments.values())
            imageUrls.push(atm.url);

        if (!imageUrls.length && !msg.stickers.size && !msg.content) return;

        await sendAction({
            content: msg.content,
            files: imageUrls,
            stickers: msg.stickers.size ? [ msg.stickers.first()?.id ] : undefined
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
        }).catch(err => {
            if (err instanceof DiscordAPIError) {
                targetChannel.send(`% Error while transfering message: ${err.message}.`);
                return;
            }
            throw err;
        });
    }
    else if (msg.channel.type == ChannelType.GuildText) {
        if (!msg.channel.parent) return;
        if (msg.channel.parent.id != bCategory.id) return;

        var targetUser = client.users.cache.get(Object.keys(transferTable).find(key => 
            transferTable[key] == msg.channel.id
        ));
        if (!targetUser) {
            await msg.reply(
                "Failed to find the user."
            );
            return;
        }

        var sendAction = async (...args) => await targetUser.send(...args);

        var refMsg;
        if (msg.reference && targetUser.dmChannel) {
            var table = transferMessages.find(t => 
                t.originalMsgId == msg.reference.messageId
             || t  .targetMsgId == msg.reference.messageId
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

        var imageUrls = new Array();
        for (let atm of msg.attachments.values())
            imageUrls.push(atm.url);

        if (!imageUrls.length && !msg.stickers.size && !msg.content) return;

        await sendAction({
            content: msg.content,
            files: imageUrls,
            stickers: msg.stickers.size ? [ msg.stickers.first()?.id ] : undefined
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
            if (err instanceof DiscordAPIError) {
                msg.reply(`% Failed to send message: ${err.message}.`);
                return;
            }
            throw err;
        });
    }

    fs.writeFileSync("./Data/TransferTable.json", JSON.stringify(transferTable, null, 4));
});

// user edit message
client.on(Events.MessageUpdate, async (oldMsg, newMsg) => {
    if (newMsg.author.bot) return;
    if (newMsg.content.startsWith(process.env.COMMAND_PREFIX)) return;
    if (oldMsg.content == newMsg.content) return;

    var bGuild = client.guilds.cache.get(process.env.BACKSTAGE_GUILD_ID);
    var bCategory = bGuild.channels.cache.get(process.env.BACKSTAGE_CATEGORY_ID);

    var table = transferMessages.find(t => t.originalMsgId == newMsg.id);
    if (!table) return;

    var channel;
    if (table.type == "from")
        channel = bCategory.children.cache.get(table.channelId);
    else
        channel = client.users.cache.get(table.userId).dmChannel;

    if (!channel) return;

    var targetMsg = channel.messages.cache.get(table.targetMsgId);
    if (!targetMsg) return;

    var imageUrls = new Array();
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

    var bGuild = client.guilds.cache.get(process.env.BACKSTAGE_GUILD_ID);
    var bCategory = bGuild.channels.cache.get(process.env.BACKSTAGE_CATEGORY_ID);

    var tableIndex = transferMessages.findIndex(t => t.originalMsgId == msg.id);
    if (tableIndex == -1) return;
    var table = transferMessages[tableIndex];

    var channel;
    if (table.type == "from")
        channel = bCategory.children.cache.get(table.channelId);
    else
        channel = client.users.cache.get(table.userId).dmChannel;
        
    if (!channel) return;

    var targetMsg = channel.messages.cache.get(table.targetMsgId);
    if (!targetMsg) return;
    
    await targetMsg.delete();
    transferMessages.splice(tableIndex);
});

// user add reaction
client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot) return;

    var bGuild = client.guilds.cache.get(process.env.BACKSTAGE_GUILD_ID);
    var bCategory = bGuild.channels.cache.get(process.env.BACKSTAGE_CATEGORY_ID);

    var transferTable = JSON.parse(fs.readFileSync("./Data/TransferTable.json"));

    var targetChannel;
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

        var targetUser = client.users.cache.get(Object.keys(transferTable).find(key => 
            transferTable[key] == reaction.message.channel.id
        ));
        if (!targetUser)
            return;
        if (!targetUser.dmChannel)
            return;

        targetChannel = targetUser.dmChannel;
    }

    var table = transferMessages.find(t => 
        t.originalMsgId == reaction.message.id
     || t  .targetMsgId == reaction.message.id
    );
    if (!table) return;

    var targetMsg = targetChannel.messages.cache.get(
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

    var bGuild = client.guilds.cache.get(process.env.BACKSTAGE_GUILD_ID);
    var bCategory = bGuild.channels.cache.get(process.env.BACKSTAGE_CATEGORY_ID);

    var transferTable = JSON.parse(fs.readFileSync("./Data/TransferTable.json"));

    var targetChannel;
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

        var targetUser = client.users.cache.get(Object.keys(transferTable).find(key => 
            transferTable[key] == reaction.message.channel.id
        ));
        if (!targetUser)
            return;
        if (!targetUser.dmChannel)
            return;

        targetChannel = targetUser.dmChannel;
    }

    var table = transferMessages.find(t => 
        t.originalMsgId == reaction.message.id
     || t  .targetMsgId == reaction.message.id
    );
    if (!table) return;

    var targetMsg = targetChannel.messages.cache.get(
        table.originalMsgId == reaction.message.id ?
            table.targetMsgId
        :
            table.originalMsgId
    );

    var messageReaction = targetMsg.reactions.cache
        .find(mr => mr.emoji.id == reaction.emoji.id);
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
    constructor (message = "Unknown") {
        super (message);
        this.name = "SlightError";
    }
}

const customSplit = function (str) {
    var arr    = str.split(/\u0020|\u3000/g);
    var result = new Array();

    var inside = false, lastLeft = -1;
    for (let [ i, str ] of arr.entries()) {
        let isLeft = false, isRight = false;
        if (str.startsWith("[")) isLeft = true;
        if (str.endsWith("]")) isRight = true;

        if (isLeft && isRight) {
            result.push(str.slice(1, -1));
            continue;
        }
        if (isLeft) {
            if (inside) throw new SlightError("Invalid left bracket", true);
            lastLeft = i, inside = true;
            continue;
        }
        if (isRight) {
            if (!inside) throw new SlightError("Invalid right bracket", true);
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

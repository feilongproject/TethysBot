import fs from "fs";
import fetch from 'node-fetch';
import FormData from 'form-data';
import { Embed, IMember, IMessage, IUser, MessageToCreate } from "qq-guild-bot";
import config from '../../config/config.json';


export class IMessageEx {
    author: IUser;
    channel_id: string;
    content: string;
    guild_id: string;
    id: string;
    member?: IMember;
    message_reference?: { message_id: string };
    seq?: number;
    seq_in_channel?: string;
    timestamp: string;
    src_guild_id?: string;
    mentions?: IUser[];

    guildName?: string;
    channelName?: string;
    messageType: "DIRECT" | "GUILD";

    constructor(msg: IMessage & MessageToCreate & IMessageDIRECT, messageType: "DIRECT" | "GUILD") {
        //log.debug(msg);
        this.author = msg.author;
        this.channel_id = msg.channel_id;
        this.content = msg.content ? msg.content.trim() : `null msg content ${new Date().getTime()}`;
        this.guild_id = msg.guild_id;
        this.id = msg.id;
        this.member = msg.member;
        this.message_reference = msg.message_reference;
        this.seq = msg.seq;
        this.seq_in_channel = msg.seq_in_channel;
        this.timestamp = msg.timestamp;
        this.src_guild_id = msg.src_guild_id;
        this.mentions = msg.mentions;

        this.messageType = messageType;

        if (messageType == "DIRECT") {
            log.info(`私信{${msg.guild_id}}[${msg.channel_id}](${msg.author.username}):${msg.content}`);
            return;
        }

        for (const guild of global.saveGuildsTree) {
            if (guild.id == this.guild_id) {
                for (const channel of guild.channel) {
                    if (channel.id == this.channel_id) {
                        this.guildName = guild.name;
                        this.channelName = channel.name;
                        log.info(`{${this.guildName}}[${this.channelName}](${this.author.username}|${this.author.id}):${this.content}`);
                        return;
                    }
                }
            }
        }
        log.warn(`unKnown message:{${msg.guild_id}}[${msg.channel_id}](${msg.author.username}):${msg.content}`);
    }

    async sendMsgEx(option: SendMsgOption) {
        return sendMsgEx(option, this);
    }

    async sendMarkdown(templateId: string, _params?: { [key: string]: string }, keyboardId?: string) {
        sendMarkdown(this.channel_id, templateId, _params, keyboardId);
    }
}

export async function sendMsgEx(option: SendMsgOption, msg?: IMessageEx) {
    //log.debug(option);
    const { ref, imagePath, content, embed } = option;
    const msgId = option.msgId || msg?.id;
    const guildId = option.guildId || msg?.guild_id;
    const channelId = option.channelId || msg?.channel_id;
    const sendType = option.sendType || msg?.messageType;

    if (imagePath) {
        var pushUrl =
            sendType == "DIRECT" ?
                `https://api.sgroup.qq.com/dms/${guildId}/messages` :
                `https://api.sgroup.qq.com/channels/${channelId}/messages`;
        const formdata = new FormData();
        formdata.append("msg_id", msgId);
        if (content) formdata.append("content", content);
        formdata.append("file_image", fs.createReadStream(imagePath));
        return fetch(pushUrl, {
            method: "POST",
            headers: {
                "Content-Type": formdata.getHeaders()["content-type"],
                "Authorization": `Bot ${config.initConfig.appID}.${config.initConfig.token}`,
            }, body: formdata
        }).then(res => { return res.json(); }).then(body => {
            if (body.code) log.error(body);
            return body;
        }).catch(error => {
            log.error(error);
        });
    } else {
        if (sendType == "GUILD") return global.client.messageApi.postMessage(channelId!, {
            content: content,
            msg_id: msgId,
            message_reference: (ref && msgId) ? { message_id: msgId, } : undefined,
            embed,
        });
        else return global.client.directMessageApi.postDirectMessage(guildId!, {
            msg_id: msgId,
            content: content,
            embed,
        });
    }
}

export async function sendMarkdown(channelId: string, templateId: string, _params?: { [key: string]: string }, keyboardId?: string) {
    const params: { key: string; values: [string]; }[] = [];
    for (const key in _params) params.push({ key, values: [_params[key]] });
    return fetch(`https://api.sgroup.qq.com/channels/${channelId}/messages`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bot ${config.initConfig.appID}.${config.initConfig.token}`,
        }, body: JSON.stringify({
            markdown: {
                custom_template_id: templateId,
                params: params,
            },
            keyboard: {
                id: keyboardId,
            },
        }),
    }).then(res => {
        return res.json();
    }).catch(err => {
        log.error(err);
    });
}

interface IMessageDIRECT {
    src_guild_id?: string;
}

interface SendMsgOption {
    ref?: boolean;
    imagePath?: string;
    imageUrl?: string;
    content?: string;
    embed?: Embed,
    initiative?: boolean;
    sendType?: "DIRECT" | "GUILD";
    msgId?: string;
    guildId?: string;
    channelId?: string;
}
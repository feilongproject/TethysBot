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
    member: IMember;
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
        const { ref, imagePath, content, embed } = option;
        const { id, guild_id, channel_id } = this;
        if (imagePath) {
            var pushUrl =
                this.messageType == "DIRECT" ?
                    `https://api.sgroup.qq.com/dms/${guild_id}/messages` :
                    `https://api.sgroup.qq.com/channels/${channel_id}/messages`;
            const formdata = new FormData();
            formdata.append("msg_id", id);
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
            if (this.messageType == "GUILD") {
                return global.client.messageApi.postMessage(channel_id, {
                    content: content,
                    msg_id: id,
                    message_reference: ref ? { message_id: id, } : undefined,
                    embed,
                });
            } else {
                return global.client.directMessageApi.postDirectMessage(guild_id, {
                    msg_id: id,
                    content: content,
                    embed,
                });
            }
        }
    }

    async sendMarkdown(templateId: string, _params?: { [key: string]: string }, keyboardId?: string) {
        const params: { key: string; values: [string]; }[] = [];
        for (const key in _params) params.push({ key, values: [_params[key]] });
        return fetch(`https://api.sgroup.qq.com/channels/${this.channel_id}/messages`, {
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
}


interface IMessageDIRECT {
    src_guild_id?: string;
}

interface SendMsgOption {
    ref?: boolean,
    imagePath?: string,
    content?: string,
    embed?: Embed,
}
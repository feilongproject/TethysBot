import fs from "fs";
import fetch from "node-fetch";
import { isAdmin } from "./admin";
import { IMessageEx } from "../lib/IMessageEx";

/* 
TODO: 关键词冲突解决
*/
export async function setKeyword(msg: IMessageEx) {

    const reg = /^(设置|提交)(精确|模糊)关键词(.*)$/.exec(msg.content)!;
    const status = reg[1] == "设置" ? "checked" : (reg[1] == "提交" ? "checking" : "delete");
    const type = /精确/.test(reg[2]) ? "accurate" : "blurry";
    const keyword = reg[3].trim();
    const refMsgId = msg.message_reference?.message_id;
    const isAdminRet = await isAdmin(msg.author.id, msg.member);

    if (status == "delete") {
        if (!isAdminRet) return msg.sendMsgEx({ content: "无权限删除" });
        return redis.keys(`keyword:${type}:${type == "accurate" ? keyword : `*${keyword}*`}`).then(keys => {
            if (keys[0]) return redis.del(keys[0]).then(() => `已删除关键词: ${keys[0]}`);
            else return `未找到对应关键词`;
        }).then(content => {
            return msg.sendMsgEx({ content });
        });
    }
    if (status == "checked" && !isAdminRet) return msg.sendMsgEx({ content: "无权限设置" });
    if (!keyword) return msg.sendMsgEx({ content: "未指定关键词" });
    if (!refMsgId) return msg.sendMsgEx({ content: "未指定关键词回复内容" });

    //const refMsg = msg.messageType == "GUILD" ? (await client.messageApi.message(msg.channel_id, refMsgId)).data.message.content : await redis.get(`directMsg:${refMsgId}`);
    const refMsg = (await client.messageApi.message(msg.channel_id, refMsgId)).data.message;
    if (!refMsg) return msg.sendMsgEx({ content: "未找到引用消息" });
    const imageName = refMsg.attachments ? await fetch("https://" + refMsg.attachments[0].url).then(async res => {
        const buff = await res.buffer();
        const _name = `autoDownload-${(refMsg.attachments[0] as any).filename}`;
        fs.writeFileSync(`${_path}/imageData/${_name}`, buff);
        return _name;
    }) : "NONE";

    return redis.hSet(`keyword:${type}:${keyword}`, [
        ["content", refMsg.content],
        ["status", status],
        ["ownerId", msg.author.id],
        ["ownerName", msg.author.username],
        ["refOwnerId", refMsg.author.id],
        ["refOwnerName", refMsg.author.username],
        ["imageName", imageName],
    ]).then(() => {
        return msg.sendMsgEx({
            content: [
                `已${status == "checked" ? "设置" : "提交"}关键词回复`,
                `类型: ${type == "accurate" ? "精确" : "模糊"}`,
                `关键词: ${keyword}`,
                `回复内容${imageName == "NONE" ? "" : "(带图)"}: ${refMsg.content}`,
            ].join("\n"),
        });
    });
}


export async function isKeyword(msg: IMessageEx) {

    const accurate = await redis.hGetAll(`keyword:accurate:${msg.content}`);
    if (devEnv) log.debug(accurate);
    if (accurate.content && accurate.status == "checked") {
        if (accurate.imageName == "NONE") return msg.sendMsgEx({ content: accurate.content });
        return msg.sendMsgEx({
            content: accurate.content,
            imagePath: `${_path}/imageData/${accurate.imageName}`
        });
    }

    return redis.keys(`keyword:blurry:*`).then(async keys => {
        if (devEnv) log.debug(keys);
        for (const _key of keys) {
            const keyword = _key.match(/^keyword:blurry:(.*)$/)![1];
            if (msg.content.includes(keyword) && await redis.hGetAll(_key).then(blurry => {
                if (devEnv) log.debug(keyword);
                if (blurry.status == "checked") return msg.sendMsgEx({ content: blurry.content });
            })) return;
        }
    });
}
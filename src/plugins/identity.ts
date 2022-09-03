import { IMessageEx } from "../lib/IMessageEx";

export async function identityList(msg: IMessageEx) {
    var rolesData = (await global.client.roleApi.roles(msg.guild_id)).data.roles;
    var sendStr: string[] = [];
    for (const role of rolesData) {
        const setEmoji = await global.redis.hGet(`emojiIdentity:${msg.guild_id}`, role.id);
        sendStr.push(`身份组: ${role.name}(id: ${role.id})${setEmoji ? `当前表情为<emoji:${setEmoji}>` : `未设置表情`}`);
    }
    msg.sendMsgEx({ content: sendStr.join("\n") });
}

export async function identitySet(msg: IMessageEx) {
    const reg = /(\d+) <emoji:(\d+)>$/.exec(msg.content);
    if (reg) {
        const identity = reg[1];
        const emojiId = reg[2];
        if (identity != '' && emojiId != '') {
            const group = global.emojiIdentity[msg.guild_id];
            if (group && group[identity]) global.redis.hSet(`emojiIdentity:${msg.guild_id}`, identity, emojiId).then(() => {
                return msg.sendMsgEx({ content: `已设置身份组[${group[identity]} (${identity})]的归属表情为<emoji:${emojiId}>` });
            });
            else msg.sendMsgEx({ content: "错误的身份组，请输入 列出身份组 来查看当前频道所有身份组id" });

        } else msg.sendMsgEx({ content: `命令错误，未找到指定身份组或表情，请使用 "设置表情身份组 身份组id 表情"设置` });

    } else msg.sendMsgEx({ content: `命令错误，未找到指定身份组或表情，请使用 "设置表情身份组 身份组id 表情"设置` });

}


export async function identityInfo(msg: IMessageEx) {
    if (msg.message_reference?.message_id) {
        const msgId = msg.message_reference.message_id;
        global.redis.set(`identityMsgId:${msg.guild_id}`, msgId).then(() => {
            msg.sendMsgEx({ content: `已设置分配表情的信息(信息id: ${msgId})` });
        });
    } else {
        msg.sendMsgEx({ content: `未选择将要设置为身份组分配的消息，请引用消息后再次设置` });
    }
    //log.debug(msg);
}
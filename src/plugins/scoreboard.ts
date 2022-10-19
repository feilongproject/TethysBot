import fetch from "node-fetch";
import { IMember } from "qq-guild-bot";
import { IMessageEx } from "../lib/IMessageEx";
import config from '../../config/config.json';

/**
 * 查询用户点数
 * @param msg 
 */
export async function scoreboardQuery(msg: IMessageEx) {
    const score = await global.redis.zScore(`scoreboard`, msg.author.id);
    const answeredQuestions = await global.redis.hGet(`user:data:${msg.author.id}`, "answeredQuestions");

    msg.sendMsgEx({
        embed: {
            title: `${msg.author.username}的点数信息`,
            prompt: `${msg.author.username}的点数信息`,
            thumbnail: { url: msg.author.avatar, },
            fields: [
                { name: score ? `当前点数：${score}点` : `未获取任何点数`, },
                { name: answeredQuestions ? `回答题数：${answeredQuestions}题` : `从未回答任何问题` }
            ],
        },
    });
}

/**
 * 查询点数排名
 * @param msg 
 */
export async function scoreboardRanking(msg: IMessageEx) {
    global.redis.zRangeWithScores("scoreboard", 0, -1).then(async datas => {
        datas.sort((v1, v2) => v2.score - v1.score);
        var currentUserRank = -1;
        const sendStr: string[] = [`<@${msg.author.id}>`, "点数排名"];
        for (const [iv, data] of datas.entries()) {
            if (data.value == msg.author.id) currentUserRank = iv + 1;
            const username = await global.redis.hGet("id->name", data.value);
            sendStr.push(`${iv + 1}. ${username}   ${data.score}点数`);
        }
        sendStr.push("", currentUserRank == -1 ? `未找到你的排名` : `当前排名：第${currentUserRank}名`);
        return msg.sendMsgEx({ content: sendStr.join("\n") });
    }).catch(err => {
        log.error(err);
    });
}

/**
 * 管理员对点数操作
 * @param msg 
 * @returns 
 */
export async function scoreboardChange(msg: IMessageEx) {
    const scReg = /^#(添加|扣除)(\d+)点数/.exec(msg.content);
    const scOpt = scReg![1] == "添加" ? 1 : -1;
    const scScore = scReg![2];

    if (!msg.mentions || msg.mentions.length == 0) {
        msg.sendMsgEx({ content: `未指定@人员，无法操作！` });
        return;
    }
    const sendStr: string[] = [`已为以下用户${scReg![1]}点数${scScore}点`];
    const queue: Promise<number>[] = [];
    for (const user of msg.mentions) {
        await global.redis.hSet("id->name", user.id, user.username);
        if (user.bot) continue;
        sendStr.push(`${user.username}`);
        queue.push(global.redis.zIncrBy(`scoreboard`, parseInt(scScore) * scOpt, user.id));
    }
    Promise.all(queue).then(() => {
        msg.sendMsgEx({ content: sendStr.join("\n") });
    });
}

/**
 * 管理员设置答案对应的点数
 * @param msg 
 */
export async function scoreboardSetAnswer(msg: IMessageEx) {
    const regAnswer = /^#答案(.+)点数(\d+)人数(\d+)$/.exec(msg.content);
    //log.debug(regAnswer);
    const answer = regAnswer![1];
    const score = regAnswer![2];
    const memberNum = regAnswer![3];
    global.redis.hSet(`answers:${answer}`, "answer", answer);
    global.redis.hSet(`answers:${answer}`, "score", score);
    global.redis.hSet(`answers:${answer}`, "memberNum", memberNum);

    const answerConfig: AnswerConfig = {
        times: 1,
        useUsers: []
    };
    global.redis.hSet(`answers:${answer}`, "config", JSON.stringify(answerConfig));
    msg.sendMsgEx({
        content:
            `答案已设置` +
            `\n答案：${answer}` +
            `\n点数：${score}` +
            `\n人数：${memberNum}`
    });
}

//暂时无法使用
export async function scoreboardChangeWithIdentity(msg: IMessageEx) {
    const scReg = /^#(添加|扣除)(.+)身份组(\d+)(点数)?$/.exec(msg.content);
    const scOpt = scReg![1] == "添加" ? 1 : -1;
    const partId = scReg![2];
    const scScore = scReg![3];

    const guildId = msg.src_guild_id || msg.guild_id;

    const _rolesData = await global.client.roleApi.roles(guildId).catch(err => {
        log.error(err);
    });
    if (!_rolesData) return;

    var rolesData = _rolesData.data.roles;
    for (const role of rolesData) {
        if (role.id == partId) {
            const roleMember = await getRoleMember(guildId, role.id).catch(err => { log.error(err); });
            if (roleMember?.code == 11253) {
                const reqData = await global.client.guildPermissionsApi.postPermissionDemand(msg.guild_id, {
                    channel_id: msg.channel_id,
                    api_identify: {
                        path: '/guilds/{guild_id}/roles/{role_id}/members',
                        method: 'GET',
                    }
                }).catch(err => { log.error(err); });
                log.debug(reqData);
                return;
            };
            if (!roleMember || !roleMember.data) return;
            const queue: Promise<number>[] = [];
            for (const member of roleMember.data) {
                queue.push(
                    global.redis.zIncrBy(`scoreboard`, (parseInt(scScore) * scOpt) || 0, member.user.id)
                );
            }
            Promise.all(queue).then(que => {
                msg.sendMsgEx({ content: `已对身份组id:${partId}的所有${que.length}个用户的点数变更了${parseInt(scScore) * scOpt}` });
            }).catch(err => {
                log.error(err);
            });
        }
    }
}

/**
 * 回答问题
 * @param msg 
 */
export async function scoreboardAnswer(msg: IMessageEx) {
    const userId = msg.author.id;
    global.redis.hGetAll(`answers:${msg.content}`).then(memberNum => {
        if (memberNum && memberNum["answer"]) {
            const answerConfig: AnswerConfig = JSON.parse(memberNum["config"]);

            //&& parseInt(memberNum["memberNum"]) > 0
            if (answerConfig.useUsers.length >= parseInt(memberNum["memberNum"])) {
                msg.sendMsgEx({ content: `回答人数已达上限` });
                return;
            }
            for (const useUser of answerConfig.useUsers) {
                if (useUser.userId == msg.author.id) {
                    msg.sendMsgEx({ content: `问题已回答` });
                    return;
                }
            }

            global.redis.zIncrBy(`scoreboard`, parseInt(memberNum["score"]), userId).then(nowScore => {
                answerConfig.useUsers.push({
                    userId: msg.author.id,
                    userName: msg.author.username,
                });
                return msg.sendMsgEx({ content: `问题回答正确，获得点数${memberNum["score"]}，当前总点数${nowScore}` });
            }).then(() => {
                return global.redis.hIncrBy(`user:data:${msg.author.id}`, "answeredQuestions", 1);
            }).then(() => {
                return global.redis.hSet(`answers:${msg.content}`, "config", JSON.stringify(answerConfig));
            }).catch(err => {
                log.error(err);
            });
        }
    }).catch(err => {
        log.error(err);
    });
}

async function getRoleMember(guildId: string, roleId: string, start_index = 0, limit = 400) {
    return fetch(`https://api.sgroup.qq.com/guilds/${guildId}/roles/${roleId}/members?start_index=${start_index}&limit=${limit}`, {
        method: "GET",
        headers: {
            "Authorization": `Bot ${config.initConfig.appID}.${config.initConfig.token}`,
        }
    }
    ).then(res => {
        return res.json();
    }).then((json: RoleMember) => {
        return json;
    }).catch(err => {
        log.error(err);
    });
}




interface RoleMember {
    code: number;
    message: string;
    data: IMember[];
    next: string;
}
interface AnswerConfig {
    times: number;
    useUsers: {
        userId: string;
        userName: string;
    }[];
}
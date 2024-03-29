import fetch from "node-fetch";
import { IMember } from "qq-guild-bot";
import { IMessageEx } from "../lib/IMessageEx";
import config from '../../config/config.json';

export async function scoreboardQuery(msg: IMessageEx) {
    const score = await global.redis.zScore(`scoreboard:积分`, msg.author.id);
    const answeredQuestions = await global.redis.hGet(`user:data:${msg.author.id}`, "answeredQuestions");
    return msg.sendMsgEx({
        embed: {
            title: `${msg.author.username}的积分信息`,
            prompt: `${msg.author.username}的积分信息`,
            thumbnail: { url: msg.author.avatar, },
            fields: [
                { name: `当前积分：${score}` },
                { name: answeredQuestions ? `回答题数：${answeredQuestions}题` : `从未回答任何问题` }
            ],
        },
    });
}

export async function scoreboardRankList(msg: IMessageEx) {
    const boardName = /^(.+)排名$/.exec(msg.content)![1];

    if (!await redis.hExists(`scoreboardList`, boardName)) {
        return msg.sendMsgEx({
            content: `未找到指定榜单`,
        });
    }

    return redis.zRangeWithScores(`scoreboard:${boardName}`, 0, -1).then(async datas => {
        datas.sort((v1, v2) => v2.score - v1.score);
        var currentUserRank = -1;
        const sendStr: string[] = [`<@${msg.author.id}>`, "分数排名"];
        for (const [iv, data] of datas.entries()) {
            if (data.value == msg.author.id) currentUserRank = iv + 1;
            if (iv >= 10) continue;
            const username = await global.redis.hGet("id->name", data.value) || data.value;
            sendStr.push(`${iv + 1}. ${username}   ${data.score}分`);
        }
        sendStr.push("", currentUserRank == -1 ? `未找到你的排名` : `当前排名：第${currentUserRank}名`);
        return msg.sendMsgEx({ content: sendStr.join("\n") });
    });
}

export async function scoreboardRankListMy(msg: IMessageEx) {
    const boardList = await redis.hKeys("scoreboardList");
    const rankListMy: { score: number; value: string; rank: number; boardName: string; f: boolean; }[] = [];
    const l: Promise<{ boardName: string; sc: { score: number; value: string; }[] }>[] = [];
    for (const boardName of boardList) {
        l.push(redis.zRangeWithScores(`scoreboard:${boardName}`, 0, -1).then(sc => {
            sc.sort((v1, v2) => v2.score - v1.score);
            return { sc, boardName };
        }));
    }
    return Promise.all(l).then((rankLists) => {
        for (const list of rankLists) {
            var f = false;
            for (const [iv, sc] of list.sc.entries()) {
                if (sc.value == msg.author.id) {
                    f = true;
                    rankListMy.push({ ...sc, rank: iv, boardName: list.boardName, f });
                    break;
                }
            }
            if (!f) rankListMy.push({ score: 0, value: "", rank: list.sc.length, boardName: list.boardName, f });
        }
    }).then(() => {
        const rankListStr: string[] = [`<@${msg.author.id}>`];
        for (const rank of rankListMy) {
            rankListStr.push(`榜单名称：${rank.boardName} 排名：第${rank.rank + 1}名 ${rank.score}分`);
        }
        return msg.sendMsgEx({ content: rankListStr.join(`\n`), });
    });
}

export async function scoreboardList(msg: IMessageEx) {
    return redis.hKeys(`scoreboardList`).then(boards => {
        boards.unshift(`当前榜单列表：`);
        return msg.sendMsgEx({ content: boards.join("\n") });
    });
}

export async function scoreboardCreate(msg: IMessageEx) {
    const reg = /^(添加|删除)(.+)榜单$/.exec(msg.content)!;
    const opt = reg[1];
    const boardName = reg[2];
    if (opt == "添加") return redis.hSet(`scoreboardList`, boardName, 1).then(() => {
        return msg.sendMsgEx({ content: `已添加榜单：${boardName}` });
    });
    else return redis.hDel(`scoreboardList`, boardName).then(() => {
        return msg.sendMsgEx({ content: `已删除榜单：${boardName}` });
    });
}

export async function scoreboardChange(msg: IMessageEx) {
    const scReg = /^(添加|扣除)\s*((<@!?\d+>\s*|\d+\s*)+)\s(\d+)(.+)$/.exec(msg.content)!;
    const scOpt = scReg[1] == "添加" ? 1 : -1;
    const scMembers = scReg[2].split(/<@!?(?!=\d+)|>?\s+|>/);
    const scScore = Number(scReg[4]) * scOpt;
    const boardName = scReg[5];

    if (!await redis.hExists(`scoreboardList`, boardName))
        return msg.sendMsgEx({ content: `未找到指定榜单` });
    if (!scMembers || scMembers.length == 0)
        return msg.sendMsgEx({ content: `未指定人员，无法操作！` });

    const sendStr: string[] = [`已为以下用户${scReg[1]}${boardName}${scScore}点`];
    const queue: Promise<number>[] = [];
    for (const tN of (msg.mentions || [])) await redis.hSet("id->name", tN.id, tN.username);
    for (var _member of scMembers) {
        _member = _member.trim();
        if (!/^\d+$/.test(_member)) continue;
        sendStr.push(await redis.hGet("id->name", _member) || _member);
        queue.push(redis.zIncrBy(`scoreboard:${boardName}`, scScore, _member));
    }
    return Promise.all(queue).then(() => {
        msg.sendMsgEx({ content: sendStr.join("\n") });
    });
}

export async function scoreboardSetAnswer(msg: IMessageEx) {
    const regAnswer = /^答案(.+)积分(\d+)人数(\d+)$/.exec(msg.content)!;
    //log.debug(regAnswer);
    const answer = regAnswer[1];
    const score = regAnswer[2];
    const memberNum = regAnswer[3];
    const answerConfig: AnswerConfig = { times: 1, useUsers: [] };
    return redis.hSet(`answers:${answer}`, [
        ["answer", answer],
        ["score", score],
        ["memberNum", memberNum],
        ["config", JSON.stringify(answerConfig)],
    ]).then(() => {
        return msg.sendMsgEx({
            content:
                `答案已设置` +
                `\n答案：${answer}` +
                `\n积分：${score}` +
                `\n人数：${memberNum}`
        });
    });
}

export async function scoreboardChangeWithIdentity(msg: IMessageEx) {
    const scReg = /^(添加|扣除)(\d+)身份组(\d+)(.+)$/.exec(msg.content)!;
    const scOpt = scReg[1] == "添加" ? 1 : -1;
    const partId = scReg[2];
    const scScore = scReg[3];
    const boardName = scReg[4];

    const guildId = msg.src_guild_id || msg.guild_id;

    const rolesData = await client.roleApi.roles(guildId).catch(err => { log.error(err); });
    if (!rolesData) return;
    for (const role of rolesData.data.roles) {
        if (role.id != partId) continue;
        const roleMember = await getRoleMembersAll(guildId, role.id).catch(err => { log.error(err); });
        if (roleMember?.code || roleMember?.message || !roleMember || !roleMember.data || roleMember.data.length == 0)
            return msg.sendMsgEx({
                content: `获取身份组成员出错` +
                    `\ncode: ${roleMember?.code}` +
                    `\nmessage: ${roleMember?.message}`
            });
        const queue: Promise<number>[] = [];
        for (const member of roleMember.data) queue.push(redis.zIncrBy(`scoreboard:${boardName}`, (parseInt(scScore) * scOpt) || 0, member.user.id));
        return Promise.all(queue).then(que =>
            msg.sendMsgEx({ content: `已对身份组id:${partId}的所有${que.length}个用户的${boardName}${scReg[1]}了${parseInt(scScore)}` })
        ).catch(err => {
            log.error(err);
        });
    }
}

export async function scoreboardAnswer(msg: IMessageEx) {
    const userId = msg.author.id;
    return redis.hGetAll(`answers:${msg.content}`).then(memberNum => {
        if (memberNum && memberNum["answer"]) {
            const answerConfig: AnswerConfig = JSON.parse(memberNum["config"]);

            if (answerConfig.useUsers.length >= Number(memberNum["memberNum"]))
                return msg.sendMsgEx({ content: `回答人数已达上限` });
            for (const useUser of answerConfig.useUsers)
                if (useUser.userId == msg.author.id)
                    return msg.sendMsgEx({ content: `问题已回答` });

            return redis.zIncrBy(`scoreboard:积分`, Number(memberNum["score"]), userId).then(nowScore => {
                answerConfig.useUsers.push({ userId: msg.author.id, userName: msg.author.username });
                return msg.sendMsgEx({ content: `问题回答正确，获得积分${memberNum["score"]}，当前总积分${nowScore}` });
            }).then(() => {
                return redis.hIncrBy(`user:data:${msg.author.id}`, "answeredQuestions", 1);
            }).then(() => {
                return redis.hSet(`answers:${msg.content}`, "config", JSON.stringify(answerConfig));
            });
        }
    });
}

async function getRoleMembersAll(guildId: string, roleId: string) {
    var isContinue = true;
    const data: RoleMember = { data: [], next: "0" };
    const limit = 400;
    while (isContinue && !data.code && !data.message) {
        await fetch(`https://api.sgroup.qq.com/guilds/${guildId}/roles/${roleId}/members?start_index=${data.next}&limit=${limit}`, {
            method: "GET",
            headers: { "Authorization": `Bot ${config.initConfig.appID}.${config.initConfig.token}` }
        }
        ).then(res => {
            return res.json();
        }).then((json: RoleMember) => {
            data.data.push(...json.data);
            if (json.next == "0") isContinue = false;
            data.code = json.code;
            data.next = json.next;
            data.message = json.message;
        }).catch(err => {
            log.error(err);
        });
    }
    return data;
}


interface RoleMember {
    code?: number;
    message?: string;
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
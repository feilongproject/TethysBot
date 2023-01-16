import { isAdmin } from "./admin";
import { IMessageEx } from "../lib/IMessageEx";
import { idToName, sleep, timeConver } from "../lib/common";


export async function createUnion(msg: IMessageEx) {
    if (!msg.member) return;
    if (!(devEnv || msg.member.roles.includes("12597148"))) return;

    const unionName = (msg.content.match(/创建公会(.+)/) || [])[1].trim();
    if (!unionName) {
        return msg.sendMsgEx({ content: `公会名称为空` });
    } else if ((await redis.exists(`union:${unionName}`)) == 1) {
        return msg.sendMsgEx({ content: `该公会名称已存在` });
    } else if (/\d/.test(unionName)) {
        return msg.sendMsgEx({ content: `公会名称中不可出现阿拉伯数字` });
    }
    const unionList = await getUnionInformationList();
    const inUnion = await findMemberInUnions(unionList, msg.author.id);
    if (inUnion?.auth == "master") return msg.sendMsgEx({ content: `您已创建过公会` });
    if (inUnion?.auth == "member") return msg.sendMsgEx({ content: `您已加入公会` });
    if (inUnion?.auth == "invited") return msg.sendMsgEx({ content: `您有一个来自${inUnion.name}公会的邀请` });
    //log.debug("create", unionName);
    return redis.hSet(`union:${unionName}`, [
        [`master`, msg.author.id],
        [`integral`, 0],
        ["memberLimit", 10],
        [`member:${msg.author.id}`, "master"],
    ]).then(async () => {
        return msg.sendMsgEx({
            content: `公会创建成功` +
                `\n输入“公会信息”便可查询公会信息` +
                `\n通过邀请入会指令邀请他人入会`,
        });
    });

}

export async function getUnionInformation(msg: IMessageEx) {
    const unionName = msg.content.replaceAll("公会信息", "").trim();

    if (unionName && !await redis.exists(`union:${unionName}`))
        return msg.sendMsgEx({ content: `未查询到<${unionName}>公会信息，请确认公会名称无误后再次查询` });

    const unionInformationList = (await getUnionInformationList()).sort((a, b) => b.integral - a.integral);
    const findUnion = unionName ? await getUnionInformationMeta(`union:${unionName}`) : await findMemberInUnions(unionInformationList, msg.author.id, ["master", "member"]);

    if (!findUnion) return msg.sendMsgEx({ content: `请输入要查询的公会名称` });

    const memberStrList: string[] = [];
    var rankStr = ``;
    for (const [index, _unionInfo] of unionInformationList.entries()) {
        if (_unionInfo.name == (unionName || findUnion.name)) {
            for (const member of _unionInfo.members)
                if (member.auth == "member") memberStrList.push(`${await idToName(member.uid)}`);
            rankStr = `第${index + 1}名`;
        }
    }

    return msg.sendMsgEx({
        content: //`查询${unionName ? `公会<${unionName}>` : "已加入公会"}的信息如下\n` +
            `公会名称：${findUnion.name}` +
            `\n公会会长：${await idToName(findUnion.master)}` + /* `(id：${unionMaster})` + */
            `\n公会成员：${memberStrList.join(`，`)}` +
            `\n公会积分：${findUnion.integral}` +
            `\n公会排名：${rankStr}`,
    });
}

export async function getUnionRank(msg: IMessageEx) {
    const medalStr = Array.from("🥇🥈🥉④⑤⑥⑦⑧⑨⑩");
    const rankStr = [];
    const unionList = await getUnionInformationList().then(_unionList => _unionList.sort((a, b) => b.integral - a.integral));

    var inUnion: string | null = null;
    for (const [index, unionInfo] of unionList.entries()) {
        const findMember = memberIsInUnion(msg.author.id, unionInfo);
        if (findMember) inUnion = `${unionInfo.name}公会排名：${index + 1}`;
        if (index >= 10) continue;
        rankStr.push(`${medalStr[index]}  ${unionInfo.name}公会  会长：${await idToName(unionInfo.master)}`);
    }
    if (inUnion) rankStr.push(`——————————————`, inUnion);
    return msg.sendMsgEx({ content: rankStr.join("\n") });
}

export async function changeUnionScore(msg: IMessageEx) {

    if (!await isAdmin(msg.author.id, msg.member)) msg.sendMsgEx({
        content: `权限不足`,
    });
    const exp = /^(增加|扣减)(.+[^\d])(\d+)积分$/.exec(msg.content)!;
    const type = exp[1].includes("加") ? 1 : (exp[1].includes("扣") ? -1 : 0);
    const unionName = exp[2].trim();
    const optScore = type * Number(exp[3]);

    if (!await redis.exists(`union:${unionName}`)) return msg.sendMsgEx({
        content: `${unionName}公会不存在`,
    });
    //log.debug(unionName, optScore);
    return redis.hIncrBy(`union:${unionName}`, "integral", optScore).then((_n) => {
        return msg.sendMsgEx({
            content: `已${exp[1]}${unionName}公会${Math.abs(optScore)}积分，目前一共${_n}积分`,
        });
    });
}

export async function inviteJoinUnion(msg: IMessageEx) {

    if (!msg.mentions) return msg.sendMsgEx({ content: `未指定邀请用户` });

    const unionInformationList = await getUnionInformationList();
    const inviteUnionInfo = await findMemberInUnions(unionInformationList, msg.author.id);

    if (!inviteUnionInfo) {
        return msg.sendMsgEx({ content: `您还没有公会，请先创建公会吧`, });
    } else if (inviteUnionInfo.auth != "master") {
        return msg.sendMsgEx({ content: `您还不是${inviteUnionInfo.name}公会会长，不可邀请他人入会`, });
    }

    for (const inviteMember of msg.mentions) {
        if (inviteMember.bot) continue;
        if (inviteUnionInfo.members.length > inviteUnionInfo.memberLimit) {
            return msg.sendMsgEx({ content: `当前公会已满人` });
        } else {
            const _inviteMemberUnionInfo = await findMemberInUnions(unionInformationList, inviteMember.id);
            const auth = _inviteMemberUnionInfo?.auth!;
            if (!_inviteMemberUnionInfo) {
                await msg.sendMarkdown("102018808_1666627777", {
                    union_name: `${inviteUnionInfo.name}`,
                    invite_member: `<@${msg.author.id}>`,
                    invited_member: `<@${inviteMember.id}>`,
                    status: "确认中",
                    invite_time: timeConver(msg.timestamp),
                }, "102018808_1666629168").then(async () => {
                    inviteUnionInfo.members.push({ uid: inviteMember.id, auth: "invited" });
                    return redis.hSet(`union:${inviteUnionInfo.name}`, `member:${inviteMember.id}`, "invited");
                }).then(() => {
                    return redis.setEx(`ttl:inviteJoinUnion:${inviteMember.id}`, 60 * 60 * 1, new Date().getTime().toString());
                });
            } else if (auth == "invited") {
                await msg.sendMsgEx({ content: `${inviteMember.username} 正在被邀请` });
            } else {
                await msg.sendMsgEx({ content: `${inviteMember.username} 已是${_inviteMemberUnionInfo.name}公会${auth == "master" ? '会长' : '成员'}` });
            }
        }
        await sleep(500);
    }
}

export async function processInviteJoinUnion(msg: IMessageEx) {

    const type = /(确认|拒绝)/.exec(msg.content)![1] == "确认" ? "acc" : "rej";
    const unionInformationList = await getUnionInformationList();
    const inviteUnionInfo = await findMemberInUnions(unionInformationList, msg.author.id);
    var replayStr = ``;

    if (!inviteUnionInfo || inviteUnionInfo.auth != "invited") {
        replayStr = `<@${msg.author.id}>当前不存在公会邀请`;
    } else if (type == "acc") {
        await redis.hSet(`union:${inviteUnionInfo.name}`, `member:${msg.author.id}`, "member");
        replayStr = `<@${msg.author.id}>已确认加入${inviteUnionInfo.name}公会`;
    } else if (type == "rej") {
        await redis.hDel(`union:${inviteUnionInfo.name}`, `member:${msg.author.id}`);
        replayStr = `<@${msg.author.id}>已拒绝加入${inviteUnionInfo.name}公会`;
    }
    return redis.del(`ttl:inviteJoinUnion:${msg.author.id}`).then(() => {
        return msg.sendMsgEx({ content: replayStr });
    })
}

export async function removeUnionMember(msg: IMessageEx) {
    if (!msg.mentions) return msg.sendMsgEx({ content: `未指定移除用户` });
    const unionInformationList = await getUnionInformationList();
    const masterUnionInfo = await findMemberInUnions(unionInformationList, msg.author.id);

    if (!masterUnionInfo) return msg.sendMsgEx({ content: `您还没有公会，请先创建公会` });
    if (masterUnionInfo.auth != "master") return msg.sendMsgEx({ content: `您还不是${masterUnionInfo.name}公会会长，不可移除他人` });

    for (const removeMember of msg.mentions) {
        if (removeMember.bot) continue;
        await redis.hDel(`union:${masterUnionInfo.name}`, `member:${removeMember.id}`).then(() => {
            return msg.sendMsgEx({ content: `已从${masterUnionInfo.name}公会移除成员${removeMember.username}` });
        });
    }
}

export async function moveUnionMaster(msg: IMessageEx) {
    if (!msg.mentions) return msg.sendMsgEx({ content: `未指定转让用户` });
    const unionInformationList = await getUnionInformationList();
    const masterUnionInfo = await findMemberInUnions(unionInformationList, msg.author.id);
    if (!masterUnionInfo) return msg.sendMsgEx({ content: `您还没有公会，无法转让` });
    if (masterUnionInfo.auth != "master") return msg.sendMsgEx({ content: `您还不是${masterUnionInfo.name}公会会长，不可转让公会` });
    for (const moveMember of msg.mentions) {
        if (moveMember.bot) continue;
        return redis.hDel(`union:${masterUnionInfo.name}`, `member:${msg.author.id}`).then(() => {
            return redis.hSet(`union:${masterUnionInfo.name}`, [
                ["master", moveMember.id],
                [`member:${moveMember.id}`, "master"],
            ]);
        }).then(() => {
            return msg.sendMsgEx({ content: `已转让${masterUnionInfo.name}公会会长给${moveMember.username}` });
        });
    }
}

export async function quitUnion(msg: IMessageEx) {
    const unionInformationList = await getUnionInformationList();
    const masterUnionInfo = await findMemberInUnions(unionInformationList, msg.author.id);
    if (!masterUnionInfo) return msg.sendMsgEx({ content: `您还没有加入公会` });
    return redis.hDel(`union:${masterUnionInfo.name}`, `member:${msg.author.id}`).then(() => {
        return msg.sendMsgEx({ content: `${msg.author.username}已退出${masterUnionInfo.name}公会` });
    });
}

function memberIsInUnion(uid: string, unionInfo: UnionListCell): boolean {
    //for (const unionInfo of unionList)
    for (const member of unionInfo.members)
        if (member.uid == uid) return true;
    return false;
}

async function getUnionInformationList(): Promise<UnionList> {
    const unionKeys = await redis.keys(`union:*`);
    const unionList: UnionList = [];
    for (const unionKey of unionKeys)
        unionList.push(await getUnionInformationMeta(unionKey));
    return unionList;
}

async function getUnionInformationMeta(unionKeyName: string): Promise<UnionListCell> {

    const members: UnionListMember[] = [];
    const kv = await redis.hGetAll(unionKeyName);
    for (const key in kv) {
        const reg = /^member:(\d+)$/.exec(key);
        if (!reg) continue;
        if (kv[key] == "invited" && !await redis.exists(`ttl:inviteJoinUnion:${reg[1]}`)) {
            await redis.hDel(unionKeyName, key);
            continue;
        } else {
            members.push({
                uid: reg[1],
                auth: kv[key] as "master" | "member" | "invited",
            });
        }
    }
    return {
        name: unionKeyName.replace(/^union:/, ""),
        master: kv["master"],
        integral: Number(kv["integral"]) || 0,
        memberLimit: Number(kv["memberLimit"]) || 0,
        members,
    }
}

function findMemberInUnions(unionInfos: UnionList, uid: string, auth?: string[]): Promise<(UnionListMember & UnionListCell) | null> {
    return new Promise((resolve, reject) => {
        for (const unionInfo of unionInfos)
            for (const member of unionInfo.members)
                if (member.uid == uid && (auth ? auth.includes(member.auth) : true))
                    resolve(Object.assign(unionInfo, member));
        resolve(null);
    });
}

type UnionList = UnionListCell[];
interface UnionListCell {
    name: string;
    master: string;
    integral: number;
    memberLimit: number;
    members: UnionListMember[];
}
interface UnionListMember {
    uid: string;
    auth: "master" | "member" | "invited";
}
import { idToName, isAdmin, sleep } from "../lib/common";
import { IMessageEx } from "../lib/IMessageEx";


export async function createUnion(msg: IMessageEx) {
    const unionName = (msg.content.match(/创建公会(.+)/) || [])[1].trim();
    if (!unionName) {
        return msg.sendMsgEx({ content: `公会名称为空` });
    } else if ((await redis.exists(`union:${unionName}`)) == 1) {
        return msg.sendMsgEx({ content: `该公会名称已存在` });
    }
    const unionList = await getUnionInformationList();
    for (const unionListCell of unionList) {
        if (unionListCell.master == msg.author.id)
            return msg.sendMsgEx({ content: `您已创建过公会` });
        if (memberIsInUnion(msg.author.id, unionListCell))
            return msg.sendMsgEx({ content: `您已加入公会` });
    }
    //log.debug("create", unionName);
    return redis.hSet(`union:${unionName}`, [
        [`master`, msg.author.id],
        [`member:${msg.author.id}`, "master"],
        [`integral`, 0],
        ["memberLimit", 10],
    ]).then(async () => {
        return msg.sendMsgEx({
            content: `公会创建成功` +
                `\n输入“公会信息”便可查询公会信息` +
                `\n通过邀请入会指令邀请他人入会`,
        });
    });

}

export async function getUnionInformation(msg: IMessageEx) {
    const _unionName = msg.content.replaceAll("公会信息", "").trim();
    const unionName = _unionName || await redis.keys(`union:*`).then(async (__unionNames) => {
        for (const __unionName of __unionNames) {
            //log.debug(__unionName, `member:${msg.author.id}`, await redis.hExists(__unionName, `member:${msg.author.id}`));
            if (await redis.hExists(__unionName, `member:${msg.author.id}`))
                return __unionName.replace(/^union:/, "");
        }
        return undefined;
    });

    if (!unionName || !await redis.exists(`union:${unionName}`)) {
        if (_unionName) return msg.sendMsgEx({ content: `未查询到<${_unionName}>公会信息，请确认公会名称无误后再次查询` });
        else return msg.sendMsgEx({ content: `请输入要查询的公会名称` });
    }

    const { unionInfo, memberStrList, rankStr } = await getUnionInformationList().then(async unionList => {
        unionList.sort((a, b) => b.integral - a.integral);
        for (const [index, r] of unionList.entries()) {
            if (r.name == unionName) {
                const _memberStrList: string[] = [];
                for (const member of r.members)
                    _memberStrList.push(`${await idToName(member.uid)}`);
                return {
                    unionInfo: r,
                    memberStrList: _memberStrList,
                    rankStr: `第${index + 1}名`,
                };
            }
        }
        throw new Error("未查询到公会");
    });

    return msg.sendMsgEx({
        content: `查询${_unionName ? `公会<${unionName}>` : "已加入公会"}的信息如下` +
            `\n公会名称：${unionName}` +
            `\n公会会长：${await idToName(unionInfo.master)}` + /* `(id：${unionMaster})` + */
            `\n公会成员：${memberStrList.join(`\t`)}` +
            `\n公会积分：${await redis.hGet(`union:${unionName}`, "integral")}` +
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
        if (findMember) inUnion = `${unionInfo.name}公会排名：${index}`;
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
    const exp = /^(添加|扣除)(.*)公会积分$/.exec(msg.content)!;
    const type = (exp[1] == "添加") ? 1 : ((exp[1] == "扣除") ? -1 : 0);
    const unionName = exp[2].trim();
    const optScore = type * Number(exp[3]);//?

    if (await redis.exists(`union:${unionName}`)) return msg.sendMsgEx({
        content: `${unionName}公会不存在`,
    });



}

/**
 * This TODO
 */
export async function inviteJoinUnion(msg: IMessageEx) {
    log.debug(msg.mentions);
    for (const inviteMember of msg.mentions) {
        sleep(500);
    }
}

function memberIsInUnion(uid: string, unionInfo: UnionListCell): boolean {
    //for (const unionInfo of unionList)
    for (const member of unionInfo.members)
        if (member.uid == uid) return true;
    return false;
}

async function getUnionInformationList() {
    const unionKeys = await redis.keys(`union:*`);
    const unionList: UnionList = [];
    for (const unionKey of unionKeys)
        unionList.push(await getUnionInformationMeta(unionKey));
    return unionList;
}

async function getUnionInformationMeta(unionKeyName: string) {
    const unionKey = unionKeyName;

    const members: UnionListMember[] = [];
    const kv = await redis.hGetAll(unionKey);
    for (const key in kv) {
        //log.debug(key);
        const reg = /^member:(\d+)$/.exec(key);
        if (reg) members.push({
            uid: reg[1],
            auth: kv[key],
        });
    }
    return {
        name: unionKey.replace(/^union:/, ""),
        master: kv["master"],
        members,
        integral: parseInt(kv["integral"] || "0"),
    }
}

type UnionList = UnionListCell[];
interface UnionListCell {
    name: string;
    master: string;
    members: UnionListMember[];
    integral: number;
}
interface UnionListMember {
    uid: string;
    auth: string;
}
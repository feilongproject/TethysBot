import { IMessageEx } from "../lib/IMessageEx";


export async function getRandomNums(msg: IMessageEx) {
    const reg = /^获取随机数\s?(\d+)\s(\d+)\s(\d+)$/.exec(msg.content);
    if (!reg) return true;

    const randoms: {
        numStart: number;
        numEnd: number;
        numTimes: number;
        nums: number[];
    } = {
        numStart: parseInt(reg[1]),
        numEnd: parseInt(reg[2]),
        numTimes: parseInt(reg[3]),
        nums: [],
    }

    if (randoms.numEnd < randoms.numStart) {
        randoms.numStart = randoms.numStart ^ randoms.numEnd;
        randoms.numEnd = randoms.numStart ^ randoms.numEnd;
        randoms.numStart = randoms.numStart ^ randoms.numEnd;
    }
    if (randoms.numEnd == randoms.numStart) {
        msg.sendMsgEx({ content: `开始与结束相同，无法生成` });
        return true;
    } else if (randoms.numEnd - randoms.numStart < randoms.numTimes) {
        msg.sendMsgEx({ content: `生成范围小于生成个数，无法生成` });
        return true;
    }

    for (var i = randoms.numStart; i <= randoms.numEnd; i++) {
        randoms.nums.push(i);
    }
    randoms.nums = randoms.nums.sort((v1, v2) => 0.5 - Math.random());
    randoms.nums = randoms.nums.sort((v1, v2) => 0.5 - Math.random());

    const end = ["生成的随机数为："];
    for (var i = 0; i < randoms.numTimes; i++) {
        end.push(randoms.nums.pop()!.toString());
    }
    msg.sendMsgEx({ content: end.join(`\n`) });

}

export async function getUID(msg: IMessageEx) {
    const aid = msg.mentions ? msg.mentions[0] : msg.author;
    return msg.sendMsgEx({
        content: `用户名称: ${aid.username}` +
            `\n用户ID: ${aid.id}`
    });
}
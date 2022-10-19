import { IMessageEx } from "../lib/IMessageEx";


export async function getRandomNums(msg: IMessageEx) {
    const reg = /^#获取随机数\s?(\d+)\s(\d+)\s(\d+)$/.exec(msg.content);
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

export async function warnWithReason(msg: IMessageEx) {
    if (!msg.mentions || msg.mentions.length == 0) {
        msg.sendMsgEx({ content: `未指定@人员，无法操作！` });
        return true;
    }
    const reg = msg.content.match(/^#警告(.+)\s?原因(.+)/)!;
    const reason = reg[2];
    const someone = msg.mentions[0].id;
    const sendStr: string[] = [];

    global.redis.zRangeWithScores(`warn:uid:${someone}`, 0, -1).then(datas => {
        sendStr.push(`<@${someone}>\n第${datas.length + 1}次警告`, `原因：${reason}`, `时间：${timeConver(msg.timestamp)}`);
        for (const [iv, data] of datas.entries()) {
            sendStr.push(`第${iv + 1}次警告`, `原因：${data.value}`);
        }
        return global.redis.zAdd(`warn:uid:${someone}`, { score: new Date().getTime(), value: reason });
    }).then(() => {
        msg.sendMsgEx({ content: sendStr.join("\n") });
    }).catch(err => {
        log.error(err);
    });

}

function timeConver(timestamp: number | string | Date) {
    const date = new Date(timestamp);
    const year = date.getFullYear().toString().padStart(4, "0");
    const month = date.getMonth().toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}
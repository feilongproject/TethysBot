import { IMember } from "qq-guild-bot";
import { idToName } from "../lib/common";
import { IMessageEx } from "../lib/IMessageEx";
import { execSync } from "child_process";
import { readFileSync } from "fs";

export async function version(msg: IMessageEx) {
    if (!adminId.includes(msg.author.id)) return;

    var packVer = ``;
    try { packVer = JSON.parse(readFileSync("package.json").toString()).version; }
    catch (error) { packVer = "未成功获取"; }

    var gitVer = ``;
    try { gitVer = execSync("git rev-parse HEAD").toString(); }
    catch (error) { gitVer = `未成功获取`; }

    return msg.sendMsgEx({
        content: `package版本号: ${packVer}` +
            `\ngit版本号: ${gitVer}`
    });
}

export async function addAdmin(msg: IMessageEx) {
    if (!msg.mentions) return msg.sendMsgEx({ content: `未指定用户` });
    const sendStr: string[] = [`已对下列用户添加管理权限`];
    for (const member of msg.mentions) {
        if (member.bot) continue;
        await redis.hSet("auth", member.id, "admin");
        sendStr.push(`${await idToName(member.id)}`);
    }
    return msg.sendMsgEx({ content: sendStr.join("\n") });
}

export async function testShell(msg: IMessageEx) {
    if (!adminId.includes(msg.author.id)) return;
    const code = /^运行命令(.*)$/.exec(msg.content)![1];
    try {
        return msg.sendMsgEx({ content: execSync(code.replaceAll("。", ".")).toString().replaceAll(".", "。") }).catch(err => {
            //log.error(err);
        });
    } catch (error) {
        return msg.sendMsgEx({ content: (error as any).toString().replaceAll(".", ". ") });
    }

}

export async function isAdmin(uid: string, iMember?: IMember): Promise<boolean> {
    if (adminId.includes(uid)) return true;
    if (iMember && (iMember.roles.includes("2") || iMember.roles.includes("4"))) return true;
    return redis.hGet("auth", uid).then(auth => {
        if (auth == "admin") return true;
        return false;
    });
}

export function devAdmin(uid: string): boolean {
    if (devEnv && adminId.includes(uid)) return true;
    return devEnv ? false : true;
}
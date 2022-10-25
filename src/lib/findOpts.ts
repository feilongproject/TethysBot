import { IMember } from "qq-guild-bot";
import { IMessageEx } from "./IMessageEx";


export async function findOpts(msg: IMessageEx): Promise<{ path: string, fnc: string }> {
    if (!msg.content) return { path: "err", fnc: "err" };
    //const optStr = msg.content.trim().split(" ")[0];

    const fnc: {
        [mainKey: string]: {
            [key: string]: {
                reg: string,
                fnc: string,
                type: string[],
                permission?: string;
                describe: string;
            }
        }
    } = (await import("../../config/opts.json")).default;

    for (const mainKey in fnc) {
        for (const key in fnc[mainKey]) {
            const opt = fnc[mainKey][key];
            if (!opt.type.includes(msg.messageType)) continue;
            if (!RegExp(opt.reg).test(msg.content)) continue;
            if (opt.permission != "anyone") {
                if (msg.messageType == "GUILD"
                    && !await findAdmin(msg.author.id, msg.member)
                ) continue;
                if (msg.messageType == "DIRECT"
                    && !await findAdmin(msg.author.id, (await client.guildApi.guildMember(msg.src_guild_id!, msg.author.id)).data)
                ) continue;
            }
            return {
                path: mainKey,
                fnc: opt.fnc,
            };

        }
    }

    return { path: "err", fnc: "err" };
}

async function findAdmin(uid: string, iMember?: IMember): Promise<boolean> {
    if (iMember && (iMember.roles.includes("2") || iMember.roles.includes("4")))
        return true;

    return await redis.hGet("auth", uid).then(auth => {
        if (auth == "admin") return true;
        return false;
    });

}

export function debugAdmin(uid: string): boolean {
    if (devEnv && adminId.includes(uid)) return true;
    return false;
}
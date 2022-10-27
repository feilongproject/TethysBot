import { isAdmin } from "./common";
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
                    && !await isAdmin(msg.author.id, msg.member)
                ) continue;
                if (msg.messageType == "DIRECT"
                    && !await isAdmin(msg.author.id, (await client.guildApi.guildMember(msg.src_guild_id!, msg.author.id)).data)
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


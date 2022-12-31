import { IMessageEx } from "./IMessageEx";
import { isAdmin } from "../plugins/admin";

export async function findOpts(msg: IMessageEx): Promise<{ path: string, fnc: string } | null> {
    if (!msg.content) return null;

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

    for (const mainKey in fnc) for (const key in fnc[mainKey]) {
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
        return { path: mainKey, fnc: opt.fnc };
    }

    return null;
}

/* 
export async function findOpts(msg: IMessageEx): Promise<({ path: string, fnc: string } | null)[]> {
    if (!msg.content) return [];

    const fnc: {
        [mainKey: string]: {
            [key: string]: {
                reg: string;
                fnc: string;
                type: string[];
                permission?: string;
                describe: string;
            }
        }
    } = (await import("../../config/opts.json")).default;

    const queue: Promise<{ path: string, fnc: string } | null>[] = [];
    for (const _content of msg.content.split("\n")) {
        queue.push(new Promise(async (resolve) => {
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
                    resolve({ path: mainKey, fnc: opt.fnc });
                }
            }
            resolve(null);
        }));
    }
    
    return await Promise.all(queue);
}
*/
import { IMessageEx } from "./IMessageEx";
import log from "./logger";


export async function findOpts(msg: IMessageEx): Promise<{ path: string, fnc: string }> {
    if (!msg.content) return { path: "err", fnc: "err" };
    const optStr = msg.content.trim().split(" ")[0];

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

            if (opt.permission != "anyone") {
                if (msg.messageType == "GUILD") {
                    if (!(msg.member.roles.includes("2") || msg.member.roles.includes("4"))) continue;
                }
                if (msg.messageType == "DIRECT") {
                    const userInfo = await client.guildApi.guildMember(msg.src_guild_id!, msg.author.id);
                    if (!(userInfo.data.roles.includes("2") || userInfo.data.roles.includes("4"))) continue;
                }
            }
            if (RegExp(opt.reg).test(optStr)) {
                return {
                    path: mainKey,
                    fnc: opt.fnc,
                };
            };
        }
    }

    return { path: "err", fnc: "err" };
}
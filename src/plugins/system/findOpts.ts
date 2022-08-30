import fnc from "../../../data/opts.json";
import { IMessageEx } from "./IMessageEx";
import log from "./logger";


export async function findOpts(msg: IMessageEx): Promise<string> {
    if (!msg.content) return "empty";

    const optStr = msg.content.trim().split(" ")[0];

    for (const opt of fnc) {

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
            return opt.fnc;
        };
    }

    return "err";
}
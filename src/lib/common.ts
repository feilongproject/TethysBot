import { IMember } from "qq-guild-bot";

export async function idToName(uid: string) {
    return redis.hGet("id->name", uid);
}

export function sleep(ms: number): Promise<NodeJS.Timeout> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function isAdmin(uid: string, iMember?: IMember): Promise<boolean> {
    if (iMember && (iMember.roles.includes("2") || iMember.roles.includes("4")))
        return true;
    return await redis.hGet("auth", uid).then(auth => {
        if (auth == "admin") return true;
        return false;
    });
}

export function debugAdmin(uid: string): boolean {
    if (devEnv) {
        if (adminId.includes(uid)) return true;
        else return false;
    }
    return true;
}
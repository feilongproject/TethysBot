
export async function idToName(uid: string) {
    return redis.hGet("id->name", uid);
}

export function sleep(ms: number): Promise<NodeJS.Timeout> {
    return new Promise((resolve) => setTimeout(() => resolve, ms));
}

export function timeConver(timestamp: number | string | Date) {
    const date = new Date(timestamp);
    const year = date.getFullYear().toString().padStart(4, "0");
    const month = date.getMonth().toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
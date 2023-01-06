import { loadGuildTree } from "../init";
import { sendMsgEx } from "../lib/IMessageEx";


export const wsIntentMessage: { [key: string]: (data?: any) => Promise<any> } = {
    "channel.getList": async () => {
        const res = await loadGuildTree(false, false);
        return saveGuildsTree;
    },
    "channel.postMsg": async (data) => {
        return sendMsgEx({
            sendType: "GUILD",
            channelId: data.channelId,
            content: data.content,
        }).then(res => {
            return res.data;
        });
    },
    "keyword.get": async () => {
        return redis.keys("keyword:*").then(keys => {
            const keysInfo: Promise<{}>[] = [];
            for (const key of keys) keysInfo.push(redis.hGetAll(key).then(keyData => {
                const match = key.match(/keyword:(.+?):(.+)$/)!;
                return {
                    ...keyData,
                    type: match[1],
                    keyword: match[2],
                };
            }));
            return Promise.all(keysInfo);
        });
    },
    "keyword.passCheck": async (data) => {
        const key = `keyword:${data.type}:${data.keyword}`;
        return redis.exists(key).then(e => {
            if (!e) throw `not found key: ${data.type}:${data.keyword}`;
        }).then(() => {
            return redis.hSet(key, "status", "checked");
        }).then(() => {
            return redis.hGetAll(key);
        }).then(keyData => {
            return Object.assign(data, keyData);
        });
    },
    "keyword.saveContent": async (data) => {
        const key = `keyword:${data.type}:${data.keyword}`;
        return redis.exists(key).then(e => {
            if (!e) throw `not found key: ${data.type}:${data.keyword}`;
        }).then(() => {
            return redis.hSet(key, "content", data.content);
        }).then(() => {
            return redis.hGetAll(key);
        }).then(keyData => {
            return Object.assign(data, keyData);
        });
    },
    "keyword.delete": async (data) => {
        const key = `keyword:${data.type}:${data.keyword}`;
        return redis.exists(key).then(e => {
            if (!e) throw `not found key: ${data.type}:${data.keyword}`;
        }).then(() => {
            return redis.del(key);
        }).then(isDel => {
            return Object.assign({ isDel }, data);
        });
    },
}
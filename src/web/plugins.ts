import { loadGuildTree } from "../init";
import { sendMsgEx } from "../lib/IMessageEx";
import { version } from "../../package.json";

export const wsIntentMessage: { [key: string]: (data?: any) => Promise<any> } = {
    "version": async () => {
        return { version };
    },
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
    "keyword.changeStatus": async (data) => {
        const key = `keyword:${data.type}:${data.keyword}`;
        return redis.exists(key).then(e => {
            if (!e) throw `not found key: ${data.type}:${data.keyword}`;
        }).then(() => {
            return redis.hSet(key, "status", data.status == "checked" ? "checking" : "checked");
        }).then(() => {
            return redis.hGetAll(key);
        }).then(keyData => {
            return Object.assign(data, keyData);
        });
    },
    "keyword.changeType": async (data) => {
        const srcType = data.type;
        const forType = srcType == "blurry" ? "accurate" : "blurry";
        const srcKey = `keyword:${srcType}:${data.keyword}`;
        const forKey = `keyword:${forType}:${data.keyword}`;
        return redis.exists(srcKey).then(e => {
            if (!e) throw `not found key: ${data.type}:${data.keyword}`;
            return redis.exists(forKey);
        }).then(e => {
            if (e) throw `new key exists: ${data.type}:${data.keyword}`;
            return redis.rename(srcKey, forKey);
        }).then(() => {
            return redis.hSet(forKey, "type", forType);
        }).then(() => {
            return redis.hGetAll(forKey);
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
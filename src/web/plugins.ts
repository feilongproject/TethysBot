import fs from "fs";
import { loadGuildTree } from "../init";
import { sendMsgEx } from "../lib/IMessageEx";
import { version } from "../../package.json";

var imageInfo: null | { name: string; size: number; type: string; lastModified: number; } = null;
const imageDataDir = `${_path}/imageData/`;

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
            imagePath: data.imageName ? `${_path}/imageData/${data.imageName}` : undefined,
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
    "keyword.saveImage": async (data) => {
        const key = `keyword:${data.type}:${data.keyword}`;
        return redis.exists(key).then(e => {
            if (!e) throw `not found key: ${data.type}:${data.keyword}`;
        }).then(() => {
            return redis.hSet(key, "imageName", data.imageName);
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
    "image.get": async (data) => {
        //log.debug(data);
        return fs.readFileSync(imageDataDir + data);
    },
    "image.getList": async () => {
        const fileList = fs.readdirSync(imageDataDir);
        const retList: string[] = [];
        for (const fileName of fileList) {
            if (fileName == "readme.txt") continue;
            retList.push(fileName);
        }
        return retList;
    },
    "image.sendReady": async (data) => {
        imageInfo = data;
    },
    "image.delete": async (data) => {
        log.debug(data);
        if (fs.existsSync(imageDataDir + data))
            return fs.rmSync(imageDataDir + data);
        else throw "file not found";
    }
}

export function saveImage(data: Buffer) {
    if (!imageInfo) throw "not get imageInfo";
    const _imageInfo = imageInfo;
    imageInfo = null;
    fs.writeFileSync(imageDataDir + _imageInfo.name, data, { encoding: "binary" });
    return _imageInfo;
}
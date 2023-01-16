import fs from "fs";
import WebSocket from "ws";
import { createClient } from "redis";
import { createOpenAPI } from "qq-guild-bot";
import _log from '../lib/logger';
import config from '../../config/config.json';
import { version as serverVersion } from "../../package.json";

global.log = _log;
global._path = process.cwd();
global.client = createOpenAPI(config.initConfig);
global.redis = createClient(config.redisConfig);
if (process.argv.includes("--dev")) {
    global.devEnv = true;
    log.mark("当前环境处于开发环境，请注意！");
} else global.devEnv = false;

const PORT = 8848;
const wss = new WebSocket.Server({ port: PORT });
const wssOn = (ws: WebSocket.WebSocket) => {
    log.info(`新连接被开启`);
    ws.on("close", (code, reason) => {
        log.error(`连接被关闭: 关闭码${code},${reason}`);
    });

    const { protocol } = ws;
    const webExp = protocol.match(/^(\d+)\.(\d+)\.(\d+)\|(.*)$/) || ["0", "0", "0", ""];
    const webVers = [Number(webExp[1]), Number(webExp[2]), Number(webExp[3])];
    const webToken = webExp[4];

    const serverExp = serverVersion.match(/^(\d+)\.(\d+)\.(\d+)$/) || ["0", "0", "0"];
    const serverVers = [Number(serverExp[1]), Number(serverExp[2]), Number(serverExp[3])];
    const serverToken = config.wsToken;

    const webLowVer = () => { return ws.close(1002, "请更新网页版本"); };
    const serverLowVer = () => { return ws.close(1002, "请更新服务器版本"); };
    if (webVers[0] < serverVers[0]) return webLowVer();
    if (webVers[0] > serverVers[0]) return serverLowVer();
    if (webVers[1] < serverVers[1]) return webLowVer();
    if (webVers[1] > serverVers[1]) return serverLowVer();
    if (webToken != serverToken) return ws.close(1002, "Token错误");

    ws.on('message', (_data) => {
        import("./plugins").then(async d => {
            if (Buffer.isBuffer(_data)) {
                log.info("接收到文件");
                return ws.send(JSON.stringify({
                    key: "image.sendGone",
                    data: d.saveImage(_data),
                }));
            }

            log.info(`接收到信息:`, _data);
            const sp = JSON.parse(_data.toString());
            if (typeof d.wsIntentMessage[sp.key] == "function") {
                const data = await d.wsIntentMessage[sp.key](sp.data);
                if (Buffer.isBuffer(data)) return ws.send(data as Buffer);
                else return ws.send(JSON.stringify({
                    key: sp.retKey ? sp.retKey : sp.key,
                    data: data,
                }));
            } else throw `${sp.key} not a funtion`;
        }).catch(err => {
            log.error(err);
            ws.send(JSON.stringify({
                key: "error",
                data: JSON.stringify(err),
            }));
        });

    });

    ws.on("error", (err) => {
        log.error(err);
    });

    ws.send(JSON.stringify({ key: "ok" }));
    ws.send(JSON.stringify({ key: "version", data: { serverVersion } }));
}

const pluginFile = `${_path}/src/web/plugins.ts`;
fs.watchFile(pluginFile, () => {
    if (require.cache[pluginFile]) {
        delete require.cache[pluginFile];
        log.mark("plugins.ts已更新");
    }
});

redis.connect().then(() => {
    log.info(`初始化：redis数据库连接成功`);
    wss.on('connection', wssOn);
    log.info(`网页后端已启动, 端口${PORT}`);
}).catch(err => {
    log.error(`初始化：redis数据库连接失败，正在退出程序\n${err}`);
    process.exit();
});

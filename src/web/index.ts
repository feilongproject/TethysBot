import WebSocket from "ws";
import { createClient } from "redis";
import { createOpenAPI } from "qq-guild-bot";
import _log from '../lib/logger';
import config from '../../config/config.json';


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

    if (ws.protocol != config.wsToken) return ws.close(1002, "Token错误");
    ws.on('message', (_data, isBinary) => {

        import("./plugins").then(async d => {
            const sp = JSON.parse(_data.toString());
            log.info(`接收到信息:`, sp);
            if (typeof d.wsIntentMessage[sp.key] == "function")
                return ws.send(JSON.stringify({
                    key: sp.retKey ? sp.retKey : sp.key,
                    data: await d.wsIntentMessage[sp.key](sp.data),
                }));
            else throw `${sp.key} not a funtion`;
        }).catch(err => {
            ws.send(JSON.stringify({
                key: "error",
                data: String(err),
            }));
        });

    });

    ws.on("error", (err) => {
        log.error(err);
    });

    ws.send(JSON.stringify({ key: "ok" }));
}

redis.connect().then(() => {
    log.info(`初始化：redis数据库连接成功`);
    wss.on('connection', wssOn);
    log.info(`网页后端已启动, 端口${PORT}`);

}).catch(err => {
    log.error(`初始化：redis数据库连接失败，正在退出程序\n${err}`);
    process.exit();
});

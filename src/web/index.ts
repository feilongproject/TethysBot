import WebSocket from "ws";
import { createOpenAPI } from "qq-guild-bot";
import config from '../../config/config.json';
import _log from '../lib/logger';


global.log = _log;
global._path = process.cwd();
global.client = createOpenAPI(config.initConfig);

const PORT = 8848;
const wss = new WebSocket.Server({ port: PORT });

log.info(`网页后端已启动, 端口${PORT}`);
wss.on('connection', (ws, req) => {
    log.info(`新连接被开启`);
    if (ws.protocol != config.wsToken) ws.close(1002, "Token错误");
    ws.on('message', (_data, isBinary) => {

        const sp = JSON.parse(_data.toString());
        log.info(`接收到信息:`, sp);

        import("./plugins").then(async d => {
            const ret = JSON.stringify({
                key: sp.retKey ? sp.retKey : sp.key,
                data: await d.wsIntentMessage[sp.key](sp.data),
            });
            //log.debug(ret);
            return ws.send(ret);
        })
    });

    ws.on("close", (code, reason) => {
        log.error(`连接被关闭: 关闭码${code},${reason}`);
    });

    ws.on("error", (err) => {
        log.error(err);
    });
});
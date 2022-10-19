import fs from "fs";
import { createClient } from 'redis';
import { createOpenAPI, createWebsocket } from 'qq-guild-bot';
import _log, { setDevLog } from './lib/logger';
import config from '../config/config.json';

export async function init() {

    global.adminId = config.admin?.uid;
    global.log = _log;
    global._path = process.cwd();
    global.emojiIdentity = {};

    if (process.argv.includes("--dev")) {
        log.mark("当前环境处于开发环境，请注意！");
        global.devEnv = true;
        setDevLog();
    } else global.devEnv = false;

    if (global.devEnv) {
        log.info(`初始化：正在创建插件热加载监听`);
        fs.watch(`${global._path}/src/plugins/`, (event, filename) => {
            //log.debug(event, filename);
            if (event != "change") return;
            if (require.cache[`${global._path}/src/plugins/${filename}`]) {
                log.mark(`文件${global._path}/src/plugins/${filename}已修改，正在执行热更新`);
                delete require.cache[`${global._path}/src/plugins/${filename}`];
            }
        });
        log.info(`初始化：正在创建指令文件热加载监听`);
        const optFile = `${global._path}/config/opts.json`;
        fs.watchFile(optFile, () => {
            if (require.cache[optFile]) {
                log.mark(`指令配置文件正在进行热更新`);
                delete require.cache[optFile];
            }
        });
    }

    log.info(`初始化：正在连接数据库`);
    global.redis = createClient({
        socket: { host: "127.0.0.1", port: 6379 },
        database: 2,
    });
    await global.redis.connect().then(() => {
        log.info(`初始化：redis数据库连接成功`);
    }).catch(err => {
        log.error(`初始化：redis数据库连接失败，正在退出程序\n${err}`);
        process.exit();
    });

    log.info(`初始化：正在创建client与ws`);
    global.client = createOpenAPI(config.initConfig);
    global.ws = createWebsocket(config.initConfig as any);

    log.info(`初始化：正在创建频道树`);
    global.saveGuildsTree = [];
    client.meApi.meGuilds().then(guilds => {
        for (const guild of guilds.data) {
            log.info(`${guild.name}(${guild.id})`);
            setIdentityGroup(guild.id);
            var _guild: SaveChannel[] = [];
            global.client.channelApi.channels(guild.id).then(channels => {
                for (const channel of channels.data) {
                    if (channel.name != "") {
                        log.info(`${guild.name}(${guild.id})-${channel.name}(${channel.id})-father:${channel.parent_id}`);
                    }
                    _guild.push({ name: channel.name, id: channel.id });
                }
                global.saveGuildsTree.push({ name: guild.name, id: guild.id, channel: _guild });
            }).catch(err => {
                log.error(err);
            });
        }
    }).catch(err => {
        log.error(err);
    });

    global.client.meApi.me().then(res => {
        global.meId = res.data.id;
    });

    /* setInterval(() => {
        log.debug("##########重新建立链接中##########");
        global.ws.disconnect();
    }, 1000 * 10);
    setTimeout(() => {
        log.debug("##########重新建立链接中##########");
        global.ws.disconnect();
    }, 1000 * 10); */
}


function setIdentityGroup(guildId: string) {
    if (guildId == "5237615478283154023") return;
    global.client.roleApi.roles(guildId).then(res => {
        return res.data.roles;
    }).then(roles => {
        const _guildIdentity: { [identity: string]: string; } = {};
        for (const role of roles) {
            _guildIdentity[role.id] = role.name;
        }
        //log.debug(roles, _guildIdentity);
        global.emojiIdentity[guildId] = _guildIdentity;
    }).catch(err => {
        log.error(err);
    });


}

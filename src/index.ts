import { init } from './init';
import { debugAdmin } from './lib/common';
import { findOpts } from './lib/findOpts';
import { IMessageEx } from './lib/IMessageEx';
import config from '../config/config.json';

var checkTimes = 0;

init().then(() => {

    global.ws.on('GUILD_MESSAGE_REACTIONS', async (data: IntentMessage) => {
        //log.debug(data.msg);
        if (!debugAdmin(data.msg.user_id)) return;//开发环境专用

        const guildId = data.msg.guild_id;
        const msgId = await global.redis.get(`identityMsgId:${guildId}`).catch(err => log.error(err));
        if (!msgId) return;
        if (data.msg.target.id != msgId) return;

        const allData = await global.redis.hGetAll(`emojiIdentity:${guildId}`).catch(err => {
            log.error(err);
            return null;
        });
        if (!allData) return;

        var identityId: string | null = null;
        for (const x in allData) {
            const emojiId = allData[x];
            //log.debug(`identity:${x},emojiId:${emojiId}`);
            if (emojiId == data.msg.emoji.id) {
                identityId = x;
                break;
            }
        }
        if (!identityId) return;
        //log.debug(identityId);

        if (data.eventType == "MESSAGE_REACTION_ADD") {
            if (await global.redis.hIncrBy(`identityLimit:${data.msg.guild_id}`, data.msg.user_id, 1) > config.emojiBindLimit) {
                log.mark(`user ${data.msg.user_id} in limit identity ${identityId}`);
            } else {
                await global.client.memberApi.memberAddRole(guildId, identityId, data.msg.user_id).then(() => {
                    log.mark(`user ${data.msg.user_id} has new identity ${identityId}`);
                }).catch(err => {
                    log.error(err);
                });
            }
        } else if (data.eventType == "MESSAGE_REACTION_REMOVE") {
            global.redis.hIncrBy(`identityLimit:${data.msg.guild_id}`, data.msg.user_id, -1);
            await global.client.memberApi.memberDeleteRole(guildId, identityId, data.msg.user_id).then(() => {
                log.mark(`user ${data.msg.user_id} has remove identity ${identityId}`);
            }).catch(err => {
                log.error(err);
            });
        }
    });

    global.ws.on('GUILD_MESSAGES', async (data: IntentMessage) => {
        if (data.eventType != "MESSAGE_CREATE") return;
        if (!debugAdmin(data.msg.author.id)) return;//开发环境专用

        const msg = new IMessageEx(data.msg, "GUILD");// = data.msg as any;

        global.redis.set("lastestMsgId", msg.id, { EX: 5 * 60 });
        await global.redis.hSet("id->name", msg.author.id, msg.author.username);

        if (data.eventType == "MESSAGE_CREATE") {
            const opt = await findOpts(msg).catch(err => {
                log.error(err);
            });
            //if (opt && msg.author.id != "7681074728704576201") opt.path = "err";//break test
            //log.debug(opt)//break test
            if (!opt || opt.path == "err") return;
            log.debug(`./plugins/${opt.path}:${opt.fnc}`);

            try {
                const plugin = await import(`./plugins/${opt.path}.ts`);
                if (typeof plugin[opt.fnc] == "function") {
                    (plugin[opt.fnc] as PluginFnc)(msg).catch(err => {
                        log.error(err);
                    });
                } else {
                    log.error(`not found function ${opt.fnc}() at "${global._path}/src/plugins/${opt.path}.ts"`);
                }
            } catch (err) {
                log.error(err);
            }
        }
    });

    global.ws.on("DIRECT_MESSAGE", async (data: IntentMessage) => {
        if (!debugAdmin(data.msg.author.id)) return;//开发环境专用

        const msg = new IMessageEx(data.msg, "DIRECT");// = data.msg as any;

        global.redis.set("lastestMsgId", msg.id, { EX: 5 * 60 });
        await global.redis.hSet("id->name", msg.author.id, msg.author.username);

        const opt = await findOpts(msg).catch(err => {
            log.error(err);
        });
        //if (opt) opt.path = "err";//break test
        if (!opt || opt.path == "err") return;
        log.debug(`./plugins/${opt.path}:${opt.fnc}`);

        try {
            const plugin = await import(`./plugins/${opt.path}.ts`);
            if (typeof plugin[opt.fnc] == "function") {
                (plugin[opt.fnc] as PluginFnc)(msg).catch(err => {
                    log.error(err);
                });
            } else {
                log.error(`not found function ${opt.fnc}() at "${global._path}/src/plugins/${opt.path}.ts"`);
            }
        } catch (err) {
            log.error(err);
        }

    });

}).catch(err => {
    console.error(err);
});

type PluginFnc = (msg: IMessageEx) => Promise<any>
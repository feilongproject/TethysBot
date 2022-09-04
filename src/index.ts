import { init } from './init';
import log from './lib/logger';
import { findOpts } from './lib/findOpts';
import { IMessageEx } from './lib/IMessageEx';
import { scoreboardAnswer, scoreboardChange, scoreboardChangeWithIdentity, scoreboardQuery, scoreboardRanking, scoreboardSetAnswer } from './plugins/scoreboard';
import { identityInfo, identityList, identitySet } from './plugins/identity';
import config from '../config/config.json';

var checkTimes = 0;

init().then(() => {

    global.ws.on('GUILD_MESSAGE_REACTIONS', async (data: IntentMessage) => {
        //log.debug(data);
        //if (data.msg.guild_id != "15134591271843561181") return;//测试用

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
        //if (data.msg.guild_id == "12129458028700690480") return;//测试用
        if (data.eventType != "MESSAGE_CREATE") return;
        //log.debug(data.msg);
        const msg = new IMessageEx(data.msg, "GUILD");// = data.msg as any;

        global.redis.set("lastestMsgId", msg.id, { EX: 5 * 60 });
        await global.redis.hSet("id->name", msg.author.id, msg.author.username);

        if (data.eventType == "MESSAGE_CREATE") {
            const opt = await findOpts(msg);
            log.debug(`./plugins/${opt.path}:${opt.fnc}`);

            try {
                if (opt.path != "err") {
                    const plugin = await import(`./plugins/${opt.path}.ts`);
                    if (typeof plugin[opt.fnc] == "function") {
                        (plugin[opt.fnc] as PluginFnc)(msg).catch(err => {
                            log.error(err);
                        });
                    } else {
                        log.error(`not found function ${opt.fnc}() at "${global._path}/src/plugins/${opt.path}.ts"`);
                    }
                }
            } catch (err) {
                log.error(err);
            }
        }
    });


    global.ws.on("DIRECT_MESSAGE", async (data: IntentMessage) => {
        //log.debug(data.msg);
        const msg = new IMessageEx(data.msg, "DIRECT");// = data.msg as any;

        global.redis.set("lastestMsgId", msg.id, { EX: 5 * 60 });
        await global.redis.hSet("id->name", msg.author.id, msg.author.username);

        const opt = await findOpts(msg);
        log.debug(`./plugins/${opt.path}:${opt.fnc}`);

        try {
            if (opt.path != "err") {
                const plugin = await import(`./plugins/${opt.path}.ts`);
                if (typeof plugin[opt.fnc] == "function") {
                    (plugin[opt.fnc] as PluginFnc)(msg).catch(err => {
                        log.error(err);
                    });
                } else {
                    log.error(`not found function ${opt.fnc}() at "${global._path}/src/plugins/${opt.path}.ts"`);
                }
            }
        } catch (err) {
            log.error(err);
        }

    });

}).catch(err => {
    log.error(err);
});

type PluginFnc = (msg: IMessageEx) => Promise<any>
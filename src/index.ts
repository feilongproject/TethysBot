import { init, loadGuildTree } from './init';
import { findOpts } from './lib/findOpts';
import { devAdmin } from './plugins/admin';
import { IMessageEx } from './lib/IMessageEx';
import config from '../config/config.json';

var checkTimes = 0;

init().then(() => {

    global.ws.on('GUILD_MESSAGE_REACTIONS', async (data: IntentMessage) => {
        //log.debug(data.msg);
        if (!devAdmin(data.msg.user_id)) return;//开发环境专用

        const guildId = data.msg.guild_id;
        const msgId = await global.redis.get(`identityMsgId:${guildId}`).catch(err => log.error(err));
        if (!msgId) return;
        if (data.msg.target.id != msgId) return;

        const allData = await global.redis.hGetAll(`emojiIdentity:${guildId}`).catch(err => {
            return log.error(err);
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

    global.ws.on('GUILD_MESSAGES', wsIntentMessage);
    global.ws.on("DIRECT_MESSAGE", wsIntentMessage);

    global.ws.on("GUILDS", () => {
        log.mark(`重新加载频道树中`);
        loadGuildTree().then(() => {
            log.mark(`频道树加载完毕`);
        }).catch(err => {
            log.error(`频道树加载失败`, err);
        });
    });
}).catch(err => {
    console.error(err);
});

async function execute(msg: IMessageEx) {
    try {
        await global.redis.set("lastestMsgId", msg.id, { EX: 4 * 60 });
        await global.redis.hSet("id->name", msg.author.id, msg.author.username);
        const opt = await findOpts(msg).catch(err => {
            log.error(err);
        });
        if (!opt || opt.path == "err") return;
        if (devEnv) log.debug(`./plugins/${opt.path}:${opt.fnc}`);
        const plugin = await import(`./plugins/${opt.path}.ts`);
        if (typeof plugin[opt.fnc] == "function") {
            (plugin[opt.fnc] as PluginFnc)(msg).catch(err => {
                log.error(err);
            });
        } else log.error(`not found function ${opt.fnc}() at "${global._path}/src/plugins/${opt.path}.ts"`);
    } catch (err) {
        log.error(err);
    }
}

async function wsIntentMessage(data: IntentMessage) {
    try {
        var msg: IMessageEx | null = null;
        if (!data.msg || !data.msg.author) return;
        if (!devAdmin(data.msg.author.id)) return;//开发环境专用

        if (data.eventType == "MESSAGE_CREATE") {
            msg = new IMessageEx(data.msg, "GUILD");
            msg.content = msg.content.replace(new RegExp(`<@!${meId}>`), ``).trim().replace(/^\//, "");
        } else if (data.eventType == "DIRECT_MESSAGE_CREATE") {
            msg = new IMessageEx(data.msg, "DIRECT");
        }
        if (msg) execute(msg);
    } catch (err) {
        log.error(err);
    }

}


type PluginFnc = (msg: IMessageEx) => Promise<any>
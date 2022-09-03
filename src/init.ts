import { createOpenAPI, createWebsocket } from 'qq-guild-bot';
import { createClient } from 'redis';
import log from './lib/logger';
import config from '../data/config.json';

export async function init() {

    global._path = process.cwd();

    global.client = createOpenAPI(config.initConfig);
    global.ws = createWebsocket(config.initConfig as any);

    global.redis = createClient({
        socket: {
            host: "127.0.0.1",
            port: 6379,
        },
        database: 2,
    });
    await global.redis.connect();

    global.saveGuildsTree = [];
    global.emojiIdentity = {};



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
    //log.debug("123");
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

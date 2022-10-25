import { RedisClientType } from "@redis/client";
import { Logger } from "log4js";
import { IMessage } from "qq-guild-bot"
import { OpenAPI, WebsocketClient } from "./qq-guild-bot";

declare global {
    var devEnv: boolean;
    var adminId: string[];
    var log: Logger;
    var meId: string;
    var _path: string;
    var client: OpenAPI;
    var ws: WebsocketClient;
    var redis: RedisClientType;
    var saveGuildsTree: SaveGuild[];
    var emojiIdentity: {
        [guild: string]: {
            [identity: string]: string;
        }
    };

    interface IntentMessage {
        eventType:
        "MESSAGE_REACTION_ADD" |
        "MESSAGE_REACTION_REMOVE" |
        "MESSAGE_CREATE" |
        "PUBLIC_MESSAGE_DELETE" |
        "GUILD_MEMBER_REMOVE" |
        "GUILD_MEMBER_ADD" |
        "GUILD_MEMBER_UPDATE" |
        "MESSAGE_DELETE",
        eventId: string,
        msg: IMessage & GUILD_MEMBER & MESSAGE_REACTION_ADD,
    }

    interface MESSAGE_REACTION_ADD {
        channel_id: string,
        emoji: { id: string, type: 1 | 2 },
        guild_id: string,
        target: { id: string, type: 0 | 1 | 2 | 3 },
        user_id: string,
    }

    interface GUILD_MEMBER {
        guild_id: string;
        joined_at: string;
        nick: string;
        op_user_id: string;
        roles?: string[];
        user: {
            avatar: string;
            bot: boolean;
            id: string;
            username: string;
        };
    }

    interface SaveGuild {
        name: string,
        id: string,
        channel: SaveChannel[],
    }

    interface SaveChannel {
        name: string,
        id: string,
    }

}


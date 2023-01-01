import { loadGuildTree } from "../init";
import { sendMsgEx } from "../lib/IMessageEx";


export const wsIntentMessage: { [key: string]: (data?: any) => Promise<any> } = {
    "channel.getList": async () => {
        const res = await loadGuildTree(false, false);
        return saveGuildsTree;
    },
    "channel.postMsg": async (data) => {
        return sendMsgEx({
            sendType: "GUILD",
            channelId: data.channelId,
            content: data.content,
        }).then(res => {
            return res.data;
        });
    }
}
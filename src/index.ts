import { Hono } from 'hono'
import {
  MessageAPIResponseBase,
  TextMessage,
  WebhookEvent,
} from "@line/bot-sdk";
import { client } from './db/client';
import { StockService } from './services/stockService';

export type Env = {
  db: D1Database;
  CHANNEL_ACCESS_TOKEN: string; 
}

const app = new Hono<{ Bindings: Env }>()

app.post("/api/webhook", async (c) => {
  const data = await c.req.json();
  const events: WebhookEvent[] = (data as any).events;
  const accessToken = c.env.CHANNEL_ACCESS_TOKEN;
  const db = c.env.db;

  await Promise.all(
    events.map(async (event: WebhookEvent) => {
      try {
        // 友達追加したときはユーザー情報を登録する
        if (event.type == 'follow') {
          await upsertUser(db, event.source.userId);
        }
        const user = await findUserByUid(db, event.source.userId);

        if (event.type !== "message" || event.message.type !== "text" || !user) {
          return;
        }

        const stockService = new StockService({ db, userId: user.id });

        const type = await stockService.getMessageType(event.message.text);
        console.log('type', type)

        if (type === "start") {
          const result = await stockService.startStock({
            message: event.message.text,
          });
          const messages = [{
            type: "text" as const,
            text: result?.message || '',
          }]
          result && await reply(messages, accessToken, event.replyToken);
        } else if (type === "continue") {
          const result = await stockService.continueStock({
            message: event.message.text,
          });
          const messages = [{
            type: "text" as const,
            text: result?.message || '',
          }]
          result && await reply(messages, accessToken, event.replyToken);
        } else if (type === "stop") {
          const result = await stockService.endStock({
            message: event.message.text,
          });
          const messages = [{
            type: "text" as const,
            text: result?.message || '',
          }]
          result && await reply(messages, accessToken, event.replyToken);
        } else if (type == 'none') {
          const result = await stockService.getStocksByMessage({
            message: event.message.text,
          });

          if (result.length === 0) {
            const messages = [{
              type: "text" as const,
              text: '見つかりませんでした',
            }]
            await reply(messages, accessToken, event.replyToken);
          } else {
            const messages = result.map((stock) => {
              return {
                type: "text" as const,
                text: stock.content,
              };
            });
            await reply(messages, accessToken, event.replyToken);
          }
        }

      } catch (err: unknown) {
        if (err instanceof Error) {
          console.error(err);
        }
        return c.json({
          status: "error",
        });
      }
    })
  );
  return c.json({ message: "ok" });
});

const reply = async (
  messages: TextMessage[],
  accessToken: string,
  replyToken: string
) => {

  await fetch("https://api.line.me/v2/bot/message/reply", {
    body: JSON.stringify({
      replyToken: replyToken,
      messages: messages,
    }),
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
};

const upsertUser = async (db: D1Database, uid?: string) => {
  if (!uid) return;

  const user = await client(db).insertInto('User').values({
    uid,
  }).onConflict((oc) => oc
    .column('uid')
    .doNothing()
  ).execute()

  return user;
}

const findUserByUid = async (db: D1Database, uid?: string) => {
  if (!uid) return;

  return await client(db).selectFrom('User').selectAll().where('uid', '=', uid).executeTakeFirst();
}

export default app

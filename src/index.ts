import { Hono } from 'hono'
import {
  MessageAPIResponseBase,
  TextMessage,
  WebhookEvent,
} from "@line/bot-sdk";
import { client } from './db/client';
import { Stock } from './stock';

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
        console.log(user);
        const stock = new Stock(db);

        if (event.type !== "message" || event.message.type !== "text" || !user) {
          return;
        }

        const type = stock.getMessageType(event.message.text);

        if (type === "start") {
          const result = await stock.startStock({
            message: event.message.text,
            userId: user.id,
          });
          result && await reply(result.message, accessToken, event.replyToken);
        } else if (type === "continue") {
          const result = await stock.continueStock({
            message: event.message.text,
            userId: user.id,
          });
          result && await reply(result.message, accessToken, event.replyToken);
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
  message: string,
  accessToken: string,
  replyToken: string
) => {

  const response: TextMessage = {
    type: "text",
    text: message,
  };

  await fetch("https://api.line.me/v2/bot/message/reply", {
    body: JSON.stringify({
      replyToken: replyToken,
      messages: [response],
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

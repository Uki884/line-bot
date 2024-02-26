import { client } from "./db/client";

const startStockRegExp = new RegExp(/^記憶して/)
const saveStockRegExp = new RegExp(/^保存して/)
const reStockRegExp = new RegExp(/^やり直して/)
const stopStockRegExp = new RegExp(/^終了/)

type Payload = {
  message: string;
  userId: number;
}

export class Stock {
  constructor (private db: D1Database) {}

  public startStock = async ({ message, userId }: Payload) => {
    if (this.getMessageType(message) !== "start") return;

    await client(this.db).insertInto('Message').values({
      content: '記憶して',
      userId: userId,
    }).execute();

    return {
      message: '保存する名前を教えて下さい',
    }
  }

  public continueStock = async ({ message, userId }: Payload) => {
    if (this.getMessageType(message) !== "continue") return;
    console.log('continueStock', message, userId)
    const stockGroup = await client(this.db).selectFrom('StockGroup').where('StockGroup.userId', '=', userId).where('StockGroup.alias', '=', message).selectAll().executeTakeFirst();
  
    if (stockGroup) {
      await client(this.db).insertInto('Stock').values({
        content: message,
        userId,
        stockGroupId: stockGroup.id,
      }).execute();
      return {
        message: '保存しました',
      }
    } else {
      console.log('stockGroupなし')
      console.log('message', message, userId)
      await client(this.db).insertInto('StockGroup').values({
        alias: message,
        userId,
      }).execute();

      return {
        message: '続けて保存したい単語を教えて下さい',
      }
    }
  };

  public saveStock = async ({ message, userId }: Payload) => {
    if (this.getMessageType(message) !== "save") return;

    const messages = await client(this.db)
    .selectFrom('Message')
    .where('Message.userId', '=', userId)
    .where('Message.content', '!=', '記憶して')
    .orderBy('Message.createdAt asc')
    .selectAll()
    .execute();

    console.log(messages);

  };

  getMessageType = (message: string) => {
    if (startStockRegExp.test(message)) {
      return "start";
    }
    if (saveStockRegExp.test(message)) {
      return "save";
    }
    if (reStockRegExp.test(message)) {
      return "re";
    }
    if (stopStockRegExp.test(message)) {
      return "stop";
    }
    return "continue";
  };
}

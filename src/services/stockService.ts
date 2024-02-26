import { client } from "../db/client";

const startStockRegExp = new RegExp(/^記憶して/)
const saveStockRegExp = new RegExp(/^保存して/)
const reStockRegExp = new RegExp(/^やり直して/)
const stopStockRegExp = new RegExp(/^終了/)
const saveStockGroupText = 'グループ名を保存'

type Payload = {
  message: string;
}

export class StockService {
  db: D1Database;
  userId: number;

  constructor (payload: { db: D1Database, userId: number }) {
    this.db = payload.db;
    this.userId = payload.userId;
  }

  getStocksByMessage = async ({ message }: Payload) => {
    const hasGroup = await this.getStockGroup(message);

    if (hasGroup) {
      const stock = await client(this.db)
        .selectFrom('Stock')
        .where('Stock.stockGroupId', '=', hasGroup.id)
        .selectAll()
        .execute();

      return stock;
    } else {
      return []
    }
  };

  public startStock = async ({ message }: Payload) => {
    if (await this.getMessageType(message) !== "start") return { message: 'エラーが発生しました' }

    await client(this.db).insertInto('Message').values({
      content: '記憶して',
      userId: this.userId,
    }).execute();

    return {
      message: 'どんな名前で保存したいか教えて下さい',
    }
  }

  public endStock = async ({ message }: Payload) => {
    if (await this.getMessageType(message) !== "stop") return { message: 'エラーが発生しました' }

    await client(this.db).deleteFrom('Message').where('Message.userId', '=', this.userId).execute();

    return {
      message: '終了しました！',
    }
  };

  public continueStock = async ({ message }: Payload) => {
    if (await this.getMessageType(message) !== "continue") return { message: 'エラーが発生しました' }

    const hasStockGroupText = await this.hasStockGroupText();

    console.log('continueStock', hasStockGroupText)
  
    if (hasStockGroupText) {
      const stockGroup = await client(this.db)
        .selectFrom('StockGroup')
        .where('StockGroup.userId', '=', this.userId)
        .orderBy('StockGroup.createdAt desc')
        .selectAll()
        .executeTakeFirstOrThrow();

      await client(this.db).insertInto('Stock').values({
        content: message,
        userId: this.userId,
        stockGroupId: stockGroup.id,
      }).execute();

      return {
        message: '保存しました！続けて保存する単語を入力するか、このまま終わる場合は「終了」と入力してください',
      }
    } else {
      await client(this.db).insertInto('StockGroup').values({
        alias: message,
        userId: this.userId,
      }).execute();

      await client(this.db).insertInto('Message').values({
        content: saveStockGroupText,
        userId: this.userId,
      }).execute();

      return {
        message: '続けて保存したい言葉を教えて下さい',
      }
    }
  };

  public saveStock = async ({ message }: Payload) => {
    if (await this.getMessageType(message) !== "save") return { message: 'エラーが発生しました' }

    const messages = await client(this.db)
    .selectFrom('Message')
    .where('Message.userId', '=', this.userId)
    .where('Message.content', '!=', '記憶して')
    .orderBy('Message.createdAt asc')
    .selectAll()
    .execute();

    console.log(messages);

  };

  getMessageType = async (message: string) => {
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
    const hasStartStockText = await this.hasStartStockText();
    if (hasStartStockText) {
      return "continue";
    }

    return "none";
  };

  private getStockGroup = async (alias: string) => {
    return await client(this.db)
    .selectFrom('StockGroup')
    .where('StockGroup.userId', '=', this.userId)
    .where('StockGroup.alias', '=', alias)
    .orderBy('StockGroup.createdAt desc')
    .selectAll()
    .executeTakeFirst();
  }

  private hasStartStockText = async () => {
    const continueStock = await client(this.db)
      .selectFrom('Message')
      .where('Message.userId', '=', this.userId)
      .where('Message.content', '=', '記憶して')
      .selectAll()
      .executeTakeFirst();

    return !!continueStock;
  }

  private hasStockGroupText = async () => {
    const continueStock = await client(this.db)
      .selectFrom('Message')
      .where('Message.userId', '=', this.userId)
      .where('Message.content', '=', saveStockGroupText)
      .selectAll()
      .executeTakeFirst();

    return !!continueStock;
  }
}

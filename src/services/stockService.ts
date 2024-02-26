import { client } from "../db/client";

const startStockRegExp = new RegExp(/^覚えて/)
const stopStockRegExp = new RegExp(/^終了する/)
const cancelStockRegExp = new RegExp(/^やめる/)
const checkStocksRegExp = new RegExp(/^リストを見せて/)
const stopStockText = '終了する' 
const startStockText = '覚えて'
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

  public getStocksByMessage = async ({ message }: Payload) => {
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

  public getStockList = async () => {
    const stockGroup = await client(this.db)
      .selectFrom('StockGroup')
      .where('StockGroup.userId', '=', this.userId)
      .selectAll()
      .execute();

    return stockGroup;
  };

  public startStock = async ({ message }: Payload) => {
    if (await this.getMessageType(message) !== "start") return { message: 'エラーが発生しました' }

    await client(this.db).insertInto('Message').values({
      content: startStockText,
      userId: this.userId,
    }).execute();

    return {
      message: '覚えた言葉を呼び出すときに使う名前を教えてください',
    }
  }

  public endStock = async ({ message }: Payload) => {
    if (await this.getMessageType(message) !== "stop") return { message: 'エラーが発生しました' }

    await client(this.db).deleteFrom('Message').where('Message.userId', '=', this.userId).execute();

    return {
      message: '終了しました！登録した内容を確認するには「リストを見せて」と入力してください',
    }
  };

  public cancelStock = async ({ message }: Payload) => {
    if (await this.getMessageType(message) !== "cancel") return { message: 'エラーが発生しました' }
    const stockGroupName = await this.getStockGroupNameInMessage();

    if (stockGroupName) {
      await client(this.db)
        .deleteFrom('StockGroup')
        .where('StockGroup.id', '=', stockGroupName.id)
        .where('StockGroup.userId', '=', this.userId)
        .execute();
      await client(this.db)
        .deleteFrom('Stock')
        .where('Stock.stockGroupId', '=', stockGroupName.id)
        .execute();
      await client(this.db)
        .deleteFrom('Message')
        .where('Message.userId', '=', this.userId)
        .execute();
    }

    return {
      message: '覚えるのを諦めました。覚えさせたい言葉が見つかったら「覚えて」と入力してね',
    }
  };

  public continueStock = async ({ message }: Payload) => {
    if (await this.getMessageType(message) !== "continue") return { message: 'エラーが発生しました' }

    const hasStockGroupText = await this.hasStockGroupText();
  
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
        message: `保存しました。続けて保存する単語を入力するか、このまま終了する場合は「${stopStockText}」と入力してください`,
      }
    } else {
      await client(this.db).insertInto('StockGroup').values({
        alias: message,
        userId: this.userId,
      }).execute();

      await client(this.db).insertInto('Message').values({
        content: `${saveStockGroupText}:${message}`,
        userId: this.userId,
      }).execute();

      return {
        message: '続けて覚えさせたい言葉を教えて下さい。覚えさせるのをやめる場合は「やめる」と入力してください',
      }
    }
  };

  getMessageType = async (message: string) => {
    if (startStockRegExp.test(message)) {
      return "start";
    }

    if (cancelStockRegExp.test(message)) {
      return "cancel";
    }

    if (stopStockRegExp.test(message)) {
      return "stop";
    }

    if (checkStocksRegExp.test(message)) {
      return "check";
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
      .where('Message.content', '=', startStockText)
      .selectAll()
      .executeTakeFirst();

    return !!continueStock;
  }

  private hasStockGroupText = async () => {
    const continueStock = await client(this.db)
      .selectFrom('Message')
      .where('Message.userId', '=', this.userId)
      .where('Message.content', 'like', `%${saveStockGroupText}%`)
      .selectAll()
      .executeTakeFirst();

    return !!continueStock;
  }

  private getStockGroupNameInMessage = async () => {
    const stockGroup = await client(this.db)
      .selectFrom('Message')
      .where('Message.userId', '=', this.userId)
      .where('Message.content', 'like', `%${saveStockGroupText}%`)
      .selectAll()
      .executeTakeFirst();

    return stockGroup;
  };
}

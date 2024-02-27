import { client } from "../db/client";

const startStockRegExp = new RegExp(/^覚えて/)
const removeStockRegExp = new RegExp(/^忘れて/)
const stopStockRegExp = new RegExp(/^終了する/)
const cancelStockRegExp = new RegExp(/^やめる/)
const checkStocksRegExp = new RegExp(/^リストを見せて/)
const stopStockText = '終了する' 
const startStockText = '覚えて'
const startRemoveStockText = '忘れて'
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
      message: '終了しました！覚えさせた言葉リストを確認するには「リストを見せて」と入力してください',
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
        message: `保存しました。続けて保存する言葉を入力するか、このまま終了する場合は「${stopStockText}」と入力してください`,
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
        message: '覚えさせたい言葉を入力してください。覚えさせるのをやめる場合は「やめる」と入力してください',
      }
    }
  };

  public removableStockList = async ({ message }: Payload) => {
    if (await this.getMessageType(message) !== "remove") return { message: 'エラーが発生しました' }
    const stockList = await this.getStockList();

    await client(this.db).insertInto('Message').values({
      content: startRemoveStockText,
      userId: this.userId,
    }).execute();

    return {
      message: `忘れさせたい言葉の番号を入力してください\n${stockList.map((stock, index) => `${index + 1}: ${stock.alias}`).join('\n')}`
    }
  };

  public removeStock = async ({ message }: Payload) => {
    const index = Number(message) - 1;
    if (isNaN(index)) {
      return {
        message: '番号を入力してください'
      }
    }
    const stockList = await this.getStockList();
    const stock = stockList[index];
    const resultStackList = stockList.filter((_, i) => i !== index);

    if (stock) {
      await client(this.db)
      .deleteFrom('Stock')
      .where('Stock.stockGroupId', '=', stock.id)
      .execute();
      await client(this.db)
        .deleteFrom('StockGroup')
        .where('StockGroup.id', '=', stock.id)
        .where('StockGroup.userId', '=', this.userId)
        .execute();

      return {
        message: `${stock.alias}に関する言葉を忘れました。続けて忘れさせたい言葉があれば番号を入力してください\n${resultStackList.map((stock, index) => `${index + 1}: ${stock.alias}`).join('\n')}\nこのまま終わる場合は「${stopStockText}」って入力してね`
      }
    } else {
      return {
        message: 'その言葉は覚えてません...'
      }
    }
  };

  getMessageType = async (message: string) => {
    if (startStockRegExp.test(message)) {
      return "start";
    }

    if (removeStockRegExp.test(message)) {
      return "remove";
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

    if (await this.hasRemoveStartStockText()) {
      return "remove_starting";      
    }

    if (await this.hasStartStockText()) {
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

  private hasRemoveStartStockText = async () => {
    const continueStock = await client(this.db)
      .selectFrom('Message')
      .where('Message.userId', '=', this.userId)
      .where('Message.content', '=', startRemoveStockText)
      .selectAll()
      .executeTakeFirst();

    return !!continueStock;
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

import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type Message = {
    id: Generated<number>;
    content: string;
    userId: number;
    createdAt: Generated<string>;
    updatedAt: Generated<string>;
};
export type Stock = {
    id: Generated<number>;
    content: string;
    stockGroupId: number;
    userId: number;
    createdAt: Generated<string>;
    updatedAt: Generated<string>;
};
export type StockGroup = {
    id: Generated<number>;
    alias: string;
    userId: number | null;
    createdAt: Generated<string>;
    updatedAt: Generated<string>;
};
export type User = {
    id: Generated<number>;
    uid: string;
    createdAt: Generated<string>;
    updatedAt: Generated<string>;
};
export type DB = {
    Message: Message;
    Stock: Stock;
    StockGroup: StockGroup;
    User: User;
};

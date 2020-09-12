import { RowDataPacket } from "mysql2";

export interface IConversion extends RowDataPacket {
    separatedId:number,
    qualityKey:string
}
import { RowDataPacket } from "mysql2";

export interface ITrack {
    id: number,
    videoId: string,
    progress: number,
    requestedTimestamp: Date,
    finishedTimestamp: Date|null,
    title: string,
    secondsLong: number,
    playedCount: number,
    thumbnailUrl: string,
    statusId:number
}

export interface ITrackResult extends ITrack,RowDataPacket{

}
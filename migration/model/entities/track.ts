import { RowDataPacket } from "mysql2";
import { BaseEntity } from "../../infrastructure/base-entity";

export interface ITrack {
    id: number,
    videoId: string,
    progress: number,
    requestedTimestamp: Date,
    finishedTimestamp: Date | null,
    title: string,
    secondsLong: number,
    playedCount: number,
    thumbnailUrl: string,
    statusId: number
}

export interface ITrackResult extends ITrack, RowDataPacket {

}

export class Track extends BaseEntity {
    id: number = -1
    videoId: string = ""
    progress: number = 0
    requestedTimestamp: Date | null = null
    finishedTimestamp: Date | null = null
    title: string = ""
    secondsLong: number = -1
    playedCount: number = -1
    thumbnailUrl: string = ""
    statusId: number = -1
    status: string = ""
    constructor() {
        super()
    }
}

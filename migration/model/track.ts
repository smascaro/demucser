export interface ITrack {
    id: number,
    videoId: string,
    progress: number,
    requestedTimestamp: Date,
    finishedTimestamp: Date,
    title: string,
    secondsLong: number,
    playedCount: number,
    thumbnailUrl: string
}
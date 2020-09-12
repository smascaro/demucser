import { BaseRepository } from "../../infrastructure/base-repository";
import { Track } from "../entities/track"
import mysql = require('mysql2/promise')
import { Database } from "../../db/database";
import { QueryOptions, QueryOptionsSort } from "../../db/query-criteria";
import { TrackRepository } from "./repository-factory";
export class TracksRepository extends BaseRepository<Track> {
    public static create(database: Database): TracksRepository {
        return new TracksRepository(database)
    }
    constructor(database: Database) {
        super(database)
    }
    get(options?: QueryOptions): Promise<Track[]> {
        let postQueryConditions = " "
        if (options) {
            if (options.omitErrors) {
                postQueryConditions += ` where tstat.value <>'ERROR'`
            }
            if (options.sort) {
                switch (options.sort) {
                    case QueryOptionsSort.NEWEST:
                        postQueryConditions += " order by `requestedTimestamp` desc"
                        break;
                    case QueryOptionsSort.OLDEST:
                        postQueryConditions += " order by `requestedTimestamp` asc"
                        break;
                    case QueryOptionsSort.POPULAR:
                        postQueryConditions += " order by `playedCount` desc"
                        break;
                    default:
                        console.warn(`Sorting criteria not implemented: ${options.sort}`)
                        break;
                }
            }

            if ((options.limit || options.limit === 0)) {
                var validLimit = (options.limit !== NaN)
                if (!validLimit) {
                    console.warn(`${options.limit} is not a valid limit. No limit or offset will be applied.`)
                } else {
                    //Valid limit
                    postQueryConditions += ` limit ${options.limit}`
                }
                if (validLimit) {
                    //If limit was valid then we can check for offset
                    if (options.offset || options.offset === 0) {
                        var validOffset = (options.offset !== NaN)
                        if (!validOffset) {
                            console.warn(`${options.offset} is not a valid offset. No offset will be applied.`)
                        } else {
                            //Valid offset
                            postQueryConditions += ` offset ${options.offset}`
                        }
                    }
                }
            }


        }
        let query = "select tsep.*,tstat.value as status \
        from sm01.tseparated as tsep \
        inner join sm01.tstatus as tstat on tstat.`key` = tsep.`status` " + postQueryConditions
        return this.execute(query)
    }
    getByKey(videoId: string): Promise<Track> {
        return new Promise((resolve, reject) => {

            let query = "select tsep.*,tstat.value as status \
            from sm01.tseparated as tsep \
            inner join sm01.tstatus as tstat on tstat.`key` = tsep.`status`\
            where tsep.`videoId`=?"
            this.execute<Track>(query, videoId).then((data) => {
                if (data.length > 0) {
                    return resolve(data[0])
                }
                return reject(`Track with ID ${videoId} not found`)

            }).catch(reject)
        })
    }
}

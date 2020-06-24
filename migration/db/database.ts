import mysql = require('mysql2/promise')
import { DatabaseSettings } from './database-settings'
import { IStatus } from '../model/status'
import { ITrack, ITrackResult } from '../model/track'
import { IQueryCriteria } from './query-criteria'
import { IQuality } from '../model/quality'
import { IConversion } from '../model/conversion'
import { ResultSetHeader } from 'mysql2/promise'

export class Database {
    _pool: mysql.Pool
    constructor(settings: DatabaseSettings) {
        this._pool = mysql.createPool({
            host: settings.host,
            user: settings.user,
            password: settings.password,
            database: settings.database
        })
    }

    getAvailableStatuses(): Promise<IStatus[]> {
        return new Promise((resolve, reject) => {
            let query = "select `key`, `value` from sm01.tstatus"
            try {
                this._pool.query(query)
                    .then((rows) => {
                        console.log(rows);
                        resolve(rows[0] as IStatus[])
                    })
                    .catch((e) => {
                        console.error(e)
                        reject(e)
                    })

                // const [rows] = await promisePool.query(query);
                // return rows;
            } catch (e) {
                console.error(e)
                return []
            }
        })
    }

    getAllItems(criteria?: IQueryCriteria): Promise<ITrack[]> {
        return new Promise((resolve, reject) => {
            let postQueryConditions = " "
            if (criteria) {
                if (criteria.omitErrors) {
                    postQueryConditions += ` where tstat.value <>'ERROR'`
                }
                if (criteria.sort) {
                    switch (criteria.sort) {
                        case "newest":
                            postQueryConditions += " order by `requestedTimestamp` desc"
                            break;
                        case "oldest":
                            postQueryConditions += " order by `requestedTimestamp` asc"
                            break;
                        case "popular":
                            postQueryConditions += " order by `playedCount` desc"
                            break;
                        default:
                            console.warn(`Sorting criteria not implemented: ${criteria.sort}`)
                            break;
                    }
                }

                if ((criteria.limit || criteria.limit === 0)) {
                    var validLimit = (criteria.limit !== NaN)
                    if (!validLimit) {
                        console.warn(`${criteria.limit} is not a valid limit. No limit or offset will be applied.`)
                    } else {
                        //Valid limit
                        postQueryConditions += ` limit ${criteria.limit}`
                    }
                    if (validLimit) {
                        //If limit was valid then we can check for offset
                        if (criteria.offset || criteria.offset === 0) {
                            var validOffset = (criteria.offset !== NaN)
                            if (!validOffset) {
                                console.warn(`${criteria.offset} is not a valid offset. No offset will be applied.`)
                            } else {
                                //Valid offset
                                postQueryConditions += ` offset ${criteria.offset}`
                            }
                        }
                    }
                }


            }
            let query = "select tsep.* \
                        from sm01.tseparated as tsep \
                        inner join sm01.tstatus as tstat on tstat.`key` = tsep.`status`" + postQueryConditions
            try {
                this._pool.query(query)
                    .then((rows) => {
                        resolve(<ITrack[]>rows[0])
                    })
            } catch (e) {
                console.error(e)
                reject(e)
            }
        })
    }

    getAvailableQualities(): Promise<IQuality[]> {
        return new Promise((resolve, reject) => {
            let query = "SELECT `key`, `format`, `isDefault` FROM sm01.tqualitysettings;"
            this._pool.query(query)
                .then((rows) => {
                    console.log(rows);
                    resolve(<IQuality[]>rows[0])
                })
                .catch((e) => {
                    reject(e)
                })
        })
    }

    getItemByVideoId(videoId: string): Promise<ITrackResult | null> {
        return new Promise((resolve, reject) => {
            let query = `select tsep.* 
            from sm01.tseparated as tsep 
            where tsep.\`videoId\` = ?`
            this._pool.query<ITrackResult[]>(query, [videoId])
                .then(([rows]) => {
                    if (rows.length > 0 && rows[0]) {
                        resolve(rows[0])
                    } else {
                        resolve(null)
                    }
                })
                .catch((e) => {
                    console.error(e)
                    reject(e)
                })
        })
    }

    getConversionsByVideoId(videoId: string): Promise<IConversion[]> {
        return new Promise((resolve, reject) => {
            this.getItemByVideoId(videoId).then((item) => {
                if (!item || item == null) {
                    const errorMessage = `Error while getting Item object with Id ${videoId}`
                    console.error(errorMessage)
                    reject(errorMessage)
                }
                let queryConversions = 'SELECT `separatedId`, `qualityKey` FROM sm01.tconverted where `separatedId` = ?;'
                let args = [item?.id]
                this._pool.query<IConversion[]>(queryConversions, args)
                    .then((rows) => {
                        console.log(rows)
                        resolve(rows[0])
                    })
                    .catch((e) => {
                        reject(e)
                    })
            })
        })
    }

    insertItem(itemToInsert: ITrack) {
        return new Promise((resolve, reject) => {
            console.log('insertItem called with parameter: ' + itemToInsert)
            if (itemToInsert.videoId.length > 0) {
                let insertQuery = `INSERT INTO \`sm01\`.\`tseparated\` (\`videoId\`,\`progress\`,\`status\`,\`requestedTimestamp\`,\`finishedTimestamp\`,\`title\`,\`secondsLong\`, \`thumbnailUrl\`) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;
                let args = [
                    itemToInsert.videoId,
                    itemToInsert.progress,
                    itemToInsert.statusId,
                    itemToInsert.requestedTimestamp,
                    itemToInsert.finishedTimestamp,
                    itemToInsert.title,
                    itemToInsert.secondsLong,
                    itemToInsert.thumbnailUrl]
                console.log(`Query: ${insertQuery}`)
                this._pool.execute(insertQuery, args)
                    .then((data) => {
                        console.log(data)
                        const result = data[0] as ResultSetHeader
                        if (result.affectedRows > 0) {
                            console.log(`Inserted row with Video ID: ${itemToInsert.videoId}`)
                            resolve()
                        } else {
                            console.error(data)
                            reject('Unknown error')
                        }
                    })
                    .catch((e) => {
                        console.error(e)
                        reject(e)
                    })
            }
        })
    }
    insertConversion(videoId: string, quality: string) {
        return new Promise((resolve, reject) => {
            this.getItemByVideoId(videoId)
                .then((item) => {
                    if (item && item != null) {
                        let queryInsert = 'insert into `sm01`.`tconverted`(`separatedId`,`qualityKey`) values(?,?)';
                        let args = [item?.id, quality.toLowerCase()];
                        this._pool.execute(queryInsert, args)
                            .then((data) => {
                                const result = data[0] as ResultSetHeader
                                if (result.affectedRows > 0) {
                                    console.log(`Inserted conversion of video with Id ${videoId} to format with quality: ${quality}`);
                                    resolve()
                                } else {
                                    return reject('Unknown error')
                                }

                            })
                            .catch((e) => {
                                console.error(e)
                                return reject(e)
                            })
                    } else {
                        const errorMessage = `Error while getting Item object with Id ${videoId}`
                        console.error(errorMessage)
                        return reject(errorMessage)
                    }
                })
        })
    }
}
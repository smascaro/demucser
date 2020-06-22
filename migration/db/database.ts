import mysql = require('mysql2/promise')
import { DatabaseSettings } from './database-settings'
import { Status, IStatus } from '../model/status'
import { ITrack } from '../model/track'
import { IQueryCriteria } from './query-criteria'

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
                .then((rows)=>{
                    resolve(<ITrack[]>rows[0])
                })
            } catch (e) {
                console.error(e)
                reject(e)
            }
        })
    }
}
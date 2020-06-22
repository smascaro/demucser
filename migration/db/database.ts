import mysql = require('mysql2/promise')
import { DatabaseSettings } from './database-settings'
import { Status, IStatus } from '../model/status'

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
}
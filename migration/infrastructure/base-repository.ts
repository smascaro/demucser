import mysql = require('mysql2/promise')
import { RowDataPacket } from 'mysql2/promise';
import { Database } from '../db/database';
import { DatabaseSettings } from '../db/database-settings';

export abstract class BaseRepository<T> {
    database: Database
    constructor(database: Database) {
        this.database = database;
    }

    protected execute<T>(sqlQuery: string, ...params: string[]): Promise<T[]> {
        return new Promise((resolve, reject) => {
            try {
                this.database.pool.query(sqlQuery, params).then((rows) => {
                    return resolve(rows[0] as T[])
                }).catch((e) => {
                    throw new Error(e)
                })
            } catch (e) {
                console.error(e)
                return reject("SQL_ERROR")
            }
        })
    }
}
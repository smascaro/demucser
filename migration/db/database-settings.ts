import fs from 'fs'
import process from 'process'

export class DatabaseSettings {
    host: string = ""
    user: string = ""
    password: string = ""
    database: string = ""

    constructor() {

    }

    init() {
        this.host = process.env.DB_HOST as string
        this.user = process.env.DB_USER as string
        this.password = process.env.DB_PASSWORD as string
        this.database = process.env.DB_DATABASE_NAME as string
    }
}
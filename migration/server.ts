import express = require('express')
import { App } from "./app"
import { DatabaseSettings } from './db/database-settings'
import { Database } from './db/database'
import path from 'path'
import { IStatus } from './model/status'
import { AppConfig } from './app-config'
(async () => {

    const appWrapper: App = new App()
    let db: Database
    const app = appWrapper.getApplication()
    const settings = new DatabaseSettings()
    settings.loadConfig(path.resolve(__dirname, '../../config/db.json'))
        .then(() => {
            db = new Database(settings)
        })

    const config = new AppConfig()
    await config.load(path.resolve('./config/config.json'))
    app.get('/', (req, res) => {
        db.getAvailableStatuses().then((rows) => {
            console.log(rows)
            rows = <IStatus[]>rows
            res.send('Hello world')
        })
    })

    app.listen(config.port, () => {
        console.log(`App listening on port ${config.port}`)
    })
})()
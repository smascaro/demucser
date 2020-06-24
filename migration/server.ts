import express = require('express')
import { App } from "./app"
import { DatabaseSettings } from './db/database-settings'
import { Database } from './db/database'
import path from 'path'
import { IStatus } from './model/status'
import { AppConfig } from './app-config'
import { ITrack } from './model/track'
import { ApiResponse } from './db/api-response'
(async () => {

    const appWrapper: App = new App()
    let db: Database
    const app = appWrapper.getApplication()
    const settings = new DatabaseSettings()
    settings.load(path.resolve(__dirname, '../../config/db.json'))
        .then(() => {
            db = new Database(settings)
        })

    const config = new AppConfig()
    await config.load(path.resolve('./config/config.json'))
    app.get('/', (req, res) => {
        db.getAllItems().then((rows) => {
            console.log(rows)
            rows = <ITrack[]>rows
            res.send(JSON.stringify(rows))
        })
    })

    app.get('/:videoId', (req, res) => {
        const { videoId } = req.params
        db.getItemByVideoId(videoId)
            .then((item) => {
                res.json(item)
            })
    })

    app.get('/insert/:videoId', (req, res) => {
        const { videoId } = req.params
        const track: ITrack = {
            id: 0,
            videoId: videoId,
            playedCount: 0,
            finishedTimestamp: null,
            progress: 17,
            requestedTimestamp: new Date(),
            secondsLong: 333,
            thumbnailUrl: "http://localhost:3000/img.jpg",
            title: 'Test #1',
            statusId: 1
        }
        db.insertItem(track)
            .then(() => {
                res.status(200).json(new ApiResponse(0, `New item inserted with ID ${videoId}`, {}))
            }).catch((e) => {
                res.status(500).send(e)
            })
    })

    app.get('/insert_conversion/:videoId/:q', (req, res) => {
        const { videoId, q } = req.params
        db.insertConversion(videoId, q)
            .then(() => {
                res.status(200).json(new ApiResponse(0, 'Conversion inserted successfully', {}))
            })
            .catch((e) => {
                res.status(500).json(new ApiResponse(-1, e, {}))
            })
    })

    app.listen(config.port, () => {
        console.log(`App listening on port ${config.port}`)
    })
})()
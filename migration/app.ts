import express =require('express');

export class App {
    private _app: express.Application
    constructor() {
        this._app = express()
        this._app.use(express.json())
    }

    getApplication(): express.Application{
        return this._app
    }
}
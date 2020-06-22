import { Database } from "../migration/db/database"
import fs from "fs"
import path from "path"
import { expect } from "chai"
import { DatabaseSettings } from "../migration/db/database-settings"
describe('Database', () => {
    it('should find a database configuration file', () => {
        fs.readFile(path.resolve(__dirname, '../config/db.json'), 'utf8', (error, data) => {
            expect(error == null || error == undefined).to.be.true
            expect(data).to.not.be.undefined
            expect(data).to.not.be.null
            expect(data).to.be.string
        })
    })
    it('should find a valid database configuration file', () => {
        fs.readFile(path.resolve(__dirname, '../config/db.json'), 'utf8', (error, data) => {
            expect(data).to.not.be.undefined
            expect(data).to.not.be.null
            expect(data).to.not.be.empty
            let parsedData = JSON.parse(data)
            expect(parsedData).to.not.be.undefined
            expect(parsedData).to.not.be.null

            expect(parsedData.host).to.be.string
            expect(parsedData.host).to.not.be.undefined
            expect(parsedData.host).to.not.be.null


            expect(parsedData.user).to.be.string
            expect(parsedData.user).to.not.be.undefined
            expect(parsedData.user).to.not.be.null


            expect(parsedData.password).to.be.string
            expect(parsedData.password).to.not.be.undefined
            expect(parsedData.password).to.not.be.null


            expect(parsedData.database).to.be.string
            expect(parsedData.database).to.not.be.undefined
            expect(parsedData.database).to.not.be.null

        })
        expect(true).to.be.true
    })
    it('should load settings correctly from a valid configuration file', async() => {
        const configFilePath =path.resolve(__dirname, '../config/db.json') 
        let settings = new DatabaseSettings()
        await settings.load(configFilePath)
            .then(async() => {
                await fs.readFile(configFilePath, 'utf8', (error,data)=>{
                    const parsedData = JSON.parse(data)
                    expect(settings.host).eq(parsedData.host)
                    expect(settings.user).eq(parsedData.user)
                    expect(settings.password).eq(parsedData.password)
                    expect(settings.database).eq(parsedData.database)
                })
            })
            // .catch((e)=>{
            //     throw new Error(e)
            // })
    })
})
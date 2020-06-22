import fs from "fs"
import { App } from "../migration/app"
import { AppConfig } from "../migration/app-config"
import { expect } from "chai"
import path from 'path'
describe('Application', () => {
    it('should find an app configuration file', () => {
        fs.readFile(path.resolve(__dirname, '../config/config.json'), 'utf8', (error, data) => {
            expect(error ==null || error==undefined).to.be.true
            expect(data).to.not.be.undefined
            expect(data).to.not.be.null
            expect(data).to.be.string
        })
    })
    it('should find a valid app configuration file', () => {
        fs.readFile(path.resolve(__dirname, '../config/config.json'), 'utf8', (error, data) => {
            expect(data).to.not.be.undefined
            expect(data).to.not.be.null
            expect(data).to.not.be.empty
            let parsedData = JSON.parse(data)
            expect(parsedData).to.not.be.undefined
            expect(parsedData).to.not.be.null
            expect(parsedData.port).to.not.be.string
            expect(parsedData.port).to.not.be.undefined
            expect(parsedData.port).to.not.be.null
            expect(parseInt(parsedData.port)).to.not.be.undefined
        })
        expect(true).to.be.true
    })
    it('should be able to run application on any open port', () => {
        let app = new App()
        try {
            let server = app.getApplication().listen(45332, () => { })
            server.close()
        } catch (e) {
            console.error(e)
            expect(true).to.be.false
        }
        const testTrueValue = true
        expect(testTrueValue).to.be.true
    })
    it('should be able to load application configuration correctly', () => {
        let config = new AppConfig()
        config.load(path.resolve(__dirname, 'test_config.json'))
            .then(() => {
                expect(config).to.not.be.undefined
                expect(config.port).to.not.be.undefined
                expect(config.port).to.not.be.eq(0)
            })
            .catch((e) => {
                expect(true).to.be.false
            })
    })
})
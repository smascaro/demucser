import fs from 'fs'
export class AppConfig {
    port: number = 0

    async load(configFilePath: string) {
        return new Promise((resolve, reject) => {
            fs.readFile(configFilePath, 'utf8', (error, data) => {
                if (!error) {
                    var parsedData = JSON.parse(data)
                    this.port = parsedData.port
                    resolve()
                } else {
                    reject(error)
                }
            })
        })
    }

}
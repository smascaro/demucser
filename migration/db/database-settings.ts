import fs = require('fs')
export class DatabaseSettings{
    constructor(){

    }

    load(configFilePath:string) {
        return new Promise((resolve, reject)=>{
            fs.readFile(configFilePath, 'utf8', (err, data)=>{
                if(!err){
                    let config = JSON.parse(data)
                    this.host=config.host
                    this.user=config.user
                    this.password=config.password
                    this.database=config.database
                    resolve()
                } else {
                    console.error(err)
                    reject(err)
                }
            })
        })
    }
    host:string = ""
    user:string = ""
    password:string = ""
    database:string = ""
}
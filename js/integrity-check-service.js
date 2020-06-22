const db = require('../routes/dbaccess')
const fs = require('fs')
const path = require('path')
module.exports = {
    checkDatabaseIntegrity: async (basePath) => {
        const itemsToCheck = await db.getAllItems()
        if (itemsToCheck) {
            await itemsToCheck.forEach(async(item) => {
                try {
                    //check directory existence
                    await fs.promises.access(path.resolve(basePath, item.videoId))
                    //directory exists, check for files in it
                    const dirContent = await fs.promises.readdir(path.resolve(basePath, item.videoId))
                    if (dirContent.filter(
                        fn => fn.startsWith('vocals.') ||
                            fn.startsWith('other.') ||
                            fn.startsWith('bass.') ||
                            fn.startsWith('drums.')
                    ).length >= 4) {
                        //Content OK
                        console.log(`Integrity check for video ID ${item.videoId}: SUCCESS`)
                    } else {
                        throw `Contents in directory for video id ${item.videoId} are not the expected`;
                    }
                } catch (error) {
                    console.error(error)
                    item.status = statusMap.get('ERROR')
                    await db.updateItem(item)
                    console.log(`Integrity check for video ID ${item.videoId}: FAIL`)
                }
            });

            console.log(`Integrity check finished.`)
        }
    }
}
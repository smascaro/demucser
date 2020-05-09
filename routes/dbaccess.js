module.exports = {
    getAllItems: async () => {
        let query = "select tsep.* \
                    from sm01.tseparated as tsep \
                    inner join sm01.tstatus as tstat on tstat.`key` = tsep.`status`"
        try {
            const [rows] = await promisePool.query(query);
            console.log(rows);
            return rows
        } catch(e) {
            console.error(e)
            return [];
        }
        
    },
    getAvailableStatus: async () => {
        let query = "select `key`, `value` from sm01.tstatus"
        try {
            const [rows] = await promisePool.query(query);
            console.log(rows);
            return rows;
        } catch (e) {
            console.error(e)
        }
    },
    getItemByVideoId: async (videoId) => {
        let query = `select tsep.* 
                    from sm01.tseparated as tsep 
                    where tsep.\`videoId\` = '${videoId}'`
        try {
            const [rows] = await promisePool.query(query);
            console.log(rows);
            return rows;
        } catch (e) {
            console.error(e)
        }
    },
    insertItem: async (itemToInsert) => {
        console.log('insertItem called with parameter: ' + itemToInsert)
        const videoId = itemToInsert.videoId ?? ''
        const title = itemToInsert.title ?? ''
        const length = itemToInsert.length ?? ''
        const progress = itemToInsert.progress ?? 0
        const status = itemToInsert.status ?? 0
        const requestedTimestamp = itemToInsert.requested ?? null
        const finishedTimestamp = itemToInsert.finished ?? null
        const thumbnailUrl = itemToInsert.thumbnailUrl ?? null
        if (videoId) {
            /*let insertQuery = `INSERT INTO \`sm01\`.\`tseparated\` (\`videoId\`,\`progress\`,\`status\`,\`requestedTimestamp\`,\`finishedTimestamp\`,\`title\`,\`secondsLong\`, \`thumbnailUrl\`) 
                               VALUES ('${videoId}', ${progress}, ${status}, ${finishedTimestamp ? ("'" + finishedTimestamp.toISOString() + "'" : 'NULL')}, ${finishedTimestamp ? ("'" + finishedTimestamp.toISOString() + "'" : 'NULL')}, '${title}', ${length}, '${thumbnailUrl}');`*/

            let insertQuery = `INSERT INTO \`sm01\`.\`tseparated\` (\`videoId\`,\`progress\`,\`status\`,\`requestedTimestamp\`,\`finishedTimestamp\`,\`title\`,\`secondsLong\`, \`thumbnailUrl\`) 
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;
            let args = [videoId, progress, status, requestedTimestamp, finishedTimestamp, title, length, thumbnailUrl]
            console.log(`Query: ${insertQuery}`)
            try {
                await promisePool.execute(insertQuery, args)
                console.log(`Inserted row with Video ID: ${videoId}`)
            } catch (e) {
                console.error(e)
            }
        }
    },
    updateItem: async (itemToUpdate) => {
        const videoId = itemToUpdate.videoId ?? ''
        const title = itemToUpdate.title ?? ''
        const length = itemToUpdate.length ?? ''
        const progress = itemToUpdate.progress ?? 0
        const status = itemToUpdate.status ?? 0
        const requestedTimestamp = itemToUpdate.requested ?? null
        const finishedTimestamp = itemToUpdate.finished ?? null
        const thumbnailUrl = itemToUpdate.thumbnailUrl ?? null
        if (videoId) {
            let updateQuery = `UPDATE \`sm01\`.\`tseparated\` SET \`title\` = ?, \`progress\` = ?, \`status\` = ?, \`requestedTimestamp\` = ?, \`finishedTimestamp\` = ?, \`secondsLong\` = ?, \`thumbnailUrl\` = ? WHERE (\`videoId\` = ?);`;
            let args = [title, progress, status, requestedTimestamp, finishedTimestamp, length, thumbnailUrl, videoId]
            try {
                await promisePool.execute(updateQuery, args)
                console.log(`Updated row with Video ID: ${videoId}`)
            } catch (e) {
                console.error(e)
            }
        }
    },
    updatePlayCount: async (videoId) => {
        let updateQuery = `UPDATE sm01.tseparated SET \`playedCount\` = \`playedCount\` + 1 where \`videoId\` = ?`;
        let args = [videoId]
            try {
                await promisePool.execute(updateQuery, args)
                console.log(`Incremented play count on item with Video ID: ${videoId}`)
            } catch (e) {
                console.error(e)
            }
        
    }
}

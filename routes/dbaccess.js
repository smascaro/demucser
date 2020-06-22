module.exports = {
    getAllItems: async (criteria) => {
        let postQueryConditions = " "
        if (criteria) {
            if(criteria.omitErrors) {
                postQueryConditions += ` where tstat.value <>'ERROR'`
            }
            if (criteria.sort) {
                switch (criteria.sort) {
                    case "newest":
                        postQueryConditions += " order by `requestedTimestamp` desc"
                        break;
                    case "oldest":
                        postQueryConditions += " order by `requestedTimestamp` asc"
                        break;
                    case "popular":
                        postQueryConditions += " order by `playedCount` desc"
                        break;
                    default:
                        console.warn(`Sorting criteria not implemented: ${criteria.sort}`)
                        break;
                }
            }

            if ((criteria.limit || criteria.limit === 0)) {
                var validLimit = (parseInt(criteria.limit) !== NaN)
                if (!validLimit) {
                    console.warn(`${criteria.limit} is not a valid limit. No limit or offset will be applied.`)
                } else {
                    //Valid limit
                    postQueryConditions += ` limit ${criteria.limit}`
                }
                if (validLimit) {
                    //If limit was valid then we can check for offset
                    if (criteria.offset || criteria.offset === 0) {
                        var validOffset = (parseInt(criteria.offset) !== NaN)
                        if (!validOffset) {
                            console.warn(`${criteria.offset} is not a valid offset. No offset will be applied.`)
                        } else {
                            //Valid offset
                            postQueryConditions += ` offset ${criteria.offset}`
                        }
                    }
                }
            }


        }
        let query = "select tsep.* \
                    from sm01.tseparated as tsep \
                    inner join sm01.tstatus as tstat on tstat.`key` = tsep.`status`" + postQueryConditions
        try {
            const [rows] = await promisePool.query(query);
            console.log(rows);
            return rows
        } catch (e) {
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
            return []
        }
    },
    getAvailableQualities: async () => {
        let query = "SELECT `key`, `format`, `isDefault` FROM sm01.tqualitysettings;"
        try {
            const [rows] = await promisePool.query(query);
            console.log(rows);
            return rows;
        } catch (e) {
            console.error(e)
            return []
        }
    },
    getItemByVideoId: async (videoId) => {
        let query = `select tsep.* 
                    from sm01.tseparated as tsep 
                    where tsep.\`videoId\` = '${videoId}'`
        try {
            const [rows] = await promisePool.query(query);
            console.log(rows);
            if (rows.length) {
                return rows[0]
            } else {
                return null
            }
        } catch (e) {
            console.error(e)
            return []
        }
    },
    getConversionsByVideoId: async (videoId) => {
        var item = await module.exports.getItemByVideoId(videoId)
        if (!item) {
            console.error(`Error while getting Item object with Id ${videoId}`)
            return false;
        }
        let queryConversions = 'SELECT `separatedId`, `qualityKey` FROM sm01.tconverted where `separatedId` = ?;'
        let args = [item.id]
        try {
            const [rows] = await promisePool.query(queryConversions, args);
            console.log(rows);
            return rows;
        } catch (e) {
            console.error(e)
            return []
        }
    },
    insertItem: async (itemToInsert) => {
        console.log('insertItem called with parameter: ' + itemToInsert)
        const videoId = itemToInsert.videoId ?? ''
        const title = itemToInsert.title ?? ''
        const length = itemToInsert.secondsLong ?? ''
        const progress = itemToInsert.progress ?? 0
        const status = itemToInsert.status ?? 0
        const requestedTimestamp = itemToInsert.requestedTimestamp ?? null
        const finishedTimestamp = itemToInsert.finishedTimestamp ?? null
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
                return true
            } catch (e) {
                console.error(e)
                return false
            }
        }
    },
    insertConversion: async (videoId, quality) => {
        var item = await module.exports.getItemByVideoId(videoId)
        if (!item) {
            console.error(`Error while getting Item object with Id ${videoId}`)
            return false;
        }
        let queryInsert = 'insert into `sm01`.`tconverted`(`separatedId`,`qualityKey`) values(?,?)';
        let args = [item.id, quality.toLowerCase()];
        try {
            await promisePool.execute(queryInsert, args);
            console.log(`Inserted conversion of video with Id ${videoId} to format with quality: ${quality}`);
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    },
    updateItem: async (itemToUpdate) => {
        const videoId = itemToUpdate.videoId ?? ''
        const title = itemToUpdate.title ?? ''
        const length = itemToUpdate.secondsLong ?? ''
        const progress = itemToUpdate.progress ?? 0
        const status = itemToUpdate.status ?? 0
        const requestedTimestamp = itemToUpdate.requestedTimestamp ?? null
        const finishedTimestamp = itemToUpdate.finishedTimestamp ?? null
        const thumbnailUrl = itemToUpdate.thumbnailUrl ?? null
        if (videoId) {
            let updateQuery = `UPDATE \`sm01\`.\`tseparated\` SET \`title\` = ?, \`progress\` = ?, \`status\` = ?, \`requestedTimestamp\` = ?, \`finishedTimestamp\` = ?, \`secondsLong\` = ?, \`thumbnailUrl\` = ? WHERE (\`videoId\` = ?);`;
            let args = [title, progress, status, requestedTimestamp, finishedTimestamp, length, thumbnailUrl, videoId]
            try {
                await promisePool.execute(updateQuery, args)
                console.log(`Updated row with Video ID: ${videoId}`)
                return true;
            } catch (e) {
                console.error(e)
                return false
            }
        }
    },
    updatePlayCount: async (videoId) => {
        let updateQuery = `UPDATE sm01.tseparated SET \`playedCount\` = \`playedCount\` + 1 where \`videoId\` = ?`;
        let args = [videoId]
        try {
            await promisePool.execute(updateQuery, args)
            console.log(`Incremented play count on item with Video ID: ${videoId}`)
            return true
        } catch (e) {
            console.error(e)
            return false
        }

    }
}

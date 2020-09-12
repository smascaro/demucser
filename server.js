const express = require('express')
const express_zip = require('express-zip')
const nunjucks = require('nunjucks')
const ytdl = require('ytdl-core')
const fs = require('fs')
const path = require('path')
require('dotenv').config()
const process = require('process')
const child_process = require('child_process')
const bodyParser = require('body-parser')
const urlUtils = require('./js/url-utils')
const os = require('os')
const app = express()
const mysql = require('mysql2/promise');
const express_locale = require('express-locale')
const { promisify } = require('util')
const { ApiResponse } = require('./js/models')
const db = require('./routes/dbaccess')
const schedule = require('node-schedule')
const integritycheck = require('./js/integrity-check-service')
const router = express.Router();
nunjucks.configure('.', {
    express: app
});

app
    .use(express_locale())
    .use(bodyParser.urlencoded({
        extended: true
    }))

// var config = JSON.parse(fs.readFileSync("config/config.json", "utf8"));

//DATABASE PARAMETERS INITIALIZATION
// var db_settings = JSON.parse(fs.readFileSync('config/db.json', 'utf8'));

console.log(process.env)

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE_NAME
})

global.promisePool = pool;
const statusMap = new Map();
(async () => {
    var statuses = await db.getAvailableStatus();
    statuses.forEach((e) => { statusMap.set(e.value, e.key); });
    console.log(`PREPROCESSING status id is ${statusMap.get("PREPROCESSING")}`)
})();
global.statusMap = statusMap

const qualitiesMap = new Map();
var defaultQuality = new Object();
(async () => {
    var qualitiesFromDb = await db.getAvailableQualities()
    defaultQuality = qualitiesFromDb.find(q => q.isDefault == 1)
    qualitiesFromDb.forEach((q) => { qualitiesMap.set(q.key, q.format) })
    console.log(`Format defined for quality LOW is ${qualitiesMap.get("low")}`)
})();
//END DATABASE PARAMETERS INITIALIZATION

const ffmpeg = path.resolve("C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe")
const demucsRunnerBat = path.resolve(__dirname, 'scripts', 'demucs.bat')
const targetDir = path.resolve(os.homedir(), 'demucs', 'separated', 'demucs')


//schedule.scheduleJob('*/1 * * * *', async function () {
//  console.log('Time to run integrity check')
//await integritycheck.checkDatabaseIntegrity(targetDir)
//})

app.get('/', (req, res) => {
    console.log(`Locale: ${req.locale}. Accessed: /`)
    res.sendFile(__dirname + "\\html\\main.html")
})

function convertFile(path, format) {
    return new Promise((resolve, reject) => {
        try {
            var splittedPath = path.split('.');
            splittedPath[splittedPath.length - 1] = format;
            const newPath = splittedPath.join('.');
            const ffmpegArgs = [
                '-y',
                '-i', path,
                '-vn',
                '-ar', 44100,
                '-ac', '2',
                '-b:a', '192k',
                newPath
            ]

            console.log(ffmpeg + ' ' + ffmpegArgs)

            const process = child_process.spawn(ffmpeg, ffmpegArgs);
            process.stdout.on('data', (data) => {
                console.log('Stdout> ' + data.toString());
            })

            process.stderr.on('data', (data) => {
                console.log('Stderr> ' + data.toString())
            })
            process.on('exit', (code) => {
                console.log(`Transcoding process for file ${path} exited with code ${code}`);
                if (code == 0) {
                    resolve(newPath);
                } else {
                    reject(code)
                }
            })
        } catch (e) {
            console.error(e)
        }
    })
}
app.get('/fetch/:id/:q', async (req, res) => {
    var { id, q } = req.params
    console.log(`Access to: /fetch/${id}/${q}`)

    const item = await db.getItemByVideoId(id)
    if (item) {
        const pathFiles = path.resolve(targetDir, id)
        const pathVocals = path.resolve(pathFiles, 'vocals.wav')
        const pathOther = path.resolve(pathFiles, 'other.wav')
        const pathBass = path.resolve(pathFiles, 'bass.wav')
        const pathDrums = path.resolve(pathFiles, 'drums.wav')

        const format = qualitiesMap.get(q)
        q = q.toLowerCase()
        var errorHappened = false;
        if (q != defaultQuality.key) {
            const formatsAvailable = await db.getConversionsByVideoId(id);
            const isAlreadyAvailable = formatsAvailable.find(f => f.qualityKey == q);
            if (!isAlreadyAvailable) {
                console.log(`Needs to be transcoded to ${format}`);
                const promiseVocalsConversion = convertFile(pathVocals, format)
                const promiseOtherConversion = convertFile(pathOther, format)
                const promiseBassConversion = convertFile(pathBass, format)
                const promiseDrumsConversion = convertFile(pathDrums, format)
                await Promise.all([
                    promiseVocalsConversion,
                    promiseOtherConversion,
                    promiseBassConversion,
                    promiseDrumsConversion]).then(values => {
                        const files = values.map(p => ({ path: p, value: p.split('\\')[p.split('\\').length - 1] }))
                        console.log(files)
                        db.insertConversion(id, q)
                    }, reason => {
                        console.log(`Reason: ${reason}`)
                        res.setHeader('Content-Disposition', 'attachment');
                        res.status(200).send(`Error convertiendo las pistas a ${format}`)
                        errorHappened = true;
                    })
            }
        }
        if (!errorHappened) {
            const finalVocalsFileName = `vocals.${format}`
            const finalPathVocals = path.resolve(pathFiles, finalVocalsFileName)
            const finalOtherFileName = `other.${format}`
            const finalPathOther = path.resolve(pathFiles, finalOtherFileName)
            const finalBassFileName = `bass.${format}`
            const finalPathBass = path.resolve(pathFiles, finalBassFileName)
            const finalDrumsFileName = `drums.${format}`
            const finalPathDrums = path.resolve(pathFiles, finalDrumsFileName)
            const files = [
                { path: finalPathVocals, name: finalVocalsFileName },
                { path: finalPathOther, name: finalOtherFileName },
                { path: finalPathBass, name: finalBassFileName },
                { path: finalPathDrums, name: finalDrumsFileName }
            ]
            res.setHeader('Content-Disposition', 'attachment');
            res.status(200).zip(files, `${id}_${q}_q.zip`)

        }
    } else {
        //Track not available
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send(JSON.stringify(new ApiResponse(-1, 'Track is not available, you must request it first, then you will be able to fetch it')))
    }
})

app.get('/testdemucs/:videoId', demucs)

app.post('/demucs/:videoId', demucs)

async function demucs(req, res) {
    try {
        res.setHeader('Content-Type', 'application/json')
        console.log('Accessed: /demucs')
        var { videoId } = req.params
        const urlParam = videoId
        console.log(req.body)
        const tracksToMix = req.body.tracksPicker
        var processedFilesDir = targetDir;
        if (urlParam.includes('youtube')) {
            videoId = urlUtils.getParameter(urlParam, 'v')
        } else if (urlParam.includes('youtu.be')) {
            videoId = urlUtils.getResource(urlParam)
        } else {
            console.log(`Url not supported: ${urlParam}`)
            // res.status(200).send(`The Url is either an invalid link or not a youtube video. (Url: ${urlParam})`)
            res.status(200).send(new ApiResponse(-3, `The Url is either an invalid link or not a youtube video. (Url: ${urlParam})`).jsonify())
        }
        var alreadyProcessed = await checkVideoAlreadyDemucsed(videoId)
        if (!alreadyProcessed) {
            res.status(200).send(new ApiResponse(2, 'Working on your request...', { "track_id": videoId }).jsonify())
            console.log(`Video ID: ${videoId}`)
            //CREATE AND INSERT ITEM INTO DB
            const item = {
                videoId: videoId,
                title: '',
                secondsLong: 0,
                progress: 0,
                requestedTimestamp: new Date(),
                finishedTimestamp: null,
                thumbnailUrl: '',
                channelTitle: '',
                status: statusMap.get("INITIAL")
            }
            await db.insertItem(item)
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
            var fileName = ''
            var downloadOutput = `${videoId}.mp4`;
            console.log(videoUrl)
            downloadOutput = path.resolve(__dirname, 'downloads', downloadOutput)
            var filenameMappings = {}
            // res.status(200).send('Working on your petition!!')
            let ytStream = ytdl(videoUrl, {
                filter: 'audioonly',
                quality: 'highestaudio',
                highWaterMark: 1 << 25
            })
                .on('info', async (info) => {
                    console.log(`Video title: ${info.title}`)
                    console.log(`Length: ${info.length_seconds} seconds`)
                    var thumbnailUrl = ""
                    try {
                        thumbnailUrl =
                            info.playerResponse.videoDetails.thumbnail.thumbnails[info.playerResponse.videoDetails.thumbnail.thumbnails.length - 1].url
                    } catch (error) {
                        console.error("Thumbnail URL could not be fetched. Fallback to defaul URL.")
                        thumbnailUrl = `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`
                    }
                    item.thumbnailUrl = thumbnailUrl
                    item.channelTitle = info.playerResponse.videoDetails.author
                    item.title = info.videoDetails.title
                    item.secondsLong = info.videoDetails.lengthSeconds
                    item.status = statusMap.get('PREPROCESSING')

                    await db.updateItem(item)

                    fileName = `${videoId}.mkv`;
                    downloadOutput = path.resolve(__dirname, 'downloads', fileName);
                    const finalDir = fileName.substring(0, fileName.lastIndexOf('.'))
                    processedFilesDir = path.resolve(processedFilesDir, finalDir)
                    filenameMappings.guitar = path.resolve(processedFilesDir, "other.wav")
                    filenameMappings.bass = path.resolve(processedFilesDir, "bass.wav")
                    filenameMappings.vocals = path.resolve(processedFilesDir, "vocals.wav")
                    filenameMappings.drums = path.resolve(processedFilesDir, "drums.wav")
                    console.log(filenameMappings)
                    console.log(`downloaded file path: ${downloadOutput}`)
                    ytStream.pipe(fs.createWriteStream(downloadOutput))

                })
                .on('error', (e) => {
                    console.error(e)
                })
                .on('progress', (chunkLength, downloaded, total) => {
                    const percent = downloaded / total;

                    console.log(`${(percent * 100).toFixed(2)}% downloaded `)
                })
                .on('finish', () => {
                    console.log('finished downloading')
                    // console.log('Lets convert it to mp3')
                    const newAudioFilePath = downloadOutput
                    // const ffmpegArgs = [
                    //     '-err_detect', 'ignore_err',
                    //     '-loglevel', 'debug',
                    //     '-i', downloadOutput,
                    //     '-c:a', 'aac',
                    //     '-vbr', '5',
                    //     '-cutoff', '18000',
                    //     '-q:a', '2',
                    //     '-flags', '+global_header',
                    //     '-map', 'a',
                    //     '-vn',
                    //     newAudioFilePath
                    // ]
                    // //const ffmpegArgs = `-i ${downloadOutput} -q:a 0 -loglevel error -map a ${newAudioFilePath}`

                    // console.log(ffmpeg + ' ' + ffmpegArgs)

                    // const process = child_process.spawnSync(ffmpeg, ffmpegArgs);
                    // if (process.stderr) {
                    //     console.log('Stderr: ' + process.stderr.toString());
                    // } else if (process.stdout) {
                    //     console.log('Stdout: ' + process.stdout.toString())
                    // }
                    // console.log('Process: ' + process);
                    // console.log('Finished conversion to MP3');
                    /*fs.unlink(downloadOutput, (err) => {
                        if (err) {
                            console.log(`Could not remove file. Error: ${err}`)
                        } else {
                            console.log(`File ${downloadOutput} deleted successfully`)
                        }
                    })*/
                    fs.access(newAudioFilePath, async (err) => {
                        if (err) {
                            console.log(`File ${newAudioFilePath} has not been generated.`)
                        } else {
                            var fileStats = fs.statSync(newAudioFilePath)
                            if (parseInt(fileStats["size"], 10) > 0) {
                                const batArgs = [
                                    newAudioFilePath
                                ];
                                item.status = statusMap.get("PROCESSING");
                                await db.updateItem(item);
                                const demucs = child_process.spawn('cmd.exe', ['/c', demucsRunnerBat, newAudioFilePath])
                                demucs.stdout.on('data', (data) => {
                                    console.log('Stdout> ' + data.toString());
                                })

                                demucs.stderr.on('data', (data) => {
                                    console.log('Stderr> ' + data.toString())
                                    if (item.progress != 100) {
                                        let splitOutput = data.toString().split('|');
                                        if (splitOutput.length > 2) {
                                            let progressTmp = splitOutput[0].trim().replace('%', '')
                                            console.log(`Progress: ${progressTmp}`)
                                            item.progress = parseInt(progressTmp)
                                            db.updateItem(item)
                                        }
                                    }
                                })
                                demucs.on('exit', (code) => {
                                    console.log(`Demucs exited with code ${code}`)
                                    //Mix tracks if asked
                                    if (tracksToMix && tracksToMix.length && tracksToMix.length > 0) {
                                        var ffmpegArgsForMixingTask = []
                                        for (var i = 0; i < tracksToMix.length; i++) {
                                            ffmpegArgsForMixingTask = ffmpegArgsForMixingTask.concat('-i')
                                            ffmpegArgsForMixingTask = ffmpegArgsForMixingTask.concat(filenameMappings[tracksToMix[i]])
                                        }
                                        const mixedFilePath = `${path.resolve(processedFilesDir, tracksToMix.join('_') + '.wav')}`
                                        ffmpegArgsForMixingTask = ffmpegArgsForMixingTask.concat([
                                            '-filter_complex',
                                            `amix=inputs=${tracksToMix.length}:duration=first:dropout_transition=2`,
                                            mixedFilePath
                                        ])
                                        console.log(`ffmpeg ${ffmpegArgsForMixingTask}`)
                                        const process = child_process.spawnSync(ffmpeg, ffmpegArgsForMixingTask);
                                        if (process.stderr) {
                                            console.log('Stderr: ' + process.stderr.toString());
                                        }
                                        console.log(`Finished track mixing. Mixed file in: ${mixedFilePath}`);
                                    }
                                    console.log(`Finished track separation.`);
                                    item.progress = 100;
                                    item.status = statusMap.get('FINISHED');
                                    item.finishedTimestamp = new Date();
                                    db.updateItem(item);
                                })
                            } else {
                                console.log(`File ${newAudioFilePath} has size 0.`)
                            }
                        }
                    })
                })

        } else {
            db.updatePlayCount(videoId)
            res.status(200).send(new ApiResponse(1, 'Video already processed.', { "track_id": videoId }).jsonify())
        }
    } catch (e) {
        console.error(e)
        res.status(200).send(new ApiResponse(-2, "Internal error").jsonify())
    }
};


app.get('/info/:videoId', async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    console.log('Accessed: /demucs')
    var { videoId } = req.params
    const urlParam = videoId
    console.log(req.body)
    const tracksToMix = req.body.tracksPicker
    var processedFilesDir = targetDir;
    console.log(`Video ID: ${videoId}`)
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
    // let info = await ytdl.getInfo(videoId)
    // let audioFormats = ytdl.filterFormats(info.formats, 'audioonly')
    // res.status(200).json(audioFormats)
    let ytStream = ytdl(videoUrl, {
        filter: "audioonly",
        quality: 'highestaudio',
        highWaterMark: 1 << 25
    })
        .on('info', async (info) => {
            res.status(200).json(ytStream)
        })


    ytStream.pipe(fs.createWriteStream(`C:\\Users\\msk14\\Desktop\\Projectes\\demucser\\downloads\\${videoId}`))

})


app.get('/availableTracks', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    const limit = req.query.limit
    const offset = req.query.offset
    const sort = req.query.sort

    //TODO: Ensure Ok status
    var tracks = await db.getAllItems({
        limit: limit,
        offset: offset,
        sort: sort,
        omitErrors: true
    })
    const response = {
        result: {
            code: 0,
            message: ''
        },
        items: tracks
    }
    res.status(200).send(JSON.stringify(response));
})

app.get('/progress/:videoId', async (req, res) => {
    const { videoId } = req.params
    var rowFound = await db.getItemByVideoId(videoId);
    res.json(new ApiResponse(0, "Progress check", rowFound))
})

app.get('/details/:videoId', async (req, res) => {
    const { videoId } = req.params
    var rowFound = await db.getItemByVideoId(videoId);
    res.json(new ApiResponse(0, "Track details", rowFound))
})

async function checkVideoAlreadyDemucsed(id) {
    console.log(`CheckVideoAlreadyDemucsed called with parameter ${id}`)
    var rowFound = await db.getItemByVideoId(id);
    return rowFound;
}

app.get('/test/:id', async (req, res) => {
    var { id } = req.params
    var resultTest = await checkVideoAlreadyDemucsed(id)
    if (resultTest) {
        res.status(200).send(`Video with id ${id} has been processed.`)
    } else {
        res.status(200).send(`Video with id ${id} has NOT been processed yet.`)
    }

})

app.get('/test', async (req, res) => {
    console.log(statusMap)
    db.getAllItems()
    res.status(200).send('Check console for results');

})


app.listen(process.env.NODE_SERVER_PORT, function () {
    console.log(`Server running at http://127.0.0.1:${process.env.NODE_SERVER_PORT}/`)
})

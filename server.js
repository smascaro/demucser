const express = require('express')
const express_zip = require('express-zip')
const nunjucks = require('nunjucks')
const ytdl = require('ytdl-core')
const fs = require('fs')
const path = require('path')
const child_process = require('child_process')
const bodyParser = require('body-parser')
const urlUtils = require('./js/url-utils')
const os = require('os')
const app = express()
const mysql = require('mysql2/promise');
const express_locale = require('express-locale')

const {
    getAllItems,
    getItemByVideoId,
    getAvailableStatus,
    getAvailableQualities,
    getConversionsByVideoId,
    insertItem,
    insertConversion,
    updateItem,
    updatePlayCount
} = require('./routes/dbaccess')

const router = express.Router();
nunjucks.configure('.', {
    express: app
});

app
    .use(express_locale())
    .use(bodyParser.urlencoded({
        extended: true
    }))
    
var config = JSON.parse(fs.readFileSync("config/config.json", "utf8"));

//DATABASE PARAMETERS INITIALIZATION
var db_settings = JSON.parse(fs.readFileSync('config/db.json', 'utf8'));

console.log(db_settings)

const pool = mysql.createPool({
    host: db_settings.host,
    user: db_settings.user,
    password: db_settings.password,
    database: db_settings.database
})

global.promisePool = pool;
const statusMap = new Map();
(async () => {
    var statuses = await getAvailableStatus();
    statuses.forEach((e) => { statusMap.set(e.value, e.key); });
    console.log(`PREPROCESSING status id is ${statusMap.get("PREPROCESSING")}`)
})();

const qualitiesMap = new Map();
var defaultQuality = new Object();
(async () => {
    var qualitiesFromDb = await getAvailableQualities()
    defaultQuality = qualitiesFromDb.find(q => q.isDefault == 1)
    qualitiesFromDb.forEach((q) => { qualitiesMap.set(q.key, q.format) })
    console.log(`Format defined for quality LOW is ${qualitiesMap.get("low")}`)
})();

//END DATABASE PARAMETERS INITIALIZATION

const ffmpeg = path.resolve("C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe")
const demucsRunnerBat = path.resolve(__dirname, 'scripts', 'demucs.bat')
// const targetDir = path.resolve("C:\\Users\\msk14\\demucs\\separated\\demucs")
const targetDir = path.resolve(os.homedir(), 'demucs', 'separated', 'demucs')
function getTimestamp() {
    const now = new Date()
    return now.getFullYear() + '' + (now.getMonth() + 1) + '' + now.getDate() + '-' + now.getHours() + '_' + now.getMinutes() + '_' + now.getSeconds() + '_' + now.getMilliseconds()
}


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

    const pathFiles = path.resolve(targetDir, id)
    const pathVocals = path.resolve(pathFiles, 'vocals.wav')
    const pathOther = path.resolve(pathFiles, 'other.wav')
    const pathBass = path.resolve(pathFiles, 'bass.wav')
    const pathDrums = path.resolve(pathFiles, 'drums.wav')

    const format = qualitiesMap.get(q)
    q = q.toLowerCase()
    var errorHappened =false;
    if (q != defaultQuality.key) {
        const formatsAvailable = await getConversionsByVideoId(id);
        const isAlreadyAvailable = formatsAvailable.find(f => f.qualityKey == q);
        if (!isAlreadyAvailable) {
            console.log(`Needs to be transcoded to ${format}`);
            const promiseVocalsTranscoding = convertFile(pathVocals, format)
            const promiseOtherTranscoding = convertFile(pathOther, format)
            const promiseBassTranscoding = convertFile(pathBass, format)
            const promiseDrumsTranscoding = convertFile(pathDrums, format)
            await Promise.all([
                promiseVocalsTranscoding,
                promiseOtherTranscoding,
                promiseBassTranscoding,
                promiseDrumsTranscoding]).then(values => {
                    const files = values.map(p => ({ path: p, value: p.split('\\')[p.split('\\').length - 1] }))
                    console.log(files)
                    insertConversion(id, q)
                }, reason => {
                    console.log(`Reason: ${reason}`)
                    res.setHeader('Content-Disposition', 'attachment');
                    res.status(200).send(`Error convertiendo las pistas a ${format}`)
                    errorHappened=true;
                })
        }
    } 
    if(!errorHappened) {
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
            { path: finalPathOther, name: finalOtherFileName},
            { path: finalPathBass, name: finalBassFileName },
            { path: finalPathDrums, name: finalDrumsFileName }
        ]
        res.setHeader('Content-Disposition', 'attachment');
        res.status(200).zip(files, `${id}_${q}_q.zip`)

    }
})

app.post('/demucs', async (req, res) => {
    console.log('Accessed: /demucs')
    //const timestamp = getTimestamp();
    var videoId = ''
    const urlParam = req.body.videoId;
    console.log(req.body)
    const tracksToMix = req.body.tracksPicker
    // var processedFilesDir = path.resolve(os.homedir(), "demucs", "separated", "demucs")
    var processedFilesDir = targetDir;
    if (urlParam.includes('youtube')) {
        videoId = urlUtils.getParameter(urlParam, 'v')
    } else if (urlParam.includes('youtu.be')) {
        videoId = urlUtils.getResource(urlParam)
    } else {
        console.log(`Url not supported: ${urlParam}`)
        res.status(200).send(`The Url is either an invalid link or not a youtube video. (Url: ${urlParam})`)
    }
    var alreadyProcessed = await checkVideoAlreadyDemucsed(videoId)
    if (!alreadyProcessed) {
        console.log(`Video ID: ${videoId}`)
        //CREATE AND INSERT ITEM INTO DB
        const item = {
            videoId: videoId,
            title: '',
            length: 0,
            progress: 0,
            requested: new Date(),
            finished: null,
            thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            status: statusMap.get("INITIAL")
        }
        await insertItem(item)
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
        var fileName = ''
        var downloadOutput = `${videoId}.mp4`;
        const initialFilename = downloadOutput;
        console.log(videoUrl)
        downloadOutput = path.resolve(__dirname, 'downloads', downloadOutput)
        var filenameMappings = {}
        res.status(200).send('Working on your petition!!')
        let ytStream = ytdl(videoUrl, {
            filter: format => format.audioBitrate && !format.encoding
        })
            .on('info', async (info) => {
                console.log(`Video title: ${info.title}`)
                console.log(`Length: ${info.length_seconds} seconds`)

                item.title = info.title
                item.length = info.length_seconds
                item.status = statusMap.get('PREPROCESSING')

                await updateItem(item)

                fileName = `${videoId}.mp4`;
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
            .on('error', console.error)
            .on('progress', (chunkLength, downloaded, total) => {
                const percent = downloaded / total;

                console.log(`${(percent * 100).toFixed(2)}% downloaded `)
            })
            .on('finish', () => {
                console.log('finished downloading')
                console.log('Lets convert it to mp3')
                const newAudioFilePath = downloadOutput.replace('mp4', 'mp3')
                const ffmpegArgs = [
                    '-copyts',
                    '-err_detect', 'ignore_err',
                    '-i', downloadOutput,
                    '-vn',
                    '-acodec', 'libmp3lame',
                    '-ac', '2',
                    '-q:a', '6',
                    '-loglevel', 'error',
                    '-map', 'a',
                    '-vsync', '0',
                    newAudioFilePath
                ]

                console.log(ffmpeg + ' ' + ffmpegArgs)

                const process = child_process.spawnSync(ffmpeg, ffmpegArgs);
                if (process.stderr) {
                    console.log('Stderr: ' + process.stderr.toString());
                    //res.status(200).send('Error while converting to mp3')
                } else {
                    if (process.stdout) console.log('Stdout: ' + process.stdout.toString())
                    //res.status(200).send('Video downloaded and converted to mp3 succesfully.')
                }
                console.log('Process: ' + process);
                console.log('Finished conversion to MP3');
                fs.unlink(downloadOutput, (err) => {
                    if (err) {
                        console.log(`Could not remove file. Error: ${err}`)
                    } else {
                        console.log(`File ${downloadOutput} deleted successfully`)
                    }
                })
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
                            await updateItem(item);
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
                                        updateItem(item)
                                    }
                                }
                            })
                            demucs.on('exit', (code) => {
                                console.log(`Demucs exited with code ${code}`)
                                //Mix tracks if asked
                                if (tracksToMix && tracksToMix.length && tracksToMix.length > 0) {
                                    var ffmpegArgsForMixingTask = []
                                    for (var i = 0; i < tracksToMix.length; i++) {
                                        //                                    inputsParam = inputsParam + '-i ' + filenameMappings[tracksToMix[i]] + ' '
                                        ffmpegArgsForMixingTask = ffmpegArgsForMixingTask.concat('-i')
                                        ffmpegArgsForMixingTask = ffmpegArgsForMixingTask.concat(filenameMappings[tracksToMix[i]])
                                        //                                    inputsParam = `${inputsParam}-i "${filenameMappings[tracksToMix[i]]}" `

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
                                        //res.status(200).send('Error while converting to mp3')
                                    } else {
                                        //res.status(200).send('Video downloaded and converted to mp3 succesfully.')
                                    }
                                    console.log(`Finished track mixing. Mixed file in: ${mixedFilePath}`);
                                }
                                console.log(`Finished track separation.`);
                                item.progress = 100;
                                item.status = statusMap.get('FINISHED');
                                item.finished = new Date();
                                updateItem(item);
                            })
                        } else {
                            console.log(`File ${newAudioFilePath} has size 0.`)
                        }
                    }
                })
            })

    } else {
        updatePlayCount(videoId)
        res.status(200).send('Video already processed.')
    }
    //res.status(200).send(`Your petition is in progress...`)
});

app.get('/availableTracks', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    var tracks = await getAllItems()
    res.status(200).send(JSON.stringify(tracks));
})

async function checkVideoAlreadyDemucsed(id) {
    console.log(`CheckVideoAlreadyDemucsed called with parameter ${id}`)
    var rowFound = await getItemByVideoId(id);
    return rowFound?.length > 0;
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
    getAllItems()
    res.status(200).send('Check console for results');

})


app.listen(config.port, function () {
    console.log(`Server running at http://127.0.0.1:${config.port}/`)
})

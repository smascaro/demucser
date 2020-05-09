const express = require('express')
const nunjucks = require('nunjucks')
const ytdl = require('ytdl-core')
const fs = require('fs')
const path = require('path')
const child_process = require('child_process')
const bodyParser = require('body-parser')
const urlUtils = require('./js/url-utils')
const os = require('os')
const app = express()
const router = express.Router();
const mysql = require('mysql2/promise');
const {
    getAllItems, 
    getItemByVideoId, 
    getAvailableStatus, 
    insertItem, 
    updateItem, 
    updatePlayCount
} = require('./routes/dbaccess')
nunjucks.configure('.', {
    express: app
});

app.use(bodyParser.urlencoded({
    extended: true
}))

var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

console.log(config)

const pool = mysql.createPool({
    host: config.db_host,
    user: config.db_user,
    password: config.db_password,
    database: config.db_database
})

global.promisePool = pool;
statusMap= new Map();
(async()=>{
    var statuses = await getAvailableStatus();
    statuses.forEach((e)=>{statusMap.set(e.value,e.key);});
    console.log(`PREPROCESSING status id is ${statusMap.get("PREPROCESSING")}`)
})();
const ffmpeg = path.resolve("C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe")
const demucsRunnerBat = path.resolve(__dirname, 'scripts', 'demucs.bat')
const targetDir= path.resolve("C:\\Users\\msk14\\demucs\\separated\\demucs")

function getTimestamp() {
    const now = new Date()
    return now.getFullYear() + '' + (now.getMonth() + 1) + '' + now.getDate() + '-' + now.getHours() + '_' + now.getMinutes() + '_' + now.getSeconds() + '_' + now.getMilliseconds()
}

app.get('/convert/:fileName', (req, res) => {
    var {
        fileName
    } = req.params
    console.log(fileName)
    fileName = path.resolve(__dirname, 'downloads', fileName)
    const ffmpegArgs = [
            '-i', fileName,
            '-vn',
            '-acodec', 'libmp3lame',
            '-ac', '2',
            '-q:a', '6',
            fileName.replace('mp4', 'mp3')
            ]
    const process = child_process.spawnSync(ffmpeg, ffmpegArgs);

    if (process.stdout) {
        console.log('Stdout: ' + process.stdout.toString());
    }
    if (process.stderr) {
        console.log('Stderr: ' + process.stderr.toString());
    }
    console.log(process)
    console.log(process.env)
    res.status(200).send(JSON.stringify(process))
})


app.get('/', (req, res) => {
    console.log('Accessed: /')
    res.sendFile(__dirname + "\\html\\main.html")
})

app.post('/demucs', async (req, res) => {
    console.log('Accessed: /demucs')
    //const timestamp = getTimestamp();
    var videoId = ''
    const urlParam = req.body.videoId;
    console.log(req.body)
    const tracksToMix = req.body.tracksPicker
    var processedFilesDir = path.resolve(os.homedir(), "demucs", "separated", "demucs")

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
            thumbnailUrl:`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
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
                    if(process.stdout) console.log('Stdout: ' + process.stdout.toString())
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
                                item.progress=100;
                                item.status=statusMap.get('FINISHED');
                                item.finished=new Date();
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

app.get('/availableTracks', async(req,res) =>{
    res.setHeader('Content-Type', 'application/json');
    var tracks = await getAllItems()
    res.status(200).send(JSON.stringify(tracks));
})

async function checkVideoAlreadyDemucsed(id) {
console.log(`CheckVideoAlreadyDemucsed called with parameter ${id}`)
    var rowFound = await getItemByVideoId(id);
    return rowFound?.length > 0;
}
    
app.get('/test/:id', async(req,res) =>{
    var {id} = req.params
    var resultTest = await checkVideoAlreadyDemucsed(id)
    if (resultTest) {
        res.status(200).send(`Video with id ${id} has been processed.`) 
    } else{
        res.status(200).send(`Video with id ${id} has NOT been processed yet.`)
    }
        
})

app.get('/test', async(req,res) =>{
    console.log(statusMap)
    getAllItems()
    res.status(200).send('Check console for results');
        
})


app.listen(8081, function () {
    console.log('Server running at http://127.0.0.1:8081/')
})

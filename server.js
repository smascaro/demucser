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
nunjucks.configure('.', {
    express: app
});

app.use(bodyParser.urlencoded({
    extended: true
}))

const ffmpeg = path.resolve('C:\\Users\\msk14\\ffmpeg\\bin\\ffmpeg.exe')
const demucsRunnerBat = path.resolve(__dirname, 'scripts', 'demucs.bat')

var processedFilesDir = path.resolve(os.homedir(), "demucs", "separated", "demucs")

function setFileMappings(mappings) {
    mappings.guitar = path.resolve(processedFilesDir, "other.wav")
    mappings.bass = path.resolve(processedFilesDir, "bass.wav")
    mappings.vocals = path.resolve(processedFilesDir, "vocals.wav")
    mappings.drums = path.resolve(processedFilesDir, "drums.wav")
    return mappings
}

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
    const timestamp = getTimestamp();
    var videoId = ''
    const urlParam = req.body.videoId;
    console.log(req.body)
    const tracksToMix = req.body.tracksPicker
    if (urlParam.includes('youtube')) {
        videoId = urlUtils.getParameter(urlParam, 'v')
    } else if (urlParam.includes('youtu.be')) {
        videoId = urlUtils.getResource(urlParam)
    }
    console.log(`Video ID: ${videoId}`)
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
    var fileName = ''
    var downloadOutput = `${timestamp}_${videoId}.mp4`;
    const initialFilename = downloadOutput;
    console.log('[' + timestamp + '] - ' + videoUrl)
    downloadOutput = path.resolve(__dirname, 'downloads', downloadOutput)
    var filenameMappings = {}
    res.status(200).send('Working on your petition!!')
    let ytStream = ytdl(videoUrl, {
            filter: format => format.audioBitrate && !format.encoding
        })
        .on('info', (info) => {
            console.log(`Video title: ${info.title}`)
            fileName = `${timestamp}_${info.title.split(`'`).join('').split(':').join('').split('"').join('')}.mp4`;
            downloadOutput = path.resolve(__dirname, 'downloads', fileName);
            const finalDir = fileName.substring(0, fileName.lastIndexOf('.'))
            processedFilesDir = path.resolve(processedFilesDir, finalDir)
            filenameMappings = setFileMappings(filenameMappings)
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

            const process = child_process.spawnSync(ffmpeg, ffmpegArgs);
            if (process.stderr) {
                console.log('Stderr: ' + process.stderr.toString());
                //res.status(200).send('Error while converting to mp3')
            } else {
                //res.status(200).send('Video downloaded and converted to mp3 succesfully.')
            }
            console.log('Finished conversion to MP3');
            fs.unlink(downloadOutput, (err) => {
                if (err) {
                    console.log(`Could not remove file. Error: ${err}`)
                } else {
                    console.log(`File ${downloadOutput} deleted successfully`)
                }
            })
            fs.access(newAudioFilePath, (err) => {
                if (err) {
                    console.log(`File ${newAudioFilePath} has not been generated.`)
                } else {
                    var fileStats = fs.statSync(newAudioFilePath)
                    if (parseInt(fileStats["size"], 10) > 0) {
                        const batArgs = [
                            newAudioFilePath
                        ];

                        const demucs = child_process.spawn('cmd.exe', ['/c', demucsRunnerBat, newAudioFilePath])
                        demucs.stdout.on('data', (data) => {
                            console.log(data.toString())
                        })
                        demucs.stderr.on('data', (data) => {
                            console.error(data.toString())
                        })
                        demucs.on('exit', (code) => {
                            console.log(`Demucs exited with code ${code}`)
                            //Mix tracks if asked
                            if (tracksToMix.length > 0) {
                                var ffmpegArgsForMixingTask = []
                                for (var i = 0; i < tracksToMix.length; i++) {
                                    //                                    inputsParam = inputsParam + '-i ' + filenameMappings[tracksToMix[i]] + ' '
                                    ffmpegArgsForMixingTask = ffmpegArgsForMixingTask.concat('-i')
                                    ffmpegArgsForMixingTask = ffmpegArgsForMixingTask.concat(filenameMappings[tracksToMix[i]])
//                                    inputsParam = `${inputsParam}-i "${filenameMappings[tracksToMix[i]]}" `

                                }
                                const mixedFilePath = `${path.resolve(processedFilesDir, tracksToMix.join('_') + '.mp3')}`
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
                        })
                    } else {
                        console.log(`File ${newAudioFilePath} has size 0.`)
                    }
                }
            })
        })


    //res.status(200).send(`Your petition is in progress...`)
});

app.listen(8081, function () {
    console.log('Server running at http://127.0.0.1:8081/')
})

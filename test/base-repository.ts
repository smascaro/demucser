import { TracksRepository } from "../migration/model/repositories/track-repository"
import { DatabaseSettings } from "../migration/db/database-settings"
import { Database } from "../migration/db/database"
import { assert, expect } from "chai"
import { Track } from "../migration/model/entities/track"
import { QueryOptions, QueryOptionsSort } from "../migration/db/query-criteria"

describe('Base repository', () => {
    it('Should load all tracks', async () => {
        const settings = new DatabaseSettings
        settings.database = 'sm01'
        settings.host = 'localhost'
        settings.user = 'admin'
        settings.password = 'SM01!MiSkl'
        let db = new Database(settings)
        let repo = new TracksRepository(db)
        await repo.get().then((data) => {
            expect(data).to.not.be.null
            expect(data).to.not.be.empty
            let track: Track
            track = data[0]
            expect(track).to.not.be.null
            expect(track.videoId).to.not.be.eq('')
            console.log(data[0])
            console.log(track)
            expect(track.videoId).to.be.eq(data[0].videoId)
        })
    })
    it('Should load a track by its ID', async () => {
        const settings = new DatabaseSettings
        settings.database = 'sm01'
        settings.host = 'localhost'
        settings.user = 'admin'
        settings.password = 'SM01!MiSkl'
        let db = new Database(settings)
        let repo = new TracksRepository(db)
        await repo.getByKey('5szuJsQzScA').then((foundTrack) => {
            expect(foundTrack).to.not.be.null
            expect(foundTrack).to.not.be.empty
            let track: Track
            track = foundTrack
            expect(track).to.not.be.null
            expect(track.videoId).to.not.be.eq('')
            console.log(foundTrack)
            console.log(track)
            console.log(foundTrack.status)
            console.log(track.status)
            expect(track.videoId).to.be.eq(foundTrack.videoId)
        })
    })
    it('Should fail on searching a non-existent track', async () => {
        const settings = new DatabaseSettings
        settings.database = 'sm01'
        settings.host = 'localhost'
        settings.user = 'admin'
        settings.password = 'SM01!MiSkl'
        let db = new Database(settings)
        let repo = new TracksRepository(db)
        await repo.getByKey('---------').then((foundTrack) => {
            console.log('This should not be reached')
            expect(0).to.be.eq(1)
        }).catch((e) => {
            expect(e).to.not.be.null
        })
    })
    it('Should load most popular track', async () => {
        const settings = new DatabaseSettings
        settings.database = 'sm01'
        settings.host = 'localhost'
        settings.user = 'admin'
        settings.password = 'SM01!MiSkl'
        let db = new Database(settings)
        let repo = new TracksRepository(db)
        let options = new QueryOptions()
        options.omitErrors = true
        options.sort = QueryOptionsSort.POPULAR
        await repo.get(options).then((tracks) => {
            console.log(`Most popular song is ${tracks[0].title} with a play count of ${tracks[0].playedCount}`);
            expect(tracks).to.not.be.empty
        }).catch((e) => {
            expect(0).to.be.eq(1)
        })
    })
    it('Should load only first track', async () => {
        const settings = new DatabaseSettings
        settings.database = 'sm01'
        settings.host = 'localhost'
        settings.user = 'admin'
        settings.password = 'SM01!MiSkl'
        let db = new Database(settings)
        let repo = new TracksRepository(db)
        let options = new QueryOptions()
        options.omitErrors = true
        options.sort = QueryOptionsSort.OLDEST
        options.limit = 1
        await repo.get(options).then((tracks) => {
            console.log(`Oldest song is ${tracks[0].title}`);
            expect(tracks).to.not.be.empty
            expect(tracks.length).to.be.eq(1)
            console.log('🤣🤣');

        }).catch((e) => {
            expect(0).to.be.eq(1)
        })
    })
})
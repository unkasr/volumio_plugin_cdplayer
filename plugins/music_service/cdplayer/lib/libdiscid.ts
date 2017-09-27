import ffi = require('ffi');
import ref = require('ref');
import libQ = require('kew');
import http = require('http');
import https = require('https');
import {IDisc, ITrack} from './CDController'

let disc_id_t = ref.types.void;
let libdiscid = ffi.Library('libdiscid', {
    'discid_new': [ 'pointer', [] ],
    'discid_get_id': ['string', [ 'pointer' ] ],
    'discid_read_sparse': ['int', ['pointer', 'string', 'int'] ],
    'discid_free': ['void', ['pointer'] ],
    'discid_get_error_msg': [ 'string', ['pointer'] ],
    'discid_get_freedb_id': ['string', ['pointer'] ],
    'discid_get_first_track_num': [ 'int', ['pointer'] ],
    'discid_get_last_track_num' : [ 'int', ['pointer'] ],
    'discid_get_track_length': [ 'int', ['pointer', 'int'] ],
    'discid_get_toc_string': ['string', ['pointer'] ]
 });

 interface IDiscId {
    id: string,
    toc: string
}

interface IOptions {
    host: string,
    port: number,
    path: string,
    method: string,
    headers: {}
}

function getDiscId(drive: string): IDiscId {
    let disc = libdiscid.discid_new();
    let result = libdiscid.discid_read_sparse(disc, drive, 0);
    let id = libdiscid.discid_get_id(disc);
    let toc = libdiscid.discid_get_toc_string(disc);
    libdiscid.discid_free(disc);
    return {id: id, toc: toc};
}

interface IHttp {
    request(IOptions, any): any
}

function getMusicBrainz(options: IOptions) {
    let defer = libQ.defer();
    let port: IHttp = options.port == 443 ? https: http;
    console.log(options.host+options.path);
    let req = port.request(options, function(res){
        let data = '';
        res.setEncoding('utf8');
        res.on('data', function(chunk){
            data += chunk;
        });

        res.on('end', function() {
            try {
                let disc = parseJSONToDisc(JSON.parse(data));
                defer.resolve(disc);
            } catch {
                defer.reject('not found');
            }
        });
    });

    req.on('error', function(err){
        console.log(err);
        defer.reject(err);
    });

    req.end();
    return defer.promise;
}

function parseJSONToDisc(data): IDisc{
    
    let release = data.releases[0];
    let title = release.title;
    let tracks = release.media[0].tracks;
    let artist = release['artist-credit'][0].name;
    let cover = 'http://coverartarchive.org/release/' + release.id + '/front-250';
    let disc = {discName: title, artist: artist, cover: cover, tracks:[]};
    for (let track of tracks) {
        console.dir(track);
        disc.tracks[track.position] = {
            track: track.position,
            name: track.title,
            duration: track.length / 1000
        };
    }    
    return disc;
}

function getById(id: string) {
    let options = {
        host: 'musicbrainz.org',
        port: 80,
        path: '/ws/2/discid/' + id + '?inc=recordings+artists&fmt=json',
        method: 'get',
        headers: {'User-Agent': 'Volumio CDIO Plugin'}
    };

    return getMusicBrainz(options);
}

export function getTracksFromMusicBrainz(drive: string)  {
    let defer = libQ.defer();
    let id = getDiscId(drive);
    if(id && id.id) {
        return getById(id.id); //('I5l9cCSFccLKFEKS.7wqSZAorPU-');
    } else {
        defer.reject('unable to get disc id');
        return defer.promise;
    }
}

export function getTracksFromDisc(drive: string) : IDisc {
    let self = this;
    let defer = libQ.defer();

    let cd: IDisc = {discName: 'Audio CD',artist: '', cover: '', tracks: [] };

    let disc = libdiscid.discid_new();
    let result = libdiscid.discid_read_sparse(disc, drive, 0);
    if(!result) {
        defer.reject(libdiscid.discid_get_error_msg(disc));
    } else {
        let firsttrack = libdiscid.discid_get_first_track_num(disc);
        let lasttrack = libdiscid.discid_get_last_track_num(disc);
        for(let i = firsttrack; i <= lasttrack; ++i) {
            let duration = libdiscid.discid_get_track_length(disc, i) / 75;
            cd.tracks[i] = {track: i, name: 'Track '+ i, duration: duration};
        }
        defer.resolve(cd);
    }

    libdiscid.discid_free(disc);
    return defer.promise;
}


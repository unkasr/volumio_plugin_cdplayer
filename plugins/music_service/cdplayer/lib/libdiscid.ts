import ffi from 'ffi';
import ref from 'kew';
import * as http from 'http';
import * as https from 'https';
import {IDisc, ITrack} from './CDController';
import libQ from 'kew';

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
    
    /*
    Return a handle for a new DiscId object.
    If no memory could be allocated, NULL is returned. Don't use the created DiscId object before calling discid_read() or discid_put().

    Returns a DiscId object, or NULL.
    */
    let disc = libdiscid.discid_new();
    
    //Read the disc in the given CD-ROM/DVD-ROM drive extracting only the TOC and additionally specified features.
    let result = libdiscid.discid_read_sparse(disc, drive, 0);
    
    //Return a MusicBrainz DiscID.
    //The returned string is only valid as long as the DiscId object exists.
    let id = libdiscid.discid_get_id(disc);
    
    //Return a string representing CD Table Of Contents (TOC).
    let toc = libdiscid.discid_get_toc_string(disc);
    
    //Release the memory allocated for the DiscId object.
    libdiscid.discid_free(disc);
    
    //return id + toc
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
    
    //get disc id by disc?
    let id = getDiscId(drive);
    console.log('CDIO(libdiscid): ' + 'getTracksFromMusicBrainz: ' + 'disc ID: ' + id.id);
    
    if(id && id.id) {
        return getById(id.id); //('I5l9cCSFccLKFEKS.7wqSZAorPU-');
    } else {
        defer.reject('unable to get disc id');
        console.log('CDIO(libdiscid): ' + 'getTracksFromMusicBrainz: ' + 'unable to get disc id for drive : ' + drive);
        
        return defer.promise;
    }
}

//extract track from disc manually
export function getTracksFromDisc(drive: string) : IDisc {
    
    let self = this;
    let defer = libQ.defer();

    let cd: IDisc = {discName: 'Audio CD',artist: '', cover: '', tracks: [] };

    /*
    Return a handle for a new DiscId object.
    If no memory could be allocated, NULL is returned. Don't use the created DiscId object before calling discid_read() or discid_put().

    Returns a DiscId object, or NULL.
    */
    let disc = libdiscid.discid_new();
    
  //Read the disc in the given CD-ROM/DVD-ROM drive extracting only the TOC and additionally specified features.
    let result = libdiscid.discid_read_sparse(disc, drive, 0);
    
    if(!result) {
        //if failed        
        
        //Return a human-readable error message.
        let err = libdiscid.discid_get_error_msg(disc);
        console.log('CDIO(libdiscid): ' + 'getTracksFromDisc: ' + 'unable to get disc id for drive : ' + drive + ' because: ' + err);
        
        //disc is missing, or we are unable to read it        
        
        defer.reject(err);
    } 
    else {
        
        //Return the number of the first track on this disc.
        let firsttrack = libdiscid.discid_get_first_track_num(disc);
        
        //Return the number of the last audio track on this disc.
        let lasttrack = libdiscid.discid_get_last_track_num(disc);
        
        for(let i = firsttrack; i <= lasttrack; ++i) {
            
            //Return the length of a track in sectors.
            let duration = libdiscid.discid_get_track_length(disc, i) / 75;
            
            //save gathered info
            cd.tracks[i] = {track: i, name: 'Track '+ i, duration: duration};
        }
        
        defer.resolve(cd);
    }

    //Release the memory allocated for the DiscId object.
    libdiscid.discid_free(disc);
    
    return defer.promise;
}


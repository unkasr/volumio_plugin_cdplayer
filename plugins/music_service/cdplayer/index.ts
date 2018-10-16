declare var __dirname : string;

import libQ = require('kew');
import fs = require('fs-extra');
import conf = require('v-conf');
import udev = require("udev");
import nodetools = require('nodetools');
import libMpd = require('mpd');
import {CDController, IDisc, ITrack, IDrives, ICDState} from './lib/CDController';
import {webSocketAPI} from './lib/webSocketAPI'; 


class ControllerCdio {
    context: any;
    commandRouter: any;
    logger: any;
    configManager: any;
    config: any;  
    cdController: any; 
    mpdPlugin: any;
    webSocketAPI: any;

    constructor(context: any) {
        this.context = context;
        this.commandRouter = this.context.coreCommand;
        this.logger = this.context.logger;
        this.configManager = this.context.configManager;
    }

    // define behaviour on system start up. In our case just read config file
    public onVolumioStart() {
        let defer = libQ.defer();
        
        let configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
        this.config = new conf();
        this.config.loadFile(configFile);
        defer.resolve();
        return defer.promise;
    }

    // Volumio needs this
    public getConfigurationFiles() : string[] {
        return ['config.json'];
    }

    //Volumio playbeck start - it is not voluion playback? it is plugin start?
    public onStart() {
        console.log('CDIO(index): ' + '--------------------------------CDIO START--------------------------------');
        console.log('CDIO(index): ' + 'onStart: ' + 'plugin initialization');
        let self = this;
        let defer=libQ.defer();
        
        //adding CDIO to Volumio sources
        self.addToBrowseSources();
        //create CD controller
        self.cdController = new CDController(self.context);
        
        //create socket interface
        this.webSocketAPI = new webSocketAPI(self.context);
        
        //We subscribe to the observable ourselves
        self.cdController.onEjected.subscribe(
                                                function(drive){ //callback
                                                    console.log('CDIO(index): ' + 'onEjected: ' + 'event raised');
                                                    //self.commandRouter.pushToastMessage('success', "CD Drive", "Ejected"); //message in Volumio interface
                                                    
                                                    //self.logger.info('disc ejected');
                                                    
                                                    //i have to recalculate CDIO menu
                                                    self.listRoot('cdio/eject');
                                                }
                                             );
        
        //We subscribe to the observable ourselves
        self.cdController.onLoaded.subscribe(
                                                function(drive){ //callback
                                                    console.log('CDIO(index): ' + 'onLoaded: ' + 'event raised');
                                                    //self.commandRouter.pushToastMessage('success', "CD Drive", "Inserted");	//message in Volumio interface
                                                    
                                                    //self.logger.info('disc loaded');
                                                    //self.logger.info('disc info :' + JSON.stringify(self.cdController.getDisc(drive), null, 4));
                                                    
                                                    //try to set drive speed for new drive
                                                    self.cdController.setDriveSpeed(drive, self.config.get('readSpeed'));
                                                    
                                                    //this.DISC_READY = true;
                                                }
                                            );
        
        //We subscribe to the observable ourselves
        self.cdController.onClosed.subscribe(
                                                function(drive){ //callback
                                                    console.log('CDIO(index): ' + 'onClosed: ' + 'event raised');
                                                }
                                            );
        
        //list already available cd roms
        console.log('CDIO(index): ' + 'onStart: ' + 'listing devices...');
        let devices: IDrives = self.cdController.getDrives;
        for(let device in devices)
        {
            console.log('CDIO(index): ' + 'onStart: ' + device);
        }
        console.log('CDIO(index): ' + 'onStart: ' + 'listing devices...done');
        
        //
        self.mpdPlugin = self.commandRouter.pluginManager.getPlugin('music_service', 'mpd');
        
        //
        self.commandRouter.executeOnPlugin('music_service', 'mpd', 'registerConfigCallback', 
            {type: 'music_service', plugin: 'cdplayer', data: 'getMPDConfigString'}
        );


        // Once the Plugin has successfull started resolve the promise
        defer.resolve();
        
        console.log('CDIO(index): ' + 'onStart: ' + 'plugin started');
    
        return defer.promise;
    }

    public onStop() {
        let defer=libQ.defer();
    
        // Once the Plugin has successfull stopped resolve the promise
        defer.resolve();
    
        console.log('CDIO(index): ' + 'onStop: ' + 'plugin stopped');
        
        return defer.promise;
    }

    public onRestart () {
        let self = this;
        // Optional, use if you need it
    };

    // Configuration Methods -----------------------------------------------------------------------------
    public saveOptions(data: any) {
        this.config.set('readSpeed', data['readSpeed']);
        for(let drive in this.cdController.getDrives) {
            this.cdController.setDriveSpeed(drive, data['readSpeed']);
        }
    }

    public getUIConfig() {
        let defer = libQ.defer();
        let self = this;
    
        let lang_code = this.commandRouter.sharedVars.get('language_code');
    
        self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
            __dirname+'/i18n/strings_en.json',
            __dirname + '/UIConfig.json')
            .then(function(uiconf)
            {
                uiconf.sections[0].content[0].value = self.config.get('readSpeed');
    
                defer.resolve(uiconf);
            })
            .fail(function()
            {
                defer.reject(new Error());
            });
    
        return defer.promise;
    };
  
    public setUIConfig(data) {
        let self = this;
        //Perform your installation tasks here
    };
    
    public getConf(varName) {
        let self = this;
        //Perform your installation tasks here
    };
    
    public setConf(varName, varValue) {
        var self = this;
        //Perform your installation tasks here
    };

    public getMPDConfigString(): string {
        let self = this;
        return 'input { \n\tplugin "cdio_paranoia"\n}\n';
    }

// Playback Controls ---------------------------------------------------------------------------------------

    private addToBrowseSources = function () {
        // Use this function to add your music service plugin to music sources
        console.log('CDIO(index): ' + 'addToBrowseSources: ' + 'Audio CD');
        
        let data = {
            name: 'Audio CD', 
            uri: 'cdio', 
            plugin_type: 'music_service', 
            plugin_name: 'cdplayer',
            albumart: '/albumart?sourceicon=music_service/cdplayer/icon.svg'
        };
        
        this.commandRouter.volumioAddToBrowseSources(data);
    }

    //here I am going to handle chosen song/songs?
    //here i am going to handle click on data sub-source
    public handleBrowseUri(curUri: string) {
        let self = this;
        console.log('CDIO(index): ' + 'handleBrowseUri: ' + curUri);
        //self.commandRouter.logger.info('CDIO: ' + curUri);
        let response;
    
        if (curUri.startsWith('cdio/eject')) {
            
            //eject cd rom
            console.log('CDIO(index): ' + 'handleBrowseUri: ' + 'command: eject cd rom: ' + curUri);
            
            //this will eject cd rom
            let ret = self.cdController.eject(curUri.replace('cdio/eject',''));
            
            //i have to recalculate CDIO menu
            response = self.listRoot(curUri);
            
        }else if (curUri.startsWith('cdio/load')){ 
            console.log('CDIO(index): ' + 'handleBrowseUri: ' + 'command: load cd rom: ' + curUri);
            
            //this will close cd rom
            let ret = self.cdController.closeDrive(curUri.replace('cdio/load',''));
            
            //I have to recalculate CDIO menu
            response = self.listRoot(curUri);
            
        }else if (curUri.startsWith('cdio/tracks')) {
            //trying to list tracks
            console.log('CDIO(index): ' + 'handleBrowseUri: ' + 'track is choosen: ' + curUri);
            response = self.listTracks(curUri);
        } else if (curUri.startsWith('cdio')) {
            //top in CDIO menu
            console.log('CDIO(index): ' + 'handleBrowseUri: ' + 'top in CDIO menu: ' + curUri);
            response = self.listRoot(curUri);
        }
        else {
          //unexpected curUri
          console.log('CDIO(index): ' + 'handleBrowseUri: ' + 'unexpected curUri: ' + curUri);
          response = self.listRoot(curUri);
        }
    
        return response;
    }

    private listTracks(cUrl: string) {
        let self = this;
        
        let response = {
            navigation: {
                "prev": {
                    uri: 'cdio'
                },
                "lists":[
                    {
                        "availableListViews": [
                                "list"
                        ],
                        "items": [
    
                        ]
                    }
                ]
            }
        }

        let split = self.parseUri(cUrl);
        
        self.logger.info('request tracks for ' + split.drive);
        
        let driveState: ICDState = self.cdController.getDisc(split.drive);
        
        console.log('CDIO(index): ' + 'listTracks: ' + 'driveState:');
        console.dir(driveState);
        if(driveState.loaded) {
            let disc = driveState.disc;
            for(let track of disc.tracks)
            {
                if(track) {
                    var song = {
                        service: 'cdplayer',
                        type: 'song',
                        trackType: 'CD',
                        artist: disc.artist,
                        album: disc.discName,
                        albumart: disc.cover,
                        title: track.name,
                        uri: 'cdio/tracks' + split.drive + '/' + track.track,
                        icon: 'fa fa-music'
                    };
                    response.navigation.lists[0].items.push(song);
                 }
            }
        }
        else{
            //if list is empty
            console.log('CDIO(index): ' + 'listTracks: ' + 'disc is inserted but empty');
        }
        
        
        //return track list?
        return libQ.resolve(response);
    }
    
    //here we are going to create sub data sources
    private listRoot(cUrl: string) {
        let self=this;
    
        let response = {
            navigation: {
                prev: {
                    uri: 'cdio'
                },
                lists: [{
                    "title": "Audio CD",
                    "icon": "fa fa-folder-open-o",
                    "availableListViews": ["list","grid"],
                    "items": []
                }]
            }
        };

        console.log('CDIO(index): ' + 'listRoot: ' + 'starting to create CDIO menu...');
        let drives: IDrives = self.cdController.getDrives;
        
        for(let drive in drives)
        {
            console.log('CDIO(index): ' + 'listRoot: ' + 'drive: ' + drive);
            let driveState = self.cdController.getDisc(drive);  
            
            //self.logger.info(JSON.stringify(driveState, null, 4));
            
            //if cd rom is closed and disc loaded, then create entry
            if (driveState.loaded){
            
                console.log('CDIO(index): ' + 'listRoot: ' + 'creating disc entry for drive: ' + drive);
                let disc = driveState.disc;
                let item = {
                    service: 'cdplayer',
                    type: 'folder',
                    title: 'Tracks' + (driveState.loaded ? ' - ' + disc.discName : ''),
                    artist: disc.artist,
                    album: disc.discName,
                    albumart: disc.cover,
                    icon: 'fa fa-folder-open-o',
                    uri: 'cdio/tracks' + drive
                };
                response.navigation.lists[0].items.push(item);
        
                //one eject sub source
                console.log('CDIO(index): ' + 'listRoot: ' + 'creating eject entry for drive: ' + drive);
                
                let eject = {
                    service: 'cdplayer',
                    type: 'folder',
                    title: 'Eject' + (driveState.loaded ? ' - ' + disc.discName : ''),
                    artist: '',
                    album: '',
                    icon: 'fa fa-eject',
                    uri: 'cdio/eject' + drive
                }
                response.navigation.lists[0].items.push(eject);
            }
            else{
                //create on eject button
                //one eject sub source
                console.log('CDIO(index): ' + 'listRoot: ' + 'creating load entry for drive: ' + drive);
                
                let eject = {
                    service: 'cdplayer',
                    type: 'folder',
                    title: 'Load ' + drive,
                    artist: '',
                    album: '',
                    icon: 'fa fa-eject',
                    uri: 'cdio/load' + drive
                }
                response.navigation.lists[0].items.push(eject);
            }
        
        }
        
        console.log('CDIO(index): ' + 'listRoot: ' + 'starting to create CDIO menu...DONE');
        
        return libQ.resolve(response);
    }
    
    // Define a method to clear, add, and play an array of tracks
    public clearAddPlayTrack(track) {
        let self = this;
        self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerCdio::clearAddPlayTrack');

        self.commandRouter.logger.info(JSON.stringify(track));

        return self.mpdPlugin.sendMpdCommand('stop',[])
            .then(function()
            {
                return self.mpdPlugin.sendMpdCommand('clear',[]);
            })
            .then(function()
            {
                return self.mpdPlugin.sendMpdCommand('add "' + track.uri+ '"',[]);
            })
            .then(function()
            {
                self.commandRouter.stateMachine.setConsumeUpdateService('mpd');
                return self.mpdPlugin.sendMpdCommand('play',[]);
            }
        );
    }

    // Seek
    public seek(timepos) {
        this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerCdio::seek to ' + timepos);

        return; //this.sendSpopCommand('seek '+timepos, []);
    }

    // Stop
    public stop() {
	    let self = this;
        self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerCdio::stop');
        
        return self.mpdPlugin.sendMpdCommand('stop',[]);
    };

    // Pause
    public pause = function() {
	    let self = this;
        self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerCdio::pause');
        return self.mpdPlugin.sendMpdCommand('pause',[]);
    }

    // Get state
    public getState() {
	    let self = this;
	    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerCdio::getState');
    }

    //Parse state
    public parseState(sState) {
	    let self = this;
	    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerCdio::parseState');

	    //Use this method to parse the state and eventually send it with the following function
    }

    // Announce updated State
    public pushState(state) {
	    let self = this;
	    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerCdio::pushState');

	    return ; //self.commandRouter.servicePushState(state, self.servicename);
    }


    public explodeUri (uri: string) {
	    let self = this;
	    let defer = libQ.defer();
        
        self.logger.info('explode: ' +  uri);

        let parts = self.parseUri(uri);
        let drive = self.cdController.getDisc(parts.drive);
        let name = '';
        let time = 0;
        if(drive.loaded) {
            if(parts.track) {
                name = drive.disc.tracks[parts.track].name;
                time = drive.disc.tracks[parts.track].duration;
            } else {
                for(let track of drive.disc.tracks)
                {
                    if(track){
                        time += track.duration;
                    }
                    name = drive.disc.discName;
                }
            }
            self.logger.info(JSON.stringify(drive.disc, null, 4));

            defer.resolve({
                uri: parts.uri,
                service: 'cdplayer',
                name: drive.disc.discName,
                title: name,
                artist: drive.disc.artist,
                type: 'track',
                albumart: drive.disc.cover,
                duration: time,
                trackType: 'CD'
            });
        } else {
            defer.reject(new Error('no disc loaded'));
        }
	    return defer.promise;
    }

    private parseUri(uri: string)
    {
        let self = this;
        let explode = uri.replace('cdio/tracks/', '').split('/')
        let handle = 'cdda://' + explode[0] + '/' + explode[1] + '/';
        if(explode[2]) {
            handle +=  explode[2];
        }

        this.logger.info(JSON.stringify(explode,null,4));

        return {
            drive: '/' + explode[0] + '/' + explode[1], 
            track: explode[2]? explode[2] : '',
            uri:  handle
        }
    }

    public search(query) {
	    let self = this;
	    let defer = libQ.defer();

	    // Mandatory, search. You can divide the search in sections using following functions

	    return defer.promise;
    }

    private searchArtists(results) {

    }

    private searchAlbums(results) {

    }

    private searchPlaylists(results) {

    }

    private searchTracks(results) {

    }
}

export = ControllerCdio;

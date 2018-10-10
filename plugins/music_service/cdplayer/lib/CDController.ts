declare var child_process : any;

//require when I want to export it too?
import udev = require('udev'); //bindings to libudev - API for enumerating and introspecting local devices
import mb = require('musicbrainz');
import libQ = require('kew');

//Import a single export from a module 
//  --import can be renamed import{exec as exec 1} from...
//  --import * as MODULE from, import whole module
import {exec} from 'child_process';
import {readdir} from 'fs';
import {SimpleEventDispatcher, SignalDispatcher, EventDispatcher, ISignal, IEvent, ISimpleEvent} from 'strongly-typed-events'
import libdiscid = require('./libdiscid');

export interface IDisc {
    discName: string,
    artist: string,
    cover: string,
    tracks: ITrack[]
}

export interface ITrack {
    track: number,
    name: string,
    duration: number
}

export interface ICDState {
    loaded: boolean,
    disc: IDisc
}

export interface IDrives {
    [name: string]: ICDState
}

export class CDController {
    private context : any;
    private commandRouter: any;
    private logger: any;
    private udevMonitor: any;
    private cdDrives: IDrives = {};
    private _onEjected = new SimpleEventDispatcher<string>();
    private _onLoaded = new SimpleEventDispatcher<string>();

    constructor(context: any) {
        //constructor
        let self = this;
        this.context = context;
        this.logger = this.context.logger;
        this.commandRouter = this.context.coreCommand;
        
        //create device monitor
        this.udevMonitor = udev.monitor();
        console.log('CDIO(CDController): ' + 'constructor: ' + 'udev monitor created');
        
        //check already connected devices?
        
        
        //this looks like listener creation. and when given event is raised, then given function is triggered.
        this.udevMonitor.on(
                               'change'
                              ,function (device: any){
                                    console.log('CDIO(CDController): ' + 'udevMonitor: ' + 'on change event raised: ' + device.DEVNAME);
                                    self.logger.info('udev action: '+ JSON.stringify(device, null, 4));
                                    
                                    // has a devname entry like /dev/sr...
                                    if(device.DEVNAME != null && device.DEVNAME.startsWith('/dev/sr')) {
                                        if(device.ID_CDROM_MEDIA != null) {
                                            if(device.ID_CDROM_MEDIA_TRACK_COUNT_AUDIO != null) {
                                                // audio disc present
                                                self.setDriveACL(device.DEVNAME);
                                                self.addDriveInfo(device.DEVNAME);
                                            } else {
                                                // no audio disc
                                                
                                            }
                                            
                                        } else {
                                            // ejected
                                            self.logger.info('ejected');
                                            self.cdDrives[device.DEVNAME] = {loaded: false, disc: null};
                                            self._onEjected.dispatch(device.DEVNAME);
                                        }
                                    }
                               }
                           );

        
        //if cd rom is already connected I have to set it up
        readdir('/dev/', function(err, items){
            if(err){
                self.logger.info('error : ' + err);
            }
            for(let item of items){
                if(item.startsWith('sr')) {
                    self.setDriveACL('/dev/' + item);
                    self.addDriveInfo('/dev/' + item);
                }
            }

        });
    }

    private addDriveInfo(drive: string) {
        let self = this;
        libdiscid.getTracksFromMusicBrainz(drive)
        .fail(function(e){
            self.logger.info(e);
            return libdiscid.getTracksFromDisc(drive);
        })
        .then(function(disc: IDisc){
            self.cdDrives[drive] = {loaded: true, disc: disc};
            self._onLoaded.dispatch(drive);
        })
        .fail(function(e){
            // no disc
            self.cdDrives[drive] = {loaded: false, disc: {discName:'', artist:'', cover: '', tracks: []}}
            self.logger.info(e);
        })
    }

    public get onEjected(): ISimpleEvent<string> {
        
        console.log('CDIO(CDController): ' + 'onEjected: ' + 'Event subscribe');
        return this._onEjected.asEvent();
        
    }

    public get onLoaded(): ISimpleEvent<string> {
        
        console.log('CDIO(CDController): ' + 'onLoaded: ' + 'Event subscribe');
        return this._onLoaded.asEvent();
        
    }

    public get getDrives(): IDrives {
        return this.cdDrives;
    }

    public getDisc(drive: string): ICDState {
        return this.cdDrives[drive];
    }

    //eject cd rom drive
    public eject(drive: string) :number {
        let self = this;
        exec('/usr/bin/eject ' + drive , function (error, stdout, stderr) {
            if(error){
                //self.logger.info('Cannot eject drive ' + drive);
                console.log('CDIO(CDController): ' + 'eject: ' + 'Cannot eject drive ' + drive);
                
                return 9;
            } 
            else{
                console.log('CDIO(CDController): ' + 'eject: ' + 'Drive ejected' + drive);
            }
        });
        
        return 0;
    }
    
    //close cd rom drive
    public close(drive: string) :number {
        let self = this;
        exec('/usr/bin/eject -t ' + drive , function (error, stdout, stderr) {
            if(error){
                //self.logger.info('Cannot close drive ' + drive);
                console.log('CDIO(CDController): ' + 'close: ' + 'Cannot close drive ' + drive);
                
                return 9;
            } 
            else{
                console.log('CDIO(CDController): ' + 'close: ' + 'Drive closed' + drive);
            }
        });
        
        return 0;
    }

    public setDriveACL(drive: string)
    {
        let self = this;
        if(drive) {
            self.logger.info('Adjusting ACL of drive ' + drive);
            exec('/usr/bin/sudo /bin/chmod 666 ' + drive, function (error, stdout, stderr){
                if(error){
                    self.logger.info('Cannot adjust ACL of drive ' + drive);
                }
            });
        }
    }

    //setting drive speed
    public setDriveSpeed(drive: string, speed: number)
    {
        
        let self = this;
        
        if(speed) {
            exec('/usr/bin/eject -x '+ speed.toString() + ' ' + drive, function (error, stdout, stderr){
                //CHR: maybe add loop to find suitable speed?
                if(error){
                    //self.logger.info('Cannot adjust speed of drive ' + drive);
                    console.log('CDIO ERROR(CDController): ' + 'setDriveSpeed: ' + 'Cannot adjust speed of drive(' + drive + '): ' + stderr + ':' + stdout);
                }
                else{
                    console.log('CDIO(CDController): ' + 'setDriveSpeed: ' + 'setting drive(' + drive + ') speed to: ' + speed);
                }
                //why was this outside? 
                //self.logger.info(stdout);
                //self.logger.info(stderr);
            });
        }
    }
}
/*
 npm i socket.io-client --save
 npm i @types/socket.io-client --save
*/

import io from '/static/volumio/node_modules/socket.io-client';

export class webSocketAPI{
    context: any;
    
    constructor(context: any){
        this.context = context;
    }
    
}
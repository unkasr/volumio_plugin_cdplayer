import ffi = require('ffi');
import ref = require('ref');
import {IDisc, ITrack} from './CDController';

let CdIo_t = ref.types.void;

let libcdio = ffi.Library('libcdio', {
   'cdio_open': ['pointer', ['string', 'int'] ],
   'cdio_get_first_track_num': [ 'int', ['pointer'] ],
   'cdio_get_num_tracks': ['int', ['pointer'] ],
   'cdio_destroy': ['void', ['pointer'] ],
   'cdio_get_discmode': ['int', ['pointer'] ],
   'cdio_get_cdtext': ['pointer', ['pointer', 'int'] ],
   'cdtext_get': ['string', ['pointer' , 'int', 'int'] ]
});

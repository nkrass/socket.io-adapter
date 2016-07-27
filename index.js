"use strict";
/**
 * Module dependencies.
 */

var Emitter = require('events').EventEmitter;
var parser = require('socket.io-parser');

/**
 * Module exports.
 */

module.exports = Adapter;

/**
 * Memory adapter constructor.
 *
 * @param {Namespace} nsp
 * @api public
 */

function Adapter(nsp){
  this.nsp = nsp;
  this.rooms = {};
  this.sids = {};
  this.encoder = new parser.Encoder();
}

/**
 * Inherits from `EventEmitter`.
 */

Adapter.prototype.__proto__ = Emitter.prototype;

/**
 * Adds a socket to a room.
 *
 * @param {String} socket id
 * @param {String} room name
 * @param {Function} callback
 * @api public
 */

Adapter.prototype.add = function(id, room, fn){
  this.sids[id] = this.sids[id] || {};
  this.sids[id][room] = true;
  this.rooms[room] = this.rooms[room] || Room();
  this.rooms[room].add(id);
  if (fn) process.nextTick(fn.bind(null, null));
};

/**
 * Removes a socket from a room.
 *
 * @param {String} socket id
 * @param {String} room name
 * @param {Function} callback
 * @api public
 */

Adapter.prototype.del = function(id, room, fn){
  this.sids[id] = this.sids[id] || {};
  delete this.sids[id][room];
  if (this.rooms.hasOwnProperty(room)) {
    this.rooms[room].del(id);
    if (this.rooms[room].length === 0) delete this.rooms[room];
  }

  if (fn) process.nextTick(fn.bind(null, null));
};

/**
 * Removes a socket from all rooms it's joined.
 *
 * @param {String} socket id
 * @param {Function} callback
 * @api public
 */

Adapter.prototype.delAll = function(id, fn){
  if (this.sids[id]) {
    Object.keys(this.sids[id]).filter( room => this.rooms[room] )
      .map( room => {
          this.rooms[room].del(id);
          if (this.rooms[room].length === 0) delete this.rooms[room];
      })  
  }
  delete this.sids[id];

  if (fn) process.nextTick(fn.bind(null, null));
};

/**
 * Broadcasts a packet.
 *
 * Options:
 *  - `flags` {Object} flags for this packet
 *  - `except` {Array} sids that should be excluded
 *  - `rooms` {Array} list of rooms to broadcast to
 *
 * @param {Object} packet object
 * @api public
 */

Adapter.prototype.broadcast = function(packet, opts){
  var rooms = opts.rooms || [];
  var except = opts.except || [];
  var flags = opts.flags || {};
  var packetOpts = {
    preEncoded: true,
    volatile: flags.volatile,
    compress: flags.compress
  };
  packet.nsp = this.nsp.name;
  
  this.encoder.encode(packet, (encodedPackets) => {
    if (rooms.length) {
        rooms.filter( room => this.rooms[room] )
          .map( room => this.rooms[room] )
          .map( room => Object.keys(room.sockets) )
          .join().split(',')
          .filter( id => !except.includes(id) )
          .map( id => this.nsp.connected[id] )
          .filter( e => e)
          .map( sc => sc.packet(encodedPackets, packetOpts) );
    } else {
      Object.keys(this.sids).filter( id => !except.includes(id) )
        .map( id => this.nsp.connected[id] )
        .filter( e => e )
        .map( sc => sc.packet(encodedPackets, packetOpts) );
    }
  });
};

/**
 * Gets a list of clients by sid.
 *
 * @param {Array} explicit set of rooms to check.
 * @api public
 */

Adapter.prototype.clients = function(rooms, fn){
  if ('function' == typeof rooms){
    fn = rooms;
    rooms = null;
  }
  if (!fn) return;
  var sids = [];
  rooms = rooms || [];
  
  if (rooms.length) {
      sids = rooms.filter( room => this.rooms[room] )
        .map( room => Object.keys(room.sockets) )
        .join().split(',')
        .filter( sc => this.nsp.connected[sc]);
  } else {
      sids = Object.keys(this.sids).filter( sc => this.nsp.connected[sc]);
  }
  process.nextTick(fn.bind(null, null, sids));
};

/**
* Room constructor.
*
* @api private
*/

function Room(){
  if (!(this instanceof Room)) return new Room();
  this.sockets = {};
  this.length = 0;
}

/**
 * Adds a socket to a room.
 *
 * @param {String} socket id
 * @api private
 */

Room.prototype.add = function(id){
  if (!this.sockets.hasOwnProperty(id)) {
    this.sockets[id] = true;
    this.length++;
  }
};

/**
 * Removes a socket from a room.
 *
 * @param {String} socket id
 * @api private
 */

Room.prototype.del = function(id){
  if (this.sockets.hasOwnProperty(id)) {
    delete this.sockets[id];
    this.length--;
  }
};

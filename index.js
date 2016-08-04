"use strict";
/**
 * Module dependencies.
 */

const Emitter = require('events').EventEmitter;
const parser = require('socket.io-parser');

/**
 * Room constructor.
 * @type {{new(): {add: (function(String)), del: (function(String))}}}
 * @api private
 * @private
 */
const Room = class {
  constructor(){
    //if (!(this instanceof Room)) return new Room();
    this.sockets = {};
    this.length = 0;
  }

  /**
   * Adds a socket to a room.
   *
   * @param {String} id socket id
   * @api private
   */
  add(id){
    if (!this.sockets.hasOwnProperty(id)) {
      this.sockets[id] = true;
      this.length++;
    }
  }
  /**
   * Removes a socket from a room.
   *
   * @param {String} id socket id
   * @api private
   */
  del(id){
    if (this.sockets.hasOwnProperty(id)) {
      delete this.sockets[id];
      this.length--;
    }
  }
}

/**
 * Memory adapter constructor.
 * @constructor
 * @param {String} nsp
 * @api public
 * @export
 */

const Adapter = class extends Emitter{
  constructor(nsp){
    super();
    this.nsp = nsp;
    this.rooms = {};
    this.sids = {};
    this.encoder = new parser.Encoder();
  }
  /**
   * Adds a socket to a room.
   *
   * @param {String} id socket id
   * @param {String} room name
   * @param {Function} fn callback
   * @api public
   */
  add(id, room, fn){
    this.sids[id] = this.sids[id] || {};
    this.sids[id][room] = true;
    this.rooms[room] = this.rooms[room] || new Room();
    this.rooms[room].add(id);
    if (fn) process.nextTick(fn.bind(null, null));
  }
  /**
   * Removes a socket from a room.
   *
   * @param {String} id socket id
   * @param {String} room name
   * @param {Function} fn callback
   * @api public
   */
  del(id, room, fn){
    this.sids[id] = this.sids[id] || {};
    delete this.sids[id][room];
    if (this.rooms.hasOwnProperty(room)) {
      this.rooms[room].del(id);
      if (this.rooms[room].length === 0) delete this.rooms[room];
    }

    if (fn) process.nextTick(fn.bind(null, null));
  }
  /**
   * Removes a socket from all rooms it's joined.
   *
   * @param {String} id socket id
   * @param {Function} fn callback
   * @api public
   */
  delAll(id, fn){
    if (this.sids[id]) {
      Object.keys(this.sids[id]).filter( room => this.rooms[room] )
          .map( room => {
            this.rooms[room].del(id);
            if (this.rooms[room].length === 0) delete this.rooms[room];
          })
    }
    delete this.sids[id];

    if (fn) process.nextTick(fn.bind(null, null));
  }
  /**
   * Broadcasts a packet.
   *
   * Options:
   *  - `flags` {Object} flags for this packet
   *  - `except` {Array} sids that should be excluded
   *  - `rooms` {Array} list of rooms to broadcast to
   *
   * @param {Object} packet object
   * @param {{rooms: Array, flags: Object, except: Array}} opts
   * @api public
   */
  broadcast(packet = {}, opts = {}){
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
  }
  /**
   * Gets a list of clients by sid.
   *
   * @param {Array} rooms explicit set of rooms to check.
   * @param {Function} fn callback
   * @api public
   */
  clients(rooms = [], fn){
    // if ('function' === typeof rooms){
    //   fn = rooms;
    //   rooms = null;
    // }
    if (!fn) return;
    let sids = [];

    if (rooms.length) {
      sids = rooms.filter( room => this.rooms[room] )
          .map( room => Object.keys(room.sockets) )
          .join().split(',')
          .filter( sc => this.nsp.connected[sc]);
    } else {
      sids = Object.keys(this.sids).filter( sc => this.nsp.connected[sc]);
    }
    process.nextTick(fn.bind(null, null, sids));
  }
}
/**
 * Module exports.
 */
module.exports = Adapter;

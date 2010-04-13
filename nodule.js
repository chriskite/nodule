var net = require('net'),
    sys = require('sys');

var LOGGING = true;

var PORT = 13823;

var STATUS_OK = 0;
var E_INVALID_REQUEST = 1,
    E_UNKNOWN_CMD = 2;

/*
 * Handle logging to STDOUT if LOGGING == true.
 */
var logger = new function() {
    this.log = function(msg) {
        if(LOGGING) sys.log(msg);
    };
};

/*
 * An entry in the key-value store.
 */
function Entry(value) {
    this.value = value;
    this.modified_at = new Date();
}
Entry.prototype.getValue = function() {
    return this.value;
}
Entry.prototype.setValue = function(value) {
    this.value = value;
    this.modified_at = new Date();
    return this;
}

/*
 * A key space, which contains Entires and subscription patterns.
 */
function Space(name) {
    this.name = name;
    this.entries = {};
    this.patterns = {};
}

/*
 * A session for a connected client.
 */
function Session(stream) {
    this.stream = stream;
    this.id = Math.floor(Math.random()*99999999999).toString();
}
Session.prototype.sendAsJSON = function(data) {
    this.stream.write(JSON.stringify(data) + "\n");
};

var sessions = {}; // track all connected sessions

/*
 * Store the entries and mitigate access.
 */
var store = new function() {
    var spaces = {};

    this.get = function(space_name, key) {
        logger.log('Store:     GET Space:' + space_name + ' Key:' + key);
        var space = spaces[space_name];
        if(!space) return null;
        var entry = space.entries[key];
        if(!entry) return null;
        return entry.getValue();
    };

    this.set = function(space_name, key, value) {
        logger.log('Store:     SET Space:' + space_name + ' Key:' + key + ' Value:' + value);
        var space = spaces[space_name];
        if(!space) space = spaces[space_name] = new Space(space_name);
        var entry = space.entries[key];
        if(entry) {
            entry.setValue(value);
        } else {
            space.entries[key] = new Entry(value);
        }
        return STATUS_OK;
    };
};

/*
 * Parse and process incoming requests.
 */
var processor = new function() {
    this.process = function(data, session) {
        try {
            var cmd = JSON.parse(data);
        } catch(err) {
            this.error(E_INVALID_REQUEST, session);
            return;
        }
        if(!cmd.hasOwnProperty('op')) return;
        
        switch(cmd['op']) {
            case 'get': this.get(cmd, session); break;
            case 'set': this.set(cmd, session); break;
            default: 
                logger.log('Processor: Unknown command "' + cmd['op'] + '"');
                this.error(E_UNKNOWN_CMD, session);
        }
    };
    
    this.error = function(errno, session) {
        logger.log('Processor: ERROR ' + errno);
        session.sendAsJSON({'status': errno});
    };
    
    this.get = function(cmd, session) {
        logger.log('Processor: GET');
        var value = store.get(cmd['space'], cmd['key']);
        session.sendAsJSON({'value': value});
    };
    
    this.set = function(cmd, session) {
        logger.log('Processor: SET');
        var r = store.set(cmd['space'], cmd['key'], cmd['value']);
        session.sendAsJSON({'status': r});
    };    
};

/*
 * Listen for connections and data events.
 */
var server = net.createServer(function (stream) {
  stream.setEncoding('utf8');
  stream.addListener('connect', function () {
    // create a session for this client
    stream.session = new Session(stream);
    sessions[stream.session.id] = stream.session;
    logger.log('Server:    CONNECT    ' + stream.session.id + ' from ' + stream.remoteAddress);
  });
  stream.addListener('data', function (data) {
    logger.log('Server:    RECEIVE    ' + stream.session.id + ' from ' + stream.remoteAddress + ' ' + data);
    processor.process(data, stream.session);
  });
  stream.addListener('end', function () {
    logger.log('Server:    DISCONNECT ' + stream.session.id + ' from ' + stream.remoteAddress);
    stream.end();
    // GC the session
    delete sessions[stream.session.id];
    delete stream.session;
  });
});

// Start the server on PORT
server.listen(PORT, "localhost");

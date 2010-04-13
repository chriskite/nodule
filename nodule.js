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
 * A session for a connected client.
 */
function Session(stream) {
    this.stream = stream;
    this.id = Math.floor(Math.random()*99999999999).toString();
}
Session.prototype.sendAsJSON = function(data) {
    this.stream.write(JSON.stringify(data) + "\n");
};

/*
 * Store the entries and mitigate access.
 */
var store = new function() {
    var spaces = {};

    this.get = function(space, key) {
        logger.log('Store:     GET Space:' + space + ' Key:' + key);
        var entries = spaces[space];
        if(!entries) entries = spaces[space] = {};
        var entry = entries[key];
        if(!entry) return null;
        return entry.getValue();
    };

    this.set = function(space, key, value) {
        logger.log('Store:     SET Space:' + space + ' Key:' + key + ' Value:' + value);
        var entries = spaces[space];
        if(!entries) entries = spaces[space] = {};
        var entry = entries[key];
        if(entry) {
            entry.setValue(value);
        } else {
            entries[key] = new Entry(value);
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
    logger.log('Server:    CONNECT    ' + stream.session.id + ' from ' + stream.remoteAddress);
  });
  stream.addListener('data', function (data) {
    logger.log('Server:    RECEIVE    ' + stream.session.id + ' from ' + stream.remoteAddress + ' ' + data);
    processor.process(data, stream.session);
  });
  stream.addListener('end', function () {
    logger.log('Server:    DISCONNECT ' + stream.session.id + ' from ' + stream.remoteAddress);
    stream.end();
    delete stream.session;
  });
});

// Start the server on PORT
server.listen(PORT, "localhost");

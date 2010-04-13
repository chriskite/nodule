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
Space.prototype.addSubscription = function(pattern, session_id) {
    logger.log('Space: ' + this.name + ' ' + session_id + ' SUBSCRIBE ' + pattern);
    if(!this.patterns[pattern]) this.patterns[pattern] = {};
    this.patterns[pattern][session_id] = null;
    return STATUS_OK;
};
Space.prototype.publish = function(key, entry) {
    for(var p in this.patterns) {
        var regex = new RegExp(p);
        if(key.match(regex)) {
            for(var id in this.patterns[p]) {
                // publish this key to the session
                sessions[id].sendAsJSON({space: this.name, key: key, value: entry.getValue()});
            }
        }
    }
};
Space.prototype.gcSession = function(session_id) {
    for(var p in this.patterns) {
        delete this.patterns[p][session_id];
    }
};

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

    this.gcSession = function(session_id) {
        for(var i in spaces) {
            spaces[i].gcSession(session_id);
        }
    };

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
            entry = space.entries[key] = new Entry(value);
        }
        space.publish(key, entry);
        return STATUS_OK;
    };
    
    this.sub = function(space_name, pattern, session_id) {
        logger.log('Store:     SUB Space:' + space_name + ' Pattern: ' + pattern);
        var space = spaces[space_name];
        if(!space) space = spaces[space_name] = new Space(space_name);
        return space.addSubscription(pattern, session_id);
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
            case 'sub': this.sub(cmd, session); break;
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
    
    this.sub = function(cmd, session) {
        logger.log('Processor: SUB');
        var r = store.sub(cmd['space'], cmd['pattern'], session.id);
        session.sendAsJSON({'status': r});
    };       
};

/*
 * Listen for connections and data events.
 */
var server = net.createServer(function (stream) {
  stream.setEncoding('utf8');
  stream.addListener('connect', function() {
    // create a session for this client
    stream.session = new Session(stream);
    sessions[stream.session.id] = stream.session;
    logger.log('Server:    CONNECT    ' + stream.session.id + ' from ' + stream.remoteAddress);
  });
  stream.addListener('data', function(data) {
    logger.log('Server:    RECEIVE    ' + stream.session.id + ' from ' + stream.remoteAddress + ' ' + data);
    processor.process(data, stream.session);
  });
  stream.addListener('end', function() {
    logger.log('Server:    DISCONNECT ' + stream.session.id + ' from ' + stream.remoteAddress);
    stream.end();
  });
  stream.addListener('close', function() {
    // GC the session
    var session_id = stream.session.id;
    store.gcSession(session_id);
    delete sessions[session_id];
    delete stream.session;
  });
});

// Start the server on PORT
server.listen(PORT, "localhost");

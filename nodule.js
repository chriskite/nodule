var net = require('net'),
    sys = require('sys');

var PORT = 13823;

var STATUS_OK = 0;
var E_INVALID_REQUEST = 1,
    E_UNKNOWN_CMD = 2;

function Entry(value) {
    this.value = value;
    this.timestamp = new Date();
}

Entry.prototype.getValue = function() {
    return this.value;
}

Entry.prototype.setValue = function(value) {
    this.value = value;
    this.timestamp = new Date();
    return this;
}

var store = new function() {
    var entries = {};

    this.get = function(space, key) {
        sys.log('Store: GET    Space:' + space + ' Key:' + key);
        entry = entries[key];
        if(!entry) return null;
        return entry.getValue();
    };

    this.set = function(space, key, value) {
        sys.log('Store: SET    Space:' + space + ' Key:' + key + ' Value:' + value);
        entry = entries[key];
        if(entry) {
            entry.setValue(value);
        } else {
            entries[key] = new Entry(value);
        }
        return STATUS_OK;
    };
};

var processor = new function() {
    this.process = function(data, stream) {
        try {
            var cmd = JSON.parse(data);
        } catch(err) {
            this.error(E_INVALID_REQUEST, stream);
            return;
        }
        if(!cmd.hasOwnProperty('op')) return;
        
        switch(cmd['op']) {
            case 'get': this.get(cmd, stream); break;
            case 'set': this.set(cmd, stream); break;
            default: 
                sys.log('Processor: Unknown command "' + cmd['op'] + '"');
                this.error(E_UNKNOWN_CMD, stream);
        }
    };
    
    this.error = function(errno, stream) {
        sys.log('Processor: ERROR ' + errno);
        this.sendAsJSON({'status': errno}, stream);
    };
    
    this.sendAsJSON = function(data, stream) {
        stream.write(JSON.stringify(data) + "\n");
    };
    
    this.get = function(cmd, stream) {
        sys.log('Processor: GET');
        var value = store.get(cmd['space'], cmd['key']);
        this.sendAsJSON({'value': value}, stream);
    };
    
    this.set = function(cmd, stream) {
        sys.log('Processor: SET');
        var r = store.set(cmd['space'], cmd['key'], cmd['value']);
        this.sendAsJSON({'status': r}, stream);
    };    
};

var server = net.createServer(function (stream) {
  stream.setEncoding('utf8');
  stream.addListener('connect', function () {
    sys.log('Server: CONNECT     ' + stream.remoteAddress);
  });
  stream.addListener('data', function (data) {
    sys.log('Server: RECEIVE     ' + stream.remoteAddress + ' ' + data);
    processor.process(data, stream);
  });
  stream.addListener('end', function () {
    sys.log('Server: DISCONNECT  ' + stream.remoteAddress);
    stream.end();
  });
});

server.listen(PORT, "localhost");

require 'rubygems'
require 'json'
require 'socket'
require 'pp'

class Nodule

  def initialize(addr = 'localhost', port = 13823)
    @socket = TCPSocket.new(addr, port)
  end  
  
  def op(name, opts)
    request = {:op => name}.merge(opts).to_json
    @socket.print request
    @socket.gets
  end
  
  def get(space, key)
    response = op(:get, {:space => space, :key => key})
    JSON.parse(response)['value']
  end
  
  def set(space, key, value)
    response = op(:set, {:space => space, :key => key, :value => value})
    self
  end
  
  def destroy
    @socket.close
  end
  
end

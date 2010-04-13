require 'rubygems'
require 'json'
require 'socket'
require 'eventmachine'
require 'pp'

module Nodule

  class Client
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
    
    def subscription(&block)
      EventMachine::run do
        EventMachine::connect('localhost', 13823, Nodule::Subscription).instance_eval(&block)
      end
    end
    
    def destroy
      @socket.close
    end
  end
  
  module Subscription
    def receive_data(data)
      p data
    end
    
    def subscribe(space, key, &block)
      add_callback(space, key, block)
      # send the subscription request
      send_data({:op => :sub, :space => space, :key => key}.to_json)
    end
    
    def add_callback(space, key, block)
      @callbacks ||= {}
      @callbacks[space] ||= {}
      @callbacks[space][key] ||= []
      @callbacks[space][key] << block
    end
  end
  
end

#n = Nodule::Client.new
#n.subscription do
#  subscribe('global', 'test') { |space, key, value| puts value }
#end

n = Nodule::Client.new
n.set 'global', 'test', 'testval'
puts n.get 'global', 'test'

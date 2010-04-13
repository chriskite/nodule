require 'rubygems'
require 'json'
require 'socket'
require 'eventmachine'
require 'pp'

module Nodule

  def self.subscription(addr = 'localhost', port = 13823, &block)
    EventMachine::run do
      EventMachine::connect(addr, port, Nodule::Subscription).instance_eval(&block)
    end
  end

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
    
    def destroy
      @socket.close
    end
  end
  
  module Subscription
    def receive_data(data)
      data.split("\n").each do |json|
        response = JSON.parse(json)
        do_callbacks(response['space'], response['key'], response['value'])
      end
    end
    
    def subscribe(space, pattern, &block)
      pattern = pattern.to_s
      add_callback(space, pattern, block)
      # send the subscription request
      send_data({:op => :sub, :space => space, :pattern => pattern}.to_json)
    end
    
    def add_callback(space, pattern, block)
      @callbacks ||= {}
      @callbacks[space] ||= {}
      @callbacks[space][pattern] ||= []
      @callbacks[space][pattern] << block
    end
    
    def do_callbacks(space, key, value)
      return unless !!@callbacks[space]
      @callbacks[space].each_key do |pattern|
        if key =~ Regexp.new(pattern)
          @callbacks[space][pattern].each { |blk| blk.call(space, key, value) }
        end
      end
    end    
  end
  
end

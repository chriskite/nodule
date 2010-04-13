# Nodule: A Pub-Sub Key-Value Store in Node.js

## Features
* Get and set UTF-8 keys and values.
* Keyspaces allow you to separate your keys without awkward naming conventions.
For example, create a 'users' keyspace with a key per ID, rather than having a bunch of "users:{id}" keys.
* Subscribe to keys by Regex pattern, and receive a data push when the key is modified by another client.
* Client library written in Ruby.

## Installation and Execution
1. Install Node.js from http://nodejs.org
2. Clone this git repository.
3. $ node nodule.js

## Examples
### Set and Get
    n = Nodule::Client.new
    n.set('global', 'a_key', 'the_value')
    n.get('global', 'a_key') # returns "the value"
    
### PubSub
    Nodule.subscription do
      subscribe('global', '.*') { |space, key, value| puts "#{key}:#{value}" } # subscribe to all keys in the 'global' keyspace
    end
    
Then when another client writes the value 'bar' to the key 'foo' in the 'global' keyspace, your subscription will process the block and output
"foo:bar".

## Disclaimer
Nodule has not been tested in production and is distributed AS-IS. It might steal your girlfriend or drink your last Dr. Pepper.

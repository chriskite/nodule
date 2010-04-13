require 'nodule'

n = Nodule::Client.new
n.set('global', ARGV[0], ARGV[1])

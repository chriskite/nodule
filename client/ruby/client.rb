require 'nodule'

n = Nodule::Client.new
n.set('global', 'test', 'old')
puts n.get('global', 'test')
n.set('global', 'test', 'new')

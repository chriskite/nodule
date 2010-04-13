require 'nodule'

Nodule.subscription do
  subscribe('global', 'test') { |space, key, value| puts value.upcase }
end

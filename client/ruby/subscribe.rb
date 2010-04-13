require 'nodule'

Nodule.subscription do
  subscribe('global', '.*') { |space, key, value| puts value.upcase }
end

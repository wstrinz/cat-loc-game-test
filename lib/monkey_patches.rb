class Array
  def to_proc
    proc { |receiver| receiver.send *self }
  end
end

module StringMods
  def underscore
    super.gsub(' ', '_')
  end
end

class String
  prepend StringMods
end

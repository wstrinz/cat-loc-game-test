class User
  class << self
    def add_item(item)
      REDIS_GAME.hincrby('user_items', item['name'], 1)
      REDIS_GAME.hsetnx('itemdefs', item['name'], item.to_json)
    end

    def item_count(item_name)
      REDIS_GAME.hget('user_items', item_name).to_i
    end
  end
end

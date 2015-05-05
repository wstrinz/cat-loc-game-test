if ENV["REDISCLOUD_URL"]
    uri = URI.parse(ENV["REDISCLOUD_URL"])
    REDIS_GEO = Redis.new(:host => uri.host, :port => uri.port, :password => uri.password)
    if ENV['REDISTOGO_URL']
      world_uri = URI.parse(ENV['REDISTOGO_URL'])
      REDIS_GAME = Redis.new(:host => world_uri.host, :port => world_uri.port, :password => world_uri.password)
    else
      REDIS_GAME = Redis.new(:host => uri.host, :port => uri.port, :password => uri.password)
    end
else
  REDIS_GAME = REDIS_GEO = Redis.new
end

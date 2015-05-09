require 'sinatra'
require 'sinatra/reloader' if development?
require 'open-uri'
require 'rosemary'
require 'json'
require 'redis'
require 'pry'
require 'active_support/core_ext'
require 'faker'
require 'engtagger'
require 'verbs'
require 'wordnet'
require 'indefinite_article'
require 'marky_markov'
require 'nokogiri'

require 'bundler/setup'
Bundler.setup

require_relative 'lib/monkey_patches'

require_relative 'initializers/redis'
require_relative 'lib/game'
also_reload './lib/game' if development?

helpers do

  PER_TILE_FACTOR = 250.0
  LAT_DEGREES_PER_TILE = 1.0 / PER_TILE_FACTOR
  LNG_DEGREES_PER_TILE = 1.0 / PER_TILE_FACTOR

  def get_geo_box(bounds)
    b = bounds
    Rosemary::Api.new.find_bounding_box(b[:w], b[:s], b[:e], b[:n])
  end

  def get_object_data(type, id)
    Rosemary::Api.new.find_element(type, id);
  end

  def generate_interaction_for(osm_data)
    InteractionGenerator.generate_interaction(osm_data)
  end

  def take_action(geo_data, action_num)
    InteractionGenerator.take_action(geo_data, action_num)
  end

  def nearest_nw_tile(lat, lng)
    [(lat * PER_TILE_FACTOR).ceil / PER_TILE_FACTOR,
      (lng * PER_TILE_FACTOR).floor / PER_TILE_FACTOR]
  end

  def nearest_se_tile(lat, lng)
    [(lat * PER_TILE_FACTOR).floor / PER_TILE_FACTOR,
      (lng * PER_TILE_FACTOR).ceil / PER_TILE_FACTOR]
  end

  def tiles_for(bounds)
    b = bounds
    maxN, maxW = nearest_nw_tile(b[:n].to_f, b[:w].to_f)
    maxS, maxE = nearest_se_tile(b[:s].to_f, b[:e].to_f)
    n_tiles_wide = (maxW.abs - maxE.abs) / LAT_DEGREES_PER_TILE
    n_tiles_high = (maxN.abs - maxS.abs) / LNG_DEGREES_PER_TILE

    n_tiles_high.round(8).ceil.times.map do |yTile|
      n_tiles_wide.round(8).ceil.times.map do |xTile|
        {
          w: (maxW + xTile.to_f * LAT_DEGREES_PER_TILE).round(4),
          e: (maxW + (xTile + 1).to_f * LAT_DEGREES_PER_TILE).round(4),
          n: (maxN - yTile.to_f * LNG_DEGREES_PER_TILE).round(4),
          s: (maxN - (yTile + 1).to_f * LNG_DEGREES_PER_TILE).round(4)
        }
      end
    end.flatten
  end

  def json_for_new_tile(rosemary_response)
    r = rosemary_response
    tile = {
      "nodes" =>  r.nodes.map do |n|
                      {lat: n.lat,
                        lng: n.lon,
                        id: n.id,
                        tags: n.tags,
                        lastInteracted: nil,
                        lastInvestigated: nil}
                  end,

      "ways" => r.ways.map do |w|
                   {tags: w.tags,
                    nodes: w.nodes,
                    id: w.id,
                    lastInteracted: nil,
                    lastInvestigated: nil}
                end
    }
    tile
  end

  def init_enemy(enemy_params)
    status = 200
    resp = {}
    if enemy = REDIS_GEO.hget('enemies', enemy_params['id'])
      resp[:enemy] = JSON.parse enemy
    else
      if REDIS_GEO.hlen('enemies') >= REDIS_GEO.hlen('tiles')
        #all_enemies = REDIS_GEO.hgetall('enemies')
        status = 422
        resp[:errors] = "Already spawned enough enemies"
      else
        new_enemy = WorldGenerator.new.init_enemy(enemy_params)
        resp[:enemy] = new_enemy
      end
    end

    resp[:status] = status
    resp
  end

  def object_ids_for_new_tile(rosemary_response)
    {"nodes" => rosemary_response.nodes.map(&:id),
     "ways" => rosemary_response.ways.map(&:id)}
  end

  def load_geo_data_to_redis(data_list)
    data_list["nodes"].each do |n|
      REDIS_GEO.hsetnx("nodes", n[:id], n.to_json)
    end

    data_list["ways"].each do |w|
      REDIS_GEO.hsetnx("ways", w[:id], w.to_json)
    end

    data_list
  end

  def get_geo_object_data(type, ids)
    REDIS_GEO.hmget(type.pluralize, *ids).map{|d| JSON.parse(d)}
  end

  def fetch_tile_from_db(tile)
    tile_contents = JSON.parse(tile)
    {"nodes" => get_geo_object_data("nodes", tile_contents["nodes"]),
     "ways"  => get_geo_object_data("ways", tile_contents["ways"])}
  end

  def load_tile(tile)
    osm_data = get_geo_box(tile)
    objects_for_tile = load_geo_data_to_redis(json_for_new_tile(osm_data))
    WorldGenerator.new.with_seeded_rand do |ra|
      spawn_node = objects_for_tile["nodes"].sample(random: ra)
      spawn_node[:spawn] = true
      REDIS_GEO.hset("nodes", spawn_node[:id], spawn_node.to_json)
    end

    object_ids = object_ids_for_new_tile(osm_data)
    json_tile = tile.each_with_object({}) do |ent, h|
      h[ent[0]] = ent[1].to_f
    end.to_json
    REDIS_GEO.hset('tiles', json_tile, object_ids.to_json)
    objects_for_tile
  end

  def is_tile_loaded?(tile)
    REDIS_GEO.hget('tiles', tile.to_json).present?
  end

  def num_tiles_in_db
    REDIS_GEO.hkeys('tiles').count
  end

  def center_of_bounds(bounds)
    {lng: bounds[:e].to_f.abs + (bounds[:w].to_f.abs - bounds[:e].to_f.abs),
     lat: bounds[:s].to_f.abs + (bounds[:n].to_f.abs - bounds[:s].to_f.abs)}
  end

  NEW_WORLD_TILES_TO_LOAD = 6
  def get_geo_data(bounds)
    tiles = tiles_for(bounds)
    user_loc = center_of_bounds(bounds)

    is_new_world = num_tiles_in_db == 0
    n_tiles_to_load = is_new_world ? [tiles.count, NEW_WORLD_TILES_TO_LOAD].min : 0

    if is_new_world
      seed_tile = nearest_nw_tile(*nearest_se_tile(user_loc[:lat], user_loc[:lng]))
      WorldGenerator.new({lat: seed_tile[0], lng: seed_tile[1]})
    end

    data = tiles.map do |tile|
      cached_resp = REDIS_GEO.hget('tiles', tile.to_json)
      if cached_resp.present?
        fetch_tile_from_db(cached_resp)
      else
        puts("miss: #{tile.to_json}")
        if num_tiles_in_db < n_tiles_to_load
          puts("loading #{tile}")
          load_tile(tile)
        else
          {'unknown_tiles' => [tile]}
        end
      end
    end

    if is_new_world
      data = tiles.map do |tile|
        cached_resp = REDIS_GEO.hget('tiles', tile.to_json)
        if cached_resp.present?
          fetch_tile_from_db(cached_resp)
        else
          {'unknown_tiles' => [tile]}
        end
      end
    end


    d= data.inject({}) do |resp, memo|
      memo_nodes = memo["nodes"] || []
      memo_ways = memo["ways"] || []
      resp_nodes = resp["nodes"] || []
      resp_ways = resp["ways"] || []
      memo_unknown_tiles = memo["unknown_tiles"] || []
      resp_unknown_tiles = resp["unknown_tiles"] || []

      {'nodes' => memo_nodes.to_set.union(resp_nodes.to_set).to_a,
       'ways' => memo_ways.to_set.union(resp_ways.to_set).to_a,
       'unknown_tiles' => memo_unknown_tiles.to_set.union(resp_unknown_tiles.to_set).to_a}
    end

    d['tile_count'] = REDIS_GEO.hlen('tiles')

    d
  end

  def nodesForWay(way, osm_data)
    osm_data.nodes.select{|n| named.first.nodes.include?(n.id)}
  end
end

get '/' do
  erb :index
end

get '/game' do
  erb :game
end

post '/game/init_enemy' do
  content_type :json
  resp = init_enemy(JSON.parse(params[:enemy]).with_indifferent_access)
  if resp[:errors]
    status resp[:status]
    resp.to_json
  else
    resp.to_json
  end
end

get '/reset_game' do
  REDIS_GEO.flushall
  REDIS_GAME.flushall
end

get '/nodes' do
  content_type :json
  geo_data = get_geo_data(params[:bounds])

  {nodes: geo_data['nodes'], tiles: geo_data['unknown_tiles'], tileCount: geo_data['tile_count']}.to_json
end

get '/ways' do
  content_type :json
  geo_data = get_geo_data(params[:bounds])

  {ways: geo_data['ways'], tiles: geo_data['unknown_tiles'], tileCount: geo_data['tile_count']}.to_json
end

get '/:object_type/:id/interact' do
  content_type :json
  interactData = generate_interaction_for(get_geo_object_data(params[:object_type], params[:id]).first)

  {interaction: interactData}.to_json
end

post '/load_tile' do
  content_type :json
  geo_data = load_tile(params[:tile])

  {nodes: geo_data['nodes'], ways: geo_data['ways']}.to_json
end

post '/:object_type/:id/interact/:action_id' do
  content_type :json
  action_result = take_action(get_geo_object_data(params[:object_type], params[:id]).first, params[:action_id])

  action_result.to_json
end

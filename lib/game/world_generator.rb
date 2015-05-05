class WorldGenerator
  class << self
    def world_exists?
      REDIS_GAME.get('world_seed').present?;
    end

    def init_world(seed_loc)
      seed = ProcGen.id_for_loc(seed_loc[:lat], seed_loc[:lng])
      REDIS_GAME.set('world_seed', seed);
    end
  end

  def initialize(loc=nil)
    if loc == nil && !self.class.world_exists?
      raise "World not yet seeded; WorldGenerator requires a seed loc"
    else
      self.class.init_world(loc) unless self.class.world_exists?
    end
  end

  def seed_loc
    @seed_loc ||= REDIS_GAME.get('world_seed');
  end

  def new_seeded_rand(osm_object = nil)
    ProcGen.randomizer(osm_object)
  end

  def tile_count
    REDIS_GEO.hlen('tiles')
  end

  def update_osm_object(osm_object, changes={})
    osm_object_type = osm_object['nodes'] ? 'ways' : 'nodes'
    REDIS_GEO.hset osm_object_type, osm_object['id'], osm_object.merge(changes.stringify_keys).to_json
    JSON.parse REDIS_GEO.hget osm_object_type, osm_object['id']
  end

  def seed_initial_spawns
    r = new_seeded_rand
    REDIS_GEO.hgetall('tiles').map do |k,v|
      tile = JSON.parse v
      spawn_node = tile['nodes'].sample(random: r)
      node = JSON.parse REDIS_GEO.hget('nodes', spawn_node)
      update_osm_object(node, spawn: true)
    end
  end

  def init_enemy(enemy_params)
    # ret = nil
    rando = new_seeded_rand
    new_enemy = enemy_params.symbolize_keys.merge({
      targetNode: nil,
      targetNodeLat: nil,
      targetNodeLng: nil,
      currentWay: nil,
      direction: :forward,
      lastServerContact: Time.now
    }).with_indifferent_access

    home_id = enemy_params['homeNode']['id']
    home_node = JSON.parse REDIS_GEO.hget('nodes', home_id);

    # ways = REDIS_GEO.hgetall('ways').map{|id, w| JSON.parse(w)}.select{|w| w['nodes'].include?(home_id)}
    # current_way = ways.sample(random: rando)
    # if current_way
    #   new_enemy[:currentWay] = current_way['id']
    #   node_index = current_way['nodes'].find_index(home_id)
    #   next_node_id = current_way['nodes'][node_index + 1]
    #   if next_node_id.present?
    #     target_node = JSON.parse REDIS_GEO.hget('nodes', next_node_id)
    #   else
    #     next_node_id = current_way['nodes'][node_index - 1]
    #     unless next_node_id
    #       raise 'I dont know what do'
    #     end
    #     target_node = JSON.parse REDIS_GEO.get('nodes', next_node_id)
    #     new_enemy[:direction] = :reverse
    #   end
    #   new_enemy[:targetNode] = target_node['id']
    #   new_enemy[:targetNodeLat] = target_node['lat']
    #   new_enemy[:targetNodeLng] = target_node['lng']
    # else
      new_enemy[:targetNode] = home_id
      new_enemy[:targetNodeLat] = home_node['lat']
      new_enemy[:targetNodeLng] = home_node['lng']
    # end

    REDIS_GEO.hset('enemies', new_enemy[:id], new_enemy.to_json)
    sweep_for_expired_enemies
    JSON.parse(new_enemy.to_json)
  end

  def sweep_for_expired_enemies
    es = REDIS_GEO.hgetall('enemies')
    es.values.map do |v|
      enemy = JSON.parse v
      if(enemy["lastServerContact"] < Time.now - 5.minutes)
        REDIS_GEO.hdel('enemies', enemy['id'])
      end
    end
  end

  def generate_god
    "#{Faker::Name.last_name} of #{Faker::Address.city}"
  end

  def generate_building(osm_object)
    rando = new_seeded_rand(osm_object)
    ensure_useful = rando.rand(3) == 0
    if ensure_useful
      type = Concepts.buildings.sample(random: rando)
    else
      type = Concepts.buildings_with_uses.sample(random: rando)
    end

    use = Concepts.uses_for(type).sample(random: rando)
    if use
      event = event_for_usage(osm_object, use)
    elsif (at_loc = Concepts.at_location(type)).present?
      event = event_for_item(osm_object, at_loc)
    end
    name = ProcGen.building_name(osm_object, type)
    text = "The #{name}, #{type.humanize.with_indefinite_article}"

    {text: text, event: event, type: type, name: name}
  end

  def event_for_usage(osm_object, uses)
    rando = ProcGen.randomizer(osm_object)
    uses = Array.wrap(uses)
    plurality = rando.rand(2) == 0
    conj_plurality = !!plurality ? :plural : :singular
    use_choice = uses.first(4).sample(random: rando)
    entity = ProcGen.common_entity(osm_object)
    entity = entity.pluralize if plurality
    verb = use_choice.verb.conjugate(tense: :present, plurality: conj_plurality, aspect: :progressive, subject: entity.downcase)
    past_verb = use_choice.verb.conjugate(tense: :past, plurality: conj_plurality, aspect: :perfective, subject: entity.downcase)

    quantifier = !!plurality ? "Some" : entity.indefinite_article.capitalize

    {prefix: "",
     text: "#{quantifier} #{verb}",
     suffix: " here.",
     entity: entity,
     verb: verb,
     memory: "#{quantifier.downcase} #{past_verb}",
    }
  end

  def event_for_item(osm_object, items)
    rando = ProcGen.randomizer(osm_object)
    items = Array.wrap(items)
    plurality = rando.rand(2) == 0

    item = items.first(5).sample(random: rando)
    item = item.pluralize if plurality
    quantifier = !!plurality ? "Some" : item.indefinite_article.capitalize

    {prefix: "There's ",
     text: "#{quantifier} #{item}",
     suffix: " here.",
     memory: "#{quantifier.downcase} #{item}",
     entity: item}
  end

  def cryptic_instruction
    "#{Faker::Lorem.sentence}"
  end

  def starting_item
    "thing of thingy"
  end

  def god_for(earth_religion)
    if in_game_god = REDIS_GAME.hget('world_gods', earth_religion)
      JSON.parse(in_game_god)
    else
      new_god = generate_god
      REDIS_GAME.hset('world_gods', earth_religion, new_god.to_json)
      JSON.parse(new_god.to_json)
    end
  end

  def with_seeded_rand(osm_object=nil, opts={})
    yield ProcGen.randomizer(osm_object, opts)
  end
end

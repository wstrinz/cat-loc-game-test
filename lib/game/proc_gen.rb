class ProcGen
  class << self
    ITEMS = [{'name' => 'money', 'type' => 'tangible'}, {'name' => 'memory', 'type' => 'observation'}, {'name' => 'xp', 'type' => 'character'}]
    INTERACT_RESET = 1.hour # should move this somewhere

    def relative_location(osm_object)
      ["below", "nearby"].sample(random: randomizer(osm_object))
    end

    def items_for(osm_object)
      (rand(2) + 1).times.map{|t| ITEMS.sample(random: randomizer(osm_object)) }
    end

    def buttons_for(osm_object)
      type = osm_object['nodes'] ? 'ways' : 'nodes'
      if type == 'ways'
        unless osm_object['lastInteracted'].present? && Time.parse(osm_object['lastInteracted']) > INTERACT_RESET.ago
          [{type: type, id: osm_object['id'], text: 'Search', actionId: 1}]
        else
          []
        end
      else
        [{type: type, id: osm_object['id'], text: 'Leave', actionId: 1}]
      end
    end

    def leave_button

    end

    def common_entity(osm_object)
      ["Human", "Person", "Cat"].sample(random: randomizer(osm_object))
    end

    def randomizer(osm_object = nil, opts = {})
      if opts[:true_random]
        Random.new
      else
        if osm_object
          Random.new(seed_for_osm_object(osm_object))
        elsif opts[:seeds]
          Random.new (world_seed_bits + opts[:seeds].map{|s| s.to_s(2)}.join).to_i(2)
        else
          Random.new(world_seed.to_i(2))
        end
      end
    end

    def seed_for_osm_object(osm_object)
      seed_bits = world_seed_bits
      if osm_object
        seed_bits << osm_object['id'].to_s(2)
      end

      seed_bits.to_i(2)
    end

    def id_for_loc(lat, lng, round_percision = 5)
      rp = round_percision
      fact = 10 ** (rp - 1)
      [(lat.round(rp) * fact).to_i.to_s(2),
       (lng.round(rp) * fact).to_i.to_s(2)]
      .join.to_i(2).to_s(36)
    end

    def choose_between(choices: [], weights: [], seed:)
      if choices.length != weights.length
        raise "Length not equal: #{choices} vs #{weights}"
      end

      #int_weights = weights.map(&[:*, 100]).map(&:to_i)
    end

    def world_seed
      if WorldGenerator.world_exists?
        WorldGenerator.new.seed_loc
      else
        raise "Tried to get seed for randomizer before world existed!"
      end
    end

    def world_seed_int
      world_seed.to_i(36)
    end

    def world_seed_bits
      world_seed_int.to_s(2)
    end

    def building_name(osm_object, type)
      case type
      when 'restaurant', 'eatery', 'cafe'
        BuildingName.restaurant(osm_object)
      when 'temple'
        BuildingName.temple(osm_object)
      else
        old_seed = srand seed_for_osm_object(osm_object)
        article = rand(6) == 0 ? "The " : ""
        name = Faker::Company.name
        srand old_seed
        article + name
      end
    end
  end

  class BuildingName
    class << self
      def restaurant_parts_1
        @rparts_1 ||= open('./lib/dictionaries/restaurant_parts_1').each_line.to_a
      end

      def restaurant_parts_2
        @rparts_2 ||= open('./lib/dictionaries/restaurant_parts_2').each_line.to_a
      end

      def restaurant_parts_3
        @rparts_3 ||= open('./lib/dictionaries/restaurant_parts_3').each_line.to_a
      end

      def restaurant(osm_object)
        r = ProcGen.randomizer(osm_object)
        p1 = restaurant_parts_1.sample(random: r)
        p2 = restaurant_parts_2.sample(random: r)
        p3 = restaurant_parts_3.sample(random: r)

        "#{p1} #{p2} #{p3}".strip.gsub("\n","")
      end

      def temple(osm_object)
        temple_type = "Church"
        old_seed = srand ProcGen.seed_for_osm_object(osm_object)
        name_pt_1 = Faker::Name.last_name
        name_pt_2 = Faker::Lorem.word.capitalize
        title = Faker::Name.title
        subject = "The #{Faker::Commerce.product_name}"
        srand old_seed

        "#{temple_type} of #{name_pt_1} #{name_pt_2}, #{title} of #{subject}"
      end
    end
  end
end

class InteractionGenerator
  TAG_PRIORITIES = %w{amenity}

  def self.generate_interaction(osm_object)
    inst = self.new(osm_object)

    if inst.osm_object_type == "nodes"
      result = inst.generic_event_interaction
    else
      result = inst.send(inst.interaction_method)
    end

    inst.update_osm_object(lastInvestigated: Time.now)
    result
  end

  def self.take_action(osm_object, action_id)
    inst = self.new(osm_object)
    buttons = ProcGen.buttons_for(osm_object)
    action = buttons.find{|b| b[:actionId] == action_id.to_i}
    if action.present?
      if action[:text] == "Search"
        inst.take_search_action
      elsif action[:text] == "Leave"
        inst.update_osm_object(lastInteracted: Time.now)
        # inventory = REDIS_GAME.hgetall('user_items')
        {items: [], inventory: [], text: 'You move on'}
      else
        {items: [], inventory: [], text: "You took an unexpected action... (#{action[:text]})"}
      end
    else
      # inst.update_osm_object(lastInteracted: Time.now)
      # inventory = REDIS_GAME.hgetall('user_items')
      {items: [], inventory: [], text: 'You move on'}
    end
  end

  def take_search_action
    update_osm_object(lastInteracted: Time.now)
    items = ProcGen.items_for(osm_object)
    items.each do |i|
      User.add_item(i)
    end

    inventory = REDIS_GAME.hgetall('user_items')

    text = <<-TEXT
you find <generated search text> and

#{items.map do |i|
    "A #{i['name']} (new total #{inventory[i['name']]})"
  end.join("\n")}
    TEXT

    {items: items, inventory: inventory, text: text}
  end

  def interaction_method
    if (relevant_tags = osm_object['tags'].keys.select{|k| self.respond_to?("generate_interaction_for_#{k}")}).present?
      relevant_tag = TAG_PRIORITIES.find{|t| relevant_tags.include?(t)} || relevant_tags.first

      :"generate_interaction_for_#{relevant_tag}"
    else
      :generic_interaction
    end
  end

  def initialize(osm_object)
    @init_object = osm_object
    @seed_loc = world_gen.seed_loc
  end

  def osm_object
    @init_object
  end

  def osm_object_type
    osm_object['nodes'] ? "ways" : "nodes"
  end

  def is_home
    osm_object == @seed_loc
  end

  def world_gen
    @world_gen ||= WorldGenerator.new(@init_object)
  end

  def update_osm_object(changes={})
    REDIS_GEO.hset osm_object_type, osm_object['id'], osm_object.merge(changes.stringify_keys).to_json
    @init_object = JSON.parse REDIS_GEO.hget osm_object_type, osm_object['id']
  end

  def handle_event(event, location)
    extra_text = "#{event[:prefix]} #{event[:text]} #{event[:suffix]}".strip

    unless osm_object['lastInvestigated']
      item = {'name' => "memory: #{event[:memory]} at #{location}",
              'type' => 'memory'}
      User.add_item(item)

      extra_text << "\n\nGained #{item['name']} (new total #{User.item_count(item['name'])})"
    end


    extra_text
  end

  def generic_event_interaction
    buttons = ProcGen.buttons_for(osm_object)
    {text: "A thing is happening!", buttons: buttons}
  end

  def generic_interaction
    if osm_object.fetch('tags', {})['building']
      bldg = world_gen.generate_building(osm_object)
      event = bldg[:event]

      if event
        extra_text = handle_event(bldg[:event], "#{bldg[:name]}, #{bldg[:type].with_indefinite_article}")
      end

      buttons = ProcGen.buttons_for(osm_object)
      {text: bldg[:text].to_s + "\n#{extra_text}", buttons: buttons}
    else
      {text: "Nothing of interest", buttons: [{type: osm_object_type, id: osm_object['id'], text: 'Leave', actionId: 1}]}
    end
  end

  def generate_interaction_for_amenity
    obj_tags = osm_object['tags']
    amenity_type = obj_tags['amenity']
    amenity_type_human = amenity_type.humanize
    amenity_description = amenity_type_human.with_indefinite_article
    items = ProcGen.items_for(osm_object)
    buttons = ProcGen.buttons_for(osm_object)
    if obj_tags['building']
      name = ProcGen.building_name(osm_object, amenity_type)
      amenity_description = "#{name}, #{amenity_description}"
    end


    uses = Concepts.uses_for(amenity_type)
    extra_text = ""
    at_loc = Concepts.at_location(amenity_type)
    if uses.present?
      event = world_gen.event_for_usage(osm_object, uses)
    elsif at_loc.present?
      event = world_gen.event_for_item(osm_object, at_loc)
    end

    if event
      extra_text = handle_event(event, amenity_description)
    end

      text = <<-TEXT
#{amenity_description} is here.

#{extra_text}
      TEXT

      #if items.present?
        #text << <<-TXT

#It has a <proc gen description> #{ProcGen.relative_location(osm_object, @seed_loc)} it
        #TXT
      #end
    # end

    {text: text, items: items, buttons: buttons}
  end
end

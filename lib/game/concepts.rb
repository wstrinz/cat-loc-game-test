class Concepts
  class << self
    def all_data(concept)
      JSON.parse(open("http://conceptnet5.media.mit.edu/data/5.2/c/en/#{concept.to_s.gsub(' ','_')}").read)
    end

    def shortened_data(concept)
      all_data(concept)['edges'].map do |d|
        d.slice(*%w{dataset endLemmas rel score startLemmas})
      end
    end

    def search_for(opts = {})
      default_opts = {text: nil,
                      surfaceText: nil,
                      limit: 50,
                      offset: 0,
                      minWeight: nil,
                      start: nil,
                      end: nil,
                      rel: nil,
                      id: nil,
                      uri: nil,
                      context: nil,
                      features: nil,
                      filter: nil}
      opts = default_opts.merge(opts)

      concept_args = ['/c/en/', :underscore]
      {start: concept_args, end: concept_args, rel: ['/r/', :camelize]}.each do |k, todo|
        opts[k] = todo[1].to_proc.call opts[k] if opts[k]
        opts[k] = "#{todo[0]}#{opts[k]}" if opts[k] && !opts[k][/^\//]
      end

      url = CGI.unescape "http://conceptnet5.media.mit.edu/data/5.2/search?#{opts.compact.to_query}"
      JSON.parse(open(url).read)['edges']
    end

    def uses_for(concept)
      rel = 'UsedFor'
      results = search_for(start: concept, rel: rel)
      if results.blank?
        results = search_for(text: concept, rel: rel)
        if results.blank?
          reverse_use = search_for(end: concept, rel: rel)
          if reverse_use.present?
            results = search_for(start: reverse_use.first['startLemmas'], rel: rel)
          end
        end
      end

      results.map(&[:[], 'endLemmas'])
    end

    def at_location(concept)
      rel = 'AtLocation'
      results = search_for(end: concept, rel: rel)
      if results.blank?
        results = search_for(text: concept, rel: rel)
        if results.blank?
          reverse_use = search_for(start: concept, rel: rel)
          if reverse_use.present?
            results = search_for(end: reverse_use.first['endLemmas'], rel: rel)
          end
        end
      end

      results.map(&[:[], 'startLemmas'])
    end

    def buildings
      db_buildings = REDIS_GAME.lrange('proc_gen_buildings', 0, REDIS_GAME.llen('proc_gen_buildings'))
      return db_buildings if db_buildings.present?

      buildings = WordNet::Lemma.find('building', :noun).synsets.first.hyponym.map(&:words).flatten.uniq
      REDIS_GAME.lpush('proc_gen_buildings', buildings)
      buildings
    end

    def buildings_with_uses
      db_buildings = REDIS_GAME.lrange('proc_gen_useful_buildings', 0, REDIS_GAME.llen('proc_gen_useful_buildings'))
      return db_buildings if db_buildings.present?

      useful = buildings.select{|b| uses_for(b).present?}
      REDIS_GAME.lpush('proc_gen_useful_buildings', useful)
      useful
    end

    def all_hyponyms(word, word_type = :noun)
      if syn = WordNet::Lemma.find(word, word_type).synsets.find do |sy|
                                                                   sy.hyponym.present?
                                                                 end
        syn.hyponym.map(&:words).flatten
      else
        []
      end

    end
  end
end

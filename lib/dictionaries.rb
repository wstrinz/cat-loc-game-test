class Dictionaries
  class << self
    def building_types
      @building_types ||= open('dictionaries/buildings/building_types').read
    end

    def buildings_of_type(type)
      @building_types ||= open('dictionaries/buildings/building_types').read
    end
  end
end

module DictionaryGen
  class SeventhSanctum
    class << self
      GENERATORS = %w{government}
      def generate(type = GENERATORS.sample, n_results = 20)
        results = []

        until results.count >= n_results
          noko = Nokogiri::HTML(open("http://www.seventhsanctum.com/generate.php?Genname=#{type}").read)
          p = noko.css('div.GeneratorResultPrimeBG').map(&:text)
          s = noko.css('div.GeneratorResultSecondaryBG').map(&:text)
          if p.blank? && s.blank?
            p = noko.css('div.GeneratorResultPrimeBGPara').map(&:text)
            s = noko.css('div.GeneratorResultSecondaryBGPara').map(&:text)
            if p.blank? && s.blank?
              return []
            end
          end
          results << p + s
          results = results.flatten
        end
        results.first(n_results)
      end
    end
  end
end

CGSS = DictionaryGen::SeventhSanctum;

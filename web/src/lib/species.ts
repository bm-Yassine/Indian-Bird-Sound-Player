// A short, checkable note for each of the 25 species the model knows.
//
// Deliberately brief: a scientific name, what it looks like, and roughly where
// it lives. Anything more specific belongs on the Wikipedia page each entry
// links to, rather than being half-remembered here.

export type SpeciesInfo = {
  scientificName: string;
  description: string;
  habitat: string;
  wikipedia: string;
};

const wiki = (title: string) => `https://en.wikipedia.org/wiki/${title}`;

export const SPECIES: Record<string, SpeciesInfo> = {
  "Asian Green Bee Eater": {
    scientificName: "Merops orientalis",
    description: "Slender, bright green bird with a black eye-stripe and long central tail feathers. Catches insects in mid-air from a favourite perch.",
    habitat: "Open country, farmland and scrub across the Indian subcontinent and into Africa.",
    wikipedia: wiki("Asian_green_bee-eater"),
  },
  "Brown Headed Barbet": {
    scientificName: "Psilopogon zeylanicus",
    description: "Chunky green barbet with a brown head and a heavy pale bill, more often heard than seen.",
    habitat: "Wooded gardens and groves, especially where fruiting trees grow.",
    wikipedia: wiki("Brown-headed_barbet"),
  },
  "Cattle Egret": {
    scientificName: "Bubulcus ibis",
    description: "Small white heron that turns buff on the head and back when breeding. Famously follows grazing animals for the insects they stir up.",
    habitat: "Pastures, fields and wetland edges, now on every continent except Antarctica.",
    wikipedia: wiki("Cattle_egret"),
  },
  "Common Kingfisher": {
    scientificName: "Alcedo atthis",
    description: "Tiny, brilliant blue-and-orange kingfisher. Usually seen as a flash of blue low over the water.",
    habitat: "Clear, slow rivers, canals and lakes across Eurasia and North Africa.",
    wikipedia: wiki("Common_kingfisher"),
  },
  "Common Myna": {
    scientificName: "Acridotheres tristis",
    description: "Brown bird with a glossy black head, yellow bill and bare yellow skin behind the eye. Bold and very vocal around people.",
    habitat: "Towns, farmland and open country; widely introduced well beyond its native range.",
    wikipedia: wiki("Common_myna"),
  },
  "Common Rosefinch": {
    scientificName: "Carpodacus erythrinus",
    description: "Stocky finch; breeding males are washed rose-red on the head and breast, females plain streaky brown.",
    habitat: "Scrub and woodland edges; breeds across Europe and Asia and winters in the Indian subcontinent.",
    wikipedia: wiki("Common_rosefinch"),
  },
  "Common Tailorbird": {
    scientificName: "Orthotomus sutorius",
    description: "Small warbler with a rufous cap and a cocked tail. Named for stitching leaves together to hold its nest.",
    habitat: "Gardens, thickets and open woodland across tropical Asia.",
    wikipedia: wiki("Common_tailorbird"),
  },
  "Coppersmith Barbet": {
    scientificName: "Psilopogon haemacephalus",
    description: "Small green barbet with a crimson forehead and breast patch. Its steady metallic call gives it its name.",
    habitat: "Gardens, groves and open woodland across southern Asia.",
    wikipedia: wiki("Coppersmith_barbet"),
  },
  "Forest Wagtail": {
    scientificName: "Dendronanthus indicus",
    description: "The only wagtail that swings its tail sideways rather than up and down; olive above with two dark breast bands.",
    habitat: "Shady forest floors and plantations; breeds in East Asia, winters in South and Southeast Asia.",
    wikipedia: wiki("Forest_wagtail"),
  },
  "Gray Wagtail": {
    scientificName: "Motacilla cinerea",
    description: "Long-tailed wagtail, grey above and yellow below, constantly bobbing its tail near water.",
    habitat: "Fast-running streams when breeding; more varied wetlands and towns in winter.",
    wikipedia: wiki("Grey_wagtail"),
  },
  Hoopoe: {
    scientificName: "Upupa epops",
    description: "Unmistakable pinkish-brown bird with black-and-white wings and a fan-shaped crest it raises when startled.",
    habitat: "Open ground with short grass and old trees, across Europe, Asia and Africa.",
    wikipedia: wiki("Hoopoe"),
  },
  "House Crow": {
    scientificName: "Corvus splendens",
    description: "Slim crow with a pale grey neck and breast contrasting with a black face and wings.",
    habitat: "Cities, ports and villages; spread widely by shipping.",
    wikipedia: wiki("House_crow"),
  },
  "Indian Grey Hornbill": {
    scientificName: "Ocyceros birostris",
    description: "Grey hornbill with a long tail and a casque on top of its curved bill; flies with heavy flapping and glides.",
    habitat: "Wooded areas and leafy city suburbs across the Indian subcontinent.",
    wikipedia: wiki("Indian_grey_hornbill"),
  },
  "Indian Peacock": {
    scientificName: "Pavo cristatus",
    description: "The Indian peafowl. Males carry an enormous eye-spotted train they fan in display; females are brown and crestless in pattern.",
    habitat: "Forest edges, farmland and villages; the national bird of India.",
    wikipedia: wiki("Indian_peafowl"),
  },
  "Indian Pitta": {
    scientificName: "Pitta brachyura",
    description: "Stocky, short-tailed bird in improbable colours - green, buff, blue and a crimson vent. Secretive on the forest floor.",
    habitat: "Undergrowth of scrub and deciduous forest; migrates within the subcontinent.",
    wikipedia: wiki("Indian_pitta"),
  },
  "Indian Roller": {
    scientificName: "Coracias benghalensis",
    description: "Brown-and-turquoise bird that flashes brilliant blue wing bands in flight, named for its tumbling display.",
    habitat: "Open country, farmland and roadside wires across southern Asia.",
    wikipedia: wiki("Indian_roller"),
  },
  "Jungle Babbler": {
    scientificName: "Argya striata",
    description: "Drab grey-brown babbler that moves in noisy parties - the reason for its nickname, 'seven sisters'.",
    habitat: "Gardens, scrub and forest across the Indian subcontinent.",
    wikipedia: wiki("Jungle_babbler"),
  },
  "Northern Lapwing": {
    scientificName: "Vanellus vanellus",
    description: "Dark green-glossed plover with a thin wispy crest and broad, rounded wings.",
    habitat: "Farmland, wet meadows and marshes across Eurasia; winters south to India.",
    wikipedia: wiki("Northern_lapwing"),
  },
  "Red Wattled Lapwing": {
    scientificName: "Vanellus indicus",
    description: "Black-headed plover with a white cheek stripe and red skin in front of the eye. Loud and hard to sneak past.",
    habitat: "Open ground near water, farmland and dry riverbeds across South and West Asia.",
    wikipedia: wiki("Red-wattled_lapwing"),
  },
  "Ruddy Shelduck": {
    scientificName: "Tadorna ferruginea",
    description: "Orange-brown duck with a paler head and black flight feathers; often seen in pairs.",
    habitat: "Lakes and large rivers; breeds in Central Asia and winters in the Indian subcontinent.",
    wikipedia: wiki("Ruddy_shelduck"),
  },
  "Rufous Treepie": {
    scientificName: "Dendrocitta vagabunda",
    description: "Long-tailed relative of the crows, rufous-bodied with black and grey wings and a very long graduated tail.",
    habitat: "Open woodland, groves and gardens across the Indian subcontinent.",
    wikipedia: wiki("Rufous_treepie"),
  },
  "Sarus Crane": {
    scientificName: "Antigone antigone",
    description: "The tallest flying bird in the world: grey with a bare red head and upper neck. Pairs stay together for years.",
    habitat: "Wetlands and flooded fields in northern India, Southeast Asia and northern Australia.",
    wikipedia: wiki("Sarus_crane"),
  },
  "White Breasted Kingfisher": {
    scientificName: "Halcyon smyrnensis",
    description: "Also called the white-throated kingfisher: chocolate-brown with a white throat and breast, turquoise back and a heavy red bill. Often hunts far from water.",
    habitat: "Farmland, gardens and wetlands from the Middle East across to Southeast Asia.",
    wikipedia: wiki("White-throated_kingfisher"),
  },
  "White Breasted Waterhen": {
    scientificName: "Amaurornis phoenicurus",
    description: "Dark slate rail with a clean white face and breast, flicking its tail as it walks.",
    habitat: "Reedy marshes, ditches and pond edges across South and Southeast Asia.",
    wikipedia: wiki("White-breasted_waterhen"),
  },
  "White Wagtail": {
    scientificName: "Motacilla alba",
    description: "Trim black, white and grey wagtail with a bobbing tail and a bounding flight.",
    habitat: "Open ground near water, farmyards and car parks across Eurasia; winters into India and Africa.",
    wikipedia: wiki("White_wagtail"),
  },
};

export function speciesInfo(name: string): SpeciesInfo | undefined {
  return SPECIES[name];
}

/** Where the call recording for a species lives. */
export function soundUrl(name: string): string {
  return `/sounds/${name.split(" ").join("_")}.mp3`;
}

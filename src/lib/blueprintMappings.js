// Mapping of parser material names to display info, in order of spritesheet.
export const MATERIAL_MAPPINGS = {
  // Row 1
  Brick: { id: "brick", name: "Brick" },
  BronzeIngot: { id: "bronze-ingot", name: "Bronze Ingot" },
  BronzeRivet: { id: "bronze-rivet", name: "Bronze Rivet" },
  ChamomileSeed: { id: "chamomile-seeds", name: "Chamomile Seeds" },
  // Row 2
  Clay: { id: "clay", name: "Clay" },
  CopperBearing: { id: "copper-bearing", name: "Copper Bearing" },
  CopperIngot: { id: "copper-ingot", name: "Copper Ingot" },
  GentianSeed: { id: "gentian-seeds", name: "Gentian Seeds" },
  // Row 3
  FlaxSeed: { id: "flax-seeds", name: "Flax Seeds" },
  Glass: { id: "glass", name: "Glass" },
  GloomFungus: { id: "gloomfungus", name: "Gloomfungus" },
  GoldIngot: { id: "gold-ingot", name: "Gold Ingot" },
  // Row 4
  LargeWoodGear: { id: "large-wooden-gear", name: "Large Wood Gear" },
  IronIngot: { id: "iron-ingot", name: "Iron Ingot" },
  Nails: { id: "iron-nails", name: "Nails" },
  LavenderSeed: { id: "lavender-seeds", name: "Lavender Seeds" },
  // Row 5
  Logs: { id: "logs", name: "Logs" },
  LinenRope: { id: "linen-rope", name: "Linen Rope" },
  WoodBoard: { id: "plank", name: "Wood Board" },
  RedcurrantSeed: { id: "redcurrant-seeds", name: "Redcurrant Seeds" },
  // Row 6
  RottenLog: { id: "rotten-log", name: "Rotten Log" },
  PortalSigil: { id: "portal-sigil", name: "Portal Sigil" },
  SageSeed: { id: "sage-seeds", name: "Sage Seeds" },
  SteelGear: { id: "steel-gear", name: "Steel Gear" },
  // Row 7
  SilverIngot: { id: "silver-ingot", name: "Silver Ingot" },
  WoodGear: { id: "small-wooden-gear", name: "Wood Gear" },
  SteelIngot: { id: "steel-ingot", name: "Steel Ingot" },
  Stone: { id: "stone", name: "Stone" },
  // Row 8
  WorldTreeSeed: { id: "world-tree-seeds", name: "World Tree Seeds" },
  Linen: { id: "linen", name: "Linen" },
  // Default
  None: { id: "none", name: "None" },
};

// Mapping of parser building names to display info, in order of spritesheet.
export const BUILDING_MAPPINGS = {
  // Row 1
  "Omni-Machine": { id: "omni-machine", name: "Advanced Assembler" },
  AdvancedAthanor: { id: "advancedathanor", name: "Advanced Athanor" },
  AdvancedShaper: { id: "advancedshaper", name: "Advanced Shaper" },
  AdvancedBlender: { id: "advancedblender", name: "Advanced Blender", aliases: ["AdvancedBlender_Sym"] },
  // Row 2
  Alembic: { id: "alembic", name: "Alembic" },
  ArcaneProcessor: { id: "arcaneprocessor", name: "Arcane Processor" },
  AetherShaper: { id: "arcaneshaper", name: "Arcane Shaper" },
  Assembler: { id: "assembler", name: "Assembler", aliases: ["Assembler_Sym"] },
  // Row 3
  Athanor: { id: "athanor", name: "Athanor", hidePerUnit: true },
  AutoCheckout: { id: "autocheckout", name: "Auto Checkout" },
  AutoNursery: { id: "autonursery", name: "Auto Nursery" },
  Belt: { id: "belt", name: "Belt" },
  // Row 4
  Beam3: { id: "beam3", name: "Beam", aliases: ["Beam5", "Beam10", "Beam18"], hidePerUnit: true },
  BeltInclinedUp: { id: "beltinclinedup", name: "Belt Inclined Up", aliases: ["BeltInclinedDown"] },
  BeltSlopeUp: { id: "beltslopeup", name: "Belt Slope Up", aliases: ["BeltSlopeDown"] },
  NoticeBoard: { id: "noticeboard", name: "Notice Board", aliases: ["NoticeBoard_2"] },
  // Row 5
  BlastFurnace: { id: "blastfurnace", name: "Blast Furnace" },
  Blender: { id: "blender", name: "Blender" },
  BounceShroom: { id: "bounceshroom", name: "Bounce Shroom" },
  BrickBlock: { id: "brickblock", name: "Brick Block" },
  // Row 6
  BronzeBlock: { id: "bronzeblock", name: "Bronze Block" },
  CandleHanging: { id: "candle_hanging", name: "Candle Hanging" },
  Candle: { id: "candle", name: "Candle" },
  Cannon: { id: "cannon", name: "Cannon" },
  // Row 7
  catapult: { id: "catapult", name: "Catapult" },
  Cauldron: { id: "cauldron", name: "Cauldron" },
  CoinBalance: { id: "coinbalance", name: "Coin Balance" },
  CheckoutTable: { id: "checkouttable", name: "Checkout Table" },
  // Row 8
  Column: { id: "column", name: "Column" },
  ConicalFlask: { id: "conicalflask", name: "Conical Flask"},
  ConveyerLift_Upwards: { id: "conveyerlift_upwards", name: "Conveyer Lift Upwards", hidePerUnit: true },
  ConveyorTunnel: { id: "conveyortunnel", name: "Conveyor Tunnel" },
  // Row 9
  CopperBlock: { id: "copperblock", name: "Copper Block" },
  CrossTunnel: { id: "crosstunnel", name: "Crossway Tunnel" },
  Crucible: { id: "crucible", name: "Crucible" },
  Portal_Wholesaling: { id: "portal_wholesaling", name: "Dispatch Portal" },
  // Row 10
  DrawBridge: { id: "drawbridge", name: "Draw Bridge", aliases: ["DrawBridgeR"] },
  EnhancedGrinder: { id: "enhancedgrinder", name: "Enhanced Grinder" },
  Extractor: { id: "extractor", name: "Extractor" },
  Filter_Vert: { id: "filter_vert", name: "Filter Splitter", aliases: ["Filter_Sym"] },
  // Row 11
  FrameSingle: { id: "framesingle", name: "Frame Single", hidePerUnit: true },
  GoldBlock: { id: "goldblock", name: "Gold Block" },
  Grinder: { id: "grinder", name: "Grinder" },
  IronBlock: { id: "ironblock", name: "Iron Block" },
  // Row 12
  Hopper: { id: "hopper", name: "Hopper" },
  IronSmelter: { id: "ironsmelter", name: "Iron Smelter" },
  JewelryStand: { id: "jewelrystand", name: "Jewelry Stand" },
  JunkBarrel: { id: "junkbarrel", name: "Junk Barrel" },
  // Row 13
  Kiln: { id: "kiln", name: "Kiln" },
  KnowledgeAltar: { id: "knowledgealtar", name: "Knowledge Altar" },
  IronStand: { id: "ironstand", name: "Lab Stands", aliases: ["IronStandDuo"], hidePerUnit: true },
  MediumStand: { id: "mediumstand", name: "Medium Stand" },
  // Row 14
  LargeStand: { id: "largestand", name: "Large Stand" },
  MetalContainer: { id: "metalcontainer", name: "Metal Container" },
  MetalStand: { id: "metalstand", name: "Metal Stand" },
  ModularWall: { id: "modularwall", name: "Modular Wall" },
  // Row 15
  ModularFloor: { id: "modularfloor", name: "Modular Floor" },
  ParadoxCrucible: { id: "paradoxcrucible", name: "Paradox Crucible" },
  Platform_Wood: { id: "platformwood", name: "Platform Wood" },
  PotionStand: { id: "potionstand", name: "Potion Stand" },
  // Row 16
  Portal_Bank: { id: "portal_bank", name: "Portal Bank" },
  Pipe: { id: "pipe", name: "Pipe", aliases: ["Pipe_Vertical"], hidePerUnit: true },
  Merger_Vert: { id: "merger_vert", name: "Priority Merger", aliases: ["Merger_Sym"] },
  Splitter_Vert: { id: "splitter_vert", name: "Priority Splitter", aliases: ["Splitter"] },
  // Row 17
  Processor: { id: "processor", name: "Processor", aliases: ["Processor_Sym"], hidePerUnit: true },
  Portal_AlchGuild: { id: "portal_alchguild", name: "Purchasing Portal" },
  RailRamp: { id: "railramp", name: "Rail Ramp" },
  RailStation: { id: "railstation", name: "Rail Station" },
  // Row 18
  RailDown: { id: "raildown", name: "Rail Down" },
  RailRoad: { id: "railroad", name: "Railroad" },
  RailTurn: { id: "railturn", name: "Rail Turn" },
  RailUp: { id: "railup", name: "Rail Up" },
  // Row 19
  SmallPlatform: { id: "smallplatform", name: "Reinforced Platform", aliases: ["MediumPlatform", "CrossPlatform"] },
  Refiner: { id: "refiner", name: "Refiner" },
  RoofHalf: { id: "roofhalf", name: "Roof Half" },
  SeedPlot: { id: "seedplot", name: "Seed Plot" },
  // Row 20
  SilverBlock: { id: "silverblock", name: "Silver Block" },
  Shaper: { id: "shaper", name: "Shaper" },
  RelicStandSmall: { id: "relicstandsmall", name: "Relic Stand Small" },
  SimpleCrate: { id: "simplecrate", name: "Simple Crate" },
  // Row 21
  SmallContainer: { id: "smallcontainer", name: "Small Container", aliases: ["SmallContainer_Side", "SmallContainer_Sym", "SmallContainer_Vert", "SmallContainer_Vert_Sym"], hidePerUnit: true },
  SmallBase: { id: "smallbase", name: "Small Base" },
  SphereFlask: { id: "sphereflask", name: "Sphere Flask" },
  StackableCrucible: { id: "stackablecrucible", name: "Stackable Crucible" },
  // Row 22
  Stairs2Wood: { id: "stairs2wood", name: "Stairs 2 Wood" },
  StoneBlock: { id: "stoneblock", name: "Stone Block" },
  StairsWood: { id: "stairswood", name: "Stairs Wood" },
  StoneFurnace: { id: "stonefurnace", name: "Stone Furnace" },
  // Row 23
  StoneCrusher: { id: "stonecrusher", name: "Stone Crusher" },
  StoneStove: { id: "stonestove", name: "Stone Stove" },
  TableSaw: { id: "tablesaw", name: "Table Saw" },
  ThermalExtractor: { id: "thermalextractor", name: "Thermal Extractor" },
  // Row 24
  StoneWall: { id: "stonewall", name: "Stone Wall" },
  Trolley: { id: "trolley", name: "Trolley" },
  VerticalSplitter: { id: "verticalsplitter", name: "Vertical Splitter" },
  WallShelf: { id: "wallshelf", name: "Wall Shelf" },
  // Row 25
  WoodBed: { id: "woodbed", name: "Wood Bed" },
  WoodContainer: { id: "woodcontainer", name: "Wood Container", aliases: ["WoodContainer_Vert"] },
  WoodBlock: { id: "woodblock", name: "Wood Block" },
  WoodCrate: { id: "woodcrate", name: "Wood Crate" },
  // Row 26
  WoodGrinder: { id: "woodgrinder", name: "Wood Grinder" },
  WoodRailing: { id: "woodrailing", name: "Wood Railing" },
  WoodTable: { id: "woodtable", name: "Wood Table" },
  Workbench: { id: "workbench", name: "Workbench" },
  // Row 27
  WorldTreeNursery: { id: "worldtreenursery", name: "World Tree Nursery" },
  AdvancedAlembic: { id: "advancedalembic", name: "Advanced Alembic" },
  LiquidSupplier: { id: "liquidsupplier", name: "Liquid Supplier" },
};

// Transform parsed materials data from the parser API to our format
export function transformParsedMaterials(parsedMaterials) {
  if (!parsedMaterials || typeof parsedMaterials !== 'object' || Array.isArray(parsedMaterials)) {
    return [];
  }
  
  try {
    return Object.entries(parsedMaterials)
      .filter(([name, quantity]) => name !== "None" && quantity > 0)
      .map(([name, quantity]) => {
        const mapping = MATERIAL_MAPPINGS[name];
        return {
          id: mapping?.id || name.toLowerCase(),
          name: mapping?.name || name,
          quantity: quantity,
        };
      })
      .sort((a, b) => b.quantity - a.quantity);
  } catch (error) {
    console.error("Error transforming materials:", error);
    return [];
  }
}

// Transform parsed buildings data from the parser API to our format
export function transformParsedBuildings(parsedBuildings) {
  if (!parsedBuildings || typeof parsedBuildings !== 'object' || Array.isArray(parsedBuildings)) {
    return [];
  }
  
  try {
    return Object.entries(parsedBuildings)
      .filter(([name, quantity]) => quantity > 0)
      .map(([name, quantity]) => {
        const mapping = BUILDING_MAPPINGS[name];
        return {
          id: mapping?.id || name.toLowerCase(),
          name: mapping?.name || name,
          quantity: quantity,
        };
      })
      .sort((a, b) => b.quantity - a.quantity);
  } catch (error) {
    console.error("Error transforming buildings:", error);
    return [];
  }
}
